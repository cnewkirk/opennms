# Topology Edge Label Fields Design

## Goal

Allow users to configure which network fields (utilization, port names, IPs, MAC, speed) appear on topology edge labels and in the hover tooltip, toggled via a toolbar popover and persisted to localStorage.

---

## Architecture

Three concerns, three owners:

1. **Data fetching** — `weathermapStore` already fetches SNMP interfaces per node. Extend `_fetchAll` to also fetch IP interfaces and enlinkd/LLDP data per node in the same parallel batch. Store results in a new `edgeLabelData` map (keyed by edgeKey) alongside the existing `edgeUtilMap`.

2. **Display config** — new `edgeLabelStore` holds 6 boolean field visibility flags, persisted to localStorage. No polling, no API calls — pure config state.

3. **Rendering** — `useTopology.ts` composes the final edge label string from enabled fields and re-applies it any time either store changes. `TopologyEdgeTooltip.vue` reads `edgeLabelData` to render the full hover tooltip regardless of label toggles.

---

## Data Model

### `EdgeLabelData` (in weathermapStore, keyed by edgeKey)

```typescript
interface EdgeLabelData {
  localIfName?: string      // ifName or ifDescr of local connecting interface
  remotePortId?: string     // lldpRemPortId (remote port identifier)
  remotePortDescr?: string  // lldpRemPortDescr (remote port description)
  localIp?: string          // primary IP of source node (snmpPrimary === 'P')
  remoteIp?: string         // primary IP of target node
  localMac?: string         // physAddr of local SNMP interface
  ifSpeed?: number          // link speed in bits/sec
}
```

**LLDP correlation:** For edge (srcId→tgtId), find the LLDP link on srcId where `lldpRemSysname` matches the target vertex label. That link's `lldpLocalPortNum` maps to `ifIndex` → look up `ifName` from SNMP interfaces. `lldpRemPortId`/`lldpRemPortDescr` give the remote side. If no match (non-LLDP topology or sysName mismatch), remote port fields are absent and silently omitted.

### `EdgeLabelConfig` (in edgeLabelStore, persisted to localStorage)

```typescript
interface EdgeLabelConfig {
  showUtilization: boolean  // weathermap % + in/out rates
  showLocalPort: boolean    // local interface name (ifName/ifDescr)
  showRemotePort: boolean   // remote port from LLDP (remotePortId or remotePortDescr)
  showIp: boolean           // source IP ↔ target IP
  showMac: boolean          // local MAC address (physAddr)
  showSpeed: boolean        // link speed formatted (e.g. "1G")
}
```

**Defaults:** `showUtilization: true`, all others `false`. This preserves today's out-of-the-box behavior while making everything user-controllable.

---

## Edge Label Composition

`composeEdgeLabel(edgeKey)` in `useTopology.ts` builds a multi-line string from enabled fields that have data. Lines joined with `\n`. Empty string if nothing to show.

Example with utilization + local port + IP enabled:
```
47% · ↑230M ↓180M
eth0 ↔ GigEth0/1
10.0.0.1 ↔ 10.0.0.2
```

Fields with no data for a given edge are silently omitted — no blanks or dashes.

---

## Tooltip

`TopologyEdgeTooltip.vue` always renders ALL available `EdgeLabelData` fields (regardless of label toggles) in a structured section below the protocol chips. The toggles only affect what's printed on the edge line itself — the tooltip is always maximally informative.

---

## Toolbar "Edge Labels ▾" Popover

A new button in `TopologyToolbar.vue` that opens a dropdown popover with 6 labeled checkboxes:
- Utilization (default on)
- Local Port
- Remote Port
- IP Addresses
- MAC Address
- Speed

Reuses existing `topology-toolbar__chip` and SCSS patterns. Closes on outside-click (`@click.outside` or `v-click-outside`). Checkbox state bound to `edgeLabelStore`.

---

## Data Fetching

**Extended `_fetchAll` in weathermapStore** adds two calls per node to the existing parallel batch:
- `getNodeIpInterfaces(nodeId)` → extract primary IP
- `getNodeEnlinkd(nodeId)` → LLDP link data for port correlation

All three per-node fetches (`snmpInterfaces`, `ipInterfaces`, `enlinkd`) run in the same `Promise.allSettled`. A single failing call does not block others.

`edgeLabelData` is built after node data is collected and stored atomically with `edgeUtilMap`. Updated on every poll cycle. The existing `weathermapStore.loading` flag covers both maps.

---

## Rendering / Watchers

**Responsibility split in `useTopology.ts`:**
- `applyWeathermapStyles()` (existing) — continues to own edge **color and width** from utilization data. Unaffected by label toggles.
- `applyEdgeLabels()` (new) — owns all edge **label text**. Replaces the label-setting logic currently inside `applyWeathermapStyles`. Calls `composeEdgeLabel(edgeKey)` for each edge in a `cy.batch()`.

Disabling `showUtilization` suppresses the utilization text from the label but does **not** affect edge color or width — those are always driven by weathermap data when available.

**Watchers added:**
```typescript
watch(() => [
  edgeLabelStore.showUtilization,
  edgeLabelStore.showLocalPort,
  edgeLabelStore.showRemotePort,
  edgeLabelStore.showIp,
  edgeLabelStore.showMac,
  edgeLabelStore.showSpeed,
], applyEdgeLabels)
watch(() => weathermapStore.edgeLabelData, applyEdgeLabels)
watch(() => weathermapStore.edgeUtilMap, () => { applyWeathermapStyles(); applyEdgeLabels() })
```

---

## New / Modified Files

| File | Action | Responsibility |
|------|--------|----------------|
| `ui/src/stores/edgeLabelStore.ts` | Create | Field visibility config + localStorage persistence |
| `ui/src/stores/weathermapStore.ts` | Modify | Add IP/enlinkd fetching, `edgeLabelData` map, LLDP correlation |
| `ui/src/composables/useTopology.ts` | Modify | `composeEdgeLabel`, `applyEdgeLabels`, watchers |
| `ui/src/components/Topology/TopologyToolbar.vue` | Modify | "Edge Labels ▾" popover with checkboxes |
| `ui/src/components/Topology/TopologyEdgeTooltip.vue` | Modify | Render `EdgeLabelData` fields in tooltip |
| `ui/src/services/measurementsService.ts` | Modify | Add `fetchNodeIpInterfaces` helper |
