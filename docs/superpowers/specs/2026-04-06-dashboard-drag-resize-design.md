# Dashboard Drag+Drop / Resize — Design Spec

**Date:** 2026-04-06  
**Branch:** feature/jmx-config-vue  
**Scope:** Main Dashboard (`/ui/index.html#/dashboard`) — expandable pattern for other surfaces

---

## Goal

Replace the static 12-column CSS grid with a Grafana-style drag+drop, resizable widget grid. Layout persists per-user via dual-write (localStorage + OpenNMS user properties API).

---

## Library

**gridstack.js** with the official Vue 3 wrapper. Framework-agnostic core makes the pattern reusable across Node Detail, Surveillance Views, etc. without adopting a new library per surface.

---

## Data Model

`WidgetConfig` drops `colSpan`, gains gridstack coordinates:

```ts
interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  // layout
  x: number    // column position (0–11)
  y: number    // row position
  w: number    // width in columns (1–12)
  h: number    // height in row units
  // widget settings (unchanged)
  categories: string[]
  limit: number
  refreshInterval: number
  severities: string[]
}
```

**Grid constants:**
- 12 columns
- Row height: 150px
- Default layout:
  - Summary: `{x:0, y:0, w:12, h:2}`
  - Outages: `{x:0, y:2, w:6,  h:3}`
  - Alarms:  `{x:6, y:2, w:6,  h:3}`
  - Nodes:   `{x:0, y:5, w:12, h:3}`

**Migration:** localStorage configs lacking `x`/`y`/`h` are discarded and replaced with defaults (one-time, acceptable for a layout preference).

---

## Persistence

Dual-write, server-first on read.

**Load sequence (dashboard mount):**
1. `GET /rest/users/{username}/properties` → key `ui.dashboard.layout`
2. Found + valid → use it, write to localStorage as cache
3. Else → try localStorage
4. Else → default config

**Save sequence (any layout change):**
1. Write localStorage immediately (synchronous)
2. Debounce 2s → `PUT /rest/users/{username}/properties`

Username sourced from `mainMenu.username` (already in Pinia menu store).

---

## Components

### New: `useDashboardLayout` composable

Reusable core. Accepts:
- `containerRef: Ref<HTMLElement | null>` — gridstack mount target
- `widgets: Ref<WidgetConfig[]>` — reactive widget list
- `onLayoutChange: (items: GridStackNode[]) => void` — fired on drag/resize

Owns gridstack instance lifecycle (init on mount, destroy on unmount). Handles programmatic widget add/remove without triggering spurious layout change events.

This is the unit dropped into any future surface.

### `DashboardGrid.vue` — rewritten

- Strips CSS grid
- Renders gridstack container + one gridstack item div per widget (keyed by `id`)
- `WidgetFrame` slots inside each item — gridstack owns positioning, WidgetFrame owns chrome
- Drag handle: gridstack `handle` option points to `.widget-drag-handle` class on WidgetFrame title bar

### `dashboardStore.ts` — extended

New action: `updateLayout(items: GridStackNode[])` — maps gridstack node list back to `WidgetConfig[]` (updates `x`, `y`, `w`, `h`), triggers dual-write. Existing actions (`addWidget`, `removeWidget`, `updateWidget`) updated to include `x`/`y`/`w`/`h`.

### `dashboardConfigService.ts` — extended

New functions: `loadFromServer(username)`, `saveToServer(username, config)`. Uses existing `rest` axios instance. Property key: `ui.dashboard.layout`. Value: JSON-stringified `DashboardConfig`.

### `Dashboard.vue` — minor

Remove `colSpan` from `WIDGET_DEFAULTS`.

### `WidgetConfigDialog.vue` — minor

Remove width/colSpan picker (width set by dragging).

### `WidgetFrame.vue` — minor

Add `.widget-drag-handle` class to title bar element.

---

## Expandability Pattern

To add drag/resize to a new surface:
1. Add `x`, `y`, `w`, `h` to that surface's item config type
2. Import `useDashboardLayout` with that surface's container ref and item list
3. Wire `onLayoutChange` to that surface's store/persistence

No new library adoption required per surface.

---

## Out of Scope

- Mobile/responsive breakpoints (gridstack supports this; deferred)
- Widget library expansion (new widget types)
- Multi-dashboard / named dashboard tabs
