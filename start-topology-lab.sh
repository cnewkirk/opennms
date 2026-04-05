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
