#!/usr/bin/env bash
# start-topology-lab.sh
# Spins up a 5-node leaf/spine topology lab alongside test-opennms.
# Nodes run FRR (OSPF + ISIS) + lldpd (LLDP) + net-snmp for EnLinkd testing.
#
# Usage:
#   ./start-topology-lab.sh             # start lab (teardown + rebuild if running)
#   ./start-topology-lab.sh --teardown  # teardown only
#   ./start-topology-lab.sh --rebuild   # force image rebuild

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOPO_IMAGE="localhost/opennms/topology-node:latest"
FRR_BASE="quay.io/frrouting/frr:9.1.0"

TEARDOWN_ONLY=false
FORCE_REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --teardown) TEARDOWN_ONLY=true ;;
    --rebuild)  FORCE_REBUILD=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Node definitions: name, mgmt-ip, role, and P2P network assignments
# ---------------------------------------------------------------------------
# Format: "name mgmt-ip role net1:iface1:ip1 [net2:iface2:ip2] ..."
NODES=(
  "topo-spine-01 10.100.0.11 spine topo-s1-l1:eth1:10.101.1.1 topo-s1-l2:eth2:10.101.2.1 topo-s1-l3:eth3:10.101.3.1"
  "topo-spine-02 10.100.0.12 spine topo-s2-l1:eth1:10.101.4.1 topo-s2-l2:eth2:10.101.5.1 topo-s2-l3:eth3:10.101.6.1"
  "topo-leaf-01  10.100.0.21 leaf  topo-s1-l1:eth1:10.101.1.2 topo-s2-l1:eth2:10.101.4.2"
  "topo-leaf-02  10.100.0.22 leaf  topo-s1-l2:eth1:10.101.2.2 topo-s2-l2:eth2:10.101.5.2"
  "topo-leaf-03  10.100.0.23 leaf  topo-s1-l3:eth1:10.101.3.2 topo-s2-l3:eth2:10.101.6.2"
)

MGMT_NET="topology-mgmt"
MGMT_SUBNET="10.100.0.0/24"
P2P_NETS=(
  "topo-s1-l1:10.101.1.0/30"
  "topo-s1-l2:10.101.2.0/30"
  "topo-s1-l3:10.101.3.0/30"
  "topo-s2-l1:10.101.4.0/30"
  "topo-s2-l2:10.101.5.0/30"
  "topo-s2-l3:10.101.6.0/30"
)

# ---------------------------------------------------------------------------
# Teardown
# ---------------------------------------------------------------------------
teardown() {
  echo "==> Tearing down topology lab..."

  # Remove containers
  for node_def in "${NODES[@]}"; do
    name=$(echo "$node_def" | awk '{print $1}')
    podman rm -f "$name" 2>/dev/null && echo "    removed container: $name" || true
  done

  # Disconnect OpenNMS from management network
  podman network disconnect "${MGMT_NET}" test-opennms 2>/dev/null && \
    echo "    disconnected test-opennms from ${MGMT_NET}" || true

  # Remove staged FRR configs
  rm -rf "${SCRIPT_DIR}/.topology-lab" 2>/dev/null && echo "    removed staged configs" || true

  # Remove networks
  podman network rm -f "${MGMT_NET}" 2>/dev/null && echo "    removed network: ${MGMT_NET}" || true
  for entry in "${P2P_NETS[@]}"; do
    net="${entry%%:*}"
    podman network rm -f "$net" 2>/dev/null && echo "    removed network: $net" || true
  done

  echo "==> Teardown complete."
}

if [[ "${TEARDOWN_ONLY}" == "true" ]]; then
  teardown
  exit 0
fi

# Always tear down first for clean state
teardown

# ---------------------------------------------------------------------------
# Phase 1: Build topology-node image
# ---------------------------------------------------------------------------
echo ""
echo "==> [1/7] Building topology-node image..."

if podman image exists "${TOPO_IMAGE}" && [[ "${FORCE_REBUILD}" == "false" ]]; then
  echo "    Image already exists, skipping build (use --rebuild to force)"
else
  BUILD_DIR="$(mktemp -d)"
  trap 'rm -rf "$BUILD_DIR"' EXIT

  # ---- snmpd.conf ----
  cat > "${BUILD_DIR}/snmpd.conf" <<'SNMPD'
master agentx
agentXSocket /var/agentx/master
rocommunity public
syslocation "OpenNMS Topology Lab"
syscontact "admin@localhost"
SNMPD

  # ---- entrypoint.sh ----
  cat > "${BUILD_DIR}/entrypoint.sh" <<'ENTRY'
#!/bin/bash
set -e

# Create AgentX socket directory
mkdir -p /var/agentx
chmod 755 /var/agentx

# Start snmpd (master AgentX agent) — must be up before subagents connect
/usr/sbin/snmpd -Lo -p /tmp/snmpd.pid -c /etc/snmp/snmpd.conf
sleep 1

# For leaf nodes: create bridge interface for Bridge-MIB
if [[ "${ROLE}" == "leaf" ]]; then
  ip link add br0 type bridge 2>/dev/null || true
  ip link add dummy0 type dummy 2>/dev/null || true
  ip link set dummy0 master br0 2>/dev/null || true
  ip link set br0 up
  ip link set dummy0 up
fi

# Start lldpd as AgentX subagent (-x = AgentX, -d = debug/foreground logs)
lldpd -x &
sleep 1

# Start FRR (zebra + ospfd + isisd via watchfrr)
exec /usr/lib/frr/docker-start
ENTRY
  chmod +x "${BUILD_DIR}/entrypoint.sh"

  # ---- Dockerfile ----
  cat > "${BUILD_DIR}/Dockerfile" <<DOCKERFILE
FROM ${FRR_BASE}
USER root
RUN apk update && apk add --no-cache \
    lldpd \
    net-snmp \
    net-snmp-tools \
    iproute2
RUN mkdir -p /var/agentx
COPY snmpd.conf /etc/snmp/snmpd.conf
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
DOCKERFILE

  echo "    Building ${TOPO_IMAGE}..."
  podman build --no-cache -t "${TOPO_IMAGE}" "${BUILD_DIR}"
  echo "    Build complete."
fi

# ---------------------------------------------------------------------------
# Phase 2: Create networks
# ---------------------------------------------------------------------------
echo ""
echo "==> [2/7] Creating podman networks..."

podman network create --subnet "${MGMT_SUBNET}" "${MGMT_NET}"
echo "    created: ${MGMT_NET} (${MGMT_SUBNET})"

for entry in "${P2P_NETS[@]}"; do
  net="${entry%%:*}"
  subnet="${entry##*:}"
  podman network create --subnet "${subnet}" "${net}"
  echo "    created: ${net} (${subnet})"
done

# ---------------------------------------------------------------------------
# Phase 3: Stage per-node FRR configs
# ---------------------------------------------------------------------------
echo ""
echo "==> [3/7] Staging FRR configs..."

# Fixed location so bind-mount paths survive manual container restarts
CONFIGS="${SCRIPT_DIR}/.topology-lab/configs"
rm -rf "${CONFIGS}"
mkdir -p "${CONFIGS}"
echo "    config staging dir: ${CONFIGS}"

# vtysh.conf is identical for all nodes
VTYSH_CONF="service integrated-vtysh-config"

# ---- spine-01 ----
mkdir -p "${CONFIGS}/spine-01"
cat > "${CONFIGS}/spine-01/daemons" <<'DAEMONS'
zebra=yes
ospfd=yes
isisd=yes
bgpd=no
ripd=no
ospf6d=no
DAEMONS
cat > "${CONFIGS}/spine-01/vtysh.conf" <<< "${VTYSH_CONF}"
cat > "${CONFIGS}/spine-01/frr.conf" <<'FRR'
frr version 9.1
frr defaults traditional
hostname spine-01
agentx
!
interface lo
 ip address 10.255.0.11/32
!
interface eth1
 description link-to-leaf-01
 ip address 10.101.1.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description link-to-leaf-02
 ip address 10.101.2.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth3
 description link-to-leaf-03
 ip address 10.101.3.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
router ospf
 ospf router-id 10.255.0.11
 network 10.255.0.11/32 area 0.0.0.0
!
router isis FABRIC
 net 49.0001.0aff.000b.00
 is-type level-2-only
 metric-style wide
!
FRR

# ---- spine-02 ----
mkdir -p "${CONFIGS}/spine-02"
cat > "${CONFIGS}/spine-02/daemons" <<'DAEMONS'
zebra=yes
ospfd=yes
isisd=yes
bgpd=no
ripd=no
ospf6d=no
DAEMONS
cat > "${CONFIGS}/spine-02/vtysh.conf" <<< "${VTYSH_CONF}"
cat > "${CONFIGS}/spine-02/frr.conf" <<'FRR'
frr version 9.1
frr defaults traditional
hostname spine-02
agentx
!
interface lo
 ip address 10.255.0.12/32
!
interface eth1
 description link-to-leaf-01
 ip address 10.101.4.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description link-to-leaf-02
 ip address 10.101.5.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth3
 description link-to-leaf-03
 ip address 10.101.6.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
router ospf
 ospf router-id 10.255.0.12
 network 10.255.0.12/32 area 0.0.0.0
!
router isis FABRIC
 net 49.0001.0aff.000c.00
 is-type level-2-only
 metric-style wide
!
FRR

# ---- leaf-01 ----
mkdir -p "${CONFIGS}/leaf-01"
cat > "${CONFIGS}/leaf-01/daemons" <<'DAEMONS'
zebra=yes
ospfd=yes
isisd=yes
bgpd=no
ripd=no
ospf6d=no
DAEMONS
cat > "${CONFIGS}/leaf-01/vtysh.conf" <<< "${VTYSH_CONF}"
cat > "${CONFIGS}/leaf-01/frr.conf" <<'FRR'
frr version 9.1
frr defaults traditional
hostname leaf-01
agentx
!
interface lo
 ip address 10.255.0.21/32
!
interface eth1
 description uplink-to-spine-01
 ip address 10.101.1.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description uplink-to-spine-02
 ip address 10.101.4.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
router ospf
 ospf router-id 10.255.0.21
 network 10.255.0.21/32 area 0.0.0.0
!
router isis FABRIC
 net 49.0001.0aff.0015.00
 is-type level-2-only
 metric-style wide
!
FRR

# ---- leaf-02 ----
mkdir -p "${CONFIGS}/leaf-02"
cat > "${CONFIGS}/leaf-02/daemons" <<'DAEMONS'
zebra=yes
ospfd=yes
isisd=yes
bgpd=no
ripd=no
ospf6d=no
DAEMONS
cat > "${CONFIGS}/leaf-02/vtysh.conf" <<< "${VTYSH_CONF}"
cat > "${CONFIGS}/leaf-02/frr.conf" <<'FRR'
frr version 9.1
frr defaults traditional
hostname leaf-02
agentx
!
interface lo
 ip address 10.255.0.22/32
!
interface eth1
 description uplink-to-spine-01
 ip address 10.101.2.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description uplink-to-spine-02
 ip address 10.101.5.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
router ospf
 ospf router-id 10.255.0.22
 network 10.255.0.22/32 area 0.0.0.0
!
router isis FABRIC
 net 49.0001.0aff.0016.00
 is-type level-2-only
 metric-style wide
!
FRR

# ---- leaf-03 ----
mkdir -p "${CONFIGS}/leaf-03"
cat > "${CONFIGS}/leaf-03/daemons" <<'DAEMONS'
zebra=yes
ospfd=yes
isisd=yes
bgpd=no
ripd=no
ospf6d=no
DAEMONS
cat > "${CONFIGS}/leaf-03/vtysh.conf" <<< "${VTYSH_CONF}"
cat > "${CONFIGS}/leaf-03/frr.conf" <<'FRR'
frr version 9.1
frr defaults traditional
hostname leaf-03
agentx
!
interface lo
 ip address 10.255.0.23/32
!
interface eth1
 description uplink-to-spine-01
 ip address 10.101.3.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description uplink-to-spine-02
 ip address 10.101.6.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 isis circuit-type level-2-only
 isis network point-to-point
!
router ospf
 ospf router-id 10.255.0.23
 network 10.255.0.23/32 area 0.0.0.0
!
router isis FABRIC
 net 49.0001.0aff.0017.00
 is-type level-2-only
 metric-style wide
!
FRR

echo "    FRR configs staged for all 5 nodes."
