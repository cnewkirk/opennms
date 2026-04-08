# Linkification v2 — Node Detail Tabs + Service Card Interactions

**Date:** 2026-04-07
**Branch:** feat/ui-refactor
**Status:** Approved

## Objective

Two related goals addressed together:

1. **Node detail tab redesign** — reduce scrolling on the node detail page by moving content into top-level tabs. This also provides a clean navigation target for service card clicks.
2. **Service card interactions** — make availability panel service cards clickable (jump to Graphs tab) and hoverable (show a live Perses response-time chart tooltip).
3. **Remaining linkification** — convert legacy `<a href>` and plain-text entity references to `<router-link>` in NodesTable, MapAlarmsGrid, and MapNodesGrid.

---

## Section 1: Node Detail Tab Restructure

### Tab Layout

`NodeDetails.vue` is restructured to use `<FeatherTabContainer>` with 4 top-level tabs. NodeHeader and AdminActionsBar remain pinned above the tabs, always visible. PerspectiveToggle moves into the tab bar area (right-aligned).

| Tab key | Label | Content |
|---------|-------|---------|
| `overview` | Overview | AvailabilityPanel + NodeInfoPanel + CategoryPanel |
| `activity` | Activity | NodeActivityTab (Alarms / Events / Outages / Links sub-tabs) |
| `graphs` | Resource Graphs | ResourceGraphsPanel |
| `network` | Network | NetworkTab |

### URL Sync

Active tab is reflected in the URL via `?tab=<key>`. Default is `overview`. Implementation follows the existing pattern in `NodeActivityTab.vue`:

- On mount: read `route.query.tab`, set active tab index.
- On tab change: `router.replace({ query: { ...route.query, tab: <key> } })`.
- Nested Activity sub-tabs (`?tab=alarms`, `?tab=events`, etc.) continue to work — they are passed as `defaultTab` prop to NodeActivityTab when the Activity tab is active.

### Perspective Mode Changes

Previously `ResourceGraphsPanel` was conditionally hidden in `perspectiveStore.isProblems` mode. With tabs, the Resource Graphs tab is always present — users can navigate to it any time. The `perspectiveStore.isProblems` guard on ResourceGraphsPanel is removed.

The "View Graphs →" button (previously shown in problems mode) is removed — the tab makes it redundant.

The `CollapsibleSection` wrapping NodeInfoPanel + CategoryPanel in problems mode is retained as-is.

### Files Modified

- `ui/src/containers/NodeDetails.vue` — primary restructure

---

## Section 2: Service Card Interactions

### Click Behavior

Each `avail-card` in `AvailabilityPanel.vue` becomes clickable. On click, the component emits `go-graphs`. `NodeDetails.vue` handles this by calling:

```ts
router.push({ query: { ...route.query, tab: 'graphs' } })
```

`AvailabilityPanel` receives a prop `clickable: boolean` (default `true`) so the component remains reusable outside the node detail page without unexpected navigation side-effects.

Visual treatment: `cursor: pointer` on `.avail-card`, subtle box-shadow lift on hover. No arrow or underline — the card shape is the affordance.

### Hover Tooltip (Perses)

On `mouseenter` over an avail-card, after a 300ms debounce (prevents flicker on accidental pass-through), a floating `ServiceGraphTooltip.vue` popover appears positioned relative to the card.

**Tooltip contents:** A `PersesPanel` at 320×200px showing the response-time graph for the service's IP address over the last 6 hours.

**Resource ID construction:**

```ts
const resourceId = `node[${nodeId}].responseTime[${ip.replace(/\./g, '_')}]`
```

This follows OpenNMS's standard per-interface response-time resource naming convention.

**No-data handling:** If no response-time resource exists for the IP (e.g. a passive service with no poller), the tooltip is suppressed — no error state shown.

**Dismiss:** `mouseleave` from the card or tooltip, or click-away.

### New Component

`ui/src/components/NodeDetail/ServiceGraphTooltip.vue` — encapsulates hover state, positioning (via `getBoundingClientRect`), debounce timer, and `PersesPanel` rendering. Keeps AvailabilityPanel clean.

### Files Modified / Created

- `ui/src/components/NodeDetail/AvailabilityPanel.vue` — add click emit, hover trigger, `clickable` prop
- `ui/src/components/NodeDetail/ServiceGraphTooltip.vue` — new component

---

## Section 3: Remaining Linkification

Plain template changes — no new routes, stores, or APIs.

### NodesTable.vue

`ui/src/components/Nodes/NodesTable.vue` — node ID and label columns currently use `<a :href="computeNodeLink(node.id)" @click="onNodeLinkClick(node.id)" target="_blank">`. Replace with `` <router-link :to="`/node/${node.id}`"> ``. Remove `onNodeLinkClick` if unused. Retain `computeNodeLink` if still referenced by `NodeDetailsDialog`.

### MapAlarmsGrid.vue

`ui/src/components/Map/MapAlarmsGrid.vue` — alarm ID and nodeLabel columns are plain text. Replace:

- `{{ alarm.id }}` → `` <router-link :to="`/alarm/${alarm.id}`">{{ alarm.id }}</router-link> ``
- `{{ alarm.nodeLabel }}` → `` <router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link> ``

### MapNodesGrid.vue

`ui/src/components/Map/MapNodesGrid.vue` — node ID and label use `<a href="#" @click.prevent="onNodeIdClick">` / `onNodeLabelClick` (sets a search filter). Replace both with `` <router-link :to="`/node/${node.id}`"> ``. Remove the now-unused `onNodeIdClick` and `onNodeLabelClick` handlers.

### Out of Scope

OutagesListTable interface and service columns currently link to legacy JSP pages (`interface.jsp`, `service.jsp`). These JSPs are being removed as part of the Vue migration — do not update these links. They will disappear with the JSPs.

---

## Architecture Notes

- All tab state lives in the URL query param — no new Pinia store needed.
- `ServiceGraphTooltip` is a leaf component with no store dependencies; it takes `nodeId`, `ip`, and `serviceName` as props.
- `PersesPanel` is already integrated and dark-mode aware via `appStore.theme` watch — no theme wiring needed in the tooltip.
- The existing `?tab=` query param pattern from NodeActivityTab is reused verbatim for top-level tabs.
