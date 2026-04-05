// ui/src/composables/useResourceGraphs.ts
import { ref } from 'vue'
import { getResourceForNode } from '@/services/resourceService'
import { getGraphDefinitionsByResourceId } from '@/services/graphService'
import type { Resource } from '@/types'
import type { SavedChart, HighlightItem } from '@/types/resourceGraphs'

const storageKey = (nodeId: string) => `resource-charts:${nodeId}`

const useResourceGraphs = (nodeId: string) => {
  const resources = ref<Resource[]>([])
  const highlights = ref<HighlightItem[]>([])
  const savedCharts = ref<SavedChart[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  // Load saved charts synchronously on init
  try {
    const raw = localStorage.getItem(storageKey(nodeId))
    savedCharts.value = raw ? JSON.parse(raw) : []
  } catch {
    savedCharts.value = []
  }

  const persistSaved = () => {
    localStorage.setItem(storageKey(nodeId), JSON.stringify(savedCharts.value))
  }

  const fetch = async () => {
    loading.value = true
    error.value = null

    const topResource = await getResourceForNode(nodeId)
    if (!topResource) {
      error.value = 'Could not load resources for this node'
      loading.value = false
      return
    }

    const children = topResource.children?.resource ?? []
    resources.value = children

    const defResults = await Promise.all(
      children.map(async (r) => {
        const resp = await getGraphDefinitionsByResourceId(r.id)
        return { resourceId: r.id, label: r.label, definitions: resp.name ?? [] }
      })
    )

    highlights.value = defResults.flatMap(r =>
      r.definitions.map(def => ({
        resourceId: r.resourceId,
        definition: def,
        label: r.label
      }))
    )

    loading.value = false
  }

  const saveChart = (chart: SavedChart) => {
    savedCharts.value = [...savedCharts.value, chart]
    persistSaved()
  }

  const deleteChart = (id: string) => {
    savedCharts.value = savedCharts.value.filter(c => c.id !== id)
    persistSaved()
  }

  fetch()

  return { resources, highlights, savedCharts, loading, error, saveChart, deleteChart, refresh: fetch }
}

export default useResourceGraphs
