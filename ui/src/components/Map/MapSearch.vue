<template>
  <AutoComplete
    v-model="searchStr"
    :suggestions="results"
    option-label="label"
    multiple
    placeholder="Search"
    class="map-search"
    @complete="(e) => resetLabelsAndSearch(e.query)"
    :loading="loading"
    @update:modelValue="selectItem"
    :delay="0"
  />
</template>

<script
  setup
  lang="ts"
>
import { debounce } from 'lodash'
import AutoComplete from 'primevue/autocomplete'
import { useMapStore } from '@/stores/mapStore'
import { useSearchStore } from '@/stores/searchStore'

const emit = defineEmits(['fly-to-node', 'set-bounding-box'])

const mapStore = useMapStore()
const searchStore = useSearchStore()
const searchStr = ref()
const loading = ref(false)
const outsideSearch = ref(false)

const selectItem: any = (items: { label: string }[]) => {
  const nodeLabels = items.map((item) => item.label)
  mapStore.setSearchedNodeLabels(nodeLabels)

  if (nodeLabels.length) {
    if (nodeLabels.length === 1) {
      // fly to last selected node
      emit('fly-to-node', nodeLabels[0])
    } else {
      // set bounding box for all searched nodes
      emit('set-bounding-box', nodeLabels)
    }
  }
}

const resetLabelsAndSearch = (value: string) => {
  search(value)
}

const search = debounce(async (value: string) => {
  if (!value) {
    return
  }

  loading.value = true

  await searchStore.search(value)

  loading.value = false
}, 1000)

const results = computed(() => {
  if (searchStore.searchResults.length > 0 && searchStore.searchResults[0]) {
    return searchStore.searchResults[0].results
  }

  return []
})

// search term set by an outside component rather than from user text input, i.e. from MapNodesGrid
const nodeSearchTerm = computed<string>(() => mapStore.nodeSearchTerm)

// when results are updated as a result of a search initiated from an outside component,
// select the item (which may also perform the fly-to-node behavior)
const selectItemFromOutsideSearch = (searchResults: any) => {
  if (outsideSearch.value) {
    outsideSearch.value = false
    const label = searchResults?.[0].label

    if (label) {
      selectItem([{ label }])
    }
  }
}

// when an outside component modifies nodeSearchTerm, launch a search with this term,
// similar to 'search()' above
// search term may be a node label or else an expression (e.g. 'nodeid == 10')
// when results are received and outsideSearch is true, this will trigger watch(results)
watchEffect(async () => {
  if (nodeSearchTerm.value) {
    searchStr.value = [{ label: nodeSearchTerm.value }]

    loading.value = true
    outsideSearch.value = true
    await searchStore.search(nodeSearchTerm.value)
    loading.value = false
  }
})

watch(results, (newResults) => {
  selectItemFromOutsideSearch(newResults)
})
</script>

<style
  lang="scss"
  scoped
>
@import "@/styles/tokens";

.map-search {
  z-index: 1000;
  width: 290px !important;
}
</style>
