# Surveillance Dashboard — Vue Replacement Design

**Date:** 2026-04-06  
**Route:** `/surveillance-dashboard`  
**Replaces:** `dashboard.jsp` (Vaadin surveillance-views iframe)  
**Also replaces:** `surveillance-view.jsp`

---

## Context and Purpose

The Vaadin surveillance dashboard is the main network status overview in OpenNMS. It renders a category-by-node grid (rows = node groupings like "Routers", columns = environment groupings like "PROD/TEST/DEV") where each cell is colored by the worst active alarm severity among nodes at the intersection. This is the highest-traffic page in the admin UI.

This replacement also establishes the **canonical Vaadin→Vue pattern** for future pages. The architecture, file layout, and conventions here should be followed for all subsequent replacements.

---

## Data Model

### Source: `GET /api/v2/surveillance-view-config`

Returns the view definition used to build the grid structure:

```typescript
interface SurveillanceView {
  name: string
  refreshSeconds: number
  rows: { label: string; categories: string[] }[]
  columns: { label: string; categories: string[] }[]
}
```

### Computed per cell

For each cell `(row i, col j)`:
- **Node set** = nodes where `node.categories` overlaps `row[i].categories` **AND** overlaps `col[j].categories`
- **Severity** = worst active alarm severity among that node set (CLEARED/NORMAL → Normal, else worst)
- **Node count** = `nodeIds.size`
- **Down count** = nodes in set with at least one active outage

### Data sources (all fetched in parallel on load)

| Data | Endpoint | Notes |
|------|----------|-------|
| View config | `GET /api/v2/surveillance-view-config` | Existing endpoint |
| All nodes | `GET /api/v2/nodes?limit=1000` | Includes `categories[]` |
| Active alarms | `GET /api/v2/alarms?limit=1000&_s=severity!=CLEARED;severity!=NORMAL` | Unresolved non-normal |
| Active outages | `GET /api/v2/outages?limit=1000&_s=ifRegainedService==null` | Currently open |

**Why client-side intersection:** The v2 FIQL API returns 500 for `categories.name==X` on nodes (Hibernate mapping gap). Fetching all nodes and computing intersections client-side is correct and performant for typical deployment sizes.

---

## Severity Color Mapping

Uses existing `ui/src/styles/_severities.scss`. Cell background class:

| Worst alarm severity | Cell class | Color |
|---------------------|------------|-------|
| No alarms / NORMAL | `sev-normal` | Green |
| WARNING | `sev-warning` | Yellow |
| MINOR | `sev-minor` | Orange |
| MAJOR | `sev-major` | Red |
| CRITICAL | `sev-critical` | Dark red |
| No nodes in cell | `sev-empty` | Neutral/gray |

Severity rank (highest wins): CRITICAL > MAJOR > MINOR > WARNING > NORMAL.

---

## Component Architecture

Follows the canonical container/component/service pattern from `JmxConfigGenerator` and `MibCompiler`.

```
ui/src/
  containers/
    SurveillanceDashboard.vue        ← page container: breadcrumbs, view picker, refresh timer
  components/
    SurveillanceDashboard/
      SurveillanceGrid.vue           ← renders the N×M table
      SurveillanceCellDetail.vue     ← slide-in panel for clicked cell (nodes list + alarm count)
  services/
    surveillanceDashboardService.ts  ← data fetching + cell computation logic
```

### `surveillanceDashboardService.ts`

```typescript
// Public API
fetchDashboardData(viewName?: string): Promise<DashboardData>

interface DashboardData {
  view: SurveillanceView
  grid: CellData[][]  // [rowIndex][colIndex]
}

interface CellData {
  nodeIds: number[]
  nodeCount: number
  downCount: number       // nodes with ≥1 active outage
  worstSeverity: Severity // NORMAL | WARNING | MINOR | MAJOR | CRITICAL
}
```

All computation (intersection, severity ranking) lives here, not in components.

### `SurveillanceDashboard.vue` (container)

- Fetches via `surveillanceDashboardService`
- If config has multiple views, shows a `<FeatherSelect>` to pick active view
- Starts auto-refresh interval (`view.refreshSeconds`, min 30s enforced)
- Shows `<BreadCrumbs>` with "Home > Dashboard"
- Passes `view` and `grid` as props to `<SurveillanceGrid>`
- Shows loading state (`<FeatherSpinner>`) during initial fetch
- Shows error state if config fetch fails

### `SurveillanceGrid.vue`

- Renders a `<table>` — not a component grid library, just HTML table for simplicity
- Header row: empty corner cell + column labels
- Each body row: row label (left) + N cells
- Each cell: click handler sets `selectedCell` in parent, background class from severity
- Cell content: `nodeCount` total, `downCount` down (e.g. "3 / 1 down")
- Empty cells (no nodes): muted, no count shown

### `SurveillanceCellDetail.vue`

A panel that appears below (or beside) the grid when a cell is clicked:
- Header: "Row Label × Column Label"
- Lists nodes in the cell with their alarm severity badge and outage indicator
- Each node is a link to `/node/:id`
- If cell has 0 nodes, shows "No nodes match these categories"
- Dismissed by clicking another cell or pressing Escape

---

## Routing

### New route in `router/index.ts`

```typescript
{
  path: '/surveillance-dashboard',
  name: 'Surveillance Dashboard',
  component: () => import('@/containers/SurveillanceDashboard.vue')
}
```

No role guard — same as the Vaadin page, accessible to all logged-in users.

### JSP redirects

**`dashboard.jsp`** (the "Surveillance Dashboard" sidebar link):
```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-dashboard"); %>
```

**`surveillance-view.jsp`** (the "Surveillance View" sidebar link — same destination):
```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-dashboard"); %>
```

### `legacyToVueRoutes` entries in `SideMenu.vue`

```typescript
'dashboard.jsp':         'ui/index.html#/surveillance-dashboard',
'surveillance-view.jsp': 'ui/index.html#/surveillance-dashboard',
```

---

## Auto-Refresh

- Timer starts after first successful data load
- Interval = `Math.max(view.refreshSeconds, 30) * 1000` ms
- Timer cleared `onUnmounted`
- Refresh indicator: subtle "Last updated HH:MM:SS" text, no spinner (non-disruptive)

---

## Dark Mode

- Import both `open-light.css` and `open-dark.css` (already in `main.ts`)
- Cell severity colors use SCSS vars — no hardcoded hex
- Table borders use `var($border-light-on-surface)`
- Row/column headers use `var($surface-dark)` background

---

## Error Handling

- Config 404 → show "No surveillance views configured" empty state with link to config page
- Node/alarm/outage fetch failure → show grid with "?" in cells, toast error via `useSnackbar`
- No node matches for a cell → show cell as empty/gray, not an error

---

## What This Is NOT

- No graphs or RTC (resource/time-series) data — the Vaadin detail had availability charts; those are deferred
- No drill-down to individual service status — node link goes to Node Detail page
- No edit/config from this page — that's the existing `#/surveillance-views-config` page

---

## Pattern Notes for Future Vaadin Replacements

This page demonstrates the full replacement pattern:

1. **Check what API exists first.** `surveillance-view-config` was already there. Avoid building REST endpoints unless truly necessary.
2. **Client-side computation is fine** when data volume is bounded (all nodes, all alarms).
3. **Container owns data fetching.** Components take props, emit events — no `useRoute()` in components.
4. **Service owns business logic.** Cell intersection and severity ranking live in the service, not the component.
5. **JSP = redirect only.** Replace the entire file, never prepend.
6. **Both sidebar entry AND JSP** must be updated — `legacyToVueRoutes` for sidebar, JSP redirect for direct URL.
7. **`dashboard.jsp` ≠ `#/dashboard`.** The surveillance dashboard has its own route `#/surveillance-dashboard`. Never redirect it to the generic widget dashboard.
