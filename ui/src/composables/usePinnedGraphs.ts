// ui/src/composables/usePinnedGraphs.ts
import { ref, computed } from 'vue'
import type { PinIdentifier, ResourceGroup, HighlightItem } from '@/types/resourceGraphs'

const DEFAULTS_KEY = 'pinned-graphs:defaults'
const nodeKey = (nodeId: string) => `pinned-graphs:${nodeId}`

const readPins = (key: string): PinIdentifier[] => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writePins = (key: string, pins: PinIdentifier[]) => {
  localStorage.setItem(key, JSON.stringify(pins))
}

const usePinnedGraphs = (nodeId: string, resourceGroups: () => ResourceGroup[]) => {
  const nodePins = ref<PinIdentifier[]>(readPins(nodeKey(nodeId)))
  const defaultPins = ref<PinIdentifier[]>(readPins(DEFAULTS_KEY))
  const hasPerNodePins = computed(() => nodePins.value.length > 0)

  // Active pins: per-node if any exist, otherwise user defaults
  const activePins = computed<PinIdentifier[]>(() =>
    hasPerNodePins.value ? nodePins.value : defaultPins.value
  )

  // Resolve pin identifiers to full HighlightItems using current resource groups
  const pinnedItems = computed<HighlightItem[]>(() => {
    const groups = resourceGroups()
    const items: HighlightItem[] = []
    for (const pin of activePins.value) {
      for (const group of groups) {
        const resource = group.resources.find(r => r.resourceId === pin.resourceId)
        if (resource && resource.definitions.includes(pin.definition)) {
          items.push({ resourceId: pin.resourceId, definition: pin.definition, label: resource.label })
          break
        }
      }
    }
    return items
  })

  const isPinned = (resourceId: string, definition: string): boolean => {
    return activePins.value.some(p => p.resourceId === resourceId && p.definition === definition)
  }

  const togglePin = (item: HighlightItem) => {
    const existing = nodePins.value.findIndex(
      p => p.resourceId === item.resourceId && p.definition === item.definition
    )
    if (existing >= 0) {
      nodePins.value = nodePins.value.filter((_, i) => i !== existing)
    } else {
      nodePins.value = [...nodePins.value, { resourceId: item.resourceId, definition: item.definition }]
    }
    writePins(nodeKey(nodeId), nodePins.value)
  }

  const setAsDefault = () => {
    defaultPins.value = [...nodePins.value]
    writePins(DEFAULTS_KEY, defaultPins.value)
  }

  return { pinnedItems, isPinned, togglePin, setAsDefault, hasPerNodePins }
}

export default usePinnedGraphs
