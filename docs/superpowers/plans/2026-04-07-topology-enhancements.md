# Topology Diagram Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the OpenNMS topology diagram with unified view state, named views, node filtering, friendly names, per-side edge labels, and grid snap.

**Architecture:** All view state is consolidated into a new `topologyViewStore` that replaces the existing `edgeLabelStore`. Every feature (filters, grid snap, edge labels, viewport) reads/writes this single store, making named view save/restore trivially complete. Backend adds a single REST endpoint for shared/global views only; private views stay in localStorage.

**Tech Stack:** Vue 3 + Pinia, Cytoscape.js, Vitest (happy-dom), Java 17 / Spring / Hibernate / Liquibase (backend only)

---

## Chunk 1: Foundation — Types, fieldLabels, topologyViewStore

### Task 1: Add new types to `ui/src/types/topology.ts`

**Files:**
- Modify: `ui/src/types/topology.ts`

- [ ] **Step 1: Append the new interfaces**

Add to the bottom of `ui/src/types/topology.ts` (after the existing `isVertex` export):

```typescript
export interface TopologyEdgeLabels {
  showUtilization: boolean
  showLocalPort: boolean
  showRemotePort: boolean
  showIp: boolean
  showMac: boolean
  showSpeed: boolean
}

export interface TopologyFilter {
  surveillanceCategories: string[]
  cidrs: string[]
  namePattern: string
}

export interface TopologyViewState {
  activeLayers: string[]
  nodePositions: Record<string, { x: number; y: number }>
  filters: TopologyFilter
  edgeLabels: TopologyEdgeLabels
  viewport: { pan: { x: number; y: number }; zoom: number }
  gridSnap: { enabled: boolean; size: number }
}

export interface TopologyView {
  id: string
  name: string
  description?: string
  // 'global': admin-set default applied to all users
  // 'shared': visible and loadable by all authenticated users
  // 'private': stored in localStorage, visible only in this browser
  scope: 'global' | 'shared' | 'private'
  // username (authStore.whoAmI.id); 'system' is a reserved sentinel for scope:'global'
  // the backend DAO must NOT attempt to resolve 'system' as a user record
  owner: string
  state: TopologyViewState
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -30
```
Expected: no errors relating to topology.ts.

- [ ] **Step 3: Commit**

```bash
git add ui/src/types/topology.ts
git commit -m "feat(topology): add TopologyViewState, TopologyFilter, TopologyView types"
```

---

### Task 2: Create `ui/src/components/Topology/fieldLabels.ts`

**Files:**
- Create: `ui/src/components/Topology/fieldLabels.ts`
- Create: `ui/tests/components/Topology/fieldLabels.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/components/Topology/fieldLabels.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { humanize, FIELD_LABELS } from '@/components/Topology/fieldLabels'

describe('FIELD_LABELS', () => {
  it('maps known protocol namespace keys', () => {
    expect(FIELD_LABELS['lldp']).toBe('LLDP')
    expect(FIELD_LABELS['ospf']).toBe('OSPF')
    expect(FIELD_LABELS['isis']).toBe('IS-IS')
    expect(FIELD_LABELS['bgp']).toBe('BGP')
    expect(FIELD_LABELS['mpls']).toBe('MPLS')
    expect(FIELD_LABELS['cdp']).toBe('CDP')
  })

  it('maps known edge label field keys', () => {
    expect(FIELD_LABELS['ospfArea']).toBe('OSPF Area')
    expect(FIELD_LABELS['ifName']).toBe('Interface')
    expect(FIELD_LABELS['ifDescr']).toBe('Interface Description')
    expect(FIELD_LABELS['ifSpeed']).toBe('Speed')
    expect(FIELD_LABELS['ipAddress']).toBe('IP Address')
    expect(FIELD_LABELS['localIp']).toBe('Local IP')
    expect(FIELD_LABELS['remoteIp']).toBe('Remote IP')
    expect(FIELD_LABELS['localIfName']).toBe('Local Interface')
    expect(FIELD_LABELS['remotePortId']).toBe('Remote Port')
    expect(FIELD_LABELS['localMac']).toBe('MAC Address')
  })
})

describe('humanize()', () => {
  it('returns FIELD_LABELS value for known keys', () => {
    expect(humanize('ospfArea')).toBe('OSPF Area')
    expect(humanize('lldp')).toBe('LLDP')
    expect(humanize('localIp')).toBe('Local IP')
  })

  it('splits camelCase for unknown clean keys', () => {
    expect(humanize('nodeLabel')).toBe('Node Label')
    expect(humanize('sourceNode')).toBe('Source Node')
  })

  it('replaces hyphens and underscores with spaces', () => {
    expect(humanize('some-key')).toBe('Some Key')
    expect(humanize('some_key')).toBe('Some Key')
  })

  it('title-cases each word', () => {
    expect(humanize('foo bar')).toBe('Foo Bar')
  })

  it('uses FIELD_LABELS for acronym-heavy keys that would mangle in fallback', () => {
    // These MUST be in the map — the fallback would produce garbage
    expect(humanize('ospf')).toBe('OSPF')
    expect(humanize('bgp')).toBe('BGP')
    expect(humanize('isis')).toBe('IS-IS')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/fieldLabels.test.ts 2>&1 | tail -10
```
Expected: FAIL — "Cannot find module '@/components/Topology/fieldLabels'"

- [ ] **Step 3: Create the implementation**

Create `ui/src/components/Topology/fieldLabels.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

/**
 * Explicit label overrides for known API property names and protocol namespace identifiers.
 *
 * IMPORTANT: The regex fallback in humanize() only works for clean camelCase English words.
 * Any key containing acronyms (OSPF, BGP, IS-IS), abbreviations, or non-English terms
 * MUST be added here — the fallback will mangle them.
 * Convention: when adding a new field to the topology UI, add its label here at the same time.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Protocol namespace identifiers
  lldp: 'LLDP',
  ospf: 'OSPF',
  isis: 'IS-IS',
  bgp: 'BGP',
  mpls: 'MPLS',
  cdp: 'CDP',
  // Edge label fields from weathermap/enlinkd data
  ospfArea: 'OSPF Area',
  ifName: 'Interface',
  ifDescr: 'Interface Description',
  ifSpeed: 'Speed',
  ipAddress: 'IP Address',
  localIp: 'Local IP',
  remoteIp: 'Remote IP',
  localIfName: 'Local Interface',
  remotePortId: 'Remote Port',
  localMac: 'MAC Address',
}

/**
 * Return a human-readable label for an API property name or protocol key.
 * Checks FIELD_LABELS first; falls back to splitting camelCase/kebab/snake.
 * The fallback is a last resort — always prefer adding entries to FIELD_LABELS.
 */
export function humanize(key: string): string {
  return FIELD_LABELS[key]
    ?? key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/fieldLabels.test.ts 2>&1 | tail -10
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Topology/fieldLabels.ts ui/tests/components/Topology/fieldLabels.test.ts
git commit -m "feat(topology): add fieldLabels.ts with FIELD_LABELS map and humanize()"
```

---

### Task 3: Create `ui/src/stores/topologyViewStore.ts`

This replaces `edgeLabelStore`. It owns the full `TopologyViewState` and handles localStorage persistence for edge labels, positions, grid snap, and private views.

**Files:**
- Create: `ui/src/stores/topologyViewStore.ts`
- Create: `ui/tests/stores/topologyViewStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `ui/tests/stores/topologyViewStore.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/stores/topologyViewStore.test.ts 2>&1 | tail -10
```
Expected: FAIL — "Cannot find module '@/stores/topologyViewStore'"

- [ ] **Step 3: Create the implementation**

Create `ui/src/stores/topologyViewStore.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'
import { TopologyView, TopologyViewState, TopologyEdgeLabels, TopologyFilter } from '@/types/topology'

const EDGE_LABELS_KEY = 'opennms-topology-edge-labels'
const PRIVATE_VIEWS_KEY = 'opennms-topology-private-views'
const FILTER_DEFAULTS_KEY = 'opennms-topology-filter-defaults'
const LAYOUT_KEY_PREFIX = 'opennms-topo-layout-'

const loadJson = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

const defaultEdgeLabels = (): TopologyEdgeLabels => ({
  showUtilization: true,
  showLocalPort: false,
  showRemotePort: false,
  showIp: false,
  showMac: false,
  showSpeed: false
})

const defaultFilters = (): TopologyFilter => ({
  surveillanceCategories: [],
  cidrs: [],
  namePattern: ''
})

export const useTopologyViewStore = defineStore('topologyViewStore', () => {
  // Edge label visibility — persisted to localStorage
  const _savedLabels = loadJson<Partial<TopologyEdgeLabels>>(EDGE_LABELS_KEY, {})
  const edgeLabels = reactive<TopologyEdgeLabels>({
    ...defaultEdgeLabels(),
    ..._savedLabels
  })
  watch(() => ({ ...edgeLabels }), (v) => {
    localStorage.setItem(EDGE_LABELS_KEY, JSON.stringify(v))
  }, { deep: true })

  // Active filter state (in-memory only; personal defaults are separate)
  const filters = reactive<TopologyFilter>(defaultFilters())

  // Grid snap state
  const gridSnap = reactive({ enabled: false, size: 20 })

  // Viewport (not persisted directly — restored per session via viewStore on load)
  const viewport = reactive({ pan: { x: 0, y: 0 }, zoom: 1 })

  // Dirty flag — set whenever user makes any change after load/save
  const isDirty = ref(false)
  const markDirty = () => { isDirty.value = true }
  const clearDirty = () => { isDirty.value = false }

  // --- Node position helpers (delegates to localStorage using existing key format) ---

  const saveNodePositions = (layoutKey: string, positions: Record<string, { x: number; y: number }>) => {
    if (!layoutKey) return
    localStorage.setItem(`${LAYOUT_KEY_PREFIX}${layoutKey}`, JSON.stringify(positions))
  }

  const loadNodePositions = (layoutKey: string): Record<string, { x: number; y: number }> | null => {
    if (!layoutKey) return null
    return loadJson<Record<string, { x: number; y: number }> | null>(`${LAYOUT_KEY_PREFIX}${layoutKey}`, null)
  }

  const clearNodePositions = (layoutKey: string) => {
    if (!layoutKey) return
    localStorage.removeItem(`${LAYOUT_KEY_PREFIX}${layoutKey}`)
  }

  // --- Grid snap helpers ---

  const toggleGridSnap = () => { gridSnap.enabled = !gridSnap.enabled }

  /** Snaps a coordinate value to the nearest grid point. Returns value unchanged if snap disabled. */
  const snapToGrid = (v: number): number => {
    if (!gridSnap.enabled) return v
    return Math.round(v / gridSnap.size) * gridSnap.size
  }

  // --- Private view CRUD (localStorage) ---

  const loadPrivateViews = (): TopologyView[] =>
    loadJson<TopologyView[]>(PRIVATE_VIEWS_KEY, [])

  const savePrivateView = (view: TopologyView) => {
    const views = loadPrivateViews().filter(v => v.id !== view.id)
    views.push(view)
    localStorage.setItem(PRIVATE_VIEWS_KEY, JSON.stringify(views))
  }

  const deletePrivateView = (id: string) => {
    const views = loadPrivateViews().filter(v => v.id !== id)
    localStorage.setItem(PRIVATE_VIEWS_KEY, JSON.stringify(views))
  }

  // --- Personal filter defaults ---

  const loadFilterDefaults = (): TopologyFilter | null =>
    loadJson<TopologyFilter | null>(FILTER_DEFAULTS_KEY, null)

  const saveFilterDefaults = () => {
    localStorage.setItem(FILTER_DEFAULTS_KEY, JSON.stringify({ ...filters }))
  }

  const clearFilterDefaults = () => {
    localStorage.removeItem(FILTER_DEFAULTS_KEY)
  }

  // --- View state capture / restore ---

  /** Snapshot current view state (called when saving a view). activeLayers and positions are passed in by caller. */
  const captureCurrentState = (
    activeLayers: string[],
    nodePositions: Record<string, { x: number; y: number }>
  ): TopologyViewState => ({
    activeLayers: [...activeLayers],
    nodePositions: { ...nodePositions },
    filters: { ...filters, surveillanceCategories: [...filters.surveillanceCategories], cidrs: [...filters.cidrs] },
    edgeLabels: { ...edgeLabels },
    viewport: { pan: { ...viewport.pan }, zoom: viewport.zoom },
    gridSnap: { ...gridSnap }
  })

  /** Apply a saved TopologyViewState to the store. Does NOT touch activeLayers or nodePositions
   *  (those are owned by topologyStore and useTopology respectively). */
  const applyViewState = (state: TopologyViewState) => {
    Object.assign(edgeLabels, state.edgeLabels)
    Object.assign(filters, state.filters)
    Object.assign(gridSnap, state.gridSnap)
    Object.assign(viewport, state.viewport)
    clearDirty()
  }

  return {
    edgeLabels,
    filters,
    gridSnap,
    viewport,
    isDirty,
    markDirty,
    clearDirty,
    saveNodePositions,
    loadNodePositions,
    clearNodePositions,
    toggleGridSnap,
    snapToGrid,
    loadPrivateViews,
    savePrivateView,
    deletePrivateView,
    loadFilterDefaults,
    saveFilterDefaults,
    clearFilterDefaults,
    captureCurrentState,
    applyViewState
  }
})
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/stores/topologyViewStore.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/stores/topologyViewStore.ts ui/tests/stores/topologyViewStore.test.ts
git commit -m "feat(topology): add topologyViewStore replacing edgeLabelStore"
```

---

## Chunk 2: topologyStore Migration — setActiveLayers + filteredVertices/filteredEdges + delete edgeLabelStore

### Task 4: Add `setActiveLayers()` and `filteredVertices`/`filteredEdges` to `topologyStore.ts`

This is the most critical migration step. `setActiveLayers()` is the action `topologyViewStore` will call when loading a saved view; `filteredVertices`/`filteredEdges` are what `useTopology` will render.

**Files:**
- Modify: `ui/src/stores/topologyStore.ts`
- Create: `ui/tests/stores/topologyStore.filteredVertices.test.ts`

- [ ] **Step 1: Write failing tests for filteredVertices/filteredEdges**

Create `ui/tests/stores/topologyStore.filteredVertices.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/stores/topologyStore.filteredVertices.test.ts 2>&1 | tail -15
```
Expected: FAIL — "filteredVertices is not a function/property"

- [ ] **Step 3: Add CIDR utility function**

Create `ui/src/components/Topology/cidrUtils.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
/// ...
///

/** Returns true if ipStr falls within the CIDR block cidrStr (e.g. "10.0.0.0/8"). */
export function ipInCidr(ipStr: string, cidrStr: string): boolean {
  const [baseStr, prefixStr] = cidrStr.split('/')
  const prefix = parseInt(prefixStr, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false
  const ipNum = ipToNum(ipStr)
  const baseNum = ipToNum(baseStr)
  if (ipNum === null || baseNum === null) return false
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipNum & mask) === (baseNum & mask)
}

function ipToNum(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/** Returns true if cidrStr is a syntactically valid CIDR notation. */
export function isValidCidr(cidrStr: string): boolean {
  const [ip, prefix] = cidrStr.split('/')
  if (!ip || !prefix) return false
  const p = parseInt(prefix, 10)
  if (isNaN(p) || p < 0 || p > 32) return false
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) &&
    ip.split('.').every(o => { const n = parseInt(o, 10); return n >= 0 && n <= 255 })
}
```

Also write tests for cidrUtils — create `ui/tests/components/Topology/cidrUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ipInCidr, isValidCidr } from '@/components/Topology/cidrUtils'

describe('ipInCidr', () => {
  it('matches an IP in range', () => {
    expect(ipInCidr('10.0.1.5', '10.0.0.0/8')).toBe(true)
  })
  it('rejects an IP out of range', () => {
    expect(ipInCidr('192.168.1.1', '10.0.0.0/8')).toBe(false)
  })
  it('handles /24', () => {
    expect(ipInCidr('10.0.1.200', '10.0.1.0/24')).toBe(true)
    expect(ipInCidr('10.0.2.1', '10.0.1.0/24')).toBe(false)
  })
  it('handles /32 exact match', () => {
    expect(ipInCidr('10.0.0.1', '10.0.0.1/32')).toBe(true)
    expect(ipInCidr('10.0.0.2', '10.0.0.1/32')).toBe(false)
  })
  it('handles /0 (matches everything)', () => {
    expect(ipInCidr('1.2.3.4', '0.0.0.0/0')).toBe(true)
  })
  it('returns false for invalid IP', () => {
    expect(ipInCidr('not-an-ip', '10.0.0.0/8')).toBe(false)
  })
  it('returns false for invalid CIDR', () => {
    expect(ipInCidr('10.0.0.1', 'not-a-cidr')).toBe(false)
  })
})

describe('isValidCidr', () => {
  it('accepts valid CIDR', () => expect(isValidCidr('10.0.0.0/8')).toBe(true))
  it('rejects missing prefix', () => expect(isValidCidr('10.0.0.0')).toBe(false))
  it('rejects out-of-range prefix', () => expect(isValidCidr('10.0.0.0/33')).toBe(false))
  it('rejects invalid IP', () => expect(isValidCidr('256.0.0.0/8')).toBe(false))
})
```

Run CIDR tests to verify they pass before using in store:

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/cidrUtils.test.ts 2>&1 | tail -10
```

- [ ] **Step 4: Add filteredVertices/filteredEdges/setActiveLayers to topologyStore.ts**

Open `ui/src/stores/topologyStore.ts`. Make the following additions:

**4a.** After the existing imports, add:
```typescript
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { ipInCidr } from '@/components/Topology/cidrUtils'
```

**4b.** After the `layoutKey` computed (around line 135), add the `filteredVertices` and `filteredEdges` computeds:

```typescript
  // Filtered vertices — applies active filters from topologyViewStore.
  // When no filters are active, returns the same array reference as vertices (identity)
  // so watchers are not triggered spuriously.
  const filteredVertices = computed<TopologyVertex[]>(() => {
    const viewStore = useTopologyViewStore()
    const f = viewStore.filters
    const hasCategory = f.surveillanceCategories.length > 0
    const hasCidr = f.cidrs.length > 0
    const hasName = f.namePattern.length > 0

    if (!hasCategory && !hasCidr && !hasName) return vertices.value

    // _categoryNodeIdSet lives in topologyStore (this store), not viewStore
    const categorySet = _categoryNodeIdSet.value  // populated async by fetchCategoryNodeIds()

    return vertices.value.filter(v => {
      if (hasCategory) {
        if (!v.nodeID || !categorySet.has(v.nodeID)) return false
      }
      if (hasCidr) {
        if (!v.ipAddress || !f.cidrs.some(cidr => ipInCidr(v.ipAddress!, cidr))) return false
      }
      if (hasName) {
        if (f.namePattern.startsWith('/')) {
          try {
            const rx = new RegExp(f.namePattern.slice(1), 'i')
            if (!rx.test(v.label)) return false
          } catch { return false }
        } else {
          if (!v.label.toLowerCase().includes(f.namePattern.toLowerCase())) return false
        }
      }
      return true
    })
  })

  // Filtered edges — an edge is shown only if both endpoints are in filteredVertices.
  // Returns same array reference as edges when no filters are active (identity guarantee
  // prevents spurious watcher triggers in useTopology.ts).
  const filteredEdges = computed(() => {
    const viewStore = useTopologyViewStore()
    const f = viewStore.filters
    const hasFilter = f.surveillanceCategories.length > 0 || f.cidrs.length > 0 || f.namePattern.length > 0
    if (!hasFilter) return edges.value

    // filteredVertices vertex IDs are strings; TopologyEdge source/target IDs are numbers
    // String(e.source.id) ensures consistent comparison
    const visibleIds = new Set(filteredVertices.value.map(v => v.id))
    return edges.value.filter(e =>
      visibleIds.has(String(e.source.id)) && visibleIds.has(String(e.target.id))
    )
  })
```

**4c.** Add `setActiveLayers()` action after `setAllLayers`:

```typescript
  /**
   * Load a set of layer namespaces from a saved view.
   * Ensures containers are loaded first, resolves namespace strings to TopologyLayer
   * objects, loads any missing layers from the cache, then updates activeLayers.
   * Any namespace not found in availableLayers is dropped with a console.warn.
   */
  const setActiveLayers = async (namespaces: string[]) => {
    if (availableLayers.value.length === 0) {
      await loadContainers()
    }
    const resolved = namespaces
      .map(ns => availableLayers.value.find(l => l.namespace === ns))
      .filter((l): l is TopologyLayer => {
        if (!l) console.warn(`[topology] setActiveLayers: namespace not found in availableLayers, skipping`)
        return !!l
      })
    if (resolved.length === 0) { selectedElement.value = null; return }
    loading.value = true
    const toLoad = resolved.filter(l => !layerCache.value[l.namespace])
    await Promise.allSettled(toLoad.map(async (l) => {
      try { await ensureLayerLoaded(l) }
      catch (e) { console.warn(`[topology] setActiveLayers: failed to load layer ${l.namespace}`, e) }
    }))
    activeLayers.value = resolved.filter(l => !!layerCache.value[l.namespace]).map(l => l.namespace)
    loading.value = false
    selectedElement.value = null
  }
```

**4d.** Add `_categoryNodeIdSet` ref to the store (used by `filteredVertices`):

```typescript
  // Populated async by the filter panel when surveillanceCategories filter is active.
  // Stores string node IDs (String(node.id) from API response).
  const _categoryNodeIdSet = ref<Set<string>>(new Set())
```

**4e.** Update the return object to expose the new additions:
```typescript
    filteredVertices,
    filteredEdges,
    setActiveLayers,
    _categoryNodeIdSet,
```

- [ ] **Step 5: Run the filteredVertices tests**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn vitest run tests/stores/topologyStore.filteredVertices.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn test 2>&1 | tail -20
```
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add ui/src/stores/topologyStore.ts ui/src/components/Topology/cidrUtils.ts \
  ui/tests/stores/topologyStore.filteredVertices.test.ts \
  ui/tests/components/Topology/cidrUtils.test.ts
git commit -m "feat(topology): add filteredVertices/filteredEdges, setActiveLayers, cidr utils"
```

---

### Task 5: Delete `edgeLabelStore` and migrate its consumers

Now that `topologyViewStore` owns edge label state, delete the old store and update every file that imported from it.

**Files:**
- Delete: `ui/src/stores/edgeLabelStore.ts`
- Delete: `ui/tests/stores/edgeLabelStore.test.ts`
- Modify: `ui/src/composables/useTopology.ts` (replace `useEdgeLabelStore` with `useTopologyViewStore`)
- Modify: `ui/src/components/Topology/TopologyToolbar.vue` (replace `useEdgeLabelStore` with `useTopologyViewStore`)

- [ ] **Step 1: Find all consumers of edgeLabelStore**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms && grep -r "edgeLabelStore\|useEdgeLabelStore" ui/src --include="*.ts" --include="*.vue" -l
```
Note every file listed.

- [ ] **Step 2: Update useTopology.ts**

In `ui/src/composables/useTopology.ts`:

Replace:
```typescript
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
```
With:
```typescript
import { useTopologyViewStore } from '@/stores/topologyViewStore'
```

Replace:
```typescript
  const elStore = useEdgeLabelStore()
```
With:
```typescript
  const viewStore = useTopologyViewStore()
```

Replace all `elStore.` references with `viewStore.edgeLabels.`:
- `elStore.showUtilization` → `viewStore.edgeLabels.showUtilization`
- `elStore.showLocalPort` → `viewStore.edgeLabels.showLocalPort`
- `elStore.showRemotePort` → `viewStore.edgeLabels.showRemotePort`
- `elStore.showIp` → `viewStore.edgeLabels.showIp`
- `elStore.showMac` → `viewStore.edgeLabels.showMac`
- `elStore.showSpeed` → `viewStore.edgeLabels.showSpeed`

Update the edge label watcher (currently watching `elStore.*`):
```typescript
  watch(() => [
    viewStore.edgeLabels.showUtilization,
    viewStore.edgeLabels.showLocalPort,
    viewStore.edgeLabels.showRemotePort,
    viewStore.edgeLabels.showIp,
    viewStore.edgeLabels.showMac,
    viewStore.edgeLabels.showSpeed,
  ], applyEdgeLabels)
```

Update the vertices/edges watcher to use filteredVertices/filteredEdges:
```typescript
  watch(() => [store.filteredVertices, store.filteredEdges], syncElements, { deep: true })
```

**Update the `syncElements` function body** to read from `filteredVertices`/`filteredEdges` instead of `vertices`/`edges`. In `useTopology.ts`, find the `syncElements` function. Replace every read of `store.vertices` with `store.filteredVertices` and every read of `store.edges` with `store.filteredEdges` inside that function.

Update the `onMounted` call:
```typescript
  onMounted(() => {
    initCytoscape()
    if (store.filteredVertices.length > 0) syncElements()
    // ...
  })
```

Update `store.vertices.find(...)` reference in the focusTarget watcher to `store.filteredVertices.find(...)`.

- [ ] **Step 3: Update TopologyToolbar.vue**

In `ui/src/components/Topology/TopologyToolbar.vue`, replace any `useEdgeLabelStore` import and usage with `useTopologyViewStore`, accessing edge labels via `viewStore.edgeLabels.*`.

- [ ] **Step 4: Delete the old store and test**

```bash
git rm ui/src/stores/edgeLabelStore.ts
git rm ui/tests/stores/edgeLabelStore.test.ts
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn test 2>&1 | tail -20
```
Expected: no failures (edgeLabelStore tests deleted, new viewStore tests pass).

- [ ] **Step 7: Commit**

```bash
git add -A ui/src/stores/ ui/src/composables/useTopology.ts ui/src/components/Topology/TopologyToolbar.vue
git commit -m "refactor(topology): delete edgeLabelStore, migrate consumers to topologyViewStore"
```

---

## Chunk 3: useTopology Migrations — Layout Persistence + Edge Endpoint Labels + Grid Snap

### Task 6: Migrate layout persistence from `useTopology.ts` to `topologyViewStore`

The two private helper functions `localStorageKey` and `savedPositions` are removed from `useTopology.ts`. `saveLayout` and `resetLayout` keep their names but get new bodies delegating to `viewStore`. Both must remain in the function's `return` statement — do not remove them from the return value.

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

- [ ] **Step 1: Remove old layout functions and replace with viewStore calls**

In `ui/src/composables/useTopology.ts`, remove the functions `localStorageKey`, `savedPositions`, `saveLayout`, and `resetLayout`.

Replace `savedPositions()` call in `runLayout`:
```typescript
const saved = viewStore.loadNodePositions(store.layoutKey)
```

Replace `saveLayout()` implementation (now just a call):
```typescript
  const saveLayout = () => {
    if (!cy) return
    const positions: Record<string, { x: number; y: number }> = {}
    cy.nodes().forEach(n => { positions[n.id()] = { ...n.position() } })
    viewStore.saveNodePositions(store.layoutKey, positions)
    viewStore.markDirty()
  }
```

Replace `resetLayout()`:
```typescript
  const resetLayout = () => {
    viewStore.clearNodePositions(store.layoutKey)
    runLayout(true)
  }
```

The `dragfree` event handler (which calls `saveLayout`) remains unchanged.

- [ ] **Step 2: Build and spot-check**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn test 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/composables/useTopology.ts
git commit -m "refactor(topology): delegate layout persistence to topologyViewStore"
```

---

### Task 7: Add edge endpoint labels (source-label, target-label)

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

Edge labels are currently all centered. This splits them: source side gets local interface + local IP; target side gets remote interface + remote IP; center keeps protocol + utilization.

- [ ] **Step 1: Add source/target label stylesheet entries**

In `buildStylesheet()`, find the edge selector block (around the `'width': 2` line). Add a new entry for endpoint labels:

```javascript
    {
      selector: 'edge.has-endpoint-labels',
      css: {
        'source-label': 'data(sourceLabel)',
        'target-label': 'data(targetLabel)',
        'source-text-offset': 40,
        'target-text-offset': 40,
        'source-text-margin-y': -8,
        'target-text-margin-y': -8,
        'font-size': 9,
        'text-background-color': labelBg || '#0d1117',
        'text-background-opacity': 0.75,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle',
        'color': '#ffffff',
      }
    },
```

- [ ] **Step 2: Add `composeEndpointLabels()` and update `applyEdgeLabels()`**

After the existing `composeEdgeLabel()` function, add:

```typescript
  /**
   * Compute source-side and target-side labels for a single edge.
   * sourceLabel: local interface + local IP (shown near source node)
   * targetLabel: remote interface + remote IP (shown near target node)
   * Returns { sourceLabel: '', targetLabel: '' } when no endpoint data is visible.
   */
  const composeEndpointLabels = (key: string): { sourceLabel: string; targetLabel: string } => {
    const d = wmStore.edgeLabelData[key]
    if (!d) return { sourceLabel: '', targetLabel: '' }

    const el = viewStore.edgeLabels
    const sourceParts: string[] = []
    const targetParts: string[] = []

    if (el.showLocalPort && d.localIfName)  sourceParts.push(d.localIfName)
    if (el.showIp && d.localIp)             sourceParts.push(d.localIp)
    if (el.showRemotePort && d.remotePortId) targetParts.push(d.remotePortId)
    if (el.showIp && d.remoteIp)            targetParts.push(d.remoteIp)

    return {
      sourceLabel: sourceParts.join('\n'),
      targetLabel: targetParts.join('\n')
    }
  }
```

Update `composeEdgeLabel()` to skip ports and IPs (they now live in endpoint labels):

In `composeEdgeLabel`, remove the "Port" and "IP addresses" blocks (the `elStore.showLocalPort || elStore.showRemotePort` block and the `elStore.showIp` block). Leave utilization, MAC, speed, and protocol list.

Update `applyEdgeLabels()` to also stamp endpoint labels:

```typescript
  const applyEdgeLabels = () => {
    if (!cy) return
    cy.batch(() => {
      cy!.edges().forEach(edge => {
        const key = edge.data('edgeKey') as string
        const protocols = (edge.data('protocols') as string[]) ?? []
        const label = composeEdgeLabel(key, protocols)
        const { sourceLabel, targetLabel } = composeEndpointLabels(key)

        if (label) {
          edge.data('wmLabel', label)
          edge.addClass('weathermap')
        } else {
          edge.data('wmLabel', '')
          edge.removeClass('weathermap')
        }

        if (sourceLabel || targetLabel) {
          edge.data('sourceLabel', sourceLabel)
          edge.data('targetLabel', targetLabel)
          edge.addClass('has-endpoint-labels')
        } else {
          edge.data('sourceLabel', '')
          edge.data('targetLabel', '')
          edge.removeClass('has-endpoint-labels')
        }
      })
    })
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/composables/useTopology.ts
git commit -m "feat(topology): add source/target endpoint labels for interface and IP data"
```

---

### Task 8: Add grid snap to drag handler

**Files:**
- Modify: `ui/src/composables/useTopology.ts`
- Modify: `ui/src/components/Topology/TopologyGraph.vue` (add grid CSS class + inline style binding)

- [ ] **Step 1: Update the dragfree handler to snap positions**

In `useTopology.ts`, find the `dragfree` event handler inside `initCytoscape`. It currently calls `saveLayout()` after a node is dragged. Update it to snap the moved node's position before saving:

```typescript
    cy.on('dragfree', 'node', (evt) => {
      const node = evt.target
      const pos = node.position()
      const snapped = {
        x: viewStore.snapToGrid(pos.x),
        y: viewStore.snapToGrid(pos.y)
      }
      if (snapped.x !== pos.x || snapped.y !== pos.y) {
        node.position(snapped)
      }
      saveLayout()
    })
```

- [ ] **Step 2: Add align-to-grid action**

In `useTopology.ts`, add an `alignToGrid()` function after `resetLayout`:

```typescript
  /** Snap all current node positions to the grid, save, and re-render. */
  const alignToGrid = () => {
    if (!cy || !viewStore.gridSnap.enabled) return
    cy.batch(() => {
      cy!.nodes().forEach(n => {
        n.position({
          x: viewStore.snapToGrid(n.position().x),
          y: viewStore.snapToGrid(n.position().y)
        })
      })
    })
    saveLayout()
  }
```

Expose it in the return value:
```typescript
  return { getCy: () => cy, saveLayout, resetLayout, alignToGrid, pendingLinkSource, pendingLinkTarget, edgeTooltip }
```

- [ ] **Step 3: Add grid visual to TopologyGraph.vue**

Find the Cytoscape container `div` in `ui/src/components/Topology/TopologyGraph.vue`. It has `ref="graphContainer"` and class `topology-graph__canvas`. Add the class binding and style binding to that div:

```html
<div
  ref="graphContainer"
  class="topology-graph__canvas"
  :class="{ 'grid-snap-active': viewStore.gridSnap.enabled }"
  :style="viewStore.gridSnap.enabled
    ? { backgroundSize: `${viewStore.gridSnap.size}px ${viewStore.gridSnap.size}px` }
    : {}"
/>
```

Import `useTopologyViewStore` in the component script:
```typescript
import { useTopologyViewStore } from '@/stores/topologyViewStore'
const viewStore = useTopologyViewStore()
```

Add the CSS at the bottom of `TopologyGraph.vue` (or in its scoped style block):

```css
.grid-snap-active {
  background-image:
    linear-gradient(to right, var(--feather-shade-3, rgba(255,255,255,0.08)) 1px, transparent 1px),
    linear-gradient(to bottom, var(--feather-shade-3, rgba(255,255,255,0.08)) 1px, transparent 1px);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn test 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/composables/useTopology.ts ui/src/components/Topology/TopologyGraph.vue
git commit -m "feat(topology): add grid snap on drag, align-to-grid action, visual grid overlay"
```

---

## Chunk 4: Backend — topology_views REST API

This chunk is **parallel-safe** with Chunk 5 (frontend views UI). The frontend can be built against a stub/mock until the backend lands.

### Task 9: Add Liquibase migration for `topology_views` table

**Files:**
- Identify the correct Liquibase changelog location by running:

```bash
find /Users/chance.newkirk/git/cnewkirk-fork/opennms/core/schema -name "changelog*.xml" | head -10
```

The changeset must be **added inside the existing `<databaseChangeLog>` element** in the correct changelog file — do not create a standalone file. Look for the most recent changeset in the master changelog to determine where to append. Typical path: `core/schema/src/main/liquibase/`.

- [ ] **Step 1: Add the changeset inside the existing `<databaseChangeLog>` element**

```xml
<changeSet id="topology-views-1" author="cnewkirk">
    <createTable tableName="topology_views">
        <column name="id" type="varchar(64)">
            <constraints primaryKey="true" nullable="false"/>
        </column>
        <column name="name" type="varchar(255)">
            <constraints nullable="false"/>
        </column>
        <column name="description" type="varchar(1024)"/>
        <column name="scope" type="varchar(16)">
            <constraints nullable="false"/>
        </column>
        <column name="owner" type="varchar(255)">
            <constraints nullable="false"/>
        </column>
        <column name="state_json" type="text">
            <constraints nullable="false"/>
        </column>
        <column name="created_at" type="datetime">
            <constraints nullable="false"/>
        </column>
        <column name="updated_at" type="datetime">
            <constraints nullable="false"/>
        </column>
    </createTable>
    <createIndex tableName="topology_views" indexName="idx_topology_views_scope">
        <column name="scope"/>
    </createIndex>
    <createIndex tableName="topology_views" indexName="idx_topology_views_owner">
        <column name="owner"/>
    </createIndex>
</changeSet>
```

- [ ] **Step 2: Commit**

```bash
git add <path-to-liquibase-file>
git commit -m "feat(topology): add topology_views Liquibase migration"
```

---

### Task 10: Create `TopologyView` JPA entity and DAO

**Module:** Identify the correct module by checking where similar REST entities live (look for existing enlinkd or topology Java files):

```bash
find /Users/chance.newkirk/git/cnewkirk-fork/opennms/features -name "*.java" -path "*topology*" | grep -v test | head -10
```

- [ ] **Step 1: Create `TopologyView.java` entity**

Place in the appropriate `model` package. Example path: `features/topology-map/persistence/src/main/java/org/opennms/netmgt/topology/persistence/api/TopologyView.java`

**Important:** Before writing this file, verify which persistence namespace existing topology/enlinkd entities use:
```bash
grep -r "^import javax.persistence\|^import jakarta.persistence" \
  /Users/chance.newkirk/git/cnewkirk-fork/opennms/features --include="*.java" | head -5
```
Use whichever namespace matches (OpenNMS 35.x with Spring 5 uses `javax.persistence.*`; Spring Boot 3+ uses `jakarta.persistence.*`).

```java
package org.opennms.netmgt.topology.persistence.api;

import javax.persistence.*;  // or jakarta.persistence.* — match existing entities in this module
import java.util.Date;

@Entity
@Table(name = "topology_views")
public class TopologyView {
    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "name", length = 255, nullable = false)
    private String name;

    @Column(name = "description", length = 1024)
    private String description;

    /** One of: 'global', 'shared', 'private' */
    @Column(name = "scope", length = 16, nullable = false)
    private String scope;

    /** Username, or 'system' for global default (never resolved as a user record). */
    @Column(name = "owner", length = 255, nullable = false)
    private String owner;

    @Column(name = "state_json", nullable = false, columnDefinition = "text")
    private String stateJson;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at", nullable = false)
    private Date updatedAt;

    // Getters and setters (generate with IDE or write manually)
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getStateJson() { return stateJson; }
    public void setStateJson(String stateJson) { this.stateJson = stateJson; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Create `TopologyViewDao` interface and `TopologyViewDaoHibernate` implementation**

Follow the pattern of existing DAOs in the project (e.g. look at a simple one like `UserDefinedLinkDao`):

```bash
find /Users/chance.newkirk/git/cnewkirk-fork/opennms -name "*Dao.java" | grep -i "topology\|enlinkd" | head -5
```

The DAO interface needs: `findById`, `findByScope`, `findByOwner`, `save`, `delete`.

**`owner: 'system'` sentinel:** The global default view uses `owner = 'system'`. The DAO and REST service must **never** attempt to resolve `'system'` as an OpenNMS user record. Add a comment to `TopologyViewDaoHibernate` and the REST service: `// 'system' is a reserved owner sentinel for global default views — do not resolve as user`.

- [ ] **Step 3: Create `TopologyViewsRestService.java`**

Place in the web module that handles v2 REST endpoints. Follow the pattern of existing v2 REST services (check `features/rest/` or similar):

```bash
find /Users/chance.newkirk/git/cnewkirk-fork/opennms -name "*RestService.java" -path "*v2*" | head -5
```

The service must:
- `GET /api/v2/topology/views` — return all shared + global views (no auth filter needed for read)
- `GET /api/v2/topology/views?scope=global` — return the global default (404 if not set)
- `POST /api/v2/topology/views` — create a view (shared or global; global requires ROLE_ADMIN)
- `PUT /api/v2/topology/views/{id}` — update (owner or ROLE_ADMIN only)
- `DELETE /api/v2/topology/views/{id}` — delete (owner or ROLE_ADMIN only)

Global default write requires `SecurityContextHolder` check for `ROLE_ADMIN`.

- [ ] **Step 4: Wire DAO into Spring context**

Add the DAO bean to the appropriate Spring XML config file alongside existing DAO beans.

- [ ] **Step 5: Build the affected module**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms && ./compile.pl -DskipTests --projects :<module-name> -am install 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add <all-backend-files>
git commit -m "feat(topology): add topology_views entity, DAO, and REST service"
```

---

## Chunk 5: Frontend Features — Filter Panel, Views Panel, Toolbar Additions

### Task 11: Add category node-ID fetching to `topologyViewStore` / `topologyStore`

When the surveillance category filter is activated, node IDs must be fetched and cached.

**Files:**
- Modify: `ui/src/stores/topologyStore.ts` (add `fetchCategoryNodeIds` action)

- [ ] **Step 1: Add `fetchCategoryNodeIds()` to `topologyStore.ts`**

The `_categoryNodeIdSet` ref lives in `topologyStore`, so the action that populates it belongs there too.

In `topologyStore.ts`, add the `v2` import if not already present:
```typescript
import { v2 } from '@/services/http'
```

Then add this action:

```typescript
  /**
   * Fetch node IDs for selected surveillance categories and populate _categoryNodeIdSet.
   * Called by the filter panel whenever surveillanceCategories filter changes.
   * Stores IDs as strings (String(node.id)) for type-safe comparison with TopologyVertex.nodeID.
   */
  const fetchCategoryNodeIds = async (categories: string[]) => {
    if (categories.length === 0) {
      _categoryNodeIdSet.value = new Set()
      return
    }
    const idSets = await Promise.all(
      categories.map(async cat => {
        try {
          const resp = await v2.get(`/nodes?_s=categories.name==${encodeURIComponent(cat)}&limit=1000`)
          // API returns id as string (Node type: id: string); String() coercion is safe but explicit
          const nodes: Array<{ id: string }> = resp.data?.node ?? []
          return nodes.map(n => String(n.id))
        } catch {
          console.warn(`[topology] Failed to fetch nodes for category: ${cat}`)
          return []
        }
      })
    )
    _categoryNodeIdSet.value = new Set(idSets.flat())
  }
```

Expose it: add `fetchCategoryNodeIds` to the return object.

- [ ] **Step 2: Add v2 axios instance import if not present**

Check if `v2` is already imported in `topologyStore.ts`. If not, find where it's imported in other service files:

```bash
grep -r "import.*v2.*from" /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui/src/services/ | head -5
```

Use the same import pattern.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/stores/topologyStore.ts
git commit -m "feat(topology): add fetchCategoryNodeIds action to topologyStore"
```

---

### Task 12: Add Filter Panel to `TopologyToolbar.vue`

**Files:**
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`

The filter panel is a collapsible section in the toolbar. It shows a badge count of active filters.

- [ ] **Step 1: Add filter panel template**

In `TopologyToolbar.vue`, after the existing layers panel section, add:

```html
<!-- Filter Panel -->
<div class="topology-toolbar__filters" ref="filterPanelRef">
  <button
    type="button"
    class="topology-toolbar__chip"
    :class="{ active: filterPanelOpen, 'has-filters': activeFilterCount > 0 }"
    @click="filterPanelOpen = !filterPanelOpen"
  >
    Filter
    <span v-if="activeFilterCount > 0" class="topology-toolbar__filter-badge">{{ activeFilterCount }}</span>
  </button>
  <div v-if="filterPanelOpen" class="topology-toolbar__filter-panel">
    <!-- Surveillance categories -->
    <div class="topology-toolbar__filter-section">
      <div class="topology-toolbar__filter-label">Category</div>
      <div class="topology-toolbar__category-chips">
        <label
          v-for="cat in availableCategories"
          :key="cat"
          class="topology-toolbar__category-chip"
          :class="{ active: viewStore.filters.surveillanceCategories.includes(cat) }"
        >
          <input
            type="checkbox"
            :checked="viewStore.filters.surveillanceCategories.includes(cat)"
            @change="toggleCategory(cat)"
          >
          {{ cat }}
        </label>
      </div>
    </div>

    <!-- CIDR filter -->
    <div class="topology-toolbar__filter-section">
      <div class="topology-toolbar__filter-label">CIDR</div>
      <div class="topology-toolbar__cidr-list">
        <span
          v-for="cidr in viewStore.filters.cidrs"
          :key="cidr"
          class="topology-toolbar__cidr-chip"
        >
          {{ cidr }}
          <button type="button" @click="removeCidr(cidr)">×</button>
        </span>
      </div>
      <div class="topology-toolbar__cidr-input">
        <input
          v-model="cidrInput"
          type="text"
          placeholder="e.g. 10.0.0.0/8"
          :class="{ invalid: cidrInput && !isCidrValid }"
          @keydown.enter.prevent="addCidr"
        >
        <button type="button" :disabled="!isCidrValid" @click="addCidr">Add</button>
      </div>
    </div>

    <!-- Name pattern -->
    <div class="topology-toolbar__filter-section">
      <div class="topology-toolbar__filter-label">Name</div>
      <input
        v-model="viewStore.filters.namePattern"
        type="text"
        class="topology-toolbar__name-filter"
        placeholder="Search nodes... (prefix / for regex)"
        @input="viewStore.markDirty()"
      >
    </div>

    <!-- Actions -->
    <div class="topology-toolbar__filter-actions">
      <button type="button" class="topology-toolbar__link" @click="clearAllFilters">Clear all</button>
      <button type="button" class="topology-toolbar__link" @click="saveFilterDefaults">Save as my defaults</button>
      <button type="button" class="topology-toolbar__link" @click="clearFilterDefaults">Clear my defaults</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add filter panel script logic**

In the component's `<script setup>`:

```typescript
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { useTopologyStore } from '@/stores/topologyStore'
import { isValidCidr } from '@/components/Topology/cidrUtils'
import { ref, computed, onMounted } from 'vue'

const viewStore = useTopologyViewStore()
const store = useTopologyStore()

// Filter panel state
const filterPanelOpen = ref(false)
const cidrInput = ref('')
const availableCategories = ref<string[]>([])
const isCidrValid = computed(() => isValidCidr(cidrInput.value))

const activeFilterCount = computed(() =>
  viewStore.filters.surveillanceCategories.length +
  viewStore.filters.cidrs.length +
  (viewStore.filters.namePattern ? 1 : 0)
)

const toggleCategory = async (cat: string) => {
  const cats = viewStore.filters.surveillanceCategories
  if (cats.includes(cat)) {
    viewStore.filters.surveillanceCategories = cats.filter(c => c !== cat)
  } else {
    viewStore.filters.surveillanceCategories = [...cats, cat]
  }
  // Re-fetch category node IDs whenever selection changes
  await store.fetchCategoryNodeIds(viewStore.filters.surveillanceCategories)
  viewStore.markDirty()
}

const addCidr = () => {
  if (!isCidrValid.value || viewStore.filters.cidrs.includes(cidrInput.value)) return
  viewStore.filters.cidrs = [...viewStore.filters.cidrs, cidrInput.value]
  cidrInput.value = ''
  viewStore.markDirty()
}

const removeCidr = (cidr: string) => {
  viewStore.filters.cidrs = viewStore.filters.cidrs.filter(c => c !== cidr)
  viewStore.markDirty()
}

const clearAllFilters = () => {
  viewStore.filters.surveillanceCategories = []
  viewStore.filters.cidrs = []
  viewStore.filters.namePattern = ''
  // Use the action — don't mutate the ref directly
  store.fetchCategoryNodeIds([])
  viewStore.markDirty()
}

const saveFilterDefaults = () => viewStore.saveFilterDefaults()
const clearFilterDefaults = () => viewStore.clearFilterDefaults()

// Load categories from backend on mount
onMounted(async () => {
  try {
    // Use the existing getCategories() helper from categoryService — do not call axios directly
    const result = await getCategories()
    if (result) availableCategories.value = result.category.map(c => c.name).sort()
  } catch {
    console.warn('[topology] Failed to load surveillance categories')
  }
})
```

Add to imports at top of file:
```typescript
import { getCategories } from '@/services/categoryService'
```

- [ ] **Step 3: Apply personal filter defaults on topology load**

In `ui/src/containers/Topology.vue` (the page container), in the `onMounted` or initialization code, after `store.loadContainers()`:

```typescript
const viewStore = useTopologyViewStore()
const filterDefaults = viewStore.loadFilterDefaults()
if (filterDefaults) {
  Object.assign(viewStore.filters, filterDefaults)
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Topology/TopologyToolbar.vue ui/src/containers/Topology.vue
git commit -m "feat(topology): add filter panel with category, CIDR, and name filters"
```

---

### Task 13: Add Views Panel to `TopologyToolbar.vue`

**Files:**
- Create: `ui/src/services/topologyViewService.ts`
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`

- [ ] **Step 1: Create `topologyViewService.ts`**

Create `ui/src/services/topologyViewService.ts`:

```typescript
import { v2 } from '@/services/http'
import { TopologyView } from '@/types/topology'

export const getSharedViews = async (): Promise<TopologyView[]> => {
  const resp = await v2.get<{ view: TopologyView[] }>('/topology/views')
  return resp.data?.view ?? []
}

export const getGlobalView = async (): Promise<TopologyView | null> => {
  try {
    const resp = await v2.get<TopologyView>('/topology/views?scope=global')
    return resp.data ?? null
  } catch (e: unknown) {
    if ((e as { response?: { status: number } })?.response?.status === 404) return null
    throw e
  }
}

export const createView = async (view: Omit<TopologyView, 'id' | 'createdAt' | 'updatedAt'>): Promise<TopologyView> => {
  const resp = await v2.post<TopologyView>('/topology/views', view)
  return resp.data
}

export const updateView = async (view: TopologyView): Promise<TopologyView> => {
  const resp = await v2.put<TopologyView>(`/topology/views/${view.id}`, view)
  return resp.data
}

export const deleteView = async (id: string): Promise<void> => {
  await v2.delete(`/topology/views/${id}`)
}
```

- [ ] **Step 2: Add views panel to TopologyToolbar.vue**

Add a "Views" dropdown button to the toolbar template after the filter panel:

```html
<!-- Views Panel -->
<div class="topology-toolbar__views" ref="viewsPanelRef">
  <button
    type="button"
    class="topology-toolbar__chip"
    :class="{ active: viewsPanelOpen }"
    @click="viewsPanelOpen = !viewsPanelOpen"
  >Views</button>

  <div v-if="viewsPanelOpen" class="topology-toolbar__views-panel">
    <!-- Save current -->
    <button type="button" class="topology-toolbar__views-action" @click="startSaveView">
      + Save current view…
    </button>
    <hr class="topology-toolbar__layer-divider">

    <!-- Global default -->
    <div v-if="globalView" class="topology-toolbar__views-section-label">Global Default</div>
    <div v-if="globalView" class="topology-toolbar__views-item" @click="loadView(globalView!)">
      {{ globalView.name }}
    </div>

    <!-- Shared views -->
    <div v-if="sharedViews.length > 0" class="topology-toolbar__views-section-label">Shared Views</div>
    <div
      v-for="view in sharedViews"
      :key="view.id"
      class="topology-toolbar__views-item"
      @click="loadView(view)"
    >
      {{ view.name }}
      <button v-if="canDelete(view)" type="button" class="topology-toolbar__views-delete" @click.stop="deleteViewById(view.id)">×</button>
    </div>

    <!-- Private views -->
    <div v-if="privateViews.length > 0" class="topology-toolbar__views-section-label">My Views</div>
    <div
      v-for="view in privateViews"
      :key="view.id"
      class="topology-toolbar__views-item"
      @click="loadView(view)"
    >
      {{ view.name }}
      <button type="button" class="topology-toolbar__views-delete" @click.stop="deletePrivateView(view.id)">×</button>
    </div>
  </div>
</div>

<!-- Save View Modal -->
<div v-if="saveViewOpen" class="topology-toolbar__modal-overlay" @click.self="saveViewOpen = false">
  <div class="topology-toolbar__modal">
    <h3>Save View</h3>
    <label>Name<input v-model="newViewName" type="text" placeholder="My view name"></label>
    <label>Description<input v-model="newViewDescription" type="text"></label>
    <label>
      Scope
      <select v-model="newViewScope">
        <option value="private">Private (this browser only)</option>
        <option value="shared">Shared (all users)</option>
        <option v-if="authStore.whoAmI?.roles?.includes('ROLE_ADMIN')" value="global">Global Default</option>
      </select>
    </label>
    <div class="topology-toolbar__modal-actions">
      <button type="button" @click="saveViewOpen = false">Cancel</button>
      <button type="button" :disabled="!newViewName" @click="confirmSaveView">Save</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add views panel script logic**

```typescript
import { getSharedViews, getGlobalView, createView, deleteView as deleteRemoteView } from '@/services/topologyViewService'
import { useAuthStore } from '@/stores/authStore'
import { TopologyView } from '@/types/topology'
// Use crypto.randomUUID() — natively available in all modern browsers, no extra dependency needed

const authStore = useAuthStore()
const viewsPanelOpen = ref(false)
const saveViewOpen = ref(false)
const newViewName = ref('')
const newViewDescription = ref('')
const newViewScope = ref<'private' | 'shared' | 'global'>('private')
const globalView = ref<TopologyView | null>(null)
const sharedViews = ref<TopologyView[]>([])
// Use ref<TopologyView[]> (not computed) — loadPrivateViews() reads localStorage which
// has no reactive dependency, so a computed would never re-evaluate after save/delete.
const privateViews = ref<TopologyView[]>([])
const refreshPrivateViews = () => { privateViews.value = viewStore.loadPrivateViews() }

const canDelete = (view: TopologyView) =>
  view.owner === authStore.whoAmI?.id || (authStore.whoAmI?.roles ?? []).includes('ROLE_ADMIN')

// Load global + shared views and private views on mount
onMounted(async () => {
  refreshPrivateViews()
  try {
    const [gv, sv] = await Promise.all([getGlobalView(), getSharedViews()])
    globalView.value = gv
    sharedViews.value = sv.filter(v => v.scope === 'shared')
  } catch {
    console.warn('[topology] Failed to load shared/global views')
  }
})

const startSaveView = () => {
  newViewName.value = ''
  newViewDescription.value = ''
  newViewScope.value = 'private'
  saveViewOpen.value = true
}

const confirmSaveView = async () => {
  if (!newViewName.value) return
  // Toolbar emits 'save-view-requested' — Topology.vue handles capture and completes the save.
  // We cannot use emit() as a mutation call (Vue events are one-way).
  // Instead, emit an event that Topology.vue catches synchronously.
  emit('save-view-requested', { name: newViewName.value, description: newViewDescription.value, scope: newViewScope.value })
  saveViewOpen.value = false
}

// Not async — just emits an event. Topology.vue handles the actual state restore.
const loadView = (view: TopologyView) => {
  if (viewStore.isDirty) {
    if (!window.confirm('You have unsaved changes. Load this view anyway?')) return
  }
  emit('restore-view', view)
  viewsPanelOpen.value = false
}

const deleteViewById = async (id: string) => {
  await deleteRemoteView(id)
  sharedViews.value = sharedViews.value.filter(v => v.id !== id)
  if (globalView.value?.id === id) globalView.value = null
}

const deletePrivateView = (id: string) => {
  viewStore.deletePrivateView(id)
  refreshPrivateViews()
}
```

- [ ] **Step 4: Wire save/restore through `Topology.vue`**

`TopologyToolbar` and `TopologyGraph` are siblings — both children of `Topology.vue`. Vue events are one-way, so the toolbar cannot use an emit to capture positions from a sibling. The correct pattern: `Topology.vue` handles the full save-view flow.

**4a.** In `TopologyGraph.vue`, add `getCy` and `alignToGrid` to the existing destructuring of `useTopology()`. It currently looks like:
```typescript
const { saveLayout, resetLayout, ... } = useTopology(graphContainer)
```
Update it to also destructure `getCy` and `alignToGrid`:
```typescript
const { saveLayout, resetLayout, getCy, alignToGrid, ... } = useTopology(graphContainer)
```

Then add `capturePositions` and `restorePositions` helper functions:
```typescript
const capturePositions = (): Record<string, { x: number; y: number }> => {
  const cy = getCy()
  if (!cy) return {}
  const positions: Record<string, { x: number; y: number }> = {}
  cy.nodes().forEach(n => { positions[n.id()] = { ...n.position() } })
  return positions
}

const restorePositions = (positions: Record<string, { x: number; y: number }>) => {
  const cy = getCy()
  if (!cy) return
  cy.batch(() => {
    cy!.nodes().forEach(n => {
      const p = positions[n.id()]
      if (p) n.position(p)
    })
  })
  viewStore.saveNodePositions(store.layoutKey, positions)
}

// Replace the existing defineExpose (which exposes saveLayout, resetLayout) with this expanded version:
defineExpose({ capturePositions, restorePositions, alignToGrid, saveLayout, resetLayout })
```

**4b.** In `TopologyToolbar.vue`, define the emit:
```typescript
const emit = defineEmits<{
  'save-view-requested': [{ name: string; description: string; scope: 'private' | 'shared' | 'global' }]
  'restore-view': [TopologyView]
  'toggle-grid': []
  'align-to-grid': []
  'save-layout': []
  'reset-layout': []
}>()
```

**4c.** In `ui/src/containers/Topology.vue`, add handlers for the new toolbar events:
```typescript
const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)

const handleSaveViewRequested = async (opts: { name: string; description: string; scope: 'private' | 'shared' | 'global' }) => {
  const positions = graphRef.value?.capturePositions() ?? {}
  const state = viewStore.captureCurrentState(store.activeLayers, positions)
  const now = new Date().toISOString()
  const view: TopologyView = {
    id: crypto.randomUUID(),
    name: opts.name,
    description: opts.description || undefined,
    scope: opts.scope,
    owner: authStore.whoAmI?.id ?? 'unknown',
    state,
    createdAt: now,
    updatedAt: now
  }
  if (view.scope === 'private') {
    viewStore.savePrivateView(view)
  } else {
    await createView(view)
  }
  viewStore.clearDirty()
}

const handleRestoreView = async (view: TopologyView) => {
  viewStore.applyViewState(view.state)
  await store.setActiveLayers(view.state.activeLayers)
  graphRef.value?.restorePositions(view.state.nodePositions)
}
```

In the template, wire the toolbar events:
```html
<TopologyToolbar
  @save-view-requested="handleSaveViewRequested"
  @restore-view="handleRestoreView"
  @toggle-grid="viewStore.toggleGridSnap()"
  @align-to-grid="graphRef?.alignToGrid()"
  @save-layout="graphRef?.saveLayout()"
  @reset-layout="graphRef?.resetLayout()"
/>
<TopologyGraph ref="graphRef" ... />
```

In `TopologyToolbar.vue`, the `loadView` function is already defined correctly in Step 3 above. No additional changes needed here.

- [ ] **Step 5: Add grid toggle + align-to-grid buttons to TopologyToolbar.vue**

In the layout actions section, add:

```html
<FeatherButton text @click="emit('toggle-grid')" :title="viewStore.gridSnap.enabled ? 'Disable grid snap' : 'Enable grid snap'">
  {{ viewStore.gridSnap.enabled ? '⊞ Grid On' : '⊡ Grid Off' }}
</FeatherButton>
<FeatherButton text :disabled="!viewStore.gridSnap.enabled" @click="emit('align-to-grid')" title="Snap all nodes to grid">
  Align to Grid
</FeatherButton>
```

Handle in `TopologyGraph.vue` / `Topology.vue`:
- `toggle-grid` → `viewStore.toggleGridSnap()`
- `align-to-grid` → `topology.alignToGrid()`

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn test 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add ui/src/services/topologyViewService.ts ui/src/components/Topology/TopologyToolbar.vue ui/src/components/Topology/TopologyGraph.vue
git commit -m "feat(topology): add views panel with save/load/delete for private, shared, global views"
```

---

### Task 14: Update `TopologyEdgeTooltip.vue` to use `humanize()`

**Files:**
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue`

- [ ] **Step 1: Add `humanize()` import and use it for field labels**

In `TopologyEdgeTooltip.vue`, add:
```typescript
import { humanize } from '@/components/Topology/fieldLabels'
```

Replace any hardcoded field label strings like `"Local Interface"`, `"Remote Port"`, `"Local IP"`, `"Remote IP"`, `"MAC"`, `"Speed"` with `humanize('localIfName')`, `humanize('remotePortId')`, etc.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): use humanize() for edge tooltip field labels"
```

---

### Task 15: Page load — apply global default view and personal filter defaults

**Files:**
- Modify: `ui/src/containers/Topology.vue`

- [ ] **Step 1: Add view initialization to page load**

In `Topology.vue`, update the initialization sequence. The existing code likely calls `store.loadContainers()` on mount. After containers load, add:

```typescript
import { getGlobalView } from '@/services/topologyViewService'

// In onMounted or init function, after store.loadContainers():

// Apply views in parallel — don't block graph render
const viewStore = useTopologyViewStore()
Promise.all([
  getGlobalView().catch(() => null),           // 404 or network error → null (no global default)
  Promise.resolve(viewStore.loadFilterDefaults())
]).then(async ([globalView, filterDefaults]) => {
  if (globalView) {
    viewStore.applyViewState(globalView.state)

    // Apply activeLayers from the global view if they differ from the defaults set by loadContainers.
    // setActiveLayers handles loadContainers if needed and gracefully drops unknown layers.
    const currentLayers = [...store.activeLayers].sort().join('+')
    const viewLayers = [...globalView.state.activeLayers].sort().join('+')
    if (currentLayers !== viewLayers) {
      await store.setActiveLayers(globalView.state.activeLayers)
    }

    // Only restore positions from global view if user has no local saved positions for this layer set
    if (store.layoutKey && !viewStore.loadNodePositions(store.layoutKey)) {
      graphRef.value?.restorePositions(globalView.state.nodePositions)
    }
  }
  if (filterDefaults) {
    Object.assign(viewStore.filters, filterDefaults)
  }
  viewStore.clearDirty()
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chance.newkirk/git/cnewkirk-fork/opennms/ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Full build and deploy**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```
Verify `ui/src/main/dist/index.html` has `src="/opennms/ui/assets/index-*.js"`.

```bash
./ui/deploy-to-container.sh test-opennms
```

Verify bundle hash matches:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

- [ ] **Step 4: Final commit**

```bash
git add ui/src/containers/Topology.vue
git commit -m "feat(topology): apply global view and personal filter defaults on page load"
```

---

## Final Verification

- [ ] All Vitest tests pass: `cd ui && ./target/node/yarn/dist/bin/yarn test`
- [ ] TypeScript compiles: `cd ui && ./target/node/yarn/dist/bin/yarn tsc --noEmit`
- [ ] Bundle deployed and verified live in container
- [ ] Manual smoke test checklist:
  - [ ] Filter panel opens, categories load, CIDR input validates, name filter works
  - [ ] Grid snap enables/disables, visual grid appears, drag snaps to grid
  - [ ] Align-to-grid button aligns all nodes
  - [ ] Edge endpoint labels (local interface, IP) appear near source/target nodes
  - [ ] Views panel: private view save/load/delete works
  - [ ] Edge tooltip field labels use friendly names (e.g. "Local Interface" not "localIfName")
  - [ ] Layout positions survive page refresh (localStorage still works after migration)
  - [ ] Existing edge label toggles (utilization, MAC, speed) still work
