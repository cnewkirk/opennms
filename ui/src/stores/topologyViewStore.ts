import { defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import type { IconMapping, TopologyView } from '@/types/topology'

const LS_KEY_FILTERS  = 'topology:filter:defaults'
const LS_KEY_PRIVATE  = 'topology:views:private'

function loadPrivateViews(): TopologyView[] {
  try {
    const raw = localStorage.getItem(LS_KEY_PRIVATE)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePrivateViews(views: TopologyView[]) {
  try { localStorage.setItem(LS_KEY_PRIVATE, JSON.stringify(views)) } catch { /* ignore */ }
}

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
  const gridSnap = reactive({
    enabled: false,
    size: 40,
  })

  // Filters
  const savedDefaults = loadFilterDefaults()
  const filters = reactive({
    surveillanceCategories: (savedDefaults?.surveillanceCategories ?? []) as string[],
    cidrs: (savedDefaults?.cidrs ?? []) as string[],
    namePattern: (savedDefaults?.namePattern ?? '') as string,
  })

  // Icon mappings (persisted in localStorage)
  const categoryIconMap = ref<IconMapping[]>([])
  const oidIconMap      = ref<IconMapping[]>([])
  const lagPrefixPatterns = ref<string[]>(['Po', 'ae', 'bond', 'Bundle-Ether', 'LAG'])

  // Per-user private views (localStorage)
  const privateViews = ref<TopologyView[]>(loadPrivateViews())
  watch(privateViews, (v) => savePrivateViews(v), { deep: true })

  // Dirty flag — set when filters/settings change but no view has been saved
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

  const addPrivateView = (view: TopologyView) => {
    privateViews.value = [...privateViews.value, view]
  }

  const deletePrivateView = (id: string) => {
    privateViews.value = privateViews.value.filter(v => v.id !== id)
  }

  return {
    gridSnap,
    filters,
    categoryIconMap,
    oidIconMap,
    lagPrefixPatterns,
    privateViews,
    isDirty,
    markDirty,
    clearDirty,
    saveFilterDefaults,
    clearFilterDefaults,
    addPrivateView,
    deletePrivateView,
  }
})
