# Topology Node Icons — Design Spec
Date: 2026-04-30

## Goal

Display open-source network device icons on topology nodes. Icons represent device function (router, switch, server, etc.) and their stroke color reflects alarm severity. All nodes receive an icon — unrecognized nodes fall back to the server (bare metal host) icon.

## Visual Style

Dark neutral circle background (`#1f2937`). SVG icon centered in the circle, stroke color = severity color. The icon is the primary alarm indicator — no solid fill color competing with it.

Severity color map (mirrors existing stylesheet):
- NORMAL / WARNING → `#f59e0b`
- MINOR → `#eab308`
- MAJOR → `#f97316`
- CRITICAL → `#ef4444`
- INDETERMINATE → `#6b7280`
- default (IP prefix / non-node vertices) → `#06b6d4`

All nodes render with the dark circle + colored icon style. The existing solid severity-colored circle style is fully replaced.

## Files Changed

```
NEW:    ui/src/composables/useNodeIconResolver.ts
MODIFY: ui/src/components/Topology/iconRegistry.ts
MODIFY: ui/src/stores/topologyViewStore.ts
MODIFY: ui/src/components/Topology/TopologyIconSettings.vue
MODIFY: ui/src/composables/useTopology.ts
NEW:    ui/src/assets/topology-icons/console.svg
NEW:    ui/src/assets/topology-icons/pdu.svg
```

## Icon Registry (`iconRegistry.ts`)

Add two new icons to the registry:
- `console` — console/terminal server (out-of-band management device)
- `pdu` — power distribution unit

Add `getColoredIconDataUri(iconKey: string, color: string): string`:
1. Read the SVG string for `iconKey`
2. Replace all occurrences of `currentColor` with `color`
3. Return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

`generic` remains in the registry for explicit user assignment but is no longer used in auto-resolution.

## `useNodeIconResolver` Composable

Single exported function: `resolveIconDataUri(vertex, node, severity)`.

Reads `namePatternRules`, `categoryIconMap` from `topologyViewStore`. Runs resolution in priority order, stops at first match:

```
Priority 1 — User custom patterns
  Evaluate topologyViewStore.namePatternRules[] top-to-bottom.
  Each rule: { pattern: string (regex), iconKey: string }
  Match against vertex.label (case-insensitive).

Priority 2 — OpenNMS category mapping
  For each category in node.categories[]:
    Look up topologyViewStore.categoryIconMap[category.name]
  Use first match found.

Priority 3 — Built-in name patterns (hardcoded defaults)
  /spine/i            → router
  /leaf/i             → switch
  /host/i             → server
  /fw|fire(wall)?/i   → firewall
  /lb|load.?bal/i     → load-balancer
  /console|oob/i      → console
  /pdu/i              → pdu
  /ups/i              → ups
  /\d+\.\d+\.\d+/    → cloud   (IP prefix nodes like 10.88.0.0/16)

Priority 4 — Fallback
  server  (bare metal host — reasonable assumption for unidentified nodes)
```

If `node` is null (vertex has no associated OpenNMS node), skip Priority 2.

Once icon key is resolved, call `iconRegistry.getColoredIconDataUri(key, severityColor)` and return the result.

The composable reads store values reactively so icon assignments update live when settings change.

## Settings UI (`TopologyIconSettings.vue` + `topologyViewStore.ts`)

### Store addition

Add to `topologyViewStore`:
```ts
namePatternRules: Array<{ pattern: string; iconKey: string }>
```
Persisted to localStorage. Default: empty array (built-in patterns cover the common cases).

### New "Name Patterns" tab

Add a third tab to the existing settings panel alongside "Category → Icon" and "OID → Icon".

Each row: regex pattern input | icon picker dropdown | delete button.

Rules are ordered; drag-to-reorder controls priority among user-defined rules. New rules inserted at top (highest priority). No changes to existing Category or OID tabs.

## Rendering Pipeline (`useTopology.ts`)

### `syncElements()`
For each vertex being added to the graph:
- Call `resolveIconDataUri(vertex, node, severity)`
- Store result as `iconDataUri` in Cytoscape element data

### `buildStylesheet()`
Update the base node selector to include icon rendering:
```
selector: 'node'
style:
  background-color: '#1f2937'
  background-image: 'data(iconDataUri)'
  background-fit: 'contain'
  background-clip: 'none'
  background-image-opacity: 1
```
Existing severity-class selectors (`severity-critical`, `severity-major`, etc.) continue to set `border-color` and label color unchanged.

### `applySeverityClasses()`
After applying severity CSS classes, iterate affected elements: re-call `resolveIconDataUri` with the new severity and update `iconDataUri` in element data. This re-colors the icon stroke without a full graph rebuild.

## Out of Scope

- OID-prefix → icon matching (existing tab in settings UI, not changed)
- Per-node icon override (click a node, pick icon directly) — deferred
- Server-side icon persistence (icons live in localStorage + server-side views via existing view store mechanism)
