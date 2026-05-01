import { ref, computed, type Ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { ResourceGroup } from '@/types/resourceGraphs'

export interface SearchResultItem {
  typeLabel: string
  resourceId: string
  resourceLabel: string
  definition: string
}

export function searchResources(groups: ResourceGroup[], query: string): SearchResultItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResultItem[] = []

  for (const group of groups) {
    const typeMatch = group.typeLabel.toLowerCase().includes(q)
    for (const resource of group.resources) {
      const resourceMatch = resource.label.toLowerCase().includes(q)
      for (const definition of resource.definitions) {
        const defMatch = definition.toLowerCase().includes(q)
        if (typeMatch || resourceMatch || defMatch) {
          results.push({
            typeLabel: group.typeLabel,
            resourceId: resource.resourceId,
            resourceLabel: resource.label,
            definition
          })
          if (results.length >= 50) return results
        }
      }
    }
  }

  return results
}

export function useResourceSearch(groups: Ref<ResourceGroup[]>) {
  const query = ref('')
  const debouncedQuery = refDebounced(query, 200)
  const results = computed(() => searchResources(groups.value, debouncedQuery.value))
  const isSearching = computed(() => debouncedQuery.value.trim().length > 0)
  return { query, results, isSearching }
}
