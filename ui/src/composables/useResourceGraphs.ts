// ui/src/composables/useResourceGraphs.ts
import { ref } from 'vue'
import { getResourceForNode } from '@/services/resourceService'
import { getGraphDefinitionsByResourceId } from '@/services/graphService'
import type { Resource } from '@/types'
import type { SavedChart, ResourceGroup } from '@/types/resourceGraphs'

const storageKey = (nodeId: string) => `resource-charts:${nodeId}`

const useResourceGraphs = (nodeId: string) => {
  const resources = ref<Resource[]>([])
  const resourceGroups = ref<ResourceGroup[]>([])
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
        return { resource: r, definitions: resp.name ?? [] }
      })
    )

    // Group by typeLabel
    const groupMap = new Map<string, ResourceGroup>()
    for (const { resource: r, definitions } of defResults) {
      if (!definitions.length) continue
      const existing = groupMap.get(r.typeLabel)
      const entry = { resourceId: r.id, label: r.label, definitions }
      if (existing) {
        existing.resources.push(entry)
      } else {
        groupMap.set(r.typeLabel, { typeLabel: r.typeLabel, resources: [entry] })
      }
    }
    resourceGroups.value = Array.from(groupMap.values())

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

  return { resources, resourceGroups, savedCharts, loading, error, saveChart, deleteChart, refresh: fetch }
}

export default useResourceGraphs
