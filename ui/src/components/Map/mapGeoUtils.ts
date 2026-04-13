import type { FeatureCollection, Feature, Point, LineString } from 'geojson'
import type { Node } from '@/types'
import type { TopologyEdge, TopologyVertex } from '@/types/topology'

/** Maps severity name → numeric rank for cluster severity aggregation. */
export const SEVERITY_RANK: Record<string, number> = {
  NORMAL: 0,
  INDETERMINATE: 0,
  CLEARED: 0,
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
    if (isFinite(lat) && isFinite(lng)) {
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
