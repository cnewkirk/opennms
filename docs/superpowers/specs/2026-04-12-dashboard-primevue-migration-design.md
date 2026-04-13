# Dashboard Enhancement + PrimeVue Migration (Phase 1)

**Date:** 2026-04-12  
**Branch:** feat/ui-refactor  
**Scope:** Dashboard spacing fix, global time range, config schema v3, graph/donut/availability widgets, PrimeVue migration of dashboard shell components

---

## Background

The Vue SPA currently uses Feather DS (Ciena's branded design system) for all UI components. Feather covers basics but has no charts, no date range pickers, and limited advanced components. PrimeVue is adopted as the long-term replacement, with the dashboard as the Phase 1 beachhead.

**Migration phasing:**
1. **Phase 1 (this spec)** — Dashboard: new widgets + Feather → PrimeVue in dashboard shell
2. **Phase 2** — Shared components (tables, badges, filter bars, dialogs)
3. **Phase 3** — Feature pages (Alarms, Outages, Nodes, etc.)
4. **Phase 4** — Admin pages
5. **Phase 5** — App shell (top nav, sidebar, FeatherAppLayout)

No new Feather components are built from this point forward.

---

## Section 1: Spacing

GridStack currently uses `margin: 8` in `useDashboardLayout.ts`. Both horizontal and vertical gaps are 8px, but vertical feels tighter due to cell density.

**Change:** Set `margin: 16` in `GRID_OPTIONS`. Uniform 16px gap on all axes. No other layout changes.

---

## Section 2: Global Time Range Control

### Data model

```ts
interface DashboardTimeRange {
  mode: 'relative' | 'absolute'
  relativeWindow: '1h' | '6h' | '24h' | '7d' | '30d'
  from?: string   // ISO string, used when mode = 'absolute'
  to?: string
}
```

### Store

`dashboardStore` gains a `timeRange` field alongside `widgets`, persisted as part of `DashboardConfig` v3. Default: `{ mode: 'relative', relativeWindow: '24h' }`.

Exported helper `resolveTimeRange(timeRange: DashboardTimeRange): { start: Date; end: Date }` converts relative windows to absolute `Date` objects at call time. Used by all time-aware widgets.

### Toolbar

The dashboard toolbar renders a time range picker on the right side **when at least one `graph` or `availability` widget is present**. Otherwise it is hidden. `node-status` is instant/current state and does not consume a time range.

The picker uses a PrimeVue `Select` for relative presets ("Last 1h", "Last 6h", "Last 24h", "Last 7d", "Last 30d") plus a "Custom range…" option that opens a PrimeVue `DatePicker` for absolute from/to selection.

### Per-widget override

`GraphWidgetConfig` and `AvailabilityWidgetConfig` have an optional `timeRange?: DashboardTimeRange` field. When set, the widget uses it instead of the global value. The widget config dialog exposes a "Use custom time range" `Checkbox`; when checked, the time range picker fields appear.

---

## Section 3: PrimeVue Setup & Theming

### Installation

```
yarn add primevue @primevue/themes primeicons
```

PrimeVue registered in `main.ts` with the `Aura` preset:

```ts
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

app.use(PrimeVue, { theme: { preset: Aura } })
```

### CSS bridge

`ui/src/styles/primevue-theme-bridge.scss` overrides PrimeVue's design tokens with the app's existing `--feather-*` CSS variables. Since both systems are CSS-custom-property-based and Feather vars already switch on dark/light mode, PrimeVue components inherit correct theming automatically.

Key token mappings (representative — full list in implementation):

| PrimeVue token | Feather variable |
|---|---|
| `--p-surface-0` | `var(--feather-surface)` |
| `--p-surface-ground` | `var(--feather-background)` |
| `--p-text-color` | `var(--feather-primary-text-on-surface)` |
| `--p-text-muted-color` | `var(--feather-secondary-text-on-surface)` |
| `--p-primary-color` | `var(--feather-primary)` |
| `--p-content-border-color` | `var(--feather-border-light-on-surface)` |
| `--p-overlay-modal-background` | `var(--feather-surface)` |

Bridge imported once in `main.ts` after PrimeVue's CSS.

### Feather components replaced in this pass

| Location | Feather component | PrimeVue replacement |
|---|---|---|
| `WidgetFrame.vue` | `FeatherButton`, `FeatherIcon`, `FeatherSpinner` | `Button`, icons via `primeicons`, `ProgressSpinner` |
| `WidgetConfigDialog.vue` | `FeatherDialog`, `FeatherButton`, `FeatherInput`, `FeatherCheckbox`, `FeatherSelect` | `Dialog`, `Button`, `InputText`, `Checkbox`, `Select` |
| `WidgetConfigDialog.vue` | Category/severity checkbox lists | `MultiSelect` |
| `Dashboard.vue` | `FeatherButton`, `FeatherIcon` | `Button`, `SplitButton` for add-widget menu |

---

## Section 4: Config Schema v3 (Discriminated Union)

### Type definitions

```ts
interface BaseWidgetConfig {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
  refreshInterval: number
}

interface SummaryWidgetConfig extends BaseWidgetConfig {
  type: 'summary'
  categories: string[]
}

interface TableWidgetConfig extends BaseWidgetConfig {
  type: 'outages' | 'alarms' | 'nodes'
  categories: string[]
  limit: number
  severities: string[]
  columns: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

interface GraphWidgetConfig extends BaseWidgetConfig {
  type: 'graph'
  series: GraphSeries[]
  stack: boolean
  timeRange?: DashboardTimeRange
}

interface NodeStatusWidgetConfig extends BaseWidgetConfig {
  type: 'node-status'
  categories: string[]
}

interface AvailabilityWidgetConfig extends BaseWidgetConfig {
  type: 'availability'
  categories: string[]
  timeRange?: DashboardTimeRange
}

export type WidgetConfig =
  | SummaryWidgetConfig
  | TableWidgetConfig
  | GraphWidgetConfig
  | NodeStatusWidgetConfig
  | AvailabilityWidgetConfig

export interface GraphSeries {
  id: string
  nodeId: string
  resourceId: string    // e.g. "node[4].interfaceSnmp[eth0-aa:bb:cc:dd:ee:ff]"
  attribute: string     // e.g. "ifHCInOctets" — derived from rrdGraphAttributes
  label: string
  color?: string        // hex string
  expression?: string   // advanced mode: CDEF/JEXL expression override
}

export interface DashboardConfig {
  version: 3
  timeRange: DashboardTimeRange
  widgets: WidgetConfig[]
}
```

### v2 → v3 migration

Run on `loadConfig()` / `loadFromServer()`. If `parsed.version < 3`:
- Wrap `widgets` in the new union shape (all existing types match `SummaryWidgetConfig` or `TableWidgetConfig` — field sets are compatible)
- Inject default `timeRange: { mode: 'relative', relativeWindow: '24h' }`
- Set `version: 3`

Storage key unchanged. No data loss.

### Widget config dialogs

The single `WidgetConfigDialog.vue` is replaced by per-type config components:

- `SummaryWidgetConfig.vue` — title, categories, refresh interval
- `TableWidgetConfig.vue` — title, categories, severities (alarms only), limit, columns, sort, refresh interval
- `GraphWidgetConfig.vue` — title, series builder (see Section 5), stack toggle, time range override, refresh interval
- `NodeStatusWidgetConfig.vue` — title, categories, refresh interval
- `AvailabilityWidgetConfig.vue` — title, categories, time range override, refresh interval

`WidgetConfigDialog.vue` becomes a thin shell that renders the appropriate sub-component based on `widget.type`.

---

## Section 5: Graph Widget

### Architecture

`GraphWidget.vue` receives `GraphWidgetConfig` and the resolved effective time range (per-widget override or global). It translates `series[]` into the `OpenNMSBatchQuerySpec` consumed by `PersesPanel.vue`. One query source per series, carrying `resourceId`, `attribute`, and `label`. The `stack` flag maps to Perses stacked area mode.

All rendering remains TSS-agnostic via the existing Measurements API path in `PersesPanel`. No new charting library.

### Series builder

`GraphSeriesBuilder.vue` is the series configuration sub-component used inside `GraphWidgetConfigDialog.vue`.

**Simplified mode (default):**

Three cascading PrimeVue `Select` dropdowns per series row:
1. **Node** — fetches via `API.getNodes()`, searchable by label
2. **Resource** — fetches via `resourceStore.getResourcesForNode(nodeId)` when node selected, displays resource label
3. **Attribute** — populated from `resource.rrdGraphAttributes` keys when resource selected

Each row also has:
- PrimeVue `InputText` for series label (auto-filled from attribute name, editable)
- PrimeVue `ColorPicker` for series color
- Remove button

Rows are reorderable via drag handle (Vue `sortable` or CSS drag, TBD in implementation).

A `+ Add Series` button appends a new blank row.

**Advanced mode:**

An "Advanced" toggle at the bottom of the series list (per row) reveals a `Textarea` for a raw expression override (CDEF/JEXL). When an expression is set, the simplified dropdowns go read-only but remain visible for reference. Clearing the expression re-enables them.

### Default widget size

`w: 6, h: 4` — half width, tall enough for a readable chart.

---

## Section 6: Node Status Donut & Availability Ring

Both use PrimeVue's `Chart` component (Chart.js `doughnut` type). No additional charting library.

### NodeStatusWidget.vue (`type: 'node-status'`)

**Data:**
- Total nodes: `GET /opennms/rest/nodes?limit=0` (optionally filtered by category)
- Nodes down: derived from `GET /opennms/rest/outages?limit=0&ifRegainedService=null` — count distinct `nodeId` values

**Visualization:**
- Doughnut: two segments — "Up" (`--feather-success` green) and "Down" (`--feather-error` red)
- Center label: total node count (via Chart.js center-text plugin)
- Legend below: "N up / M down"

**Default size:** `w: 4, h: 3`

### AvailabilityWidget.vue (`type: 'availability'`)

**Data:**
- `GET /opennms/rest/availability/categories` (or filtered variant)
- Extracts aggregate `availability` percentage (0–100)

**Visualization:**
- Doughnut: availability % (filled) vs shortfall % (background gray)
- Center label: "XX.X%"
- Color thresholds:
  - ≥ 99%: `--feather-success` green
  - 95–99%: `--feather-warning` amber
  - < 95%: `--feather-error` red
- Time range: uses widget `timeRange` override or global dashboard time range

**Default size:** `w: 4, h: 3`

---

## New Widget Types Summary

| Type | Component | Default size | Key data source |
|---|---|---|---|
| `summary` | `SummaryWidget.vue` | 12×2 | nodes, alarms, outages counts |
| `outages` | `OutagesWidget.vue` | 6×3 | `/rest/outages` |
| `alarms` | `AlarmsWidget.vue` | 6×3 | `/rest/alarms` |
| `nodes` | `NodesWidget.vue` | 12×3 | `/rest/nodes` |
| `graph` | `GraphWidget.vue` | 6×4 | `/rest/measurements` via PersesPanel |
| `node-status` | `NodeStatusWidget.vue` | 4×3 | `/rest/nodes` + `/rest/outages` |
| `availability` | `AvailabilityWidget.vue` | 4×3 | `/rest/availability/categories` |

---

## Out of Scope

- App shell migration (Phase 5)
- Feature page migration (Phase 3)
- Admin page migration (Phase 4)
- Multi-dashboard support (single dashboard per user)
- Dashboard sharing between users
