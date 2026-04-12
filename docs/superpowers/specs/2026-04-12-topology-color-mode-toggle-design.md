# Topology Edge Color Mode Toggle

**Date:** 2026-04-12
**Branch:** feat/ui-refactor
**Status:** Approved

## Problem

Edge colors switch between protocol-based and utilization-based coloring depending on whether weathermap data is loaded, with no indication to the user which coloring scheme is active. Users can't tell whether a green edge means "OSPF" or "low utilization."

## Design

A segmented control in the topology toolbar lets users explicitly choose the edge coloring mode. The control is always visible (not hidden in a dropdown) and serves as a persistent indicator of the active mode.

```
Colors  [ Protocol | Utilization ]
```

The active segment is filled (primary color, white text). The inactive segment is bordered-only. This matches the existing `.topology-toolbar__chip` active/inactive visual language.

## Placement

A new inline group positioned between the Weathermap group and the Filter dropdown in the toolbar. Always visible — never buried in a panel.

## Data Model

One new field in `edgeLabelStore`:

```ts
colorMode: ref<'protocol' | 'utilization'>('utilization')
```

Persisted to localStorage alongside existing toggles. Defaults to `'utilization'` so existing behavior is preserved on first load.

## Behavior

`applyWeathermapStyles()` in `useTopology.ts` becomes mode-aware:

| Mode | Edge color | Edge width |
|------|-----------|------------|
| `'utilization'` | `utilizationColor(util.utilPct)` | `throughputWidth(inBps + outBps)` |
| `'protocol'` | `edge.data('color')` (protocol color) | 3 (fixed) |

When no weathermap data is available for an edge, both modes fall back to protocol color — existing behavior unchanged.

A `watch(() => elStore.colorMode, applyWeathermapStyles)` in `useTopology.ts` re-applies colors immediately when the user toggles modes.

## Files

| File | Change |
|------|--------|
| `ui/src/stores/edgeLabelStore.ts` | Add `colorMode` ref, persist to localStorage |
| `ui/src/composables/useTopology.ts` | Mode-aware `applyWeathermapStyles`, new watcher |
| `ui/src/components/Topology/TopologyToolbar.vue` | Segmented control HTML + SCSS |

## What Does Not Change

- Weathermap polling and data fetching — unaffected
- Edge label text toggles (utilization %, port, IP, etc.) — unaffected
- Node coloring — unaffected
- Existing `applyWeathermapStyles` fallback when no data — preserved
