import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { IconMapping, TopologyView, TopologyViewState } from '@/types/topology'
import { getViews, createView, updateView, deleteView as deleteViewApi } from '@/services/topologyViewService'

const LS_KEY_FILTERS = 'topology:filter:defaults'

function loadFilterDefaults() {
  try {
    const raw = localStorage.getItem(LS_KEY_FILTERS)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useTopologyViewStore = defineStore('topologyView', () => {
  // Grid snap
  const gridSnap = reactive({ enabled: false, size: 40 })

  // Filters
  const savedDefaults = loadFilterDefaults()
  const filters = reactive({
    surveillanceCategories: (savedDefaults?.surveillanceCategories ?? []) as string[],
    cidrs: (savedDefaults?.cidrs ?? []) as string[],
    namePattern: (savedDefaults?.namePattern ?? '') as string,
  })

  // Icon mappings
  const categoryIconMap = ref<IconMapping[]>([])
  const oidIconMap      = ref<IconMapping[]>([])
  const lagPrefixPatterns = ref<string[]>(['Po', 'ae', 'bond', 'Bundle-Ether', 'LAG'])

  // Dirty flag
  const isDirty = ref(false)
  const markDirty = () => { isDirty.value = true }
  const clearDirty = () => { isDirty.value = false }

  const saveFilterDefaults = () => {
    try {
      localStorage.setItem(LS_KEY_FILTERS, JSON.stringify({
        surveillanceCategories: filters.surveillanceCategories,
        cidrs: filters.cidrs,
        namePattern: filters.namePattern,
      }))
    } catch { /* ignore */ }
  }

  const clearFilterDefaults = () => {
    try { localStorage.removeItem(LS_KEY_FILTERS) } catch { /* ignore */ }
    filters.surveillanceCategories = []
    filters.cidrs = []
    filters.namePattern = ''
    markDirty()
  }

  // Server-side views
  const serverViews  = ref<TopologyView[]>([])
  const activeView   = ref<TopologyView | null>(null)
  const viewsLoading = ref(false)
  const viewsError   = ref<string | null>(null)

  // Layout from the loaded view — useTopology.ts reads this to apply positions
  const viewLayout = ref<Record<string, { x: number; y: number }>>({})

  // Suppression: what's currently hidden from the loaded view
  const suppressedVertices = ref<string[]>([])
  const suppressedEdges    = ref<string[]>([])

  // Edit mode working copies (pending changes not yet saved)
  const editMode            = ref(false)
  const editPendingVertices = ref<string[]>([])
  const editPendingEdges    = ref<string[]>([])

  const fetchServerViews = async () => {
    viewsLoading.value = true
    viewsError.value   = null
    try {
      serverViews.value = await getViews()
    } catch {
      viewsError.value = 'Failed to load views from server'
    } finally {
      viewsLoading.value = false
    }
  }

  /**
   * Apply a loaded view's state to the store.
   * Caller is responsible for applying layers/filters/edgeLabels to the
   * relevant stores (topologyStore, edgeLabelStore) after calling this.
   */
  const applyView = (view: TopologyView) => {
    activeView.value          = view
    viewLayout.value          = { ...view.state.layout }
    suppressedVertices.value  = [...view.state.suppressed.vertices]
    suppressedEdges.value     = [...view.state.suppressed.edges]
    editMode.value            = false
    editPendingVertices.value = []
    editPendingEdges.value    = []
    clearDirty()
  }

  const saveView = async (state: TopologyViewState) => {
    if (!activeView.value) return
    const updated: TopologyView = { ...activeView.value, state }
    const result = await updateView(activeView.value.id, updated)
    activeView.value          = result
    viewLayout.value          = { ...state.layout }
    suppressedVertices.value  = [...state.suppressed.vertices]
    suppressedEdges.value     = [...state.suppressed.edges]
    editMode.value            = false
    editPendingVertices.value = []
    editPendingEdges.value    = []
    clearDirty()
    await fetchServerViews()
  }

  const saveNewView = async (
    name: string,
    scope: 'private' | 'shared' | 'global',
    state: TopologyViewState,
    description?: string
  ): Promise<TopologyView> => {
    const result = await createView({ name, scope, description, state })
    activeView.value          = result
    viewLayout.value          = { ...state.layout }
    suppressedVertices.value  = [...state.suppressed.vertices]
    suppressedEdges.value     = [...state.suppressed.edges]
    clearDirty()
    await fetchServerViews()
    return result
  }

  const deleteServerView = async (id: string) => {
    await deleteViewApi(id)
    if (activeView.value?.id === id) {
      activeView.value         = null
      viewLayout.value         = {}
      suppressedVertices.value = []
      suppressedEdges.value    = []
    }
    await fetchServerViews()
  }

  const enterEditMode = () => {
    if (!activeView.value) return
    editMode.value            = true
    editPendingVertices.value = [...suppressedVertices.value]
    editPendingEdges.value    = [...suppressedEdges.value]
  }

  const discardEditMode = () => {
    editMode.value            = false
    editPendingVertices.value = []
    editPendingEdges.value    = []
  }

  const toggleSuppression = (id: string, type: 'vertex' | 'edge') => {
    if (!editMode.value) return
    const list = type === 'vertex' ? editPendingVertices : editPendingEdges
    const idx = list.value.indexOf(id)
    if (idx >= 0) list.value.splice(idx, 1)
    else list.value.push(id)
  }

  return {
    gridSnap, filters, categoryIconMap, oidIconMap, lagPrefixPatterns,
    isDirty, markDirty, clearDirty, saveFilterDefaults, clearFilterDefaults,
    serverViews, activeView, viewsLoading, viewsError, viewLayout,
    suppressedVertices, suppressedEdges,
    editMode, editPendingVertices, editPendingEdges,
    fetchServerViews, applyView, saveView, saveNewView, deleteServerView,
    enterEditMode, discardEditMode, toggleSuppression,
  }
})
