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

  // Reactive ref so toolbar updates instantly after save/delete
  const privateViews = ref<TopologyView[]>(loadJson<TopologyView[]>(PRIVATE_VIEWS_KEY, []))

  const loadPrivateViews = (): TopologyView[] => privateViews.value

  const savePrivateView = (view: TopologyView) => {
    const updated = privateViews.value.filter(v => v.id !== view.id)
    updated.push(view)
    privateViews.value = updated
    localStorage.setItem(PRIVATE_VIEWS_KEY, JSON.stringify(updated))
  }

  const deletePrivateView = (id: string) => {
    const updated = privateViews.value.filter(v => v.id !== id)
    privateViews.value = updated
    localStorage.setItem(PRIVATE_VIEWS_KEY, JSON.stringify(updated))
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
    privateViews,
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
