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
import { buildNodeCoordMap, buildNodeFeatureCollection, buildEdgeFeatureCollection, type EdgeFeatureProperties } from '@/components/Map/mapGeoUtils'
import { getProtocolColor, utilizationColor } from '@/components/Topology/protocolColors'

// Read a Feather DS CSS custom property at runtime — same pattern as useTopology.ts
const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Severity → Feather DS CSS variable name
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
  let watchStops: (() => void)[] = []
  let resizeObserver: ResizeObserver | null = null

  const popupNode = ref<PopupState | null>(null)
  const edgeTooltip = ref<EdgeTooltipState | null>(null)
  const edgesVisible = ref(false)
  const edgesLoading = ref(false)

  // ── Tile source helpers ──────────────────────────────────────────────────

  /** Converts an OSM-style {s} subdomain URL to MapLibre format (picks 'a'). */
  const toMapLibreTileUrl = (url: string): string => url.replace('{s}', 'a')

  /** Returns a MapLibre StyleSpecification wrapping the raster tile URL, or the style URL directly. */
  const buildStyle = (): maplibregl.StyleSpecification | string => {
    const providers = geolocationStore.tileProviders
    const primary = providers.find(p => p.visible) ?? providers[0]

    if (!primary) {
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
      return primary.url
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

  /** Apply or remove the dark mode CSS filter to the MapLibre canvas element only. */
  const applyDarkMode = () => {
    const canvas = map?.getCanvas()
    if (!canvas) return
    const isDark = appStore.theme === 'open-dark'
    canvas.style.filter = isDark
      ? 'invert(1) hue-rotate(200deg) brightness(0.8) contrast(0.9)'
      : ''
  }

  // ── Severity colors ───────────────────────────────────────────────────────

  const resolveSeverityColors = (): Record<string, string> =>
    Object.fromEntries(
      Object.entries(SEVERITY_CSS_VARS).map(([sev, varName]) => [sev, cssVar(varName) || '#718096'])
    )

  const updateSeverityColors = () => {
    if (!map || !map.getLayer('map-nodes-point')) return
    const c = resolveSeverityColors()

    const severityMatchExpr: maplibregl.ExpressionSpecification = [
      'match', ['get', 'severity'],
      'CRITICAL', c.CRITICAL,
      'MAJOR',    c.MAJOR,
      'MINOR',    c.MINOR,
      'WARNING',  c.WARNING,
      c.NORMAL
    ]

    map.setPaintProperty('map-nodes-point', 'circle-color', severityMatchExpr)
    map.setPaintProperty('map-nodes-point', 'circle-stroke-color', severityMatchExpr)

    map.setPaintProperty('map-clusters', 'circle-color', [
      'step', ['get', 'maxSeverityRank'],
      c.NORMAL,
      1, c.WARNING,
      2, c.MINOR,
      3, c.MAJOR,
      4, c.CRITICAL
    ] as maplibregl.ExpressionSpecification)
  }

  // ── Node GeoJSON source ───────────────────────────────────────────────────

  const getNodeCoordMap = () => buildNodeCoordMap(mapStore.nodesWithCoordinates)

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
        'circle-color': ['step', ['get', 'maxSeverityRank'], c.NORMAL, 1, c.WARNING, 2, c.MINOR, 3, c.MAJOR, 4, c.CRITICAL] as maplibregl.ExpressionSpecification,
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30] as maplibregl.ExpressionSpecification,
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
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (zoom === null) return
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        map!.easeTo({ center: coords, zoom })
      }).catch((err) => {
        if (import.meta.env.DEV) console.warn('[useMapLibre] getClusterExpansionZoom failed', err)
      })
    })

    // Cursor changes
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

    // Compute per-edge color: utilization (if available) overrides protocol color
    for (const feature of fc.features) {
      const props = feature.properties as { edgeKey: string; protocols: string[]; color?: string }
      const util = wmStore.edgeUtilMap[props.edgeKey]
      const proto = Array.isArray(props.protocols) ? props.protocols[0] : ''
      props.color = util ? utilizationColor(util.utilPct) : getProtocolColor(proto ?? '')
    }

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
        'line-color': ['get', 'color'] as maplibregl.ExpressionSpecification,
        'line-width': 2,
        'line-opacity': 0.75
      }
    }, 'map-clusters') // insert below node layers

    map!.addLayer({
      id: 'map-edges-user-defined',
      type: 'line',
      source: 'map-edges',
      filter: ['==', ['get', 'userDefined'], true],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#A0AEC0',
        'line-width': 2,
        'line-dasharray': [6, 3],
        'line-opacity': 0.85
      }
    }, 'map-clusters')

    // Edge hover tooltip
    map!.on('mousemove', 'map-edges-line', (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as Record<string, unknown>
      // MapLibre serialises array properties to JSON strings — parse back
      const protocols = typeof props.protocols === 'string'
        ? JSON.parse(props.protocols) as string[]
        : []
      const util = wmStore.edgeUtilMap[props.edgeKey as string] ?? null
      const labelData = wmStore.edgeLabelData[props.edgeKey as string] ?? null
      edgeTooltip.value = {
        x: e.point.x,
        y: e.point.y,
        protocols,
        srcLabel: props.srcLabel as string,
        tgtLabel: props.tgtLabel as string,
        srcNodeId: (props.srcNodeId as string) || null,
        tgtNodeId: (props.tgtNodeId as string) || null,
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

  // ── Edge toggle ───────────────────────────────────────────────────────────

  const toggleEdges = async () => {
    edgesVisible.value = !edgesVisible.value

    if (edgesVisible.value) {
      if (topologyStore.availableLayers.length === 0) {
        edgesLoading.value = true
        await topologyStore.loadContainers()
        edgesLoading.value = false
      }
      map?.setLayoutProperty('map-edges-line', 'visibility', 'visible')
      map?.setLayoutProperty('map-edges-user-defined', 'visibility', 'visible')
      syncEdgeSource()
    } else {
      map?.setLayoutProperty('map-edges-line', 'visibility', 'none')
      map?.setLayoutProperty('map-edges-user-defined', 'visibility', 'none')
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const flyTo = (nodeLabelOrId: string) => {
    if (!map) return
    const coordMap = getNodeCoordMap()
    let coords = coordMap.get(nodeLabelOrId)
    if (!coords) {
      const node = mapStore.nodesWithCoordinates.find(n => n.label === nodeLabelOrId)
      if (node) coords = coordMap.get(node.id)
    }
    if (coords) map.flyTo({ center: coords, zoom: 7 })
  }

  const setBoundingBox = (nodeLabels: string[]) => {
    if (!map) return
    const coordMap = getNodeCoordMap()
    const nodeByLabel = new Map(mapStore.nodesWithCoordinates.map(n => [n.label, n]))
    const coords: [number, number][] = nodeLabels
      .map(label => { const n = nodeByLabel.get(label); return n ? coordMap.get(n.id) : undefined })
      .filter((c): c is [number, number] => c !== undefined)
    if (!coords.length) return
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
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
      center: [
        parseFloat(String(mapStore.mapCenter.longitude)),
        parseFloat(String(mapStore.mapCenter.latitude))
      ],
      zoom: 2,
      minZoom: 2,
      maxZoom: 19
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      addNodeLayers()
      addEdgeLayers()
      map!.setLayoutProperty('map-edges-line', 'visibility', 'none')
      map!.setLayoutProperty('map-edges-user-defined', 'visibility', 'none')
      applyDarkMode()
      updateSeverityColors()
      syncNodeSource()

      // Fit to node bounds on first load
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
      const b = map!.getBounds()
      const adaptedBounds = {
        getNorthEast: () => ({ lat: b.getNorth(), lng: b.getEast() }),
        getSouthWest: () => ({ lat: b.getSouth(), lng: b.getWest() })
      }
      mapStore.setMapBounds(adaptedBounds as any)
    })

    resizeObserver = new ResizeObserver(() => map?.resize())
    resizeObserver.observe(containerRef.value!)
  })

  watchStops = [
    watch(() => appStore.theme, () => { applyDarkMode(); updateSeverityColors() }),
    watch(() => [mapStore.nodesWithCoordinates, mapStore.getNodeAlarmSeverityMap()], syncNodeSource, { deep: true }),
    watch(() => topologyStore.edges, () => { if (edgesVisible.value) syncEdgeSource() }, { deep: true }),
    watch(() => wmStore.edgeUtilMap, () => { if (edgesVisible.value) syncEdgeSource() }, { deep: true })
  ]

  onBeforeUnmount(() => {
    watchStops.forEach(stop => stop())
    resizeObserver?.disconnect()
    resizeObserver = null
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
