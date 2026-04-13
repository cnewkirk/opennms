# Geo Map — MapLibre GL JS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Leaflet-based geo map with MapLibre GL JS, adding topology-sourced edge lines, WebGL rendering, dark mode tile support, and Feather DS styled popups.

**Architecture:** MapLibre GL JS is mounted imperatively to a `div` ref inside a `useMapLibre` composable — mirroring how `useTopology.ts` mounts Cytoscape. Node markers and cluster circles render as MapLibre GeoJSON layers (no DOM marker objects). Edge lines come from `topologyStore.edges` (same store the topology view uses, including user-defined links). Popups use Vue Teleport over the canvas — no `innerHTML`, no `window['L']`.

**Tech Stack:** `maplibre-gl` (WebGL map), Vue 3 Composition API, Pinia (`mapStore`, `topologyStore`, `geolocationStore`, `appStore`, `weathermapStore`), Vitest/happy-dom for unit tests, Feather DS components + `SeverityBadge`

---

## File Map

```
Created:
  ui/src/components/Map/mapGeoUtils.ts         — Pure GeoJSON feature builders (tested)
  ui/src/composables/useMapLibre.ts            — Composable: map lifecycle, layers, event handlers
  ui/src/components/Map/MapLibreMap.vue        — Root map component (replaces LeafletMap.vue)
  ui/src/components/Map/MapNodePopup.vue       — Click-on-node popup (Feather DS card, Vue Teleport)
  ui/tests/mapGeoUtils.test.ts                 — Unit tests for pure functions

Modified:
  ui/src/types/index.ts (or wherever TileProviderItem lives) — add isMapLibreStyle flag
  ui/src/stores/geolocationStore.ts            — detect MapLibre style JSON URLs
  ui/src/containers/Map.vue                    — swap LeafletMap → MapLibreMap
  ui/package.json                              — add maplibre-gl, remove leaflet

Deleted (Task 10):
  ui/src/components/Map/LeafletMap.vue
  ui/src/components/Map/MarkerCluster.vue
  ui/src/components/Map/MarkerClusterPopupContent.vue
  ui/src/components/Map/MarkerPopup.vue
  ui/src/assets/Critical-icon.png
  ui/src/assets/Minor-icon.png
  ui/src/assets/Major-icon.png
  ui/src/assets/Normal-icon.png
  ui/src/assets/Warning-icon.png
```

**Reused unchanged:**
- `ui/src/components/Map/MapSearch.vue` — search/fly-to, same `@fly-to-node` / `@set-bounding-box` events
- `ui/src/components/Map/SeverityFilter.vue` — unchanged
- `ui/src/components/Map/MapAlarmsGrid.vue`, `MapNodesGrid.vue`, `GridTabs.vue` — unchanged
- `ui/src/components/Topology/TopologyEdgeTooltip.vue` — reused as-is for edge hover
- `ui/src/components/Common/SeverityBadge.vue` — reused in MapNodePopup

---

## Task 1: Install maplibre-gl, remove Leaflet

**Files:**
- Modify: `ui/package.json`

- [ ] **Step 1: Install maplibre-gl**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn add maplibre-gl
```

- [ ] **Step 2: Remove Leaflet packages**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn remove @vue-leaflet/vue-leaflet leaflet
# Also remove @types/leaflet if present:
./target/node/yarn/dist/bin/yarn remove @types/leaflet 2>/dev/null || true
```

- [ ] **Step 3: Verify package.json**

```bash
grep -E 'maplibre|leaflet' ui/package.json
```

Expected: `maplibre-gl` appears under `dependencies`, no `leaflet` or `@vue-leaflet` entries remain.

- [ ] **Step 4: Commit**

```bash
git add ui/package.json ui/yarn.lock
git commit -m "feat(map): swap leaflet for maplibre-gl"
```

---

## Task 2: Pure GeoJSON builder utilities + unit tests

**Files:**
- Create: `ui/src/components/Map/mapGeoUtils.ts`
- Create: `ui/tests/mapGeoUtils.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `ui/tests/mapGeoUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  SEVERITY_RANK,
  buildNodeCoordMap,
  buildNodeFeatureCollection,
  buildEdgeFeatureCollection
} from '@/components/Map/mapGeoUtils'
import type { Node } from '@/types'
import type { TopologyEdge, TopologyVertex } from '@/types/topology'

// Minimal Node stub with just the fields mapGeoUtils needs
const makeNode = (id: string, label: string, lat: string, lng: string): Node =>
  ({ id, label, assetRecord: { latitude: lat, longitude: lng }, categories: [] } as unknown as Node)

const makeVertex = (id: string, label: string, nodeID: string): TopologyVertex =>
  ({ id, namespace: 'enlinkd', label, nodeID })

const makeEdge = (srcId: number, tgtId: number, protocols = ['LLDP'], userDefined = false): TopologyEdge =>
  ({ source: { namespace: 'enlinkd', id: srcId }, target: { namespace: 'enlinkd', id: tgtId }, protocols, userDefined })

describe('buildNodeCoordMap', () => {
  it('stores valid coordinates as [longitude, latitude] (GeoJSON order)', () => {
    const nodes = [makeNode('1', 'r1', '40.7128', '-74.0060')]
    const map = buildNodeCoordMap(nodes)
    expect(map.get('1')).toEqual([-74.006, 40.7128])
  })

  it('excludes nodes with missing latitude', () => {
    const nodes = [makeNode('1', 'r1', '', '-74')]
    expect(buildNodeCoordMap(nodes).has('1')).toBe(false)
  })

  it('excludes nodes with non-numeric coordinates', () => {
    const nodes = [makeNode('1', 'r1', 'N/A', 'N/A')]
    expect(buildNodeCoordMap(nodes).has('1')).toBe(false)
  })

  it('includes multiple valid nodes', () => {
    const nodes = [makeNode('1', 'a', '10', '20'), makeNode('2', 'b', '30', '40')]
    const map = buildNodeCoordMap(nodes)
    expect(map.size).toBe(2)
  })
})

describe('buildNodeFeatureCollection', () => {
  it('produces a GeoJSON FeatureCollection', () => {
    const nodes = [makeNode('1', 'r1', '40', '-74')]
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildNodeFeatureCollection(nodes, {}, coordMap)
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features[0].geometry.type).toBe('Point')
  })

  it('filters out nodes not in the coordMap', () => {
    const nodes = [makeNode('1', 'r1', '40', '-74'), makeNode('2', 'r2', '', '')]
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildNodeFeatureCollection(nodes, {}, coordMap)
    expect(fc.features).toHaveLength(1)
    expect(fc.features[0].properties.id).toBe('1')
  })

  it('maps severity from severityMap and assigns correct rank', () => {
    const nodes = [makeNode('1', 'r1', '40', '-74')]
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildNodeFeatureCollection(nodes, { r1: 'CRITICAL' }, coordMap)
    expect(fc.features[0].properties.severity).toBe('CRITICAL')
    expect(fc.features[0].properties.severityRank).toBe(SEVERITY_RANK.CRITICAL)
  })

  it('defaults to NORMAL/rank 0 when no severity entry exists', () => {
    const nodes = [makeNode('1', 'r1', '40', '-74')]
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildNodeFeatureCollection(nodes, {}, coordMap)
    expect(fc.features[0].properties.severity).toBe('NORMAL')
    expect(fc.features[0].properties.severityRank).toBe(0)
  })
})

describe('buildEdgeFeatureCollection', () => {
  const vertices = [makeVertex('1', 'r1', '1'), makeVertex('2', 'r2', '2')]
  const edges = [makeEdge(1, 2, ['LLDP'])]
  const nodes = [makeNode('1', 'r1', '40', '-74'), makeNode('2', 'r2', '41', '-75')]

  it('creates a LineString for an edge with both endpoints geolocated', () => {
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildEdgeFeatureCollection(edges, vertices, coordMap)
    expect(fc.features).toHaveLength(1)
    expect(fc.features[0].geometry.type).toBe('LineString')
    expect(fc.features[0].geometry.coordinates).toHaveLength(2)
  })

  it('excludes edges where either endpoint has no coordinates', () => {
    const coordMap = buildNodeCoordMap([makeNode('1', 'r1', '40', '-74')]) // node 2 missing
    const fc = buildEdgeFeatureCollection(edges, vertices, coordMap)
    expect(fc.features).toHaveLength(0)
  })

  it('excludes edges with no matching topology vertex', () => {
    const coordMap = buildNodeCoordMap(nodes)
    const badEdges = [makeEdge(99, 100)] // no matching vertices
    const fc = buildEdgeFeatureCollection(badEdges, vertices, coordMap)
    expect(fc.features).toHaveLength(0)
  })

  it('deduplicates edges with the same node pair', () => {
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildEdgeFeatureCollection([...edges, ...edges], vertices, coordMap)
    expect(fc.features).toHaveLength(1)
  })

  it('sets userDefined=true on user-defined edges', () => {
    const coordMap = buildNodeCoordMap(nodes)
    const udEdge = makeEdge(1, 2, ['LLDP'], true)
    const fc = buildEdgeFeatureCollection([udEdge], vertices, coordMap)
    expect(fc.features[0].properties.userDefined).toBe(true)
  })

  it('stores the edge key as min-max of source/target ids', () => {
    const coordMap = buildNodeCoordMap(nodes)
    const fc = buildEdgeFeatureCollection(edges, vertices, coordMap)
    expect(fc.features[0].properties.edgeKey).toBe('1-2')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run tests/mapGeoUtils.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module '@/components/Map/mapGeoUtils'` or similar import error.

- [ ] **Step 3: Implement `mapGeoUtils.ts`**

Create `ui/src/components/Map/mapGeoUtils.ts`:

```typescript
import type { FeatureCollection, Feature, Point, LineString } from 'geojson'
import type { Node } from '@/types'
import type { TopologyEdge, TopologyVertex } from '@/types/topology'

/** Maps severity name → numeric rank for cluster severity aggregation. */
export const SEVERITY_RANK: Record<string, number> = {
  NORMAL: 0,
  INDETERMINATE: 0,
  WARNING: 1,
  MINOR: 2,
  MAJOR: 3,
  CRITICAL: 4
}

export interface NodeFeatureProperties {
  id: string
  label: string
  severity: string
  severityRank: number
}

export interface EdgeFeatureProperties {
  edgeKey: string
  protocols: string[]
  userDefined: boolean
  srcLabel: string
  tgtLabel: string
  srcNodeId: string | null
  tgtNodeId: string | null
}

/**
 * Returns a Map of nodeId → [longitude, latitude] for all nodes with valid coordinates.
 * Uses GeoJSON coordinate order ([lng, lat]) throughout.
 */
export const buildNodeCoordMap = (nodes: Node[]): Map<string, [number, number]> => {
  const map = new Map<string, [number, number]>()
  for (const node of nodes) {
    const lat = parseFloat(String(node.assetRecord?.latitude))
    const lng = parseFloat(String(node.assetRecord?.longitude))
    if (!isNaN(lat) && !isNaN(lng)) {
      map.set(node.id, [lng, lat])
    }
  }
  return map
}

/**
 * Builds a GeoJSON FeatureCollection of Point features for nodes present in coordMap.
 * Each feature carries severity and severityRank for MapLibre paint expressions.
 */
export const buildNodeFeatureCollection = (
  nodes: Node[],
  severityMap: Record<string, string>,
  coordMap: Map<string, [number, number]>
): FeatureCollection<Point, NodeFeatureProperties> => {
  const features: Feature<Point, NodeFeatureProperties>[] = []

  for (const node of nodes) {
    const coords = coordMap.get(node.id)
    if (!coords) continue

    const severity = severityMap[node.label] ?? 'NORMAL'
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: node.id,
        label: node.label,
        severity,
        severityRank: SEVERITY_RANK[severity] ?? 0
      }
    })
  }

  return { type: 'FeatureCollection', features }
}

/**
 * Builds a GeoJSON FeatureCollection of LineString features for topology edges
 * where both endpoints have coordinates in coordMap.
 *
 * Matches edges to coordinates via TopologyVertex.nodeID (the numeric OpenNMS node ID as a string).
 * Deduplicates edges with the same node pair (keeps first occurrence).
 */
export const buildEdgeFeatureCollection = (
  edges: TopologyEdge[],
  vertices: TopologyVertex[],
  coordMap: Map<string, [number, number]>
): FeatureCollection<LineString, EdgeFeatureProperties> => {
  // Index vertices by their numeric source/target id (as used in TopologyEdge)
  const vertexByNumericId = new Map<number, TopologyVertex>()
  for (const v of vertices) {
    const numId = parseInt(v.id, 10)
    if (!isNaN(numId)) vertexByNumericId.set(numId, v)
  }

  const features: Feature<LineString, EdgeFeatureProperties>[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    const srcVertex = vertexByNumericId.get(edge.source.id)
    const tgtVertex = vertexByNumericId.get(edge.target.id)
    if (!srcVertex?.nodeID || !tgtVertex?.nodeID) continue

    const srcCoords = coordMap.get(srcVertex.nodeID)
    const tgtCoords = coordMap.get(tgtVertex.nodeID)
    if (!srcCoords || !tgtCoords) continue

    const key = `${Math.min(edge.source.id, edge.target.id)}-${Math.max(edge.source.id, edge.target.id)}`
    if (seen.has(key)) continue
    seen.add(key)

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [srcCoords, tgtCoords] },
      properties: {
        edgeKey: key,
        protocols: edge.protocols ?? [],
        userDefined: edge.userDefined ?? false,
        srcLabel: srcVertex.label ?? '',
        tgtLabel: tgtVertex.label ?? '',
        srcNodeId: srcVertex.nodeID,
        tgtNodeId: tgtVertex.nodeID
      }
    })
  }

  return { type: 'FeatureCollection', features }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run tests/mapGeoUtils.test.ts 2>&1 | tail -20
```

Expected: all tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Map/mapGeoUtils.ts ui/tests/mapGeoUtils.test.ts
git commit -m "feat(map): add mapGeoUtils pure GeoJSON builders with tests"
```

---

## Task 3: Extend TileProviderItem + geolocationStore MapLibre style detection

**Files:**
- Modify: `ui/src/types/index.ts` (find `TileProviderItem` — it may be in this file or a sub-file; run `grep -r 'TileProviderItem' ui/src/types/` to locate it)
- Modify: `ui/src/stores/geolocationStore.ts`

- [ ] **Step 1: Find TileProviderItem definition**

```bash
grep -r 'TileProviderItem' ui/src/types/ --include='*.ts' -l
```

- [ ] **Step 2: Add `isMapLibreStyle` field**

In whichever file defines the interface, add the optional field:

```typescript
export interface TileProviderItem {
  name: string
  visible: boolean
  url: string
  attribution: string
  isMapLibreStyle?: boolean   // true when url is a MapLibre style JSON URL (ends with .json)
}
```

- [ ] **Step 3: Set `isMapLibreStyle` in `geolocationStore.ts`**

In `fetchUserDefinedTileProvider()`, after building the `TileProviderItem`, detect style URLs:

```typescript
// After: userDefinedTileProvider.value = { name, url: resp.tileServerUrl, attribution: ..., visible: true }
// Add:
userDefinedTileProvider.value = {
  name,
  url: resp.tileServerUrl,
  attribution: resp.options?.attribution ?? '',
  visible: true,
  isMapLibreStyle: resp.tileServerUrl.endsWith('.json')
} as TileProviderItem
```

Also set `isMapLibreStyle: false` on the default providers in `getDefaultTileProviders()` (explicit is better than implicit):

```typescript
return [
  {
    name: 'OpenStreetMap',
    visible: true,
    attribution: '&copy; <a target="_blank" href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    isMapLibreStyle: false
  },
  {
    name: 'OpenTopoMap',
    visible: false,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: ...',
    isMapLibreStyle: false
  }
]
```

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run 2>&1 | tail -20
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add ui/src/types ui/src/stores/geolocationStore.ts
git commit -m "feat(map): add isMapLibreStyle flag to TileProviderItem"
```

---

## Task 4: `useMapLibre.ts` — core map init, tiles, dark mode, navigation

**Files:**
- Create: `ui/src/composables/useMapLibre.ts`

- [ ] **Step 1: Create the composable**

Create `ui/src/composables/useMapLibre.ts`:

```typescript
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Ref, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useGeolocationStore } from '@/stores/geolocationStore'
import { useMapStore } from '@/stores/mapStore'
import { useAppStore } from '@/stores/appStore'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import type { Node } from '@/types'
import type { EdgeTooltipState } from '@/components/Topology/TopologyEdgeTooltip.vue'
import { buildNodeCoordMap, buildNodeFeatureCollection, buildEdgeFeatureCollection, SEVERITY_RANK, type EdgeFeatureProperties } from '@/components/Map/mapGeoUtils'
import { getProtocolColor, utilizationColor } from '@/components/Topology/protocolColors'

// Read a Feather DS CSS custom property at runtime — same pattern as useTopology.ts
const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Severity → Feather DS CSS variable name (same mapping as useTopology.ts)
const SEVERITY_CSS_VARS: Record<string, string> = {
  CRITICAL: '--feather-error',
  MAJOR:    '--feather-major',
  MINOR:    '--feather-minor',
  WARNING:  '--feather-warning',
  NORMAL:   '--feather-success',
  INDETERMINATE: '--feather-indeterminate'
}

interface PopupState {
  node: Node
  x: number
  y: number
}

const useMapLibre = (containerRef: Ref<HTMLElement | null>) => {
  const geolocationStore = useGeolocationStore()
  const mapStore = useMapStore()
  const appStore = useAppStore()
  const topologyStore = useTopologyStore()
  const wmStore = useWeathermapStore()

  let map: maplibregl.Map | null = null

  const popupNode = ref<PopupState | null>(null)
  const edgeTooltip = ref<EdgeTooltipState | null>(null)
  const edgesVisible = ref(false)
  const edgesLoading = ref(false)

  // ── Tile source helpers ──────────────────────────────────────────────────

  /** Converts an OSM-style template URL ({s} subdomain, {z}/{x}/{y}) to MapLibre format. */
  const toMapLibreTileUrl = (url: string): string =>
    url.replace('{s}', 'a') // MapLibre doesn't support {s}; pick subdomain 'a'

  /**
   * Returns a MapLibre StyleSpecification that wraps the configured raster tile URL,
   * or the URL string directly when it points to a MapLibre style JSON.
   */
  const buildStyle = (): maplibregl.StyleSpecification | string => {
    const providers = geolocationStore.tileProviders
    const primary = providers.find(p => p.visible) ?? providers[0]

    if (!primary) {
      // Absolute fallback — no providers configured
      return {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      }
    }

    if (primary.isMapLibreStyle) {
      return primary.url // direct MapLibre style JSON URL
    }

    return {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: [toMapLibreTileUrl(primary.url)],
          tileSize: 256,
          attribution: primary.attribution
        }
      },
      layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }]
    }
  }

  // ── Dark mode ─────────────────────────────────────────────────────────────

  /**
   * Apply or remove the dark mode CSS filter to the MapLibre canvas element.
   * We filter only the canvas (not the controls) so zoom buttons stay readable.
   */
  const applyDarkMode = () => {
    const canvas = map?.getCanvas()
    if (!canvas) return
    const isDark = appStore.theme === 'open-dark'
    canvas.style.filter = isDark
      ? 'invert(1) hue-rotate(200deg) brightness(0.8) contrast(0.9)'
      : ''
  }

  // ── Severity colors ───────────────────────────────────────────────────────

  /**
   * Resolve current Feather DS severity colors from CSS variables.
   * Called at init and after theme changes so dark/light tokens are respected.
   */
  const resolveSeverityColors = (): Record<string, string> =>
    Object.fromEntries(
      Object.entries(SEVERITY_CSS_VARS).map(([sev, varName]) => [sev, cssVar(varName) || '#718096'])
    )

  /**
   * Update MapLibre layer paint expressions with resolved severity colors.
   * Must be called after layers are added.
   */
  const updateSeverityColors = () => {
    if (!map || !map.getLayer('map-nodes-point')) return
    const c = resolveSeverityColors()

    const severityMatchExpr = [
      'match', ['get', 'severity'],
      'CRITICAL', c.CRITICAL,
      'MAJOR',    c.MAJOR,
      'MINOR',    c.MINOR,
      'WARNING',  c.WARNING,
      c.NORMAL // default
    ]

    map.setPaintProperty('map-nodes-point', 'circle-color', severityMatchExpr)
    map.setPaintProperty('map-nodes-point', 'circle-stroke-color', severityMatchExpr)

    // Cluster circles use maxSeverityRank (0–4) computed by clusterProperties aggregate
    map.setPaintProperty('map-clusters', 'circle-color', [
      'step', ['get', 'maxSeverityRank'],
      c.NORMAL,
      1, c.WARNING,
      2, c.MINOR,
      3, c.MAJOR,
      4, c.CRITICAL
    ])
  }

  // ── Node GeoJSON source ───────────────────────────────────────────────────

  const getNodeCoordMap = () =>
    buildNodeCoordMap(mapStore.nodesWithCoordinates)

  const syncNodeSource = () => {
    if (!map || !map.getSource('map-nodes')) return
    const coordMap = getNodeCoordMap()
    const fc = buildNodeFeatureCollection(
      mapStore.nodesWithCoordinates,
      mapStore.getNodeAlarmSeverityMap(),
      coordMap
    )
    ;(map.getSource('map-nodes') as maplibregl.GeoJSONSource).setData(fc)
    updateSeverityColors()
  }

  const addNodeLayers = () => {
    const c = resolveSeverityColors()

    map!.addSource('map-nodes', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
      clusterProperties: {
        // Track the highest severity rank in each cluster for coloring
        maxSeverityRank: ['max', ['get', 'severityRank']]
      }
    })

    // Cluster circles
    map!.addLayer({
      id: 'map-clusters',
      type: 'circle',
      source: 'map-nodes',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'maxSeverityRank'], c.NORMAL, 1, c.WARNING, 2, c.MINOR, 3, c.MAJOR, 4, c.CRITICAL],
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255,255,255,0.3)'
      }
    })

    // Cluster count label
    map!.addLayer({
      id: 'map-cluster-count',
      type: 'symbol',
      source: 'map-nodes',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: { 'text-color': '#fff' }
    })

    // Individual unclustered nodes
    map!.addLayer({
      id: 'map-nodes-point',
      type: 'circle',
      source: 'map-nodes',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': c.NORMAL,
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': c.NORMAL,
        'circle-stroke-opacity': 0.4
      }
    })

    // Click individual node → show popup
    map!.on('click', 'map-nodes-point', (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as { id: string }
      const node = mapStore.nodesWithCoordinates.find(n => n.id === props.id)
      if (!node) return
      popupNode.value = { node, x: e.point.x, y: e.point.y }
    })

    // Click cluster → zoom to fit cluster children
    map!.on('click', 'map-clusters', (e) => {
      if (!e.features?.length) return
      const feature = e.features[0]
      const clusterId = feature.properties?.cluster_id as number
      const source = map!.getSource('map-nodes') as maplibregl.GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom === null) return
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        map!.easeTo({ center: coords, zoom })
      })
    })

    // Pointer cursor on hover
    map!.on('mouseenter', 'map-clusters', () => { map!.getCanvas().style.cursor = 'pointer' })
    map!.on('mouseleave', 'map-clusters', () => { map!.getCanvas().style.cursor = '' })
    map!.on('mouseenter', 'map-nodes-point', () => { map!.getCanvas().style.cursor = 'pointer' })
    map!.on('mouseleave', 'map-nodes-point', () => { map!.getCanvas().style.cursor = '' })

    // Click outside a node → close popup
    map!.on('click', (e) => {
      const features = map!.queryRenderedFeatures(e.point, { layers: ['map-nodes-point', 'map-clusters'] })
      if (!features.length) popupNode.value = null
    })
  }

  // ── Edge GeoJSON source ───────────────────────────────────────────────────

  const syncEdgeSource = () => {
    if (!map || !map.getSource('map-edges')) return
    const coordMap = getNodeCoordMap()
    const fc = buildEdgeFeatureCollection(topologyStore.edges, topologyStore.vertices, coordMap)
    ;(map.getSource('map-edges') as maplibregl.GeoJSONSource).setData(fc)
  }

  const addEdgeLayers = () => {
    map!.addSource('map-edges', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    })

    map!.addLayer({
      id: 'map-edges-line',
      type: 'line',
      source: 'map-edges',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': getProtocolColor('lldp'), // default; per-feature protocol color is limited in MapLibre
        'line-width': ['case', ['get', 'userDefined'], 2, 2],
        'line-dasharray': ['case', ['get', 'userDefined'], ['literal', [6, 3]], ['literal', [1, 0]]],
        'line-opacity': 0.75
      }
    }, 'map-clusters') // insert below node layers

    // Edge hover tooltip
    map!.on('mousemove', 'map-edges-line', (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as EdgeFeatureProperties
      const util = wmStore.edgeUtilMap[props.edgeKey] ?? null
      const labelData = wmStore.edgeLabelData?.[props.edgeKey] ?? null
      edgeTooltip.value = {
        x: e.point.x,
        y: e.point.y,
        protocols: (props.protocols as unknown as string) ? JSON.parse(props.protocols as unknown as string) : [],
        srcLabel: props.srcLabel,
        tgtLabel: props.tgtLabel,
        srcNodeId: props.srcNodeId,
        tgtNodeId: props.tgtNodeId,
        util,
        labelData
      }
      map!.getCanvas().style.cursor = 'pointer'
    })

    map!.on('mouseleave', 'map-edges-line', () => {
      edgeTooltip.value = null
      map!.getCanvas().style.cursor = ''
    })
  }

  // NOTE: MapLibre serialises GeoJSON feature properties to JSON strings for non-primitive values.
  // The `protocols` array in EdgeFeatureProperties will be a JSON string when read back from a
  // rendered feature. Parse it with JSON.parse() in the mousemove handler (done above).
  // See: https://github.com/mapbox/mapbox-gl-js/issues/2434

  // ── Edge toggle ───────────────────────────────────────────────────────────

  const toggleEdges = async () => {
    edgesVisible.value = !edgesVisible.value

    if (edgesVisible.value) {
      // Load topology data on first toggle if not yet loaded
      if (topologyStore.availableLayers.length === 0) {
        edgesLoading.value = true
        await topologyStore.loadContainers()
        edgesLoading.value = false
      }
      map?.setLayoutProperty('map-edges-line', 'visibility', 'visible')
      syncEdgeSource()
    } else {
      map?.setLayoutProperty('map-edges-line', 'visibility', 'none')
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const flyTo = (nodeLabelOrId: string) => {
    if (!map) return
    const coordMap = getNodeCoordMap()
    // Try node ID first, then label
    const coords = coordMap.get(nodeLabelOrId) ??
      (() => {
        const node = mapStore.nodesWithCoordinates.find(n => n.label === nodeLabelOrId)
        return node ? coordMap.get(node.id) : undefined
      })()
    if (coords) map.flyTo({ center: coords, zoom: 7 })
  }

  const setBoundingBox = (nodeLabels: string[]) => {
    if (!map) return
    const coordMap = getNodeCoordMap()
    const nodeMap = new Map(mapStore.nodesWithCoordinates.map(n => [n.label, n]))
    const coords = nodeLabels
      .map(label => { const n = nodeMap.get(label); return n ? coordMap.get(n.id) : undefined })
      .filter((c): c is [number, number] => c !== undefined)
    if (!coords.length) return
    const bounds = coords.reduce(
      (b, [lng, lat]) => b.extend([lng, lat] as maplibregl.LngLatLike),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    )
    map.fitBounds(bounds, { padding: 60 })
  }

  const invalidateSize = () => map?.resize()

  // ── Init ─────────────────────────────────────────────────────────────────

  onMounted(async () => {
    if (!containerRef.value) return

    await geolocationStore.fetchTileProviders()

    map = new maplibregl.Map({
      container: containerRef.value,
      style: buildStyle(),
      center: [mapStore.mapCenter.longitude, mapStore.mapCenter.latitude],
      zoom: 2,
      minZoom: 2,
      maxZoom: 19
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      addNodeLayers()
      addEdgeLayers()
      map!.setLayoutProperty('map-edges-line', 'visibility', 'none') // hidden until toggled
      applyDarkMode()
      updateSeverityColors()
      syncNodeSource()

      // Fit to node bounds after first data load
      const coordMap = getNodeCoordMap()
      if (coordMap.size > 0) {
        const allCoords = [...coordMap.values()]
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
        )
        map!.fitBounds(bounds, { padding: 60, maxZoom: 12 })
      }
    })

    map.on('moveend', () => {
      // mapStore.setMapBounds expects a Leaflet LatLngBounds shape; duck-type MapLibre bounds to match.
      // The grid components only call .getNorthEast()/.getSouthWest() on the stored value.
      const b = map!.getBounds()
      const adaptedBounds = {
        getNorthEast: () => ({ lat: b.getNorth(), lng: b.getEast() }),
        getSouthWest: () => ({ lat: b.getSouth(), lng: b.getWest() })
      }
      mapStore.setMapBounds(adaptedBounds as any)
    })

    // Watch theme changes
    watch(() => appStore.theme, () => {
      applyDarkMode()
      updateSeverityColors()
    })

    // Watch node/alarm data changes
    watch(() => [mapStore.nodesWithCoordinates, mapStore.getNodeAlarmSeverityMap()], syncNodeSource, { deep: true })

    // Watch topology edge changes (when edges visible)
    watch(() => topologyStore.edges, () => { if (edgesVisible.value) syncEdgeSource() }, { deep: true })
    watch(() => wmStore.edgeUtilMap, () => { if (edgesVisible.value) syncEdgeSource() }, { deep: true })

    // Resize observer
    const observer = new ResizeObserver(() => map?.resize())
    observer.observe(containerRef.value)
    onBeforeUnmount(() => observer.disconnect())
  })

  onBeforeUnmount(() => {
    map?.remove()
    map = null
  })

  return {
    popupNode,
    edgeTooltip,
    edgesVisible,
    edgesLoading,
    flyTo,
    setBoundingBox,
    invalidateSize,
    toggleEdges
  }
}

export default useMapLibre
```

- [ ] **Step 2: Verify TypeScript compiles (no build step needed, just tsc check)**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E 'error|warning' | head -20
```

Expected: no TypeScript errors from the new file (there may be existing warnings from elsewhere — focus only on errors in `useMapLibre.ts` or `mapGeoUtils.ts`).

- [ ] **Step 3: Commit**

```bash
git add ui/src/composables/useMapLibre.ts
git commit -m "feat(map): add useMapLibre composable with node/cluster/edge layers"
```

---

## Task 5: `MapNodePopup.vue` — Feather DS node detail popup

**Files:**
- Create: `ui/src/components/Map/MapNodePopup.vue`

The popup is displayed via Vue `Teleport` into a fixed overlay `div` inside `MapLibreMap.vue`. It receives a `Node` and screen coordinates `{ x, y }`, displays node detail using Feather DS styling and `SeverityBadge`, and emits `close` on Esc or click-away.

- [ ] **Step 1: Create `MapNodePopup.vue`**

The component renders directly inside `MapLibreMap.vue`'s `.geo-map__overlay` div (which has `position: absolute; inset: 0`). No Teleport needed — the overlay div is the positioning context.

```vue
<template>
  <div
    v-if="node"
    class="map-node-popup"
    :style="{ left: x + 'px', top: y + 'px' }"
    ref="popupEl"
  >
      <div class="map-node-popup__header">
        <a :href="`${baseHref}${baseNodeUrl}${node.id}`" target="_blank" class="map-node-popup__title">
          {{ node.label }}
        </a>
        <SeverityBadge :severity="severity" />
      </div>

      <div class="map-node-popup__coords">
        {{ latitude }}, {{ longitude }}
      </div>

      <div class="map-node-popup__body">
        <div class="map-node-popup__row">
          <span class="map-node-popup__key">IP Address</span>
          <span>{{ node.primaryInterface?.ipAddress || ipAddress || 'N/A' }}</span>
        </div>
        <div class="map-node-popup__row" v-if="node.assetRecord?.description">
          <span class="map-node-popup__key">Description</span>
          <span>{{ node.assetRecord.description }}</span>
        </div>
        <div class="map-node-popup__row" v-if="node.assetRecord?.maintcontract">
          <span class="map-node-popup__key">Maint. Contract</span>
          <span>{{ node.assetRecord.maintcontract }}</span>
        </div>
        <div class="map-node-popup__row" v-if="node.categories?.length">
          <span class="map-node-popup__key">Category</span>
          <span>{{ node.categories[0].name }}</span>
        </div>
      </div>

      <div class="map-node-popup__footer">
        <a :href="topologyLink" class="map-node-popup__topo-link">View in Topology</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { PropType } from 'vue'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
import { useMenuStore } from '@/stores/menuStore'
import { useMapStore } from '@/stores/mapStore'
import type { Node } from '@/types'

const props = defineProps({
  node: { type: Object as PropType<Node>, default: null },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  ipAddress: { type: String, default: '' }
})

const emit = defineEmits(['close'])

const menuStore = useMenuStore()
const mapStore = useMapStore()
const popupEl = ref<HTMLElement | null>(null)

const baseHref = computed(() => menuStore.mainMenu.baseHref ?? '')
const baseNodeUrl = computed(() => menuStore.mainMenu.baseNodeUrl ?? 'element/node.jsp?node=')

const severity = computed(() => {
  if (!props.node) return 'NORMAL'
  const sevMap = mapStore.getNodeAlarmSeverityMap()
  return sevMap[props.node.label] ?? 'NORMAL'
})

const latitude = computed(() => {
  const v = parseFloat(String(props.node?.assetRecord?.latitude))
  return isNaN(v) ? '' : v.toFixed(6)
})

const longitude = computed(() => {
  const v = parseFloat(String(props.node?.assetRecord?.longitude))
  return isNaN(v) ? '' : v.toFixed(6)
})

const topologyLink = computed(() =>
  `${baseHref.value}topology?provider=Enhanced Linkd&focus-vertices=${props.node?.id}`
)

// Dismiss on Escape
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.map-node-popup {
  position: absolute;
  z-index: 200;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  width: 320px;
  transform: translate(12px, -50%);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px 8px;
    border-bottom: 1px solid var($border-on-surface);
  }

  &__title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var($primary);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &:hover { text-decoration: underline; }
  }

  &__coords {
    padding: 4px 14px;
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    font-family: monospace;
  }

  &__body {
    padding: 4px 14px 8px;
  }

  &__row {
    display: flex;
    gap: 8px;
    font-size: 0.78rem;
    padding: 2px 0;
    color: var($primary-text-on-surface);
  }

  &__key {
    font-weight: 600;
    min-width: 110px;
    color: var($secondary-text-on-surface);
    flex-shrink: 0;
  }

  &__footer {
    padding: 8px 14px 10px;
    border-top: 1px solid var($border-on-surface);
    font-size: 0.78rem;
  }

  &__topo-link {
    color: var($primary);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/Map/MapNodePopup.vue
git commit -m "feat(map): add MapNodePopup Feather DS card component"
```

---

## Task 6: `MapLibreMap.vue` — assemble root map component

**Files:**
- Create: `ui/src/components/Map/MapLibreMap.vue`
- Modify: `ui/src/containers/Map.vue`

This component replaces `LeafletMap.vue`. It must expose `invalidateSizeFn()` so `Map.vue`'s resize debounce works unchanged.

- [ ] **Step 1: Create `MapLibreMap.vue`**

```vue
<template>
  <div class="geo-map" ref="mapContainer">
    <!-- Overlay controls positioned above the map canvas -->
    <MapSearch class="map-search-bar" @fly-to-node="composable.flyTo" @set-bounding-box="composable.setBoundingBox" />
    <SeverityFilter class="map-severity-bar" />

    <!-- Edge toggle button -->
    <button
      class="map-edge-toggle"
      :class="{ 'map-edge-toggle--active': composable.edgesVisible.value }"
      @click="composable.toggleEdges"
      :disabled="composable.edgesLoading.value"
      :title="composable.edgesVisible.value ? 'Hide topology links' : 'Show topology links'"
    >
      <span v-if="composable.edgesLoading.value">Loading…</span>
      <span v-else>{{ composable.edgesVisible.value ? 'Hide Links' : 'Show Links' }}</span>
    </button>

    <!-- MapLibre renders into this div -->
    <div ref="mapEl" class="geo-map__canvas" />

    <!-- Overlay: popup and tooltip render here, positioned relative to the map container -->
    <div class="geo-map__overlay">
      <MapNodePopup
        v-if="composable.popupNode.value"
        :node="composable.popupNode.value.node"
        :x="composable.popupNode.value.x"
        :y="composable.popupNode.value.y"
        @close="composable.popupNode.value = null"
      />
      <TopologyEdgeTooltip :tooltip="composable.edgeTooltip.value" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MapSearch from './MapSearch.vue'
import SeverityFilter from './SeverityFilter.vue'
import MapNodePopup from './MapNodePopup.vue'
import TopologyEdgeTooltip from '@/components/Topology/TopologyEdgeTooltip.vue'
import useMapLibre from '@/composables/useMapLibre'

const mapEl = ref<HTMLElement | null>(null)
const composable = useMapLibre(mapEl)

// Exposed for Map.vue's resize debounce
const invalidateSizeFn = () => composable.invalidateSize()
defineExpose({ invalidateSizeFn })
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use '@/styles/vars' as vars;

.geo-map {
  height: 100%;
  position: relative;
  overflow: hidden;

  &__canvas {
    position: absolute;
    inset: 0;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    // Children (popup, tooltip) re-enable pointer events individually
    > * { pointer-events: auto; }
  }
}

.map-search-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 200;
}

.map-severity-bar {
  position: absolute;
  z-index: 200;
}

.map-edge-toggle {
  position: absolute;
  top: 10px;
  right: 60px; // to the left of MapLibre zoom controls
  z-index: 200;
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var($surface);
  border: 2px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  color: var($primary-text-on-surface);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: var($primary); }

  &--active {
    background: var($primary);
    color: var($primary-text-on-color);
    border-color: var($primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
```

- [ ] **Step 2: Update `Map.vue` to use `MapLibreMap` instead of `LeafletMap`**

In `ui/src/containers/Map.vue`, change the import and component reference:

```typescript
// Remove:
import LeafletMap from '../components/Map/LeafletMap.vue'

// Add:
import MapLibreMap from '../components/Map/MapLibreMap.vue'
```

In the template, change `<LeafletMap v-if="nodesReady" ref="leafletComponent" />` to:

```html
<MapLibreMap v-if="nodesReady" ref="leafletComponent" />
```

The `invalidateSizeFn` method name and `defineExpose` interface is identical, so the resize debounce in `Map.vue` requires no other changes.

- [ ] **Step 3: Build and verify no TypeScript errors**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -c '^src' || echo "no errors"
```

Expected: build succeeds (zero `error TS` lines in output).

- [ ] **Step 4: Deploy and smoke test**

```bash
./ui/deploy-to-container.sh test-opennms
```

Then in a browser:
1. Navigate to `http://localhost:8980/opennms/ui/map`
2. Verify map tiles load (OpenStreetMap)
3. Verify nodes appear as circles colored by severity
4. Click a node → popup appears with label, severity badge, IP, coords
5. Click elsewhere → popup closes
6. Click "Show Links" → topology edges appear as lines between geolocated nodes
7. Hover an edge → tooltip shows protocols and src/tgt labels
8. Toggle dark mode → map tiles invert to dark blue-gray
9. Verify zoom controls appear top-right

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Map/MapLibreMap.vue ui/src/containers/Map.vue
git commit -m "feat(map): replace LeafletMap with MapLibreMap (MapLibre GL JS)"
```

---

## Task 7: Full build, test suite, and cleanup

**Files:**
- Delete: `ui/src/components/Map/LeafletMap.vue`
- Delete: `ui/src/components/Map/MarkerCluster.vue`
- Delete: `ui/src/components/Map/MarkerClusterPopupContent.vue`
- Delete: `ui/src/components/Map/MarkerPopup.vue`
- Delete: `ui/src/assets/Critical-icon.png`, `Minor-icon.png`, `Major-icon.png`, `Normal-icon.png`, `Warning-icon.png`

- [ ] **Step 1: Verify no remaining imports of the deleted files**

```bash
grep -r 'LeafletMap\|MarkerCluster\|MarkerPopup\|MarkerClusterPopup\|Critical-icon\|Minor-icon\|Major-icon\|Normal-icon\|Warning-icon' ui/src/ --include='*.ts' --include='*.vue' -l
```

Expected: no files listed (all references were in the files being deleted).

If any files appear, update them to remove the dead imports before proceeding.

- [ ] **Step 2: Verify no remaining `@vue-leaflet` or `leaflet` imports**

```bash
grep -r 'vue-leaflet\|from .leaflet' ui/src/ --include='*.ts' --include='*.vue' -l
```

Expected: no files listed.

- [ ] **Step 3: Delete the old files**

```bash
rm ui/src/components/Map/LeafletMap.vue \
   ui/src/components/Map/MarkerCluster.vue \
   ui/src/components/Map/MarkerClusterPopupContent.vue \
   ui/src/components/Map/MarkerPopup.vue

rm ui/src/assets/Critical-icon.png \
   ui/src/assets/Minor-icon.png \
   ui/src/assets/Major-icon.png \
   ui/src/assets/Normal-icon.png \
   ui/src/assets/Warning-icon.png
```

- [ ] **Step 4: Run full test suite**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run 2>&1 | tail -30
```

Expected: all tests pass. The existing `map.test.ts` tests `numericSeverityLevel` from `utils.ts` — that file is untouched, so it should still pass.

- [ ] **Step 5: Build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -10
```

Expected: build succeeds, output shows `ui/src/main/dist/index.html`.

- [ ] **Step 6: Verify CSS has no bare `--feather-*` variables**

```bash
grep -o 'var(--feather[^)]*)\|--feather-[^:; ]*' ui/src/main/dist/assets/*.css | grep -v 'var(' | head -5
```

Expected: no output (all `--feather-*` tokens wrapped in `var()`).

- [ ] **Step 7: Deploy final build**

```bash
./ui/deploy-to-container.sh test-opennms
```

Verify both bundle hashes match:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Both must print the same hash.

- [ ] **Step 8: Final smoke test in browser**

Hard-refresh (`Cmd+Option+R` in Safari, Shift+click in Chrome) then verify:
1. Map loads at `/opennms/ui/map` with tiles visible
2. Node clusters appear; click cluster to zoom in
3. Unclustered nodes colored by severity
4. Click node → Feather DS popup with severity badge
5. "Show Links" button shows topology edge lines
6. Hover edge → `TopologyEdgeTooltip` with protocol + bandwidth data
7. Toggle dark mode → tiles go dark, node colors stay correct
8. Search bar finds and flies to a node
9. Severity filter hides/shows nodes correctly
10. Bottom grid (nodes/alarms tabs) still works

- [ ] **Step 9: Commit cleanup**

```bash
git add -u  # stages deletions
git add ui/src/ ui/tests/
git commit -m "feat(map): remove old Leaflet components and PNG icon assets"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Replace Leaflet with MapLibre GL JS | Task 1, 4 |
| Pure GeoJSON builders with tests | Task 2 |
| isMapLibreStyle detection | Task 3 |
| Core composable: init, tiles, resize, nav | Task 4 |
| Node clusters, severity circles | Task 4 |
| MapNodePopup Feather DS card | Task 5 |
| Edge layer from topologyStore | Task 4 |
| Weathermap utilization in edge tooltip | Task 4 (tooltip) |
| Dark mode CSS filter | Task 4 |
| Edge toggle button | Task 6 |
| Reuse TopologyEdgeTooltip | Task 6 |
| MapLibreMap.vue + Map.vue swap | Task 6 |
| Remove old components + PNG assets | Task 7 |
| Zero `innerHTML` / `window['L']` | Task 7 (verify step 2) |
