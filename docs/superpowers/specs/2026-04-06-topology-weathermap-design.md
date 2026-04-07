# Topology Weathermap Design

## Goal

Enrich the existing OpenNMS topology graph with live interface utilization data: color edges green→red by utilization %, scale edge width by raw throughput, print inline labels with percentage and raw values, and mark down nodes with a red fill and DOWN badge.

---

## Architecture

The weathermap enrichment sits as a parallel data layer alongside the existing topology graph. A dedicated `weathermapStore` polls `/rest/measurements` for interface utilization on all edge endpoints, fetches node `type` fields for up/down status, and exposes reactive maps. `useTopology.ts` merges these into Cytoscape element data at render time and re-styles on change. The existing `alarmSeverity` map from `topologyStore` provides a third severity signal (alarm-driven coloring).

---

## Components & Data Flow

### New files

**`ui/src/stores/weathermapStore.ts`**
Owns: polling timer, measurements cache (`edgeUtilMap`), node down map (`nodeDownMap`), loading/error state, configurable interval (default 60s).

**`ui/src/services/measurementsService.ts`**
Wraps:
- `POST /rest/measurements` — batch query for `ifHCInOctets` + `ifHCOutOctets` over a 5-minute window
- `GET /nodes/{id}/ipinterfaces` — fetch ifSpeed and interface metadata

### Modified files

**`ui/src/composables/useTopology.ts`**
Imports `weathermapStore`. Applies utilization color, edge width, and inline label to Cytoscape edges. Applies `node-down` class and styling when `nodeDownMap[nodeId]` is true.

**`ui/src/components/Topology/TopologyGraph.vue`**
Adds refresh button, polling interval selector (30s / 60s / 5m / Off), and a status indicator (last-updated timestamp or "Weathermap unavailable").

**`ui/src/components/Topology/protocolColors.ts`**
Adds `utilizationColor(pct: number): string` and `throughputWidth(bitsPerSec: number): number` helper functions.

### Data flow

1. Topology loads → `weathermapStore.start(vertices, edges)` called
2. Store resolves node IDs from edge endpoints → fetches SNMP interfaces for each node (`GET /nodes/{id}/ipinterfaces`)
3. For each interface on each edge, POSTs to `/rest/measurements` for `ifHCInOctets` + `ifHCOutOctets` over last 5-minute window
4. Computes `utilPct = (inRate + outRate) / (2 * ifSpeed)`, stores in `edgeUtilMap` keyed by edgeKey
5. Node `type` field fetched (reusing `nodeDetails` cache where available) → stored in `nodeDownMap` (`type !== 'A'` = down)
6. `useTopology` watches `edgeUtilMap` and `nodeDownMap` → calls `cy.batch()` to re-style affected elements without full re-render
7. Timer fires every N seconds (configurable, default 60s) → repeats steps 2–6

---

## Edge Visual Encoding

### Color — `utilizationColor(pct: number)`

| Utilization | Color | Hex |
|-------------|-------|-----|
| 0–50% | Green | `#48BB78` |
| 50–75% | Yellow | `#ECC94B` |
| 75–90% | Orange | `#ED8936` |
| 90–100% | Red | `#FC8181` |
| No data | Protocol color | (unchanged) |

### Width — `throughputWidth(bitsPerSec: number)`

| Throughput (in + out) | Width |
|-----------------------|-------|
| < 1 Mbps | 2px |
| 1–10 Mbps | 3px |
| 10–100 Mbps | 4px |
| 100 Mbps–1 Gbps | 6px |
| > 1 Gbps | 8px |

### Label — Cytoscape `content` at edge midpoint

```
47% · ↑230M ↓180M
```

- Utilization % first
- Direction arrows for in/out rates
- Unit-formatted: K / M / G (bits/sec)
- Only rendered when weathermap data is available for the edge
- Falls back to existing protocol label when no data

---

## Down Node Styling

Cytoscape class `node-down` applied when `nodeDownMap[nodeId] === true` (i.e., `node.type !== 'A'`):

- Background color: `#FC8181` (red)
- Border: 2px solid `#E53E3E`
- Overlay badge: Cytoscape label with `text-background-color: #E53E3E`, content: `DOWN`, positioned at bottom of node

---

## Refresh UI

**`TopologyGraph.vue` toolbar additions:**
- **Refresh button** — manual re-poll, shows spinner while in-flight
- **Interval selector** — 30s / 60s / 5m / Off (disables auto-poll)
- **Status indicator** — shows last-updated timestamp, or "Weathermap unavailable" on API failure

---

## Error Handling

- **Per-edge failure** (`/rest/measurements` non-200): edge keeps protocol color/width, no label — silent degradation, no toast
- **Complete API failure**: `weathermapStore.error` set, toolbar shows "Weathermap unavailable", all edges fall back to protocol coloring — topology remains fully usable
- **Node status failure**: falls back to alarm-severity-only coloring (already working)
- **All measurements fetched with `Promise.allSettled`** — per-edge failures do not block other edges
