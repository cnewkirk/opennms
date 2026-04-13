# Spec: Geo Map — MapLibre GL JS Redesign

**Date:** 2026-04-12  
**Branch:** feat/ui-refactor  
**Status:** Approved for implementation

---

## Problem

The current geo map (`/opennms/ui/map`) uses Leaflet via `@vue-leaflet/vue-leaflet`. It feels dated:
- Raster tiles pixelate on zoom, have no dark mode awareness
- Markers are PNG assets hardcoded per severity level
- Cluster popups use `innerHTML` injection and `window['L']` global access
- Node-to-node edge lines are commented out and never completed
- Popups are raw `.flex > div` HTML, not Feather DS components

---

## Goal

Replace the Leaflet stack with **MapLibre GL JS** to deliver:
1. WebGL-rendered vector/raster tiles with smooth 60fps pan/zoom
2. SVG markers driven by Feather DS severity tokens (dark/light mode aware)
3. Feather DS popup components via Vue Teleport — no DOM injection
4. Node interconnection edge layer sourced from the topology store (discovered + user-defined links)
5. Weathermap-style edge coloring (protocol color → utilization color when data available)
6. Dark mode tile support without requiring an API key

---

## Architecture

### Pattern

Mount MapLibre imperatively to a `div` ref in a composable — identical to how `useTopology.ts` mounts Cytoscape. No Vue wrapper library.

### What stays unchanged

| File | Reason |
|---|---|
| `mapStore.ts` | Node/alarm fetching, severity map, bounds — untouched |
| `geolocationStore.ts` | Tile provider config (minor extension only) |
| `MapSearch.vue` | Same `@fly-to-node` / `@set-bounding-box` interface |
| `SeverityFilter.vue` | Same `mapStore.setSelectedSeverity` call |
| `MapAlarmsGrid.vue`, `MapNodesGrid.vue`, `GridTabs.vue` | Untouched |
| `Map.vue` (container/splitpane) | One line: `LeafletMap` → `MapLibreMap` |

### What's replaced

| Old | New |
|---|---|
| `LeafletMap.vue` | `MapLibreMap.vue` + `useMapLibre.ts` |
| `MarkerCluster.vue` + `leaflet.markercluster` plugin | MapLibre built-in GeoJSON cluster source |
| `MarkerClusterPopupContent.vue` (innerHTML injection) | Vue Teleport popup |
| `MarkerPopup.vue` (`LPopup` / `window['L']`) | `MapNodePopup.vue` — Feather DS card |
| PNG severity icon assets (`Critical-icon.png` etc.) | SVG DOM elements via `getComputedStyle` tokens |

### New files

| File | Purpose |
|---|---|
| `ui/src/components/Map/useMapLibre.ts` | Composable: MapLibre init, markers, edge layer, dark mode, resize |
| `ui/src/components/Map/MapLibreMap.vue` | Root map component (replaces `LeafletMap.vue`) |
| `ui/src/components/Map/MapNodePopup.vue` | Click-on-marker popup, Feather DS styled |
| `ui/src/components/Map/MapEdgeTooltip.vue` | Hover-on-edge tooltip (adapts `TopologyEdgeTooltip`) |

---

## Data Flow

```
mapStore (nodes w/ coords, alarms)  →  GeoJSON nodes FeatureCollection  →  cluster + marker layers
topologyStore (vertices, edges)     →  GeoJSON edges FeatureCollection   →  edge line layer
wmStore (edgeUtilMap)               →  edge color updates (utilization mode)
appStore.theme                      →  CSS filter toggle / MapLibre style swap
geolocationStore (tile URLs)        →  raster source config
```

---

## Edge Layer

### Source
`topologyStore.edges` filtered to pairs where both endpoints have a matching node in `mapStore.nodesWithCoordinates` (matched by numeric node ID via `TopologyVertex.nodeID`). Includes both discovered (LLDP/CDP) and user-defined custom links.

### Rendering
- MapLibre GeoJSON `LineString` source, `cluster: false`
- Line layer styled with `getProtocolColor(protocols[0])` from `protocolColors.ts`
- When `wmStore.edgeUtilMap` has data for an edge key, switches to `utilizationColor(utilPct)` — same logic as topology weathermap
- Line width: 2px default, 3px on hover
- User-defined edges: dashed line style (`line-dasharray: [6, 3]`)
- Toggle button rendered as an absolute-positioned control inside `MapLibreMap.vue` (new, similar to the zoom control placement) — edges hidden by default, opt-in per session

### Edge hover tooltip
`maplibre.on('mousemove', 'map-edges-layer')` → populate `MapEdgeTooltip` via a `ref`. Same props interface as `TopologyEdgeTooltip`: `{ x, y, protocols, srcLabel, tgtLabel, util, labelData }`.

---

## Markers & Clustering

### Individual markers
- MapLibre `Marker` with a custom SVG DOM element
- 36px circle (matching Cytoscape node size for visual consistency)
- Fill color resolved at init and on theme change via `getComputedStyle(document.documentElement).getPropertyValue('--feather-<severity-var>')` — same `cssVar()` pattern as `useTopology.ts`
- On severity change: update marker DOM element fill directly (no remount)

### Clustering
- GeoJSON source with `cluster: true`, `clusterMaxZoom: 14`, `clusterRadius: 50`
- Three MapLibre layers (no DOM elements, pure canvas):
  - `map-clusters`: circle fill, color driven by `clusterSeverity` property (highest severity in cluster, injected via `clusterProperties` aggregate)
  - `map-cluster-count`: symbol layer with count label
  - `map-unclustered`: individual node points at high zoom
- Cluster click: `fitBounds` on cluster children — no popup

### Popup
`MapNodePopup.vue` mounted via Vue `Teleport` into a fixed overlay `div` above the map canvas. Contents:
- Node label (link to node detail page)
- `SeverityBadge` component (reuses existing)
- Coordinates (lat/lng)
- IP address
- Description, maintenance contract, category
- "View in Topology" link (same href format as current `MarkerPopup.vue`)

Dismissed on map click-away or Escape.

---

## Dark Mode Tiles

Two-tier strategy, no API key required by default:

1. **MapLibre style JSON URL** (opt-in): if `gwt.openlayers.url` in `opennms.properties` is a full MapLibre style JSON URL (detected by `endsWith('.json')`), pass it directly to MapLibre as the map style. Enables full vector tile dark styles (MapTiler, Stadia, self-hosted Protomaps).

2. **CSS filter fallback** (default): wrap existing OSM/OpenTopoMap raster URLs as MapLibre raster sources. When `appStore.theme === 'open-dark'`, apply `filter: invert(1) hue-rotate(200deg) brightness(0.8) contrast(0.9)` to the map canvas container. Produces a blue-toned dark basemap from any raster source — zero external dependency, works in airgapped deployments.

Theme change is watched via `watch(() => appStore.theme, ...)` — same pattern as `useTopology.ts`.

---

## `geolocationStore.ts` Changes

Minor extension only:
- `fetchTileProviders()` detects whether the configured URL is a MapLibre style JSON (`.json` suffix) and sets a `isMaplibleStyle: boolean` flag on the `TileProviderItem`
- `useMapLibre` reads this flag to decide whether to call `map.setStyle(url)` vs configuring a raster source

---

## Dependencies

| Package | Action |
|---|---|
| `maplibre-gl` | Add (`npm install maplibre-gl`) |
| `@vue-leaflet/vue-leaflet` | Remove |
| `leaflet` | Remove |
| `leaflet.markercluster` | Remove (if present as direct dep) |
| PNG icon assets | Remove after migration |

---

## What This Does NOT Change

- REST API calls — no new endpoints, no changes to existing ones
- `mapStore` data model
- The bottom grid pane (nodes/alarms grids)
- Search behavior
- Severity filter behavior
- `Map.vue` splitpane layout
- Tile server configuration format (backward compatible)

---

## Success Criteria

1. Map renders with OSM raster tiles at parity with current feature set
2. Dark mode: map tiles invert/filter correctly when theme toggles
3. Node markers colored by severity, updating live as alarms change
4. Cluster circles colored by highest-severity node in cluster
5. Click marker → `MapNodePopup.vue` (Feather DS card, no raw HTML)
6. Edge toggle button shows/hides topology edges as lines between geo-located nodes
7. Hover edge → `MapEdgeTooltip` with protocol and utilization data
8. Zero `innerHTML` injection, zero `window['L']` references
9. No PNG severity icon assets referenced
10. `leaflet` and `@vue-leaflet/vue-leaflet` removed from `package.json`
