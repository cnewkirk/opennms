# Topology Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a 5-node leaf/spine virtual network (FRR + lldpd + net-snmp) alongside the test container, provisioned into OpenNMS so EnLinkd can discover and display real LLDP, OSPF, ISIS, Bridge, and IpNetToMedia topology.

**Architecture:** A single `start-topology-lab.sh` script creates 7 podman networks, builds a custom `topology-node` image (FRR 9.1 + lldpd + net-snmp), starts 5 containers (2 spines + 3 leaves) with explicit interface-to-network assignments, attaches `test-opennms` to the management network, drops a requisition, and polls for OSPF convergence. All FRR configs, the Dockerfile, the entrypoint scripts, and the requisition XML are heredocs inside the script — no committed auxiliary files. The overlay image (`build-dark-mode-overlay.sh`) is extended to include a 30s EnLinkd rescan config and a SNMP range for 10.100.0.0/24.

**Tech Stack:** podman, FRR 9.1 (ospfd + isisd + zebra), lldpd, net-snmp (snmpd with AgentX master), bash, OpenNMS REST API

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `build-dark-mode-overlay.sh` | Modify | Add `enlinkd-configuration.xml` (30s rescan) + extend `snmp-config.xml` with topology-lab range |
| `start-topology-lab.sh` | Create | Full orchestration: image build, networks, containers, OpenNMS provisioning, convergence check |
| `stop-topology-lab.sh` | Create | Teardown helper |

---

## Task 1: Extend the overlay image with EnLinkd config + SNMP range

**Files:**
- Modify: `build-dark-mode-overlay.sh`

The test container needs to be rebuilt after this task. EnLinkd's default rescan intervals are 86400000ms (24h) — useless for testing. We set them all to 30s. The SNMP range for 10.100.0.0/24 on port 161 tells OpenNMS how to poll the topology-lab nodes.

- [ ] **Step 1: Update the `snmp-config.xml` heredoc** in `build-dark-mode-overlay.sh` (currently at the line starting `cat > "${OVERLAY_DIR}/etc/snmp-config.xml" <<'SNMPCFG'`). Replace the entire heredoc with:

```bash
cat > "${OVERLAY_DIR}/etc/snmp-config.xml" <<'SNMPCFG'
<snmp-config xmlns="http://xmlns.opennms.org/xsd/config/snmp"
    version="v2c" read-community="public" port="1161" timeout="1800" retry="1">
  <definition version="v2c" read-community="public" port="1161">
    <specific>127.0.0.1</specific>
  </definition>
  <definition version="v2c" read-community="public" port="161">
    <range begin="10.100.0.10" end="10.100.0.25"/>
  </definition>
</snmp-config>
SNMPCFG
```

- [ ] **Step 2: Add the `enlinkd-configuration.xml` heredoc** immediately after the snmp-config block (before the `echo "    snmpd.conf + ..."` line):

```bash
cat > "${OVERLAY_DIR}/etc/enlinkd-configuration.xml" <<'ENLINKD'
<?xml version="1.0" encoding="ISO-8859-1"?>
<enlinkd-configuration threads="3"
                     executor-queue-size="100"
                     executor-threads="5"
                     discovery-bridge-threads="1"
                     initial_sleep_time="30000"
                     bridge_topology_interval="30000"
                     topology_interval="30000"
                     cdp_rescan_interval="30000"
                     lldp_rescan_interval="30000"
                     bridge_rescan_interval="30000"
                     ospf_rescan_interval="30000"
                     isis_rescan_interval="30000"
                     cdp-priority="1000"
                     lldp-priority="2000"
                     bridge-priority="10000"
                     ospf-priority="3000"
                     isis-priority="4000"
                     use-cdp-discovery="true"
                     use-bridge-discovery="true"
                     use-lldp-discovery="true"
                     use-ospf-discovery="true"
                     use-isis-discovery="true"
                     disable-bridge-vlan-discovery="false"
                     max_bft="100"
                     />
ENLINKD
```

- [ ] **Step 3: Add the COPY directive** for `enlinkd-configuration.xml` in the Dockerfile heredoc (inside `build-dark-mode-overlay.sh`). Find the line:
```
COPY --chown=10001:10001 etc/snmp-config.xml /opt/opennms/etc/snmp-config.xml
```
Add immediately after it:
```dockerfile
COPY --chown=10001:10001 etc/enlinkd-configuration.xml /opt/opennms/etc/enlinkd-configuration.xml
```

- [ ] **Step 4: Update the echo confirmation line** (the one that says `snmpd.conf + entrypoint-wrapper.sh + snmp-config.xml + imports/Self.xml: staged`) to also mention enlinkd-configuration.xml:
```bash
echo "    snmpd.conf + entrypoint-wrapper.sh + snmp-config.xml + enlinkd-configuration.xml + imports/Self.xml: staged"
```

- [ ] **Step 5: Rebuild the overlay image**
```bash
./build-dark-mode-overlay.sh 2>&1 | tail -20
```
Expected: `==> Build complete: localhost/opennms/horizon:35.0.5-dark-mode`

- [ ] **Step 6: Verify enlinkd-configuration.xml is in the image**
```bash
podman run --rm --entrypoint cat localhost/opennms/horizon:35.0.5-dark-mode \
  /opt/opennms/etc/enlinkd-configuration.xml | grep lldp_rescan
```
Expected: `lldp_rescan_interval="30000"`

- [ ] **Step 7: Commit**
```bash
git add build-dark-mode-overlay.sh
git commit -m "feat(topology-lab): 30s enlinkd rescan + snmp range for test fabric"
```

---

## Task 2: Create `start-topology-lab.sh` — skeleton and topology-node image

**Files:**
- Create: `start-topology-lab.sh`

This task writes the script header, flag parsing, helper functions, and Phase 1 (image build). The topology-node Dockerfile, entrypoints, and snmpd.conf are all heredocs.

- [ ] **Step 1: Create `start-topology-lab.sh`** with the following content:

```bash
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
FRR_BASE="docker.io/frrouting/frr:9.1.0"

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
RUN apt-get update && apt-get install -y --no-install-recommends \
    lldpd \
    snmpd \
    snmp \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/agentx
COPY snmpd.conf /etc/snmp/snmpd.conf
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
DOCKERFILE

  echo "    Building ${TOPO_IMAGE}..."
  podman build --no-cache -t "${TOPO_IMAGE}" "${BUILD_DIR}"
  echo "    Build complete."
fi
```

- [ ] **Step 2: Make the script executable**
```bash
chmod +x start-topology-lab.sh
```

- [ ] **Step 3: Test the image build phase in isolation**
```bash
./start-topology-lab.sh --rebuild 2>&1 | head -40
```
Expected: image build completes, you see `Build complete.` (will fail later when trying to create networks, that's fine — we haven't written those phases yet)

- [ ] **Step 4: Verify the image was built and has the right tools**
```bash
podman run --rm localhost/opennms/topology-node:latest which lldpd
podman run --rm localhost/opennms/topology-node:latest which snmpd
podman run --rm localhost/opennms/topology-node:latest which ospfd
```
Expected: `/usr/sbin/lldpd`, `/usr/sbin/snmpd`, `/usr/lib/frr/ospfd` (or similar paths)

- [ ] **Step 5: Commit**
```bash
git add start-topology-lab.sh
git commit -m "feat(topology-lab): add start script skeleton + topology-node image build"
```

---

## Task 3: Phase 2 — Network creation + Phase 3 — FRR config staging

**Files:**
- Modify: `start-topology-lab.sh` (append after the Phase 1 block)

- [ ] **Step 1: Append the network creation phase** to `start-topology-lab.sh` (after the Phase 1 closing `fi`):

```bash
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
```

- [ ] **Step 2: Run to verify networks and configs are created**
```bash
./start-topology-lab.sh 2>&1 | head -60
```
Expected output ends with `FRR configs staged for all 5 nodes.` (will fail at Phase 4 which doesn't exist yet)

- [ ] **Step 3: Verify networks exist**
```bash
podman network ls | grep -E "topology-mgmt|topo-s"
```
Expected: 7 networks listed

- [ ] **Step 4: Teardown to reset**
```bash
./start-topology-lab.sh --teardown
podman network ls | grep -E "topology-mgmt|topo-s"
```
Expected: no networks in the grep output

- [ ] **Step 5: Commit**
```bash
git add start-topology-lab.sh
git commit -m "feat(topology-lab): add network creation + FRR config staging phases"
```

---

## Task 4: Phase 4 — Container launch

**Files:**
- Modify: `start-topology-lab.sh` (append after Phase 3)

- [ ] **Step 1: Append the container launch phase** to `start-topology-lab.sh`:

```bash
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
```

- [ ] **Step 2: Run through Phase 4**
```bash
./start-topology-lab.sh 2>&1 | head -80
```
Expected: all 5 containers started (will fail at Phase 5 which doesn't exist yet)

- [ ] **Step 3: Verify containers are running**
```bash
podman ps --filter "name=topo-" --format "{{.Names}}\t{{.Status}}"
```
Expected: 5 rows, all `Up`

- [ ] **Step 4: Spot-check FRR is running inside a spine**
```bash
podman exec topo-spine-01 vtysh -c "show version" 2>&1 | head -5
```
Expected: `FRRouting 9.1.0` (or similar)

- [ ] **Step 5: Spot-check lldpd is running**
```bash
podman exec topo-spine-01 lldpcli show chassis | head -5
```
Expected: chassis info for spine-01

- [ ] **Step 6: Spot-check snmpd is running**
```bash
podman exec topo-spine-01 snmpwalk -v2c -c public 127.0.0.1 sysName.0
```
Expected: `SNMPv2-MIB::sysName.0 = STRING: spine-01`

- [ ] **Step 7: Teardown + commit**
```bash
./start-topology-lab.sh --teardown
git add start-topology-lab.sh
git commit -m "feat(topology-lab): add container launch phase"
```

---

## Task 5: Phase 5+6 — OpenNMS attachment and requisition import

**Files:**
- Modify: `start-topology-lab.sh` (append after Phase 4)

- [ ] **Step 1: Append the OpenNMS integration phase** to `start-topology-lab.sh`:

```bash
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
# Phase 6: Drop requisition and trigger import
# ---------------------------------------------------------------------------
echo ""
echo "==> [6/7] Provisioning topology nodes into OpenNMS..."

REQ_FILE="$(mktemp)"
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
rm -f "${REQ_FILE}"

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
```

- [ ] **Step 2: Run through Phase 6** (requires `test-opennms` to be running and healthy)
```bash
./start-topology-lab.sh 2>&1 | grep -E "^\s*(==>|    )"
```
Expected: all 6 phases complete without errors

- [ ] **Step 3: Verify test-opennms is on the management network**
```bash
podman network inspect topology-mgmt --format '{{range .Containers}}{{.Name}} {{end}}'
```
Expected: output includes `test-opennms` and all 5 `topo-*` containers

- [ ] **Step 4: Verify the requisition file landed**
```bash
podman exec test-opennms cat /opt/opennms/etc/imports/Topology-Lab.xml | grep node-label
```
Expected: 5 `node-label` attributes (spine-01, spine-02, leaf-01, leaf-02, leaf-03)

- [ ] **Step 5: Wait ~30s, then verify nodes appear in OpenNMS**
```bash
sleep 30
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes?category=Topology-Lab" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"count\"]} nodes')"
```
Expected: `5 nodes`

- [ ] **Step 6: Teardown + commit**
```bash
./start-topology-lab.sh --teardown
git add start-topology-lab.sh
git commit -m "feat(topology-lab): add OpenNMS attach + requisition import phase"
```

---

## Task 6: Phase 7 — Convergence check and summary

**Files:**
- Modify: `start-topology-lab.sh` (append after Phase 6)

- [ ] **Step 1: Append the convergence check phase** to `start-topology-lab.sh`:

```bash
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
```

- [ ] **Step 2: Run the full script end-to-end** (requires running `test-opennms`)
```bash
./start-topology-lab.sh
```
Expected: completes with `Topology Lab is UP` summary

- [ ] **Step 3: Verify OSPF on both spines**
```bash
podman exec topo-spine-01 vtysh -c "show ip ospf neighbor"
podman exec topo-spine-02 vtysh -c "show ip ospf neighbor"
```
Expected: each spine shows 3 neighbors in `Full/` state

- [ ] **Step 4: Verify ISIS on spine-01**
```bash
podman exec topo-spine-01 vtysh -c "show isis neighbor"
```
Expected: 3 entries in `Up` state

- [ ] **Step 5: Verify LLDP on spine-01**
```bash
podman exec topo-spine-01 lldpcli show neighbors
```
Expected: 3 neighbor entries (leaf-01, leaf-02, leaf-03)

- [ ] **Step 6: Commit**
```bash
git add start-topology-lab.sh
git commit -m "feat(topology-lab): add convergence check + summary phase"
```

---

## Task 7: Create `stop-topology-lab.sh`

**Files:**
- Create: `stop-topology-lab.sh`

- [ ] **Step 1: Create `stop-topology-lab.sh`**:

```bash
#!/usr/bin/env bash
# stop-topology-lab.sh — Tears down the topology lab.
# Equivalent to: ./start-topology-lab.sh --teardown
set -euo pipefail
exec "$(dirname "$0")/start-topology-lab.sh" --teardown
```

- [ ] **Step 2: Make executable and verify**
```bash
chmod +x stop-topology-lab.sh
./stop-topology-lab.sh
podman ps --filter "name=topo-" --format "{{.Names}}"
```
Expected: no output (containers removed)

- [ ] **Step 3: Commit**
```bash
git add stop-topology-lab.sh
git commit -m "feat(topology-lab): add stop-topology-lab.sh teardown helper"
```

---

## Task 8: End-to-end topology layer verification

This task runs the full lab and verifies each topology layer is visible in OpenNMS via SNMP and the topology API. Run with `test-opennms` healthy and using the freshly rebuilt overlay image from Task 1.

- [ ] **Step 1: Rebuild the overlay image** (picks up enlinkd-configuration.xml from Task 1)
```bash
./build-dark-mode-overlay.sh 2>&1 | tail -5
```
Expected: `==> Build complete: localhost/opennms/horizon:35.0.5-dark-mode`

- [ ] **Step 2: Restart test-opennms with the new image**
```bash
podman rm -f test-opennms 2>/dev/null || true
podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms \
  -e OPENNMS_DBUSER=opennms \
  -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
```

- [ ] **Step 3: Wait for OpenNMS to be healthy**
```bash
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -u admin:admin http://localhost:8980/opennms/rest/info || echo 0)
  [[ "$code" == "200" ]] && echo "ready" && break
  echo "  waiting... (${i}/12)"
  sleep 5
done
```
Expected: `ready` within 60s

- [ ] **Step 4: Set password**
```bash
HASH=$(podman exec test-opennms java -cp /opt/opennms/lib/jasypt-1.9.3.jar \
  org.jasypt.intf.cli.JasyptStringDigestCLI \
  input='notdefault' algorithm=SHA-256 saltSizeBytes=16 iterations=100000 2>/dev/null \
  | tail -3 | head -1)
podman exec test-opennms sed -i \
  "s|<password salt=\"true\">.*</password>|<password salt=\"true\">${HASH}</password>|" \
  /opt/opennms/etc/users.xml
```

- [ ] **Step 5: Start the topology lab**
```bash
./start-topology-lab.sh
```
Expected: `Topology Lab is UP`

- [ ] **Step 6: Verify SNMP LLDP-MIB on spine-01**
```bash
snmpwalk -v2c -c public 10.100.0.11 LLDP-MIB::lldpRemTable 2>&1 | head -20
```
Expected: OID entries for 3 remote neighbors

- [ ] **Step 7: Verify SNMP OSPF-MIB on spine-01**
```bash
snmpwalk -v2c -c public 10.100.0.11 OSPF-MIB::ospfNbrTable 2>&1 | head -20
```
Expected: entries for 3 OSPF neighbors

- [ ] **Step 8: Verify Bridge-MIB on leaf-01**
```bash
snmpwalk -v2c -c public 10.100.0.21 BRIDGE-MIB::dot1dBase 2>&1
```
Expected: `dot1dBaseNumPorts`, `dot1dBaseType` entries for br0

- [ ] **Step 9: Verify IpNetToMedia on spine-01**
```bash
snmpwalk -v2c -c public 10.100.0.11 IP-MIB::ipNetToMediaTable 2>&1 | head -10
```
Expected: ARP entries showing IPs on the P2P subnets

- [ ] **Step 10: Wait for EnLinkd to collect (~60s), then check topology API**
```bash
sleep 60
curl -s -u admin:notdefault \
  http://localhost:8980/opennms/api/v2/graphs \
  | python3 -m json.tool | grep -A2 '"id"'
```
Expected: enlinkd graph container entries (lldp, ospf, isis, bridge, ipnettomedia namespaces)

- [ ] **Step 11: Open topology viewer and visually confirm leaf/spine graph**

Navigate to `http://localhost:8980/opennms/` → `/#/topology`. Select the EnLinkd LLDP layer. Expected: 5 nodes with spine-01 and spine-02 connected to all three leaf nodes, no cross-spine or cross-leaf links.

- [ ] **Step 12: Final commit**
```bash
git add docs/superpowers/plans/2026-04-05-topology-lab.md
git commit -m "docs: add topology lab implementation plan"
```
