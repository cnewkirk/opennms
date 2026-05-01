#!/usr/bin/env bash
# start-topology-lab.sh
# Spins up a 7-node leaf/spine/host topology lab alongside test-opennms.
# Spine/leaf nodes run FRR (OSPF + ISIS) + lldpd + net-snmp for EnLinkd testing.
# Host nodes run lldpd + net-snmp only (dual-homed to leaf pair, no routing).
#
# Usage:
#   ./start-topology-lab.sh             # start lab (teardown + rebuild if running)
#   ./start-topology-lab.sh --teardown  # teardown only
#   ./start-topology-lab.sh --rebuild   # force image rebuild

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOPO_IMAGE="localhost/opennms/topology-node:latest"
FRR_BASE="alpine:3.19"

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
  "topo-leaf-01  10.100.0.21 leaf  topo-s1-l1:eth1:10.101.1.2 topo-s2-l1:eth2:10.101.4.2 topo-l1-h1:eth3:10.102.1.1"
  "topo-leaf-02  10.100.0.22 leaf  topo-s1-l2:eth1:10.101.2.2 topo-s2-l2:eth2:10.101.5.2 topo-l2-h1:eth3:10.102.2.1 topo-l2-h2:eth4:10.102.3.1"
  "topo-leaf-03  10.100.0.23 leaf  topo-s1-l3:eth1:10.101.3.2 topo-s2-l3:eth2:10.101.6.2 topo-l3-h2:eth3:10.102.4.1"
  "topo-host-01  10.100.0.31 host  topo-l1-h1:eth1:10.102.1.2 topo-l2-h1:eth2:10.102.2.2"
  "topo-host-02  10.100.0.32 host  topo-l2-h2:eth1:10.102.3.2 topo-l3-h2:eth2:10.102.4.2"
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
  "topo-l1-h1:10.102.1.0/30"
  "topo-l2-h1:10.102.2.0/30"
  "topo-l2-h2:10.102.3.0/30"
  "topo-l3-h2:10.102.4.0/30"
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

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
if ! podman inspect test-opennms --format '{{.State.Running}}' 2>/dev/null | grep -q true; then
  echo "ERROR: test-opennms container is not running. Start OpenNMS first." >&2
  exit 1
fi

# Always tear down first for clean state
teardown

# ---------------------------------------------------------------------------
# Phase 1: Build topology-node image
# ---------------------------------------------------------------------------
echo ""
echo "==> [1/8] Building topology-node image..."

if podman image exists "${TOPO_IMAGE}" && [[ "${FORCE_REBUILD}" == "false" ]]; then
  echo "    Image already exists, skipping build (use --rebuild to force)"
else
  BUILD_DIR="$(mktemp -d)"
  trap 'rm -rf "$BUILD_DIR"' EXIT

  # ---- snmpd.conf ----
  cat > "${BUILD_DIR}/snmpd.conf" <<'SNMPD'
master agentx
agentXSocket /var/agentx/master
agentXPerms 0666 0755
rocommunity public
syslocation "OpenNMS Topology Lab"
syscontact "admin@localhost"

# Override reported speed for ALL virtual ethernet interfaces.
# Podman/virtio-net reports 10 Gbps for every interface; cap everything at
# 1 Gbps so the weathermap's pickBestInterface (highest-speed wins) doesn't
# select eth0 (management) as the utilization interface.
# Type 6 = ethernetCsmacd (IANAifType).  Speed in bits/sec.
interface eth0 6 1000000000
interface eth1 6 1000000000
interface eth2 6 1000000000
interface eth3 6 1000000000
interface eth4 6 1000000000
SNMPD

  # ---- entrypoint.sh ----
  cat > "${BUILD_DIR}/entrypoint.sh" <<'ENTRY'
#!/bin/bash
set -e

# Create AgentX socket directory
mkdir -p /var/agentx
chmod 755 /var/agentx

# FRR runtime dirs
mkdir -p /var/run/frr /var/log/frr
chown frr:frr /var/run/frr /var/log/frr 2>/dev/null || true

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

# Start lldpd as AgentX subagent (-x = AgentX)
lldpd -x &
sleep 1

# Hosts don't run FRR — just keep the container alive
if [[ "${ROLE}" == "host" ]]; then
  exec tail -f /dev/null
fi

# Start FRR (zebra + ospfd + isisd via watchfrr, same as docker-start)
source /usr/lib/frr/frrcommon.sh
exec /usr/lib/frr/watchfrr $(daemon_list)
ENTRY
  chmod +x "${BUILD_DIR}/entrypoint.sh"

  # ---- Dockerfile ----
  cat > "${BUILD_DIR}/Dockerfile" <<DOCKERFILE
FROM ${FRR_BASE}
RUN apk update && apk add --no-cache \
    frr \
    frr-snmp \
    lldpd \
    net-snmp \
    net-snmp-tools \
    iproute2
RUN mkdir -p /var/agentx /var/run/frr /var/log/frr /etc/frr && \
    addgroup -S frr 2>/dev/null || true && \
    adduser -S -G frr frr 2>/dev/null || true && \
    chown frr:frr /var/run/frr /var/log/frr /etc/frr
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
echo "==> [2/8] Creating podman networks..."

podman network create --subnet "${MGMT_SUBNET}" "${MGMT_NET}"
echo "    created: ${MGMT_NET} (${MGMT_SUBNET})"

for entry in "${P2P_NETS[@]}"; do
  net="${entry%%:*}"
  subnet="${entry##*:}"
  podman network create --subnet "${subnet}" "${net}"
  echo "    created: ${net} (${subnet})"
done

# ---------------------------------------------------------------------------
# Phase 2b: Collect bridge names for LLDP forwarding (applied after Phase 4)
# ---------------------------------------------------------------------------
# Linux bridges drop IEEE reserved multicast (01:80:c2:00:00:00-0f) by default.
# LLDP uses 01:80:c2:00:00:0e (bit 14 = 0x4000 in group_fwd_mask).
# Multicast snooping must also be disabled (no IGMP querier in lab).
# NOTE: podman resets bridge settings when containers attach, so we apply
# these settings after Phase 4 (container startup), not here.

ALL_NETS=("${MGMT_NET}")
for entry in "${P2P_NETS[@]}"; do
  ALL_NETS+=("${entry%%:*}")
done

BRIDGE_CMDS=""
for net in "${ALL_NETS[@]}"; do
  br=$(podman network inspect "$net" 2>/dev/null \
       | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['network_interface'])" 2>/dev/null || true)
  if [[ -n "$br" ]]; then
    BRIDGE_CMDS+="echo 0 > /sys/class/net/${br}/bridge/multicast_snooping 2>/dev/null;"
    BRIDGE_CMDS+="echo 0x4000 > /sys/class/net/${br}/bridge/group_fwd_mask 2>/dev/null;"
  fi
done

# ---------------------------------------------------------------------------
# Phase 3: Stage per-node FRR configs
# ---------------------------------------------------------------------------
echo ""
echo "==> [3/8] Staging FRR configs..."

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
watchfrr_enable=yes
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000 -M zebra_snmp"
ospfd_options="  -A 127.0.0.1 -M ospfd_snmp"
isisd_options="  -A 127.0.0.1 -M isisd_snmp"
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
 isis passive
 ip router isis FABRIC
!
interface eth1
 description link-to-leaf-01
 ip address 10.101.1.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description link-to-leaf-02
 ip address 10.101.2.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth3
 description link-to-leaf-03
 ip address 10.101.3.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
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
watchfrr_enable=yes
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000 -M zebra_snmp"
ospfd_options="  -A 127.0.0.1 -M ospfd_snmp"
isisd_options="  -A 127.0.0.1 -M isisd_snmp"
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
 isis passive
 ip router isis FABRIC
!
interface eth1
 description link-to-leaf-01
 ip address 10.101.4.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description link-to-leaf-02
 ip address 10.101.5.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth3
 description link-to-leaf-03
 ip address 10.101.6.1/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
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
watchfrr_enable=yes
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000 -M zebra_snmp"
ospfd_options="  -A 127.0.0.1 -M ospfd_snmp"
isisd_options="  -A 127.0.0.1 -M isisd_snmp"
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
 isis passive
 ip router isis FABRIC
!
interface eth1
 description uplink-to-spine-01
 ip address 10.101.1.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description uplink-to-spine-02
 ip address 10.101.4.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
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
watchfrr_enable=yes
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000 -M zebra_snmp"
ospfd_options="  -A 127.0.0.1 -M ospfd_snmp"
isisd_options="  -A 127.0.0.1 -M isisd_snmp"
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
 isis passive
 ip router isis FABRIC
!
interface eth1
 description uplink-to-spine-01
 ip address 10.101.2.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description uplink-to-spine-02
 ip address 10.101.5.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
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
watchfrr_enable=yes
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000 -M zebra_snmp"
ospfd_options="  -A 127.0.0.1 -M ospfd_snmp"
isisd_options="  -A 127.0.0.1 -M isisd_snmp"
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
 isis passive
 ip router isis FABRIC
!
interface eth1
 description uplink-to-spine-01
 ip address 10.101.3.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
 isis circuit-type level-2-only
 isis network point-to-point
!
interface eth2
 description uplink-to-spine-02
 ip address 10.101.6.2/30
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
 ip router isis FABRIC
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

echo "    FRR configs staged for all 5 routing nodes."

# ---------------------------------------------------------------------------
# Phase 4: Start containers
# ---------------------------------------------------------------------------
echo ""
echo "==> [4/8] Starting topology nodes..."

# Each entry in NODES: "name mgmt-ip role net1:iface1:ip1 ..."
for node_def in "${NODES[@]}"; do
  read -ra parts <<< "$node_def"
  name="${parts[0]}"
  mgmt_ip="${parts[1]}"
  role="${parts[2]}"
  # Derive the short hostname (strip "topo-" prefix)
  hostname="${name#topo-}"
  # Derive frr config dir from hostname
  frr_dir="${CONFIGS}/${hostname}"

  # Build --network args as array: management first (eth0), then P2P links
  net_args=(
    "--network" "${MGMT_NET}:interface_name=eth0,ip=${mgmt_ip}"
  )
  for net_entry in "${parts[@]:3}"; do
    net="${net_entry%%:*}"
    rest="${net_entry#*:}"
    iface="${rest%%:*}"
    ip="${rest##*:}"
    net_args+=("--network" "${net}:interface_name=${iface},ip=${ip}")
  done

  # Hosts don't run FRR — skip the config bind mount
  frr_vol_arg=()
  if [[ "${role}" != "host" ]]; then
    frr_vol_arg=("-v" "${frr_dir}:/etc/frr:ro")
  fi

  podman run -d --privileged \
    --name "${name}" \
    --hostname "${hostname}" \
    -e "ROLE=${role}" \
    "${frr_vol_arg[@]}" \
    "${net_args[@]}" \
    "${TOPO_IMAGE}"

  echo "    started: ${name} (mgmt: ${mgmt_ip}, role: ${role})"
done

# ---------------------------------------------------------------------------
# Phase 4b: Apply bridge multicast forwarding for LLDP
# ---------------------------------------------------------------------------
# Applied after container startup because podman resets bridge settings when
# containers attach to networks.
echo ""
echo "==> [5/8] Configuring bridge multicast forwarding for LLDP..."

if [[ -n "$BRIDGE_CMDS" ]]; then
  podman machine ssh -- "bash -c '${BRIDGE_CMDS}exit 0'" 2>/dev/null && \
    echo "    LLDP forwarding enabled on ${#ALL_NETS[@]} bridges" || \
    echo "    WARNING: could not configure bridge multicast (rootless/non-VM mode?)"
fi

# ---------------------------------------------------------------------------
# Phase 5: Attach test-opennms to management network
# ---------------------------------------------------------------------------
echo ""
echo "==> [6/8] Attaching test-opennms to ${MGMT_NET}..."

if podman network inspect "${MGMT_NET}" \
     --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null \
   | grep -q "test-opennms"; then
  echo "    already connected, skipping"
else
  podman network connect \
    --ip 10.100.0.10 \
    "${MGMT_NET}" test-opennms
  echo "    connected test-opennms (10.100.0.10)"
fi

# ---------------------------------------------------------------------------
# Phase 5b: Configure 30-second data collection step + SNMP range
# ---------------------------------------------------------------------------
echo ""
echo "==> [5b] Configuring SNMP range and 30s collection step in OpenNMS..."

# Extend the SNMP port-161 range to cover the full management subnet so that
# host nodes (.31, .32) don't fall through to the default port-1161 config.
podman exec test-opennms sed -i \
  's|range begin="10.100.0.10" end="10.100.0.25"|range begin="10.100.0.10" end="10.100.0.99"|' \
  /opt/opennms/etc/snmp-config.xml
echo "    snmp-config.xml: extended range to 10.100.0.10–.99 (port 161)"

# Ensure EnLinkd logs at WARN so that debug-mode leftovers from interactive
# sessions don't flood the executor thread pool's log appender and slow
# collection. The rescan intervals are 30s; if logging itself takes CPU cycles
# the queue backs up and host nodes never get scheduled.
podman exec test-opennms sed -i \
  's|key="enlinkd" value="[A-Z]*"|key="enlinkd" value="WARN"|' \
  /opt/opennms/etc/log4j2.xml
echo "    log4j2.xml: enlinkd logger -> WARN"

# Patch collectd-configuration.xml: 300s → 30s SNMP service interval
podman exec test-opennms sed -i \
  's/service name="SNMP" interval="[0-9]*"/service name="SNMP" interval="30000"/g' \
  /opt/opennms/etc/collectd-configuration.xml
echo "    collectd-configuration.xml: SNMP interval -> 30000ms"

# Patch datacollection-config.xml: 300s → 30s RRD step so newly created
# RRD files have 30s resolution rather than the default 300s.
podman exec test-opennms sed -i \
  's/<rrd step="300">/<rrd step="30">/g' \
  /opt/opennms/etc/datacollection-config.xml
echo "    datacollection-config.xml: rrd step -> 30s"

# Purge any stale Topology-Lab RRD data from a prior run so files are
# (re)created from scratch with the new 30s step on this run's first poll.
podman exec test-opennms rm -rf \
  /opt/opennms/share/rrd/snmp/fs/Topology-Lab 2>/dev/null || true
echo "    purged stale Topology-Lab RRD data"

# Reload collectd to pick up both config changes
curl -s -u admin:notdefault \
  -H "Content-Type: application/xml" \
  -X POST "http://localhost:8980/opennms/rest/events" \
  -d '<event><uei>uei.opennms.org/internal/reloadDaemonConfig</uei><parms><parm><parmName>daemonName</parmName><value>Collectd</value></parm></parms></event>' \
  >/dev/null
echo "    collectd reload triggered"

# Purge stale nodes via REST API (psql port is not mapped, so we use the REST
# API instead). Remove every node that is NOT from a known foreign source —
# this catches prior-run Topology-Lab remnants, auto-discovered duplicates,
# and extraneous test nodes (e.g. UI-Test-Node at 192.0.2.1) that would fill
# the EnLinkd executor queue and starve host nodes from getting LLDP collected.
echo "    Scanning for stale nodes via REST..."
STALE_IDS=$(curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes?limit=500" 2>/dev/null | \
  python3 -c "
import sys, re
data = sys.stdin.read()
# Parse foreignSource and id from XML attribute pairs
nodes = re.findall(r'<node[^>]+>', data)
stale = []
for tag in nodes:
    fs = re.search(r'foreignSource=\"([^\"]*)\"', tag)
    nid = re.search(r'\bid=\"([^\"]*)\"', tag)
    if not nid:
        continue
    fs_val = fs.group(1) if fs else ''
    if fs_val not in ('Topology-Lab', 'selfmonitor'):
        stale.append(nid.group(1))
print(' '.join(stale))
" 2>/dev/null || true)
if [[ -n "$STALE_IDS" ]]; then
  for nid in $STALE_IDS; do
    curl -s -o /dev/null -u admin:notdefault -X DELETE \
      "http://localhost:8980/opennms/rest/nodes/${nid}"
  done
  echo "    removed stale nodes: ${STALE_IDS}"
else
  echo "    no stale nodes found"
fi

# ---------------------------------------------------------------------------
# Phase 6: Drop requisition and trigger import
# ---------------------------------------------------------------------------
echo ""
echo "==> [7/8] Provisioning topology nodes into OpenNMS..."

REQ_FILE="$(mktemp)"
trap 'rm -f "${REQ_FILE}"' EXIT
cat > "${REQ_FILE}" <<'REQUISITION'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<model-import xmlns="http://xmlns.opennms.org/xsd/config/model-import"
    date-stamp="2026-04-05T00:00:00.000Z"
    foreign-source="Topology-Lab"
    last-import="2026-04-05T00:00:00.000Z">
  <node node-label="spine-01" foreign-id="topo-spine-01">
    <interface ip-addr="10.100.0.11" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <node node-label="spine-02" foreign-id="topo-spine-02">
    <interface ip-addr="10.100.0.12" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <node node-label="leaf-01" foreign-id="topo-leaf-01">
    <interface ip-addr="10.100.0.21" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <node node-label="leaf-02" foreign-id="topo-leaf-02">
    <interface ip-addr="10.100.0.22" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <node node-label="leaf-03" foreign-id="topo-leaf-03">
    <interface ip-addr="10.100.0.23" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <node node-label="host-01" foreign-id="topo-host-01">
    <interface ip-addr="10.100.0.31" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <node node-label="host-02" foreign-id="topo-host-02">
    <interface ip-addr="10.100.0.32" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
</model-import>
REQUISITION

podman cp "${REQ_FILE}" test-opennms:/opt/opennms/etc/imports/Topology-Lab.xml

# Trigger import via REST (provisiond picks it up within seconds)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -u admin:notdefault \
  -X PUT \
  "http://localhost:8980/opennms/rest/requisitions/Topology-Lab/import?rescanExisting=true")
if [[ "${HTTP_CODE}" == "202" ]]; then
  echo "    Import triggered (HTTP 202)"
else
  echo "    WARNING: import REST call returned HTTP ${HTTP_CODE} (may still work if file was copied)"
fi

# Provisiond scans interfaces immediately at startup before the snmpd interface-speed
# override is stable, so it records 10 Gbps (virtio-net kernel default) instead of
# 1 Gbps. Wait briefly for the initial scan to complete, then patch the DB directly.
echo "    Waiting for initial SNMP scan to complete..."
sleep 30
PGPASSWORD=notdefault psql -h localhost -p 5432 -U opennms opennms -q \
  -c "UPDATE snmpinterface SET snmpifspeed = 1000000000
      FROM node WHERE node.nodeid = snmpinterface.nodeid
        AND node.foreignsource = 'Topology-Lab'
        AND snmpinterface.snmpifname IN ('eth0','eth1','eth2','eth3','eth4')
        AND snmpinterface.snmpifspeed > 1000000000;" 2>/dev/null || true
echo "    patched snmpifspeed to 1 Gbps for all topology interfaces"

# Delete any auto-discovered nodes that EnLinkd created during the scan window.
# EnLinkd processes LLDP neighbors from the leaf nodes and creates new node
# records for anything it can't match to an existing provisioned node — these
# duplicates then consume executor queue slots and starve host-01/host-02 from
# getting their own LLDP collection scheduled. We delete them here and reload
# EnLinkd so it starts fresh with only the 7 provisioned topology nodes.
echo "    Cleaning up EnLinkd auto-discovered duplicate nodes..."
AUTO_DISC=$(curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes?limit=500" 2>/dev/null | \
  python3 -c "
import sys, re
data = sys.stdin.read()
nodes = re.findall(r'<node[^>]+>', data)
stale = []
for tag in nodes:
    fs = re.search(r'foreignSource=\"([^\"]*)\"', tag)
    nid = re.search(r'\bid=\"([^\"]*)\"', tag)
    if not nid:
        continue
    fs_val = fs.group(1) if fs else ''
    if fs_val not in ('Topology-Lab', 'selfmonitor'):
        stale.append(nid.group(1))
print(' '.join(stale))
" 2>/dev/null || true)
if [[ -n "$AUTO_DISC" ]]; then
  for nid in $AUTO_DISC; do
    curl -s -o /dev/null -u admin:notdefault -X DELETE \
      "http://localhost:8980/opennms/rest/nodes/${nid}"
  done
  echo "    deleted auto-discovered nodes: ${AUTO_DISC}"
else
  echo "    no auto-discovered nodes to clean up"
fi

# Reload EnLinkd after the cleanup so it starts a fresh collection cycle with
# only the 7 provisioned nodes, clearing any queued tasks for deleted nodes.
curl -s -u admin:notdefault \
  -H "Content-Type: application/xml" \
  -X POST "http://localhost:8980/opennms/rest/events" \
  -d '<event><uei>uei.opennms.org/internal/reloadDaemonConfig</uei><parms><parm><parmName>daemonName</parmName><value>EnLinkd</value></parm></parms></event>' \
  >/dev/null
echo "    EnLinkd reloaded for clean topology collection"

# ---------------------------------------------------------------------------
# Phase 7: Wait for OSPF convergence
# ---------------------------------------------------------------------------
echo ""
echo "==> [8/8] Waiting for OSPF convergence (cap: 120s)..."

CONVERGED=false
for i in $(seq 1 24); do
  # Check spine-01 has 3 Full OSPF neighbors
  count=$(podman exec topo-spine-01 vtysh -c "show ip ospf neighbor" 2>/dev/null \
          | grep -c "Full/" || true)
  if [[ "${count}" -ge 3 ]]; then
    CONVERGED=true
    echo "    OSPF converged after $((i * 5))s (spine-01 sees ${count} Full neighbors)"
    break
  fi
  printf "    ... waiting (%ds, spine-01 Full neighbors: %d/3)\r" "$((i * 5))" "${count}"
  sleep 5
done
echo ""

if [[ "${CONVERGED}" == "false" ]]; then
  echo "ERROR: OSPF did not converge within 120s. Diagnostics:" >&2
  echo "--- spine-01 ospf neighbors ---" >&2
  podman exec topo-spine-01 vtysh -c "show ip ospf neighbor" >&2 || true
  echo "--- spine-01 isis neighbors ---" >&2
  podman exec topo-spine-01 vtysh -c "show isis neighbor" >&2 || true
  echo "--- spine-01 lldp neighbors ---" >&2
  podman exec topo-spine-01 lldpcli show neighbors >&2 || true
  exit 1
fi

# Wait for EnLinkd to establish topology links for host-01 and host-02.
# Without this gate the script can declare success before the topology map
# reflects the actual leaf-host connections.
echo "    Waiting for host topology links in EnLinkd (cap: 120s)..."
HOST_TOPO=false
for i in $(seq 1 24); do
  host_edges=$(curl -s -u admin:notdefault \
    "http://localhost:8980/opennms/api/v2/graphs/enlinkd" 2>/dev/null | \
    python3 -c "
import sys, json, re
try:
    d = json.load(sys.stdin)
    labels = {}
    for g in d.get('graphs', []):
        for v in g.get('vertices', []):
            labels[v['id']] = v.get('label', '')
    host_edges = 0
    seen = set()
    for g in d.get('graphs', []):
        for e in g.get('edges', []):
            src = e.get('source', {}).get('id', '')
            tgt = e.get('target', {}).get('id', '')
            pair = tuple(sorted([src, tgt]))
            if pair in seen:
                continue
            seen.add(pair)
            if 'host' in labels.get(src,'').lower() or 'host' in labels.get(tgt,'').lower():
                host_edges += 1
    print(host_edges)
except:
    print(0)
" 2>/dev/null || echo 0)
  if [[ "${host_edges}" -ge 2 ]]; then
    HOST_TOPO=true
    echo "    Host topology links established after $((i * 5))s (${host_edges} host edges)"
    break
  fi
  printf "    ... waiting (%ds, host edges: %d/2)\r" "$((i * 5))" "${host_edges}"
  sleep 5
done
echo ""

if [[ "${HOST_TOPO}" == "false" ]]; then
  echo "WARNING: Host topology links not established within 120s — topology map may be incomplete" >&2
fi

# ---------------------------------------------------------------------------
# Phase 8: Start traffic generator
# ---------------------------------------------------------------------------
echo ""
echo "==> [+] Starting traffic generator..."

LOADGEN="${SCRIPT_DIR}/topology-lab-load-gen.py"
if [[ -f "${LOADGEN}" ]]; then
  nohup python3 -u "${LOADGEN}" --max-mbps 1000 --interval 30 \
    > "${SCRIPT_DIR}/.topology-lab/load-gen.log" 2>&1 &
  echo $! > "${SCRIPT_DIR}/.topology-lab/load-gen.pid"
  echo "    load-gen started (PID $(cat "${SCRIPT_DIR}/.topology-lab/load-gen.pid"))"
  echo "    log: .topology-lab/load-gen.log"
else
  echo "    WARNING: load-gen.py not found at ${LOADGEN} — skipping traffic generation"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo " Topology Lab is UP"
echo "============================================================"
echo ""
echo " Nodes:"
for node_def in "${NODES[@]}"; do
  read -ra parts <<< "$node_def"
  printf "   %-18s  %s  (%s)\n" "${parts[0]}" "${parts[1]}" "${parts[2]}"
done
echo ""
echo " Verify topology layers:"
echo "   OSPF:  podman exec topo-spine-01 vtysh -c 'show ip ospf neighbor'"
echo "   ISIS:  podman exec topo-spine-01 vtysh -c 'show isis neighbor'"
echo "   LLDP:  podman exec topo-spine-01 lldpcli show neighbors"
echo "   SNMP:  snmpwalk -v2c -c public 10.100.0.11 LLDP-MIB::lldpRemTable"
echo ""
echo " Wait ~30-60s for EnLinkd to collect, then open:"
echo "   http://localhost:8980/opennms/  → navigate to /#/topology"
echo ""
echo " Teardown:  ./start-topology-lab.sh --teardown"
echo "============================================================"
