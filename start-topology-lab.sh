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
# Phase 2b: Configure bridge multicast forwarding for LLDP
# ---------------------------------------------------------------------------
# Linux bridges drop IEEE reserved multicast (01:80:c2:00:00:00-0f) by default.
# LLDP uses 01:80:c2:00:00:0e (bit 14 = 0x4000 in group_fwd_mask).
# Multicast snooping must also be disabled (no IGMP querier in lab).
# This must be done inside the podman VM via `podman machine ssh`.
echo ""
echo "==> [2b] Configuring bridge multicast forwarding for LLDP..."

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
    echo "    configured LLDP forwarding: ${net} -> ${br}"
  fi
done

if [[ -n "$BRIDGE_CMDS" ]]; then
  podman machine ssh -- "bash -c '${BRIDGE_CMDS}exit 0'" 2>/dev/null || \
    echo "    WARNING: could not configure bridge multicast (rootless/non-VM mode?)"
fi

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

echo "    FRR configs staged for all 5 nodes."

# ---------------------------------------------------------------------------
# Phase 4: Start containers
# ---------------------------------------------------------------------------
echo ""
echo "==> [4/7] Starting topology nodes..."

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

  podman run -d --privileged \
    --name "${name}" \
    --hostname "${hostname}" \
    -e "ROLE=${role}" \
    -v "${frr_dir}:/etc/frr:ro" \
    "${net_args[@]}" \
    "${TOPO_IMAGE}"

  echo "    started: ${name} (mgmt: ${mgmt_ip}, role: ${role})"
done

# ---------------------------------------------------------------------------
# Phase 5: Attach test-opennms to management network
# ---------------------------------------------------------------------------
echo ""
echo "==> [5/7] Attaching test-opennms to ${MGMT_NET}..."

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
# Phase 5b: Configure 30-second data collection step (lab-only override)
# ---------------------------------------------------------------------------
echo ""
echo "==> [5b] Configuring 30s SNMP collection step in OpenNMS..."

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

# Purge stale topology nodes from any prior foreign-source name variants
# (e.g. lowercase 'topology-lab' vs 'Topology-Lab') to prevent duplicates
# appearing in the topology view.
STALE_IDS=$(PGPASSWORD=notdefault psql -h localhost -p 5432 -U opennms opennms -tAq \
  -c "SELECT nodeid FROM node WHERE foreignsource NOT IN ('Topology-Lab','selfmonitor')
      AND (nodelabel ILIKE 'spine-%' OR nodelabel ILIKE 'leaf-%');" 2>/dev/null || true)
if [[ -n "$STALE_IDS" ]]; then
  for id in $STALE_IDS; do
    curl -s -o /dev/null -u admin:notdefault -X DELETE \
      "http://localhost:8980/opennms/rest/nodes/$id"
  done
  echo "    removed stale topology nodes: $STALE_IDS"
fi

# ---------------------------------------------------------------------------
# Phase 6: Drop requisition and trigger import
# ---------------------------------------------------------------------------
echo ""
echo "==> [6/7] Provisioning topology nodes into OpenNMS..."

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
        AND snmpinterface.snmpifname IN ('eth0','eth1','eth2','eth3')
        AND snmpinterface.snmpifspeed > 1000000000;" 2>/dev/null || true
echo "    patched snmpifspeed to 1 Gbps for all topology interfaces"

# ---------------------------------------------------------------------------
# Phase 7: Wait for OSPF convergence
# ---------------------------------------------------------------------------
echo ""
echo "==> [7/7] Waiting for OSPF convergence (cap: 120s)..."

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
