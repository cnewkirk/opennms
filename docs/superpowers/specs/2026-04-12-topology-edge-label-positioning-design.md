# Topology Edge Label Positioning

**Date:** 2026-04-12  
**Branch:** feat/ui-refactor  
**Status:** Approved

## Problem

Edge labels currently place all information at the midpoint of the edge, concatenating local and remote endpoint data with a `↔` separator. Interface names and IP addresses have no spatial relationship to the vertex they describe.

## Design

Split the single composite edge label into three independently positioned slots using Cytoscape's native `source-label` / `target-label` / `label` support:

| Slot | Position | Content |
|------|----------|---------|
| `source-label` | Near vertex A (the "local" LLDP side) | Interface name, IP address, MAC (optional) |
| `target-label` | Near vertex B (the "remote" LLDP side) | Remote port string, IP address |
| `label` | Edge midpoint | Utilization `%·↑↓bps`, protocols (if >1), link speed |

All three slots use `autorotate` so text follows the edge angle.

The "local" vs "remote" distinction is a data-fetching artifact (LLDP data is collected from one node's perspective). Visually, each label simply describes the vertex it floats beside — neither endpoint is semantically privileged.

## Data mapping

`EdgeLabelData` fields in `weathermapStore`:

| Field | Slot |
|-------|------|
| `localIfName` | source-label |
| `localIp` | source-label |
| `localMac` | source-label (when showMac enabled) |
| `remotePortId` | target-label |
| `remoteIp` | target-label |
| `ifSpeed` | label (center) |

Utilization (`edgeUtilMap`) and protocols always go to the center `label`.

## Implementation scope

All changes are contained in `ui/src/composables/useTopology.ts`:

1. **`composeEdgeLabel`** — change return type from `string` to `{ center: string; sourceEnd: string; targetEnd: string }`. Each part is built from its assigned fields only.

2. **`applyEdgeLabels`** — stamp `wmLabel` (center), `wmLabelSrc` (source end), `wmLabelTgt` (target end) onto each Cytoscape edge element.

3. **`buildStylesheet`** — extend the `edge.weathermap` rule to wire up all three data fields and add source/target text styling:
   - `source-label: data(wmLabelSrc)`
   - `target-label: data(wmLabelTgt)`
   - `source-text-offset: 40` / `target-text-offset: 40` (keeps text clear of node boundary)
   - `source-text-rotation: autorotate` / `target-text-rotation: autorotate`
   - Same font, color, and text-outline as the center label

## What does not change

- `EdgeLabelData` shape in `weathermapStore` — no store changes
- `edgeLabelStore` toggle flags — all existing show* flags continue to work
- Tooltip behavior
- Weathermap utilization coloring
