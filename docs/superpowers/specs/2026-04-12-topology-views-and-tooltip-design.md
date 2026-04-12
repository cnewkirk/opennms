# Topology: View Persistence, Element Suppression, Edge Tooltip Both Sides, Light-Mode Halo Fix

**Date:** 2026-04-12
**Branch:** feat/ui-refactor
**Status:** Approved — pending implementation plan

---

## Overview

Four related improvements to the topology UI, grouped into one spec because features 2 and 3 share a data model.

| # | Feature | Scope |
|---|---------|-------|
| 1 | Edge label light-mode halo fix | Frontend only — `useTopology.ts` |
| 2 | YAML-backed server-side view persistence | New JAX-RS resource + Vue service layer |
| 3 | Edit mode + element suppression per view | Frontend state machine + stored in view YAML |
| 4 | Edge tooltip symmetric (both sides of link) | weathermapStore extension + tooltip restructure |

Features 1 and 4 are independent of 2/3 and can ship in any order. Features 2 and 3 must ship together.

---

## Feature 1 — Edge label light-mode halo fix

### Problem

In `useTopology.ts`, `buildStylesheet()` computes `labelOutlineColor` in light mode as
`cssVar('--feather-background') || '#b8c5d8'`. This is the *page* background color. The
Cytoscape canvas renders with its own background (a blue-gray set in the topology SCSS), so
the halo color doesn't match the canvas surface. The mismatch reads as a colored pill behind
edge labels in light mode.

### Fix

In `buildStylesheet()`, after `initCytoscape()` has attached the container to the DOM, read
the canvas container's actual computed background color via `getComputedStyle(containerRef)`.
Use that resolved color as `labelOutlineColor` in light mode. The same `cssVar()` helper
pattern already used throughout the function applies here.

One-line change inside `buildStylesheet()`. No other files affected.

### Acceptance

- In light mode: edge label text readable, no visible background bubble or pill
- In dark mode: no regression (dark-mode path unchanged)

---

## Feature 2 — YAML-backed view persistence

### Goals

- Named topology views persisted server-side so they survive browser clears and can be shared
- Tech leads can curate authoritative diagrams, check YAML files into a repo, review diffs
- Access is scoped: private (per-user), shared (any authenticated user), global (admin-curated)

### On-disk layout

```
$OPENNMS_HOME/etc/topology-views/
  global/                    ← ROLE_ADMIN write, all authenticated users read
    default.yaml
  shared/                    ← ROLE_USER write, all authenticated users read
    prod-noc-core.yaml
    datacenter-east.yaml
  private/
    cnewkirk/                ← only that user reads/writes
      my-draft.yaml
```

Directory is created on first write if absent.

### YAML schema

```yaml
id: prod-noc-core
name: "Production NOC — Core Layer"
description: "Authoritative diagram for the NOC team"
scope: shared          # private | shared | global
owner: cnewkirk        # OpenNMS username
created: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
state:
  layers:
    - enlinkd.lldp
    - enlinkd.cdp
  filters:
    surveillanceCategories: [Routers, Switches]
    cidrs: []
    namePattern: ""
  layout:
    "42": { x: 120, y: 340 }
    "17": { x: 280, y: 120 }
  suppressed:
    vertices: ["99", "101"]
    edges: ["42-17"]
  edgeColorMode: utilization   # protocol | utilization | capacity
  edgeLabels:
    showUtilization: true
    showLocalPort: true
    showRemotePort: true
    showIp: false
    showMac: false
    showSpeed: true
```

### REST API

Base path: `/rest/topology/views`

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| GET | `/rest/topology/views` | ROLE_USER | List all views accessible to caller (metadata only — no `state` blob) |
| GET | `/rest/topology/views/{id}` | ROLE_USER | Full view including state |
| POST | `/rest/topology/views` | ROLE_USER | Create new view. `scope` in body determines directory. Returns created view with assigned `id`. |
| PUT | `/rest/topology/views/{id}` | ROLE_USER | Full overwrite. Caller must own the view or be ROLE_ADMIN. |
| DELETE | `/rest/topology/views/{id}` | ROLE_USER | Delete. Caller must own the view or be ROLE_ADMIN. |

Write rules enforced by the resource:
- `scope: private` → file written under `private/{username}/`
- `scope: shared` → ROLE_USER required; file written under `shared/`
- `scope: global` → ROLE_ADMIN required; file written under `global/`

### Backend implementation

- New class `TopologyViewRestService` in `opennms-webapp-rest`
- Annotated `@Path("/topology/views")` at class level — **no `@Transactional` at class level** (CXF hides `@Path` on CGLIB-proxied classes; see project notes)
- File I/O: Jackson `ObjectMapper` configured with `YAMLFactory` (SnakeYAML-backed); already available transitively in the webapp classpath
- `id` is a filesystem-safe slug derived from the view name on create (lowercased, spaces→hyphens, truncated to 64 chars). IDs must be globally unique across all scope directories — on create, the service scans all three scope directories and appends a numeric suffix until the slug is unique. This ensures `GET /rest/topology/views/{id}` is unambiguous.
- Dates written as ISO-8601 strings

### Frontend

`topologyViewService.ts` — replace stubs with real `axios` calls matching the REST surface above.

`topologyViewStore.ts` — extend with:
- `serverViews: TopologyView[]` — list fetched from server on mount
- `activeView: TopologyView | null` — currently loaded view
- `fetchServerViews()` — calls `GET /rest/topology/views`
- `loadView(view: TopologyView)` — applies view state to topology store, filter store, edge label store, and layout
- `saveActiveView()` — serializes current state into `activeView.state` and calls PUT
- `saveAsNewView(name, scope)` — calls POST

`TopologyView` type in `types/topology.ts` — replace `data: string` (raw JSON blob) with a typed `state` object matching the YAML schema above.

---

## Feature 3 — Edit mode + element suppression

### Goals

- Users can remove vertices and edges from a view without deleting them from OpenNMS
- Suppressions are view-scoped and only take effect within that view
- Accidental suppressions on shared/global views are prevented by an explicit edit mode

### Edit mode state machine

```
BROWSING ──[Edit Current View]──→ EDITING
EDITING  ──[Save]───────────────→ BROWSING  (writes view to server)
EDITING  ──[Discard]────────────→ BROWSING  (rolls back all pending suppressions)
```

Edit mode is local UI state — it does not lock the file on the server. Last-write-wins on save.

### Entering edit mode

"Views" dropdown added to the topology toolbar (replaces or sits alongside the Layout dropdown).

Menu items:
- **Load View** — opens a modal listing server views grouped by scope; selecting one calls `loadView()`
- **Save** — saves current view (only active when `activeView` is set and dirty)
- **Save as New…** — prompts for name + scope, calls `saveAsNewView()`
- **Edit View** — enters edit mode (only active when `activeView` is set)

### Edit mode banner

Identical pattern to the existing link-mode banner in `TopologyGraph.vue`:

```
[ Editing: "Production NOC — Core Layer"  |  Save  |  Discard ]
```

### Suppression UX

While in edit mode, the Cytoscape context menu (right-click) gains:

- On a visible vertex: **Hide from view**
- On a suppressed vertex: **Restore to view**
- On a visible edge: **Hide from view**
- On a suppressed edge: **Restore to view**

The existing "Create Link" context menu item remains in edit mode.

Suppressed elements while in edit mode: rendered at 25% opacity with a dashed border so the
user can see what they have hidden and can restore it. This is a Cytoscape CSS class
`element-suppressed` applied client-side during editing.

On **Save**: suppressed IDs written to `state.suppressed.vertices` / `state.suppressed.edges`
in the view; when any view loads, suppressed elements are removed from the Cytoscape graph
after `syncElements()`.

On **Discard**: pending suppression list cleared, all elements restored to full visibility,
edit mode exited.

### Storage

Suppression lists live inside the view YAML under `state.suppressed`:

```yaml
suppressed:
  vertices: ["99", "101"]   # vertex IDs (string)
  edges: ["42-17"]          # edge keys (min-max format)
```

No separate data structure — suppressions travel with the view.

---

## Feature 4 — Edge tooltip symmetric (both sides)

### Problem

`EdgeLabelData` is built from the A-side node's LLDP/SNMP perspective. The tooltip shows
`localIfName ↔ remotePortId` for ports and `localIp ↔ remoteIp` for IPs, but:
- Remote MAC is absent
- Remote interface speed is absent (link may be asymmetric)
- The bandwidth chart queries only the A-side interface

### weathermapStore changes

`EdgeLabelData` interface gains two fields:

```typescript
remoteMac?: string       // physAddr of target node's connecting interface
remoteIfSpeed?: number   // link speed of target node's connecting interface
```

During `_fetchAll()`, after symmetric LLDP resolves `remoteIfName`, fetch the target node's
SNMP interface record (same `getNodeIpInterfaces` / `getNodeEnlinkd` calls already used for
`localMac` / `ifSpeed`) and populate `remoteMac` and `remoteIfSpeed`.

### EdgeTooltipState changes

```typescript
tgtNodeId: string | null   // added alongside existing srcNodeId
```

Populated in `useTopology.ts` `mouseover` handler: `cy.getElementById(tgtId)?.data('nodeID')`.

### Tooltip layout

Replace the current mixed `↔` rows with explicit A-side / Z-side columns:

```
┌─────────────────────────────────────┐
│  router-a  ←──────────→  router-b   │  endpoint header
├──────────────┬──────────────────────┤
│  A-side      │  Z-side              │
│  eth0/1      │  GigabitEthernet0/1  │  Port
│  10.0.0.1    │  10.0.0.2            │  IP
│  aa:bb:cc:…  │  dd:ee:ff:…          │  MAC
│  1 Gbps      │  10 Gbps             │  Speed
├──────────────┴──────────────────────┤
│  utilization badge + rates          │
├─────────────────────────────────────┤
│  Bandwidth · last 2h                │
│  4 series: A↑ A↓ Z↑ Z↓             │
└─────────────────────────────────────┘
```

Columns only rendered when data exists for that side. If Z-side data is unavailable (LLDP
didn't resolve, target node not polled), the Z-side column is omitted and the layout falls
back to the existing single-column display.

### Bandwidth chart

Second resource ID built from `tgtNodeId` + `remoteIfName` + `remoteMac` (same formula as
`localResourceId`). Both resource IDs passed to a single `PersesPanel` as a four-source
batch query:

```
sources: [
  { resourceId: localRid,  attribute: 'ifHCInOctets',  label: 'aInOctets',  transient: true },
  { resourceId: localRid,  attribute: 'ifHCOutOctets', label: 'aOutOctets', transient: true },
  { resourceId: remoteRid, attribute: 'ifHCInOctets',  label: 'zInOctets',  transient: true },
  { resourceId: remoteRid, attribute: 'ifHCOutOctets', label: 'zOutOctets', transient: true },
]
expressions: [
  { value: 'aInOctets * 8',  label: 'A In (bps)'  },
  { value: 'aOutOctets * 8', label: 'A Out (bps)' },
  { value: 'zInOctets * 8',  label: 'Z In (bps)'  },
  { value: 'zOutOctets * 8', label: 'Z Out (bps)' },
]
```

Chart height remains 180px. If the remote resource ID is null, falls back to the current
two-series query.

---

## Files changed (summary)

### Frontend
| File | Change |
|------|--------|
| `ui/src/composables/useTopology.ts` | Halo fix; `tgtNodeId` in tooltip state; edit mode state; suppression rendering |
| `ui/src/types/topology.ts` | `TopologyView.state` typed object; `TopologyView` scope types |
| `ui/src/stores/topologyViewStore.ts` | `serverViews`, `activeView`, `fetchServerViews`, `loadView`, `saveActiveView`, `saveAsNewView` |
| `ui/src/stores/weathermapStore.ts` | `remoteMac`, `remoteIfSpeed` in `EdgeLabelData`; fetch Z-side interface |
| `ui/src/services/topologyViewService.ts` | Replace stubs with real REST calls |
| `ui/src/components/Topology/TopologyEdgeTooltip.vue` | A/Z column layout; four-series chart |
| `ui/src/components/Topology/TopologyToolbar.vue` | Views dropdown; edit mode entry |
| `ui/src/components/Topology/TopologyGraph.vue` | Edit mode banner; suppression context menu items |

### Backend
| File | Change |
|------|--------|
| `opennms-webapp-rest/src/.../TopologyViewRestService.java` | New JAX-RS resource |
| `opennms-webapp-rest/src/.../ApplicationConfig.java` (or equivalent) | Register new resource |

---

## Out of scope

- Real-time collaborative editing (last-write-wins is acceptable)
- View-level access control beyond scope tiers (no per-view ACL)
- Mermaid export (noted as a future bonus, not part of this spec)
- Suppressing protocol layers within a view (handled by the existing layer checkboxes)
