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
