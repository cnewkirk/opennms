import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTopologyStore } from '@/stores/topologyStore'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { TopologyVertex } from '@/types/topology'

// vi.mock() is hoisted to module scope by Vitest — must be at top level, not inside beforeEach
vi.mock('@/services/topologyService', () => ({
  getContainers: vi.fn().mockResolvedValue([]),
  getGraph: vi.fn().mockResolvedValue({ vertices: [], edges: [] })
}))

// Helper: build a minimal TopologyVertex
const makeVertex = (id: string, label: string, nodeID?: string, ipAddress?: string): TopologyVertex => ({
  id, namespace: 'lldp', label, nodeID, ipAddress
})

describe('topologyStore filteredVertices', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('returns all vertices when no filters are active', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    // Directly inject vertices into layerCache for testing
    store.layerCache['lldp'] = { vertices: [makeVertex('1', 'router-a'), makeVertex('2', 'switch-b')], edges: [] }
    store.activeLayers.push('lldp')
    viewStore.filters.namePattern = ''
    viewStore.filters.surveillanceCategories = []
    viewStore.filters.cidrs = []
    expect(store.filteredVertices).toHaveLength(2)
  })

  it('filters by namePattern substring (case-insensitive)', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = { vertices: [makeVertex('1', 'Router-A'), makeVertex('2', 'switch-b')], edges: [] }
    store.activeLayers.push('lldp')
    viewStore.filters.namePattern = 'router'
    expect(store.filteredVertices).toHaveLength(1)
    expect(store.filteredVertices[0].label).toBe('Router-A')
  })

  it('filters by namePattern regex when prefixed with /', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = { vertices: [makeVertex('1', 'cr-01'), makeVertex('2', 'ar-02'), makeVertex('3', 'cr-03')], edges: [] }
    store.activeLayers.push('lldp')
    viewStore.filters.namePattern = '/^cr'
    expect(store.filteredVertices).toHaveLength(2)
  })

  it('filters by CIDR — node in range passes', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = {
      vertices: [
        makeVertex('1', 'in-range', undefined, '10.0.1.5'),
        makeVertex('2', 'out-range', undefined, '192.168.1.1')
      ],
      edges: []
    }
    store.activeLayers.push('lldp')
    viewStore.filters.cidrs = ['10.0.0.0/8']
    expect(store.filteredVertices).toHaveLength(1)
    expect(store.filteredVertices[0].id).toBe('1')
  })

  it('nodes without ipAddress fail CIDR filter when cidrs are active', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = { vertices: [makeVertex('1', 'no-ip')], edges: [] }
    store.activeLayers.push('lldp')
    viewStore.filters.cidrs = ['10.0.0.0/8']
    expect(store.filteredVertices).toHaveLength(0)
  })

  it('multiple filters are ANDed', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = {
      vertices: [
        makeVertex('1', 'cr-01', undefined, '10.0.0.1'),   // passes name + CIDR
        makeVertex('2', 'ar-01', undefined, '10.0.0.2'),   // fails name
        makeVertex('3', 'cr-02', undefined, '192.168.1.1') // fails CIDR
      ],
      edges: []
    }
    store.activeLayers.push('lldp')
    viewStore.filters.namePattern = 'cr'
    viewStore.filters.cidrs = ['10.0.0.0/8']
    expect(store.filteredVertices).toHaveLength(1)
    expect(store.filteredVertices[0].id).toBe('1')
  })
})

describe('topologyStore filteredEdges', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('hides edges whose endpoints are filtered out', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = {
      vertices: [makeVertex('1', 'visible'), makeVertex('2', 'hidden')],
      edges: [{ source: { namespace: 'lldp', id: 1 }, target: { namespace: 'lldp', id: 2 } }]
    }
    store.activeLayers.push('lldp')
    viewStore.filters.namePattern = 'visible'
    // Both endpoints must be in filteredVertices for the edge to show
    expect(store.filteredEdges).toHaveLength(0)
  })

  it('shows edges when both endpoints pass filter', () => {
    const store = useTopologyStore()
    const viewStore = useTopologyViewStore()
    store.layerCache['lldp'] = {
      vertices: [makeVertex('1', 'node-a'), makeVertex('2', 'node-b')],
      edges: [{ source: { namespace: 'lldp', id: 1 }, target: { namespace: 'lldp', id: 2 } }]
    }
    store.activeLayers.push('lldp')
    viewStore.filters.namePattern = 'node'
    expect(store.filteredEdges).toHaveLength(1)
  })

  it('returns vertices ref directly (identity) when no filters active', () => {
    const store = useTopologyStore()
    store.layerCache['lldp'] = { vertices: [makeVertex('1', 'a'), makeVertex('2', 'b')], edges: [] }
    store.activeLayers.push('lldp')
    // No filters — filteredVertices should be the same array as vertices (prevents spurious watcher)
    expect(store.filteredVertices).toBe(store.vertices)
  })

  it('returns edges ref directly (identity) when no filters active', () => {
    const store = useTopologyStore()
    store.layerCache['lldp'] = {
      vertices: [makeVertex('1', 'a'), makeVertex('2', 'b')],
      edges: [{ source: { namespace: 'lldp', id: 1 }, target: { namespace: 'lldp', id: 2 } }]
    }
    store.activeLayers.push('lldp')
    // No filters — filteredEdges must be the same array reference as edges
    expect(store.filteredEdges).toBe(store.edges)
  })
})
