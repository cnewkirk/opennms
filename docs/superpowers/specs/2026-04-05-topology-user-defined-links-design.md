# Topology User-Defined Links — Design Spec

## Problem

OpenNMS supports user-defined links in the topology via a REST API and PostgreSQL-backed model, but the only way to create them is by hand-crafting XML or JSON and POSTing to `/rest/v2/userdefinedlinks`. This is unintuitive. Network engineers should be able to visually connect two ports directly from the topology map.

## User Flow

1. Right-click a node on the topology canvas.
2. Context menu appears with **"Create Link..."** option.
3. Canvas enters **linking mode**: cursor changes, a top banner reads "Select target node — click to link, Esc to cancel." Nodes highlight on hover.
4. Click the target node.
5. **Create Link modal** opens showing:
   - Source node label + interface dropdown (unified SNMP + IP list)
   - Target node label + interface dropdown (unified SNMP + IP list)
   - Link label text field (required)
   - Create / Cancel buttons
6. On submit: edge drawn immediately (dashed style), POST in background.
7. On API failure: edge removed, error snackbar shown.

Escape or clicking empty canvas cancels linking mode at any point.

## Interface Merging Strategy

Users should not need to understand the distinction between SNMP and IP interfaces. We fetch both for each node and merge into a single list:

- **SNMP interfaces** (`GET /v2/nodes/{id}/snmpinterfaces`): display as `ifName` (e.g. `ge-0/0/0`). If an IP interface is bound to the same `ifIndex`, append the IP address in parentheses: `ge-0/0/0 (10.0.1.1)`.
- **IP-only interfaces** (no matching SNMP record by `ifIndex`): display as `ipAddress (hostname)` or just `ipAddress` if no hostname.
- Sort alphabetically by display label.

This gives network engineers the port names they expect while still surfacing IP-only interfaces.

## Visual Design

- **User-defined edges**: dashed line (`line-style: dashed`), primary/accent blue color. Visually distinct from auto-discovered solid-line edges.
- **Context menu**: uses `cytoscape-cxtmenu` plugin — radial menu on right-click, consistent with graph tool conventions.
- **Linking mode banner**: minimal top bar overlaying the canvas, not a full-page takeover.

## Detail Panel Behavior

When a user-defined edge is selected in the detail panel:

- Show link label, component labels (source port / target port), and owner.
- Show a **"Delete Link"** button.
- Delete is optimistic: remove edge immediately, `DELETE /rest/v2/userdefinedlinks/{dbId}` in background. On failure, restore edge and show error snackbar.
- Auto-discovered edges do NOT show the delete button — only user-defined links are editable.

## Layer Integration

- User-defined links appear as a **"User Defined"** layer toggle in the topology toolbar, alongside LLDP, OSPF, IS-IS, CDP, etc.
- They are merged into the **"All"** layer, with `'User Defined'` included in the edge's `protocols[]` array.
- Follows the same pattern as all other protocol layers.

## Backend

The backend is already complete:

- **Entity**: `UserDefinedLink` (`features/enlinkd/persistence/api/.../model/UserDefinedLink.java`)
  - Fields: `nodeIdA`, `componentLabelA`, `nodeIdZ`, `componentLabelZ`, `linkId`, `linkLabel`, `owner`, `dbId`
- **REST API**: `UserDefinedLinkRestService` (`opennms-webapp-rest/.../v2/UserDefinedLinkRestService.java`)
  - `GET /rest/v2/userdefinedlinks` — list all
  - `POST /rest/v2/userdefinedlinks` — create
  - `GET /rest/v2/userdefinedlinks/{id}` — get one
  - `PUT /rest/v2/userdefinedlinks/{id}` — update
  - `DELETE /rest/v2/userdefinedlinks/{id}` — delete
- **Service**: `UserDefinedLinkTopologyService` and its implementation handle persistence.
- **Database**: `user_defined_links` table in PostgreSQL.

No backend changes are required.

## New Files

| File | Purpose |
|------|---------|
| `ui/src/components/Topology/CreateLinkModal.vue` | Modal with interface dropdowns and link label field |
| `ui/src/services/userDefinedLinkService.ts` | API client for `/rest/v2/userdefinedlinks` CRUD |

## Modified Files

| File | Changes |
|------|---------|
| `ui/src/composables/useTopology.ts` | Init cxtmenu plugin, linking mode state, optimistic edge add/remove |
| `ui/src/stores/topologyStore.ts` | Link mode state (`linkSourceVertex`, `linkTargetVertex`), user-defined link CRUD actions, layer registration |
| `ui/src/components/Topology/TopologyDetailPanel.vue` | Show delete button for user-defined edges, display component labels |
| `ui/src/components/Topology/TopologyToolbar.vue` | Add "User Defined" layer toggle |
| `ui/src/types/topology.ts` | `UserDefinedLink` type, extend `TopologyEdge` with `userDefined` flag and `dbId` |
| `ui/package.json` | Add `cytoscape-cxtmenu` dependency |

## Optimistic Rendering

On link creation:
1. Generate a temporary edge ID.
2. Add edge to Cytoscape with dashed style and `userDefined: true` data.
3. Add edge to store's edge list.
4. POST to REST API.
5. On success: update edge with `dbId` from response `Location` header.
6. On failure: remove edge from Cytoscape and store, show error snackbar.

On link deletion:
1. Remove edge from Cytoscape and store immediately.
2. DELETE via REST API.
3. On failure: restore edge, show error snackbar.

## Owner Auto-Population

The `owner` field is auto-populated from the logged-in user's username (available from the existing whoami endpoint or auth state). Users do not need to fill this in.

## Out of Scope

- Editing existing user-defined link labels/interfaces after creation (can be added later).
- Drag-to-connect interaction (right-click menu is the primary pattern).
- Bulk import/export of user-defined links.
- Backend changes — the REST API and data model are already complete.
