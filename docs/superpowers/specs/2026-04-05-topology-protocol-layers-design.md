# Topology Protocol Layer Visualization — Design Spec

## Goal

Enhance the topology map so that edges visually communicate which network protocols (LLDP, OSPF, IS-IS, BGP, MPLS, ARP/MAC, CDPd) discovered them — rendered as parallel colored lines ("subway map" style) with hover tooltips and a legend.

## Protocol Color Palette

Fixed palette assigned at build time. These colors are used consistently across edge rendering, hover chips, and the legend.

| Protocol | Color | Hex |
|----------|-------|-----|
| LLDP | Blue | `#4C9BE8` |
| OSPF | Green | `#48BB78` |
| IS-IS | Orange | `#ED8936` |
| BGP | Purple | `#9F7AEA` |
| MPLS | Amber | `#F6AD55` |
| ARP/MAC | Teal | `#68D391` |
| CDPd | Red | `#FC8181` |

Protocols not in this map fall back to `var(--feather-border-on-surface)` (neutral gray).

The palette is defined in a single constant file: `ui/src/components/Topology/protocolColors.ts`.

## Edge Rendering

### Data model

`TopologyEdge` already carries `protocols?: string[]`. No API changes needed.

### Cytoscape element expansion

When building Cytoscape elements from `TopologyEdge[]` in `useTopology.ts`, edges with multiple protocols are expanded into N parallel Cytoscape edges — one per protocol — between the same source/target pair.

Single-protocol edges render as straight lines (`curve-style: straight`).

Multi-protocol edges use `curve-style: bezier` with evenly-spaced `control-point-distances` offsets so they fan out like parallel tracks:

- 1 protocol → offset `[0]`
- 2 protocols → offsets `[-6, 6]`
- 3 protocols → offsets `[-8, 0, 8]`
- N protocols → `linspace(-4*(N-1), 4*(N-1), N)`

Each Cytoscape edge carries a `data.protocol` field (single string) used for coloring and tooltip grouping.

Edge style:
- `line-color`: protocol color from palette
- `width`: `3px`
- `line-style`: `solid`
- `target-arrow-shape`: `none` (topology, not directed)

### Layer filter interaction

The existing "All / LLDP / OSPF / …" toolbar chips filter which protocols are visible. When a layer chip is deactivated, Cytoscape edges for that protocol are hidden (`display: none`). The parallel-track expansion only runs once on load; visibility is toggled via Cytoscape style updates.

## Hover Tooltip

A single `<div>` Vue component (`TopologyEdgeTooltip.vue`) is mounted outside the Cytoscape container and positioned absolutely near the cursor.

On Cytoscape `mouseover` (edge):
1. Collect all Cytoscape edges between the same source/target (grouped by `data.source` + `data.target`)
2. Gather their `data.protocol` values
3. Populate the tooltip: node A label ↔ node B label, then a row per protocol with a colored chip and the protocol name
4. Position the tooltip near the event position
5. Show it

On `mouseout`: hide the tooltip.

The tooltip is never shown for vertex (node) elements — only edges.

## Legend

A compact legend row is added below the existing layer-filter chips in `TopologyToolbar.vue`.

- Only protocols present in the currently loaded graph are shown (derived from the active Cytoscape edge set)
- Each entry: a short colored line segment (`<svg>`) + label text
- No toggle — purely informational
- Updates reactively when the loaded graph changes

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/src/components/Topology/protocolColors.ts` | Create | Protocol → hex color map, helper `getProtocolColor(p)` |
| `ui/src/composables/useTopology.ts` | Modify | Expand multi-protocol edges into parallel Cytoscape edges |
| `ui/src/components/Topology/TopologyEdgeTooltip.vue` | Create | Floating tooltip component |
| `ui/src/components/Topology/TopologyToolbar.vue` | Modify | Add legend row below layer chips |

## Out of Scope

- Edge labels (protocol name rendered on the line) — too noisy at scale
- User-configurable colors
- Directed arrows
- Protocol discovery UI (Enlinkd config, etc.)
