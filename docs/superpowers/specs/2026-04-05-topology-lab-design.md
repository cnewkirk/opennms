# Topology Lab Design

**Date:** 2026-04-05
**Branch:** feature/jmx-config-vue
**Status:** Approved

## Context

The Vue 3 topology SPA (`/ui#/topology`) queries `/api/v2/graphs/{containerId}/{namespace}` to render an EnLinkd topology graph. With only the `OpenNMS-Self` node provisioned in the test container, the topology viewer has nothing meaningful to show — no links, no structure.

The goal is a `start-topology-lab.sh` script that spins up a realistic 5-node leaf/spine topology alongside the running `test-opennms` container, provisions all nodes into OpenNMS, and lets EnLinkd collect real topology data via LLDP, OSPF, ISIS, Bridge, and IpNetToMedia.

CDP is excluded — it is Cisco-proprietary and requires licensed images.

## Architecture

5 nodes: 2 spines + 3 leaves. Each leaf has uplinks to both spines. Spines do not interconnect (pure leaf/spine).

```
spine-01          spine-02
  |  \   \      /   /  |
  |   \   \    /   /   |
leaf-01  leaf-02  leaf-03
```

Each node is a container running:
- **FRR** (zebra + ospfd + isisd) — real OSPF/ISIS adjacencies on P2P links
- **lldpd** — real LLDP frames, registers LLDP-MIB via AgentX
- **net-snmp** (snmpd master agent) — OpenNMS polls this for all MIBs

Leaf nodes additionally have a Linux bridge (`br0`) with a `dummy0` slave, giving net-snmp a real bridge to report via dot1d Bridge-MIB.

IpNetToMedia (ARP table) is served automatically by net-snmp from the kernel ARP cache — no extra config needed.

## Network Topology

Two tiers:

**Management network** (`topology-mgmt`, 10.100.0.0/24) — all 5 nodes + OpenNMS. Used exclusively for SNMP polling. No routing protocols run here.

| Node | Management IP |
|---|---|
| test-opennms | 10.100.0.10 |
| spine-01 | 10.100.0.11 |
| spine-02 | 10.100.0.12 |
| leaf-01 | 10.100.0.21 |
| leaf-02 | 10.100.0.22 |
| leaf-03 | 10.100.0.23 |

**Six P2P link networks** — OSPF/ISIS/LLDP adjacencies form here. Each is a `/30`.

| Podman network | Subnet | Spine end | Leaf end |
|---|---|---|---|
| `topo-s1-l1` | 10.101.1.0/30 | spine-01: .1 | leaf-01: .2 |
| `topo-s1-l2` | 10.101.2.0/30 | spine-01: .1 | leaf-02: .2 |
| `topo-s1-l3` | 10.101.3.0/30 | spine-01: .1 | leaf-03: .2 |
| `topo-s2-l1` | 10.101.4.0/30 | spine-02: .1 | leaf-01: .2 |
| `topo-s2-l2` | 10.101.5.0/30 | spine-02: .1 | leaf-02: .2 |
| `topo-s2-l3` | 10.101.6.0/30 | spine-02: .1 | leaf-03: .2 |

**Loopback addresses** (router IDs, advertised into OSPF/ISIS):

| Node | Loopback |
|---|---|
| spine-01 | 10.255.0.11/32 |
| spine-02 | 10.255.0.12/32 |
| leaf-01 | 10.255.0.21/32 |
| leaf-02 | 10.255.0.22/32 |
| leaf-03 | 10.255.0.23/32 |

The ordering of `--network` flags when starting containers determines interface numbering. Management is always first (eth0), P2P links follow (eth1, eth2, ...). Management IP is assigned to `br0` on leaf nodes (bridge interface), to `eth0` on spine nodes.

## Topology Node Image

A single custom image `localhost/opennms/topology-node:latest` built from `docker.io/frrouting/frr:9.1.0`.

**Additions over base FRR image:**
- `lldpd` — LLDP daemon with AgentX subagent support (`-x` flag)
- `snmpd` (net-snmp) — master AgentX agent
- `snmp-utils` — for manual verification (`snmpwalk`)
- `bridge-utils` — for `br0` setup on leaf nodes
- `/var/agentx/` directory for AgentX socket

**Entrypoint startup order** (AgentX master must be up before subagents connect):
1. `snmpd` — opens AgentX socket
2. `lldpd -x` — connects as AgentX subagent, registers LLDP-MIB
3. FRR via `/usr/lib/frr/docker-start` — ospfd and isisd each connect as AgentX subagents

**snmpd.conf** (identical on all nodes):
```
master agentx
agentXSocket /var/agentx/master
rocommunity public
syslocation "OpenNMS Topology Lab"
syscontact "admin@localhost"
```

Per-node variation is handled entirely via FRR config files bind-mounted at runtime. The image is identical for all 5 nodes.

## FRR Configuration

**`daemons` file** (all nodes):
```
zebra=yes
ospfd=yes
isisd=yes
bgpd=no
ripd=no
ospf6d=no
```

**Spine template** (`spine-01` shown; spine-02 uses .12/.0012 addresses):
```
frr version 9.1
hostname spine-01
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
```

**Leaf template** (`leaf-01` shown; leaf-02/.22/.0022 and leaf-03/.23/.0023 vary in IPs and P2P subnets):
```
frr version 9.1
hostname leaf-01
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
interface br0
 description access-bridge
 ip address 10.100.0.21/24
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
```

**ISIS NET encoding:** `49.0001.{loopback-as-4-byte-hex-grouped}.00`. Each octet of the loopback becomes a hex byte, grouped into 4-digit words:

NETs:

| Node | Loopback | NET |
|---|---|---|
| spine-01 | 10.255.0.11 | 49.0001.0aff.000b.00 |
| spine-02 | 10.255.0.12 | 49.0001.0aff.000c.00 |
| leaf-01 | 10.255.0.21 | 49.0001.0aff.0015.00 |
| leaf-02 | 10.255.0.22 | 49.0001.0aff.0016.00 |
| leaf-03 | 10.255.0.23 | 49.0001.0aff.0017.00 |

Management interface (`eth0` on spines, `br0` on leaves) is intentionally absent from FRR config — routing protocols must not flood through the management network into OpenNMS.

## Orchestration Script

`start-topology-lab.sh` at repo root, idempotent (tears down and rebuilds each run). Accepts `--teardown` flag.

**Phase 1 — Build image**
Build `localhost/opennms/topology-node:latest` from an inline Dockerfile. Skip if image exists and `--rebuild` not passed.

**Phase 2 — Create networks**
Create 7 podman networks with pinned subnets. Delete and recreate if already present to ensure clean state.

**Phase 3 — Stage FRR configs**
Write all 5 node configs (frr.conf, daemons, vtysh.conf) into a temp dir. One subdirectory per node, bind-mounted read-only into each container.

**Phase 4 — Start containers**
Start all 5 containers. Network flag order is critical — management first, then P2P links in consistent order. Container names: `topo-spine-01`, `topo-spine-02`, `topo-leaf-01`, `topo-leaf-02`, `topo-leaf-03`. All `--privileged` (required for FRR network namespace operations under podman on macOS).

Leaf node entrypoint additionally creates the bridge before FRR starts:
```bash
ip link add br0 type bridge
ip link add dummy0 type dummy
ip link set dummy0 master br0
ip link set br0 up
ip link set dummy0 up
```

**Phase 5 — Attach OpenNMS**
```bash
podman network connect --ip 10.100.0.10 topology-mgmt test-opennms
```
Skips gracefully if already connected.

**Phase 6 — Drop requisition and import**
Write `Topology-Lab.xml` directly into the running container:
```bash
podman cp Topology-Lab.xml test-opennms:/opt/opennms/etc/imports/Topology-Lab.xml
curl -s -u admin:notdefault -X PUT \
  http://localhost:8980/opennms/rest/requisitions/Topology-Lab/import?rescanExisting=true
```

**Phase 7 — Convergence check**
Poll OSPF neighbor state via `vtysh` on both spines. Cap at 24 × 5s = 120s. On timeout: print `show ip ospf neighbor` + `show isis neighbor` from both spines and exit non-zero.

```bash
for i in $(seq 1 24); do
  count=$(podman exec topo-spine-01 vtysh -c "show ip ospf neighbor" | grep -c "Full" || true)
  [[ "$count" -ge 3 ]] && break
  sleep 5
done
```

## OpenNMS Integration

**`Topology-Lab.xml` requisition:**
```xml
<model-import xmlns="http://xmlns.opennms.org/xsd/config/model-import"
    foreign-source="Topology-Lab">
  <node node-label="spine-01" foreign-id="topo-spine-01">
    <interface ip-addr="10.100.0.11" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Topology-Lab"/>
  </node>
  <!-- spine-02, leaf-01, leaf-02, leaf-03 follow same pattern -->
</model-import>
```

**`snmp-config.xml` addition** (baked into overlay image):
```xml
<definition version="v2c" read-community="public" port="161">
  <range begin="10.100.0.10" end="10.100.0.25"/>
</definition>
```

**`enlinkd-configuration.xml` overlay:** sets `rescan_interval="30000"` (30s) so topology data appears within a minute of lab start. Added to `build-dark-mode-overlay.sh` alongside the existing snmpd/SNMP config section.

## Verification

After `start-topology-lab.sh` completes and ~60s have passed:

| Layer | Check | Expected |
|---|---|---|
| OSPF | `podman exec topo-spine-01 vtysh -c "show ip ospf neighbor"` | 3 neighbors, state Full |
| ISIS | `podman exec topo-spine-01 vtysh -c "show isis neighbor"` | 3 neighbors, state Up |
| LLDP | `podman exec topo-spine-01 lldpcli show neighbors` | 3 entries (leaf-01, leaf-02, leaf-03) |
| SNMP LLDP-MIB | `snmpwalk -v2c -c public 10.100.0.11 LLDP-MIB::lldpRemTable` | 3 remote entries |
| SNMP OSPF-MIB | `snmpwalk -v2c -c public 10.100.0.11 OSPF-MIB::ospfNbrTable` | 3 neighbor entries |
| Bridge-MIB | `snmpwalk -v2c -c public 10.100.0.21 BRIDGE-MIB::dot1dBase` | bridge entry for leaf-01 |
| IpNetToMedia | `snmpwalk -v2c -c public 10.100.0.11 IP-MIB::ipNetToMediaTable` | ARP entries for fabric IPs |
| OpenNMS nodes | `curl -u admin:notdefault http://localhost:8980/opennms/rest/nodes?category=Topology-Lab` | 5 nodes |
| Topology API | `curl -u admin:notdefault http://localhost:8980/opennms/api/v2/graphs` | enlinkd containers listed |
| Topology viewer | Navigate to `/#/topology` in Vue SPA, select EnLinkd layer | leaf/spine graph visible |

## Files

All new files live at repo root or `docs/` — nothing committed inside the OpenNMS source tree except the two config overlays added to `build-dark-mode-overlay.sh`.

| File | Purpose |
|---|---|
| `start-topology-lab.sh` | Main orchestration script |
| `stop-topology-lab.sh` | Teardown helper (or `start-topology-lab.sh --teardown`) |
| (inline in start script) | topology-node Dockerfile |
| (inline in start script) | frr.conf per node |
| (inline in start script) | Topology-Lab.xml requisition |
| `build-dark-mode-overlay.sh` | Add enlinkd-configuration.xml + snmp range overlay |
