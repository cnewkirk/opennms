import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useTopologyViewStore } from '@/stores/topologyViewStore'

describe('useTopologyViewStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  describe('edgeLabels defaults', () => {
    it('defaults showUtilization=true, all others false', () => {
      const store = useTopologyViewStore()
      expect(store.edgeLabels.showUtilization).toBe(true)
      expect(store.edgeLabels.showLocalPort).toBe(false)
      expect(store.edgeLabels.showRemotePort).toBe(false)
      expect(store.edgeLabels.showIp).toBe(false)
      expect(store.edgeLabels.showMac).toBe(false)
      expect(store.edgeLabels.showSpeed).toBe(false)
    })
  })

  describe('gridSnap defaults', () => {
    it('defaults enabled=false, size=20', () => {
      const store = useTopologyViewStore()
      expect(store.gridSnap.enabled).toBe(false)
      expect(store.gridSnap.size).toBe(20)
    })
  })

  describe('filter defaults', () => {
    it('defaults to empty filters', () => {
      const store = useTopologyViewStore()
      expect(store.filters.surveillanceCategories).toEqual([])
      expect(store.filters.cidrs).toEqual([])
      expect(store.filters.namePattern).toBe('')
    })
  })

  describe('edgeLabels localStorage persistence', () => {
    it('persists edgeLabel changes to localStorage', async () => {
      const store = useTopologyViewStore()
      store.edgeLabels.showLocalPort = true
      await nextTick()
      const raw = localStorage.getItem('opennms-topology-edge-labels')
      expect(raw).not.toBeNull()
      const saved = JSON.parse(raw!)
      expect(saved.showLocalPort).toBe(true)
      expect(saved.showUtilization).toBe(true)
    })

    it('restores edgeLabels from localStorage on init', () => {
      localStorage.setItem('opennms-topology-edge-labels', JSON.stringify({
        showUtilization: false,
        showLocalPort: true,
        showRemotePort: false,
        showIp: true,
        showMac: false,
        showSpeed: true
      }))
      setActivePinia(createPinia())
      const store = useTopologyViewStore()
      expect(store.edgeLabels.showUtilization).toBe(false)
      expect(store.edgeLabels.showLocalPort).toBe(true)
      expect(store.edgeLabels.showIp).toBe(true)
    })

    it('handles corrupt localStorage for edgeLabels gracefully', () => {
      localStorage.setItem('opennms-topology-edge-labels', 'BAD_JSON')
      setActivePinia(createPinia())
      const store = useTopologyViewStore()
      expect(store.edgeLabels.showUtilization).toBe(true) // default
    })
  })

  describe('dirty flag', () => {
    it('isDirty is false on init', () => {
      const store = useTopologyViewStore()
      expect(store.isDirty).toBe(false)
    })

    it('isDirty becomes true after markDirty()', () => {
      const store = useTopologyViewStore()
      store.markDirty()
      expect(store.isDirty).toBe(true)
    })

    it('clearDirty() resets isDirty to false', () => {
      const store = useTopologyViewStore()
      store.markDirty()
      store.clearDirty()
      expect(store.isDirty).toBe(false)
    })
  })

  describe('nodePositions', () => {
    it('saveNodePositions() stores positions to localStorage using layoutKey', () => {
      const store = useTopologyViewStore()
      store.saveNodePositions('enlinkd-lldp+ospf', { 'node1': { x: 100, y: 200 } })
      const raw = localStorage.getItem('opennms-topo-layout-enlinkd-lldp+ospf')
      expect(raw).not.toBeNull()
      const saved = JSON.parse(raw!)
      expect(saved['node1']).toEqual({ x: 100, y: 200 })
    })

    it('loadNodePositions() returns null for unknown layoutKey', () => {
      const store = useTopologyViewStore()
      expect(store.loadNodePositions('enlinkd-lldp')).toBeNull()
    })

    it('loadNodePositions() returns saved positions', () => {
      localStorage.setItem('opennms-topo-layout-enlinkd-lldp', JSON.stringify({ 'a': { x: 1, y: 2 } }))
      const store = useTopologyViewStore()
      expect(store.loadNodePositions('enlinkd-lldp')).toEqual({ 'a': { x: 1, y: 2 } })
    })

    it('loadNodePositions() returns null on corrupt data', () => {
      localStorage.setItem('opennms-topo-layout-enlinkd-lldp', 'CORRUPT')
      const store = useTopologyViewStore()
      expect(store.loadNodePositions('enlinkd-lldp')).toBeNull()
    })

    it('clearNodePositions() removes the layout key from localStorage', () => {
      localStorage.setItem('opennms-topo-layout-enlinkd-lldp', JSON.stringify({}))
      const store = useTopologyViewStore()
      store.clearNodePositions('enlinkd-lldp')
      expect(localStorage.getItem('opennms-topo-layout-enlinkd-lldp')).toBeNull()
    })
  })

  describe('gridSnap', () => {
    it('toggleGridSnap() flips enabled', () => {
      const store = useTopologyViewStore()
      store.toggleGridSnap()
      expect(store.gridSnap.enabled).toBe(true)
      store.toggleGridSnap()
      expect(store.gridSnap.enabled).toBe(false)
    })

    it('snapToGrid() rounds to nearest grid size', () => {
      const store = useTopologyViewStore()
      store.gridSnap.enabled = true
      store.gridSnap.size = 20
      expect(store.snapToGrid(18)).toBe(20)
      expect(store.snapToGrid(9)).toBe(0)
      expect(store.snapToGrid(100)).toBe(100)
      expect(store.snapToGrid(31)).toBe(40)
    })

    it('snapToGrid() returns value unchanged when snap disabled', () => {
      const store = useTopologyViewStore()
      store.gridSnap.enabled = false
      expect(store.snapToGrid(18)).toBe(18)
    })
  })

  describe('private views localStorage', () => {
    it('savePrivateView() stores a view to localStorage', async () => {
      const store = useTopologyViewStore()
      const view = {
        id: 'v1',
        name: 'My View',
        scope: 'private' as const,
        owner: 'testuser',
        state: store.captureCurrentState(['lldp'], {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      store.savePrivateView(view)
      const raw = localStorage.getItem('opennms-topology-private-views')
      expect(raw).not.toBeNull()
      const views = JSON.parse(raw!)
      expect(views).toHaveLength(1)
      expect(views[0].id).toBe('v1')
    })

    it('loadPrivateViews() returns empty array when none saved', () => {
      const store = useTopologyViewStore()
      expect(store.loadPrivateViews()).toEqual([])
    })

    it('deletePrivateView() removes view by id', () => {
      const store = useTopologyViewStore()
      const makeView = (id: string) => ({
        id,
        name: id,
        scope: 'private' as const,
        owner: 'u',
        state: store.captureCurrentState([], {}),
        createdAt: '',
        updatedAt: ''
      })
      store.savePrivateView(makeView('a'))
      store.savePrivateView(makeView('b'))
      store.deletePrivateView('a')
      const views = store.loadPrivateViews()
      expect(views).toHaveLength(1)
      expect(views[0].id).toBe('b')
    })
  })

  describe('captureCurrentState / applyViewState', () => {
    it('captureCurrentState produces a snapshot of current state', () => {
      const store = useTopologyViewStore()
      store.edgeLabels.showLocalPort = true
      store.gridSnap.size = 40
      store.filters.namePattern = 'foo'
      const snap = store.captureCurrentState(['lldp'], { 'n1': { x: 10, y: 20 } })
      expect(snap.edgeLabels.showLocalPort).toBe(true)
      expect(snap.gridSnap.size).toBe(40)
      expect(snap.filters.namePattern).toBe('foo')
      expect(snap.activeLayers).toEqual(['lldp'])
      expect(snap.nodePositions['n1']).toEqual({ x: 10, y: 20 })
    })

    it('captureCurrentState produces a deep copy — mutating store after capture does not affect snapshot', () => {
      const store = useTopologyViewStore()
      store.filters.cidrs = ['10.0.0.0/8']
      const snap = store.captureCurrentState([], {})
      store.filters.cidrs.push('192.168.0.0/16')
      expect(snap.filters.cidrs).toEqual(['10.0.0.0/8'])
    })

    it('applyViewState restores all fields', () => {
      const store = useTopologyViewStore()
      const state = store.captureCurrentState(['ospf'], {})
      // Mutate everything
      store.edgeLabels.showIp = true
      store.gridSnap.enabled = true
      store.gridSnap.size = 40
      store.filters.namePattern = 'changed'
      store.markDirty()
      // Restore
      store.applyViewState(state)
      expect(store.edgeLabels.showIp).toBe(false)
      expect(store.gridSnap.enabled).toBe(false)
      expect(store.gridSnap.size).toBe(20)
      expect(store.filters.namePattern).toBe('')
    })

    it('applyViewState clears the dirty flag', () => {
      const store = useTopologyViewStore()
      store.markDirty()
      store.applyViewState(store.captureCurrentState([], {}))
      expect(store.isDirty).toBe(false)
    })
  })

  describe('personal filter defaults', () => {
    it('saveFilterDefaults() persists current filters to localStorage', () => {
      const store = useTopologyViewStore()
      store.filters.namePattern = 'myrouter'
      store.filters.cidrs = ['10.0.0.0/8']
      store.saveFilterDefaults()
      const raw = localStorage.getItem('opennms-topology-filter-defaults')
      expect(raw).not.toBeNull()
      const saved = JSON.parse(raw!)
      expect(saved.namePattern).toBe('myrouter')
      expect(saved.cidrs).toEqual(['10.0.0.0/8'])
    })

    it('loadFilterDefaults() returns null when nothing saved', () => {
      const store = useTopologyViewStore()
      expect(store.loadFilterDefaults()).toBeNull()
    })

    it('loadFilterDefaults() returns saved filter defaults', () => {
      const defaults = { surveillanceCategories: ['Production'], cidrs: [], namePattern: '' }
      localStorage.setItem('opennms-topology-filter-defaults', JSON.stringify(defaults))
      const store = useTopologyViewStore()
      const loaded = store.loadFilterDefaults()
      expect(loaded?.surveillanceCategories).toEqual(['Production'])
    })

    it('clearFilterDefaults() removes the localStorage key', () => {
      localStorage.setItem('opennms-topology-filter-defaults', JSON.stringify({}))
      const store = useTopologyViewStore()
      store.clearFilterDefaults()
      expect(localStorage.getItem('opennms-topology-filter-defaults')).toBeNull()
    })
  })
})
