# Topology Diagram Enhancements — Design Spec

**Date:** 2026-04-07  
**Branch:** feat/ui-refactor  
**Approach:** Views-first / unified state (Approach B)

---

## Overview

Six coordinated enhancements to the OpenNMS topology diagram, anchored by consolidating fragmented view state into a single model that all features read from and write to.

1. Unified View State Model
2. Named View Persistence (global, shared, private)
3. Node Filtering (surveillance category, CIDR, name)
4. Friendly Name Model
5. Edge Endpoint Labels (per-side interface/IP)
6. Grid Snap

---

## 1. Unified View State Model

### Problem

View state is currently scattered:
- `edgeLabelStore.ts` — edge label toggles in localStorage
- `useTopology.ts` — node positions in localStorage (key per active-layer combo)
- `topologyStore.ts` — active layers in reactive memory (not persisted)

This fragmentation makes saved views impossible to implement correctly — a view can't capture what it can't see.

### Solution

New `topologyViewStore.ts` replaces `edgeLabelStore` and owns all view state:

```typescript
interface TopologyViewState {
  activeLayers: string[]
  nodePositions: Record<string, { x: number; y: number }>
  filters: {
    surveillanceCategories: string[]   // e.g. ["Production", "Routers"]
    cidrs: string[]                    // e.g. ["10.0.0.0/8"]
    namePattern: string                // substring match; prefix "/" for regex
  }
  edgeLabels: {
    showUtilization: boolean
    showLocalPort: boolean
    showRemotePort: boolean
    showIp: boolean
    showMac: boolean
    showSpeed: boolean
  }
  viewport: { pan: { x: number; y: number }; zoom: number }
  gridSnap: { enabled: boolean; size: number }
}
```

### Migration

- `edgeLabelStore.ts` is deleted; all consumers updated to read from `topologyViewStore`.
- Layout localStorage logic in `useTopology.ts` (`localStorageKey`, `savedPositions`, `saveLayout`, `resetLayout`) is removed and delegated to `topologyViewStore`.
- Existing `edgeLabelStore` localStorage key `opennms-edge-label-config` is **not migrated**. That data is intentionally discarded; edge label settings reset to `TopologyViewState` defaults on first load after the upgrade.
- Existing localStorage key format is `opennms-topo-layout-enlinkd-{sorted-layers}` (e.g. `opennms-topo-layout-enlinkd-lldp+ospf`). `topologyViewStore` must read this exact pattern when migrating existing saved positions — the `enlinkd-` prefix is not optional.

### activeLayers Ownership

`activeLayers` and `layoutKey` remain in `topologyStore` as runtime computed state — they drive `vertices`, `edges`, and graph sync logic that already lives there. `topologyViewStore` acts as the **persistence layer**: it reads `activeLayers` from `topologyStore` when saving a view, and writes back to `topologyStore.setActiveLayers()` when loading one. There is no circular dependency — `topologyStore` does not import from `topologyViewStore`.

**`setActiveLayers()` behavior:** This is not a plain setter. It must:
1. If `availableLayers` is empty (fresh session, `loadContainers()` not yet called), call `loadContainers()` first and await it.
2. Resolve each namespace string in the incoming `string[]` against `availableLayers` to get a `TopologyLayer` object (which carries `containerId`, `namespace`, and `label` — all required by `ensureLayerLoaded`). Any namespace not found in `availableLayers` after resolution is dropped with a warning.
3. For each resolved layer missing from `layerCache`, call `ensureLayerLoaded()`.
4. Update `activeLayers` to the successfully loaded subset.

This ensures that loading a saved view in a fresh browser session produces a populated graph rather than an empty one. If any layer fails to load, it is dropped with a warning — the rest of the view still loads.

---

## 2. Named View Persistence

### View Shape

```typescript
interface TopologyView {
  id: string
  name: string
  description?: string
  scope: 'global' | 'shared' | 'private'
  owner: string           // username (authStore.whoAmI.id); 'system' is a reserved sentinel for the global default — the backend DAO must not attempt to resolve it as a user record
  state: TopologyViewState
  createdAt: string
  updatedAt: string
}
```

### Storage

The project has no server-side user preferences API. All user-scoped persistence uses browser localStorage (`opennms-preferences` key via `localStorageService.ts`). Private views and personal defaults follow this same pattern.

| Scope | Storage | Key / Endpoint |
|-------|---------|----------------|
| Private views | localStorage | `opennms-topology-private-views` (JSON array) |
| Personal filter defaults | localStorage | `opennms-topology-filter-defaults` (JSON object) |
| Shared views | New DB-backed table | `GET/POST/PUT/DELETE /api/v2/topology/views` |
| Global default | Same table, `scope: 'global'` | Same endpoint, admin-only write |

**Cross-device sync of private views is explicitly out of scope.** Private views live in the browser that created them, consistent with existing topology layout persistence.

The `/api/v2/topology/views` endpoint follows OpenNMS REST conventions. Shared views are readable by all authenticated users, writable by owner. The global view is writable only by users with the `ROLE_ADMIN` authority.

### Page Load Behavior

Page load proceeds in parallel to avoid stalling graph render:

1. **In parallel:** Fetch global default view from `/api/v2/topology/views?scope=global` AND read personal filter defaults from localStorage.
2. Apply global default as baseline state (if present). If the fetch fails (404 = no default set; network error = treat as no default, log warning, continue).
3. Overlay personal filter defaults on top (filters only — positions from global default preserved unless user has their own saved positions in `opennms-topo-layout-enlinkd-*`).
4. Restore last-used viewport from localStorage.

Graph renders with whatever state is available immediately — no blocking wait on the global default fetch. If the fetch resolves after initial render, the view is applied and the graph re-syncs.

### UI

- **Views panel** in the toolbar (dropdown button). Sections: Global Default, Shared Views, My Views.
- **Save current view** — prompts for name, description, scope (private / shared). Admin users also see "Set as Global Default."
- **Load view** — replaces `TopologyViewState` wholesale. Confirmation uses a **dirty flag** (set on any user interaction after page load or last save) rather than deep equality comparison.
- **Delete / rename** — available for views the current user owns.
- **"Save as my defaults"** — in the filter panel; persists filter + label prefs to localStorage without creating a named view.

---

## 3. Filter System

### Architecture

Filtering is **client-side**. The backend serves all nodes and edges; a computed property in `topologyStore` applies active filters before the graph renders. No new backend query parameters required.

### Filter Types

| Type | Logic | Data source |
|------|-------|-------------|
| Surveillance categories | Node belongs to ≥1 selected category (OR) | See data path note below |
| CIDR | Node's `ipAddress` falls within any listed CIDR (OR) | Client-side CIDR math |
| Name pattern | Case-insensitive substring; prefix `/` for regex | Node `label` field |

**Surveillance category data path:** `TopologyVertex` has no `categories` field. When a category filter is activated, the filter panel triggers a batch fetch: for each selected category name, call `GET /api/v2/nodes?_s=categories.name=={categoryName}&limit=1000` (FIQL syntax, v2 endpoint — consistent with existing `useNodeQuery.ts` patterns). The union of all matching node IDs across selected categories is cached in the filter store as a `Set<string>`. `TopologyVertex.nodeID` is typed `string | undefined`; API responses return numeric IDs — store as strings (i.e. `String(node.id)`) so comparison is type-safe. Vertices are filtered by checking `nodeID !== undefined && categoryNodeIdSet.has(nodeID)`. The cache is invalidated whenever the selected category set changes. Nodes without a `nodeID` (non-OpenNMS vertices) are treated as not matching any category filter.

All active filter types are **ANDed** — a node must pass every active filter to be visible.

**Edge behavior:** An edge is shown only if both its endpoint nodes are visible. Filtered-out nodes take their edges with them.

**No filters active:** Full graph shown (current behavior, no regression).

**Graph sync:** `useTopology.syncElements` switches from reading `store.vertices`/`store.edges` to `store.filteredVertices`/`store.filteredEdges`. The watcher at the bottom of `useTopology.ts` must also be updated to watch `filteredVertices`/`filteredEdges`. When no filters are active, `filteredVertices` must return `vertices.value` directly (not a new array) so the watcher does not trigger a spurious `syncElements` call on every render tick.

### UI

A **Filter panel** in the toolbar (collapsible section, shows badge count when filters are active):
- Surveillance category multi-select chip list (loaded from `/rest/categories`)
- CIDR input with add/remove chips, client-side CIDR format validation
- Name pattern text input with placeholder "Search nodes..."
- "Clear all" resets all three filters
- "Save as my defaults" persists current filter state to localStorage
- "Clear my defaults" removes personal filter defaults from localStorage

---

## 4. Friendly Name Model

### Implementation

New file: `ui/src/components/Topology/fieldLabels.ts`

```typescript
export const FIELD_LABELS: Record<string, string> = {
  // Protocol namespaces
  lldp: 'LLDP',
  ospf: 'OSPF',
  isis: 'IS-IS',
  bgp: 'BGP',
  mpls: 'MPLS',
  cdp: 'CDP',
  // Edge label fields
  ospfArea: 'OSPF Area',
  ifName: 'Interface',
  ifDescr: 'Interface Description',
  ifSpeed: 'Speed',
  ipAddress: 'IP Address',
  localIp: 'Local IP',
  remoteIp: 'Remote IP',
  localIfName: 'Local Interface',
  remotePortId: 'Remote Port',
  localMac: 'MAC Address',
  // extend as new fields are exposed
}

export function humanize(key: string): string {
  return FIELD_LABELS[key]
    ?? key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
}
```

### Usage

`humanize()` is called anywhere the UI surfaces an API property name:
- Edge tooltip field labels
- Filter panel section headings
- Detail panel property keys
- Layer dropdown labels

No admin UI. The map grows at the code level as new fields are exposed.

**Fallback behavior:** The regex fallback in `humanize()` is a last resort for cleanly-named camelCase English properties only. Any API property name that contains acronyms, abbreviations, or non-English terms (e.g. `BGPLocalAS`, `ospfNbrState`) **must** be added to `FIELD_LABELS` — the fallback will mangle them. The convention is: when adding a new field to the topology UI, add its label to `FIELD_LABELS` at the same time.

---

## 5. Edge Endpoint Labels

### Problem

All edge data (local interface, remote interface, local IP, remote IP) is currently rendered as a single centered label. Interface/IP associated with a link should appear on the device's side of the link.

### Solution

Use Cytoscape's native `source-label` and `target-label` properties.

| Position | Content |
|----------|---------|
| `source-label` (near source node) | Local interface name + local IP |
| `target-label` (near target node) | Remote interface name + remote IP |
| `label` (center, unchanged) | Protocols + utilization |

**Stylesheet additions:**
```javascript
{
  'source-label': 'data(sourceLabel)',
  'target-label': 'data(targetLabel)',
  'source-text-offset': 40,
  'target-text-offset': 40,
  'font-size': 9,
  'text-background-opacity': 0.75,
  'text-background-color': 'var(--feather-shade-5)',
  'text-background-shape': 'roundrectangle',
}
```

**Visibility:**
- `sourceLabel` is set to `''` when both `showLocalPort` and `showIp` are false (no local interface, no local IP to show on source side).
- `targetLabel` is set to `''` when both `showRemotePort` and `showIp` are false (no remote interface, no remote IP to show on target side).
- The center label stops including ports and IPs when endpoint labels are active — no duplication.

**Known limitation:** `source/target-text-offset` positioning degrades on very short or tightly curved edges. An HTML overlay layer for fine-grained control is a future improvement; Cytoscape native is sufficient for the initial implementation.

---

## 6. Grid Snap

### Snap-on-Drag

On the `dragfree` event (already wired), before persisting node positions, snap coordinates to the nearest grid point:

```typescript
const snapToGrid = (v: number, size: number) => Math.round(v / size) * size
```

Grid size defaults to 20px. Stored in `TopologyViewState.gridSnap.size` so it's captured by saved views. When `gridSnap.enabled` is false, coordinates are saved as-is (current behavior).

### Align-to-Grid Button

In the toolbar: snaps all current node positions to the nearest grid point in one pass, saves layout, re-renders. Useful for cleaning up existing freehand layouts.

### Visual Grid

When snap is enabled, a `grid-snap-active` CSS class is applied to the Cytoscape container:

```css
.grid-snap-active {
  background-image:
    linear-gradient(to right, var(--feather-shade-3) 1px, transparent 1px),
    linear-gradient(to bottom, var(--feather-shade-3) 1px, transparent 1px);
}
```

The `background-size` is set via **inline style binding** on the container element so it reacts to `gridSnap.size` changes:
```html
<div
  class="cy-container"
  :class="{ 'grid-snap-active': viewStore.gridSnap.enabled }"
  :style="viewStore.gridSnap.enabled
    ? { backgroundSize: `${viewStore.gridSnap.size}px ${viewStore.gridSnap.size}px` }
    : {}"
/>
```

Cosmetic only. Follows current theme tokens.

### Toggle

Grid icon button in the toolbar. State in `TopologyViewState.gridSnap.enabled`, captured by saved views.

---

## File Impact Summary

| File | Change |
|------|--------|
| `stores/topologyViewStore.ts` | **New** — replaces edgeLabelStore, owns all view state |
| `stores/edgeLabelStore.ts` | **Deleted** |
| `stores/topologyStore.ts` | `activeLayers` and `layoutKey` stay here (runtime source of truth). Add: `setActiveLayers()` action — calls `ensureLayerLoaded` for any layers missing from `layerCache` before updating `activeLayers`, with graceful drop-and-warn on fetch failure (called by viewStore on view load); `filteredVertices`/`filteredEdges` computeds that apply filter state from viewStore. Imports viewStore for filter state only — no circular dep since viewStore does not import topologyStore. |
| `composables/useTopology.ts` | Remove layout localStorage logic; add endpoint label mapping; add grid snap |
| `components/Topology/TopologyToolbar.vue` | Add Views panel, Filter panel, Grid toggle, Align button |
| `components/Topology/TopologyEdgeTooltip.vue` | Use `humanize()` for field labels |
| `components/Topology/fieldLabels.ts` | **New** — FIELD_LABELS map + humanize() |
| `services/topologyViewService.ts` | **New** — REST calls for shared/global views |
| `types/topology.ts` | Add TopologyView, TopologyViewState, TopologyFilter types |

Backend:
| File | Change |
|------|--------|
| New REST controller | `TopologyViewsRestService.java` — CRUD for shared/global views (`/api/v2/topology/views`) |
| New JPA entity | `TopologyView.java` — maps `topology_views` table |
| New DAO | `TopologyViewDao.java` + `TopologyViewDaoHibernate.java` |
| New DB migration | Liquibase changeset — `topology_views` table (id, name, description, scope, owner, state JSON, created_at, updated_at) |

---

## Out of Scope

- Node label aliases (friendly names for device hostnames) — deferred
- HTML overlay layer for edge endpoint label fine-tuning — deferred
- Alignment guides (snap to other nodes) — deferred
