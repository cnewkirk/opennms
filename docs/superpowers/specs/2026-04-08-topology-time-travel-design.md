# Topology Time Travel & Edge Tooltip Graphs

**Date:** 2026-04-08  
**Branch:** feat/ui-refactor  
**Status:** Approved for implementation

---

## Overview

Two related features delivered together:

1. **Time Travel Scrubber** — a global time slider at the bottom of the topology canvas that lets users scrub the entire weathermap state (edge colors, utilization labels, all metrics) back up to 24h (or 7d/30d). Replaces the current "always live" model with a live/historical mode toggle.

2. **Tooltip Graphs** — when hovering a topology edge, the tooltip now shows mini sparkline charts for utilization (both directions, both endpoints), errors, and discards. Graph data covers a 2-hour lookback window ending at the currently selected time.

**Prerequisite bug fix:** Interface name (`eth0`, `eth2`, etc.) must be consistently populated on both sides of every link before graph data can be reliably attributed to the correct interface. This is currently broken for edges where only one endpoint has LLDP data. The reverse LLDP lookup added in a prior commit helps but is not yet fully reliable — this must be validated and hardened as the first task of implementation.

---

## Architecture

Four self-contained units:

| Unit | Type | Purpose |
|------|------|---------|
| `TopologyTimeControl.vue` | New component | Time slider UI, emits selected timestamp |
| `weathermapStore` changes | Store update | Time-awareness, historical fetch support |
| `measurementsService` changes | Service update | Time-series and errors/discards fetch functions |
| `TopologyEdgeGraphs.vue` | New component | Sparkline charts embedded in edge tooltip |

---

## Section 1: TopologyTimeControl

### Layout

Full-width bar (~40px) at the bottom of the topology canvas:

```
|◀  [━━━━━━━━━━━━━━━━●━━━━━━━━━]  Apr 8, 17:34   ⊙ LIVE |
                                         24h / 7d / 30d
```

- **Slider** — maps linearly to a timestamp. Tick marks at 6h intervals (or proportional for 7d/30d range).
- **Timestamp label** — compact format (`Apr 8, 17:34`), updates live while dragging.
- **LIVE badge** — green pill at far right. Active (pulsing dot) when slider is at rightmost position. Clicking from any position snaps to now and re-enables auto-refresh.
- **Range toggle** — `24h / 7d / 30d` above slider, right-aligned. Changing range snaps slider to LIVE.
- **Canvas watermark** — when not in live mode, a semi-transparent `⏱ Historical: Apr 8, 17:34` watermark appears top-left of the Cytoscape canvas. Hidden in live mode.

### Props / Emits

```typescript
// modelValue: null = live, Date = historical
defineProps<{ modelValue: Date | null }>()
defineEmits<{ 'update:modelValue': [Date | null] }>()
```

### Debouncing

Slider input is debounced at **400ms** using `lodash.debounce` (already imported in `mapStore.ts`; consistent with the existing pattern). The debounced function is cancelled in `onBeforeUnmount` to prevent firing after the component is gone.

### Placement in component tree

`TopologyTimeControl` is owned by `Topology.vue` (not `TopologyGraph`), placed between `TopologyToolbar` and `TopologyGraph`. The topology container uses `height: calc(100vh - 120px)` — this becomes `height: calc(100vh - 160px)` to account for the ~40px control bar, keeping the Cytoscape canvas within `overflow: hidden`. `TopologyGraph` receives no layout changes; the height reduction propagates naturally.

### Range toggle — snap-to-LIVE event

When the range toggle changes, `TopologyTimeControl` emits `update:modelValue` with `null` synchronously (same event as LIVE), followed by a `rangeChange` event with the new range value. `Topology.vue` needs only the single `update:modelValue` handler; range state is internal to `TopologyTimeControl`.

### Canvas watermark

The watermark lives inside `TopologyGraph.vue` as a sibling `div` to the Cytoscape canvas container, with `position: absolute; top: 8px; left: 8px; pointer-events: none; z-index: 10`. It receives `isLive: boolean` and `selectedTime: Date | null` as props.

---

## Section 2: weathermapStore Changes

### New state

```typescript
const selectedTime = ref<Date | null>(null)  // null = live
```

### New action

```typescript
const setTime = (t: Date | null) => {
  selectedTime.value = t
  if (t === null) {
    // Resume auto-refresh
    refresh()  // _scheduleNext fires in refresh() finally block
  } else {
    // Cancel pending refresh timer; fetch historical snapshot without re-arming
    if (_timer) { clearTimeout(_timer); _timer = null }
    _fetchAll()  // call directly, bypassing refresh() to avoid _scheduleNext()
  }
}
```

Note: `_fetchAll` is called directly (not via `refresh()`) in historical mode so that `refresh()`'s `finally` block — which unconditionally calls `_scheduleNext()` — does not re-arm the auto-refresh timer. `loading` and `error` are set manually before/after the direct call.

### _fetchAll parameterization

`_fetchAll` is updated to use `selectedTime.value` when building measurement query windows:

- **Live mode** (`selectedTime === null`): current behavior — query last 5 minutes
- **Historical mode**: query a 5-minute window ending at `selectedTime`

The `edgeUtilMap` and `edgeLabelData` store shape does not change — they simply reflect the last-fetched time. The topology canvas reacts automatically via existing watchers.

### EdgeLabelData additions

Two new optional fields carry full `SnmpInterface` objects (not just ifIndex) so `TopologyEdgeGraphs` can call `buildSnmpResourceId` directly without a redundant re-query:

```typescript
export interface EdgeLabelData {
  // ... existing fields ...
  srcNodeId?: number          // e.source.id (already number in TopologyEdge)
  srcIface?: SnmpInterface    // resolved local interface from LLDP ifindex lookup
  tgtNodeId?: number          // e.target.id
  tgtIface?: SnmpInterface    // resolved remote interface from reverse LLDP lookup
}
```

These are populated during `_fetchAll` alongside the existing LLDP correlation — `srcIface` is the `localIface` already resolved from `nodeIfIndexMap[srcId]`, `tgtIface` is the interface resolved from the reverse LLDP lookup. If LLDP data is unavailable for an endpoint the fields are undefined and the tooltip graph section degrades gracefully.

---

## Section 3: measurementsService Changes

### fetchInterfaceTimeSeries

```typescript
fetchInterfaceTimeSeries(
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step?: number,       // milliseconds, default 60_000 — matches existing API convention
  signal?: AbortSignal
): Promise<{ timestamps: number[]; inBps: number[]; outBps: number[] }>
```

Queries `ifHCInOctets` and `ifHCOutOctets`, derives to bps rates. A 2-hour window at 60s step = 120 data points — appropriate resolution for a small sparkline.

**Unit note:** `step` is in **milliseconds** to match the existing `fetchInterfaceUtilization` convention (`step: 300_000`). All measurement API calls pass step in ms; internal documentation must make this explicit to avoid confusion.

### fetchInterfaceErrorsDiscards

```typescript
fetchInterfaceErrorsDiscards(
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step?: number,       // milliseconds, default 60_000
  signal?: AbortSignal
): Promise<{
  ifInErrors:    number[] | null   // null if all-zero across window
  ifOutErrors:   number[] | null
  ifInDiscards:  number[] | null
  ifOutDiscards: number[] | null
}>
```

Returns `null` for any series that is all-zero across the entire window. Zero-suppression lives in the service layer (not the component) because the decision "is this metric worth showing?" is a data concern, not a presentation concern — the component should not need to iterate raw arrays to make that call.

---

## Section 4: TopologyEdgeGraphs

### Placement

Embedded at the bottom of `TopologyEdgeTooltip.vue`, separated by a thin divider. Fixed-height reserved area prevents tooltip jumping during load.

### Chart library

**Chart.js** (already a direct dependency) — used directly without Perses/React overhead. Each chart is a `line` type, minimal styling: no axes, no grid lines, just the sparkline with a legend showing the current (rightmost) value.

### Chart layout

Up to 4 charts stacked vertically, each ~60px tall:

```
─────────────────────────────────────
 Utilization — eth2 (source)
 [sparkline]  ↑ 4.43K   ↓ 4.49K

 Utilization — eth0 (target)
 [sparkline]  ↑ 1.33K   ↓ 1.39K

 Errors                          ← omitted if both sides all-zero
 [sparkline]  src: 0   tgt: 2

 Discards                        ← omitted if both sides all-zero
 [sparkline]  src: 1   tgt: 0
─────────────────────────────────────
```

- **Utilization charts**: two datasets per chart (↑ inbound, ↓ outbound), colors matching the existing weathermap utilization palette
- **Errors/Discards charts**: two datasets (source endpoint, target endpoint), rendered only when at least one value in the window is non-zero
- **Interface label**: uses `localIfName` / `remotePortId` from `EdgeLabelData`. Falls back to node label if interface name unavailable.

### Time window

Always a **2-hour lookback** ending at `weathermapStore.selectedTime` (or `Date.now()` if live). In live mode the window auto-advances with each weathermap refresh.

### Loading state

Skeleton shimmer placeholder at the chart area height while fetching. Charts replace shimmer when data arrives.

### Error / data-gap handling

- If `srcIface`/`tgtIface` are undefined (LLDP gap): graph section renders "Interface data unavailable" in place of charts — no broken/empty chart frames
- If measurements API returns an error: graph section silently disappears — no error message in the tooltip
- Requests are cancelled via `AbortController` when the tooltip closes. The `AbortController` is created in `onMounted`, its `signal` is passed to both service functions, and `controller.abort()` is called in `onUnmounted`. Service functions accept `signal?: AbortSignal` and pass it through to `fetch()`.

### Live mode reactive updates

When `weathermapStore.selectedTime === null` (live), `TopologyEdgeGraphs` watches `weathermapStore.lastUpdated`. Each time it changes (i.e. each weathermap auto-refresh cycle), the component re-fetches its 2-hour window ending at `Date.now()` so the graphs stay current while the tooltip is open.

### Chart.js usage

`TopologyEdgeGraphs` imports and registers only the required Chart.js components locally:
```typescript
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale } from 'chart.js'
Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale)
```
Chart instances must be explicitly destroyed in `onUnmounted` to prevent canvas memory leaks:
```typescript
onUnmounted(() => { chartInstances.forEach(c => c.destroy()) })
```

---

## Data Flow

```
User drags slider
  → TopologyTimeControl emits Date (debounced 400ms)
  → Topology.vue calls weathermapStore.setTime(date)
  → weathermapStore._fetchAll(date)
      → fetchInterfaceUtilization(nodeId, iface, atTime=date) × N edges
      → edgeUtilMap updated
      → edgeLabelData updated
  → useTopology.applyEdgeLabels() fires (watching edgeLabelData)
  → Cytoscape edge colors + labels update

User hovers edge
  → TopologyEdgeTooltip opens
  → TopologyEdgeGraphs mounts
      → window = [selectedTime - 2h, selectedTime]
      → fetchInterfaceTimeSeries(srcNodeId, srcIface, start, end)
      → fetchInterfaceTimeSeries(tgtNodeId, tgtIface, start, end)
      → fetchInterfaceErrorsDiscards(srcNodeId, srcIface, start, end)
      → fetchInterfaceErrorsDiscards(tgtNodeId, tgtIface, start, end)
  → Charts render
```

---

## Out of Scope

- **Play/animate mode** — scrubbing forward in time automatically. Future enhancement on top of this foundation.
- **Topology snapshot persistence** — saving a historical view as a named bookmark. Future work.
- **Per-edge time windows** — all edges show the same selected time. Individual edge time overrides not supported.
- **Data beyond 30d** — slider range capped at 30d. Older data available via Node Detail resource graphs.

---

## Implementation Order

1. Fix interface name consistency bug (reverse LLDP, both sides) — prerequisite
2. Add `srcNodeId`/`srcIfIndex`/`tgtNodeId`/`tgtIfIndex` to `EdgeLabelData` population
3. Add `fetchInterfaceTimeSeries` and `fetchInterfaceErrorsDiscards` to `measurementsService`
4. Add `selectedTime` + `setTime` to `weathermapStore`, parameterize `_fetchAll`
5. Build `TopologyTimeControl.vue`
6. Wire `TopologyTimeControl` into `Topology.vue` (v-model → store)
7. Add canvas watermark (historical mode indicator)
8. Build `TopologyEdgeGraphs.vue` with Chart.js sparklines
9. Embed `TopologyEdgeGraphs` in `TopologyEdgeTooltip.vue`
10. End-to-end test: live mode, historical scrub, tooltip graphs, errors/discards conditional render
