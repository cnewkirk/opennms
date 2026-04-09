# Resource Graphs Panel — Design Spec

## Goal

Embed a resource graphs panel into the node detail page that delivers immediate value for long-time users (pre-fab graphs, no clicks required) while adding a Grafana-like query builder for investigation and custom chart composition. Custom charts persist in localStorage today, with the data model designed for a future server-side endpoint.

## Architecture

### New files

```
ui/src/
├── components/NodeDetail/
│   ├── ResourceGraphsPanel.vue           # panel container; owns global time range state
│   ├── ResourceHighlights.vue            # pre-fab graphs grid (read-only)
│   └── ResourceQueryBuilder/
│       ├── QueryBuilder.vue              # query builder container; tracks active chart
│       ├── ResourceSidebar.vue           # left column: collapsible resource tree
│       ├── AttributeList.vue             # middle column: attributes for selected resource
│       └── CustomChart.vue              # right/bottom: one chart + series config
├── composables/
│   └── useResourceGraphs.ts             # fetches resource tree + pre-fab graphs for a node
└── types/
    └── resourceGraphs.ts                # SavedChart, ChartSeries — persistence contract
```

### Wired into NodeDetails.vue

Added as a new panel below OutagesTable:

```vue
<ResourceGraphsPanel :nodeId="node.id" :nodeLabel="node.label" />
```

### Reused without modification

- `PersesPanel.vue` — all chart rendering
- `graphService.ts` — pre-fab graph definitions
- `resourceService.ts` — resource tree
- All existing `Resource`, `PreFabGraph`, `GraphMetricsPayload`, `GraphMetricsResponse` types

---

## Data Model

### `resourceGraphs.ts`

```typescript
export interface ChartSeries {
  resourceId: string
  resourceLabel: string
  attribute: string
  aggregation: 'AVERAGE' | 'MIN' | 'MAX'
  label: string
  color?: string
}

export interface SavedChart {
  id: string            // uuid
  nodeId: string
  title: string
  series: ChartSeries[]
  timeRange?: { start: number; end: number }  // undefined = inherit global
  createdAt: number
}
```

This type is the contract between the UI and the future server endpoint. Swapping localStorage for a REST call is a one-file change in `useResourceGraphs.ts`.

localStorage key: `resource-charts:${nodeId}`

---

## `useResourceGraphs(nodeId)` Composable

Fetches on mount in parallel:

1. `GET /rest/graphs/fornode/{node}` → pre-fab graph definitions for highlights
2. `GET /rest/resources/fornode/{node}?depth=1` → resource tree for the sidebar

Exposes:
- `preFabGraphs: Ref<PreFabGraph[]>`
- `resources: Ref<Resource[]>`
- `savedCharts: Ref<SavedChart[]>`
- `saveChart(chart: SavedChart): void` — persists to localStorage
- `deleteChart(id: string): void`
- `loading: Ref<boolean>`
- `error: Ref<string | null>`

---

## Panel Layout

```
┌─ Resource Graphs ─────────────────────────────────────────────┐
│  [Global time range picker: 1h 6h 24h 7d 30d | custom range]  │
│                                                                │
│  ── Highlights ──────────────────────────────────────────────  │
│  [ pre-fab graph ] [ pre-fab graph ]                           │
│  [ pre-fab graph ] [ pre-fab graph ]                           │
│  [ Show all / Show fewer ]                                     │
│                                                                │
│  ── Saved Charts ────────────────────────────────────────────  │
│  (hidden when empty)                                           │
│  [ saved chart ] [ saved chart ]  (edit button on each)        │
│                                                                │
│  ── Query Builder ───────────────────────────────────────────  │
│  ┌──────────────┬──────────────────┬──────────────────────┐   │
│  │ Resources    │ Attributes       │ Chart title     [Save]│   │
│  │              │                  │                       │   │
│  │ ▶ Node SNMP  │ ifHCInOctets  +  │ [PersesPanel]        │   │
│  │ ▼ Interface  │ ifHCOutOctets +  │                       │   │
│  │   eth0  ●    │ ifInErrors    +  │ Series:               │   │
│  │   eth1       │ ifOutErrors   +  │ eth0 / ifHCInOctets   │   │
│  │ ▶ Resp Time  │                  │ AVG  ■  ✕             │   │
│  │              │ [filter...]      │ [+ Add series]        │   │
│  │ [filter...]  │                  │ [⏱ Override time]     │   │
│  └──────────────┴──────────────────┴──────────────────────┘   │
│                                                                │
│  [ + Add chart ]                                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Section: ResourceHighlights

- Receives `preFabGraphs: PreFabGraph[]` as prop
- Renders each as a `PersesPanel` in a 2-column responsive grid
- Shows first 4 graphs by default; "Show all N graphs" toggle expands
- Receives `timeRange` prop from panel; passes to each `PersesPanel`
- Read-only — no editing or pinning

---

## Section: Saved Charts

- Hidden when `savedCharts` is empty
- Same 2-column grid as highlights
- Each card has an edit button: loads the `SavedChart` into the query builder (populates series list, sets title, sets time override if present) and scrolls to the builder
- Delete button removes from localStorage via `deleteChart(id)`

---

## Section: QueryBuilder

### ResourceSidebar

- Built from `resources` returned by `useResourceGraphs`
- Resources grouped by `typeLabel` (e.g. "Node SNMP", "Response Time", "Interface: eth0")
- Collapsible groups; clicking a resource selects it (highlighted) and triggers attribute load
- Text filter input at top — filters group names and resource labels in place
- Selected resource passed to `AttributeList` via emit

### AttributeList

- Receives selected `Resource`; reads its `rrdGraphAttributes` map (already loaded — no additional fetch)
- Each entry rendered as: attribute key + `+` button (attribute keys are used as-is; no separate human label source exists in the API)
- `+` emits `add-series` to `QueryBuilder.vue`, which appends a `ChartSeries` to the active `CustomChart`
- Text filter input at top
- Empty state: "Select a resource to see available attributes"

### CustomChart

**Series list** — each series shows:
- Resource label / attribute name
- Aggregation picker: AVERAGE / MIN / MAX (default AVERAGE)
- Color swatch (click to cycle through a palette of 8 Feather DS-compatible colors)
- Remove button

**Chart rendering:**
- `CustomChart` maps `ChartSeries[]` to `OpenNMSQuerySpec[]` (one per series: `{ resourceId, attribute, aggregation, label }`). No `RrdGraphConverter` involved — that's only for pre-fab RRD command strings.
- Passes the query array plus `seriesOverrides` (colors) and `timeRange` as props directly to `PersesPanel`, which handles the POST `/rest/measurements` fetch internally.
- Re-fetches on series change or time range change (debounced 300ms)
- Shows loading spinner during fetch; inline error message on failure
- Empty state when no series added: "Use the sidebar to add metrics"

**Time range:**
- Inherits global range from `ResourceGraphsPanel` by default
- "Override time range" toggle; when enabled shows a local range picker
- Local range stored in the `CustomChart`'s state (and in `SavedChart.timeRange` if saved)

**Save:**
- "Save chart" button (disabled when no series)
- Prompts for a title (inline text input, confirms on Enter or click)
- Generates a UUID, writes to localStorage via `saveChart()`
- Chart disappears from builder and appears in Saved Charts section

**Multiple charts:**
- `QueryBuilder.vue` maintains an array of active (unsaved) charts
- "Add chart" button below the last chart appends a new empty one
- Each `CustomChart` is independently rendered but shares the global time range

---

## Time Range

Global state in `ResourceGraphsPanel.vue`:

```typescript
const globalRange = ref<{ start: number; end: number }>(last24h())
```

Preset buttons: 1h, 6h, 24h, 7d, 30d. Custom range: two date-time inputs. Changing the global range re-renders all highlights and all charts that haven't overridden their local range.

---

## Error Handling & Loading States

- `useResourceGraphs` shows a panel-level skeleton while initial fetches are in flight
- If resource fetch fails: "Could not load resources for this node" with a retry button
- If pre-fab graph fetch fails: highlights section shows inline error; query builder still loads
- Per-chart fetch failures shown inline within the chart card, not as panel-level errors
- Empty node (no resources): "No performance data collected for this node"

---

## Future: Server-Side Persistence

When a server endpoint is added:

1. Add `GET /rest/nms/resource-charts?nodeId={id}` and `POST/DELETE` equivalents
2. Replace localStorage reads/writes in `useResourceGraphs.ts` with service calls
3. `SavedChart` type is unchanged — it becomes the request/response body

No component changes required.
