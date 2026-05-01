<template>
  <Drawer
    v-model:visible="nodeStructureStore.drawerState.visible"
    @hide="nodeStructureStore.closeInstancesDrawerModal()"
    header="Advanced Node Filters"
    position="right"
    style="width: 60em"
  >
    <div class="drawer-content">
      <section>
        <h3>Advanced Filters</h3>
      </section>
      <div class="spacer-large"></div>
      <div class="spacer-large"></div>
      <div>Choose one or more attributes to find a service.</div>
      <div class="spacer-large"></div>

      <div class="field">
        <label class="field-label">Categories</label>
        <AutoComplete
          v-model="selectedFilters.categories"
          :suggestions="categoryResults"
          optionLabel="_text"
          multiple
          :loading="categoriesLoading"
          @complete="(e: AutoCompleteCompleteEvent) => handleCategorySearch(e.query)"
          @update:modelValue="(items: any) => updateFilter('categories', items)"
          class="autocomplete-full"
          placeholder="Search categories..."
        />
      </div>

      <div class="field">
        <label class="field-label">Flows</label>
        <AutoComplete
          v-model="selectedFilters.flows"
          :suggestions="flowResults"
          optionLabel="_text"
          multiple
          :loading="flowsLoading"
          @complete="(e: AutoCompleteCompleteEvent) => handleFlowSearch(e.query)"
          @update:modelValue="(items: any) => updateFilter('flows', items)"
          class="autocomplete-full"
          placeholder="Search flows..."
        />
      </div>

      <div class="field">
        <label class="field-label">Locations</label>
        <AutoComplete
          v-model="selectedFilters.locations"
          :suggestions="locationResults"
          optionLabel="_text"
          multiple
          :loading="locationsLoading"
          @complete="(e: AutoCompleteCompleteEvent) => handleLocationSearch(e.query)"
          @update:modelValue="(items: any) => updateFilter('locations', items)"
          class="autocomplete-full"
          placeholder="Search locations..."
        />
      </div>

      <div class="spacer-medium"></div>
      <div>
        <h4 class="title">Extended Search</h4>
        <div class="spacer-medium"></div>
        <ExtendedSearchPanel />
      </div>
      <div class="footer">
        <Button
          @click="applySelectedFilters"
        >
          Apply Filters
        </Button>
        <Button
          severity="secondary"
          outlined
          @click="nodeStructureStore.closeInstancesDrawerModal()"
        >
          Close
        </Button>
      </div>
    </div>
  </Drawer>
</template>

<script lang="ts" setup>
import AutoComplete from 'primevue/autocomplete'
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import { ref } from 'vue'
import ExtendedSearchPanel from './ExtendedSearchPanel.vue'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'
import { IAutocompleteItemType } from '@featherds/autocomplete'

const searchTimeout = ref<number>(-1)
const categoriesLoading = ref(false)
const categoryResults = ref([] as IAutocompleteItemType[])
const flowsLoading = ref(false)
const flowResults = ref<IAutocompleteItemType[]>([])
const locationsLoading = ref(false)
const locationResults = ref<IAutocompleteItemType[]>([])
const TIMEOUT = 5

const nodeStructureStore = useNodeStructureStore()
const selectedFilters = reactive({
  categories: [] as IAutocompleteItemType[],
  flows: [] as IAutocompleteItemType[],
  locations: [] as IAutocompleteItemType[]
})

const handleCategorySearch = (query: string) => {
  categoriesLoading.value = true
  clearTimeout(searchTimeout.value)

  searchTimeout.value = window.setTimeout(() => {
    const categoriesArray = Array.isArray(nodeStructureStore.categories)
      ? nodeStructureStore.categories
      : []

    const filteredCategories = categoriesArray
      .filter((category) =>
        category.name && category.name.toLowerCase().includes(query.toLowerCase())
      )
      .map((category) => ({
        _text: category.name,
        _value: category.id
      } as IAutocompleteItemType))
    categoryResults.value = filteredCategories
    categoriesLoading.value = false
  }, TIMEOUT)
}

const handleFlowSearch = (query: string) => {
  flowsLoading.value = true
  clearTimeout(searchTimeout.value)

  searchTimeout.value = window.setTimeout(() => {
    flowResults.value = [
      { _text: 'Egress', _value: 'lastEgressFlow' },
      { _text: 'Ingress', _value: 'lastIngressFlow' }
    ].filter(flow => flow._text.toLowerCase().includes(query.toLowerCase()))
    flowsLoading.value = false
  }, TIMEOUT)
}

const handleLocationSearch = (query: string) => {
  locationsLoading.value = true
  clearTimeout(searchTimeout.value)

  searchTimeout.value = window.setTimeout(() => {
    locationResults.value = nodeStructureStore.monitoringLocations
      .filter(location => location.name.toLowerCase().includes(query.toLowerCase()))
      .map(location => ({
        _text: location.name,
        _value: location.name,
        name: location.name
      }))

    locationsLoading.value = false
  }, TIMEOUT)
}

const updateFilter = (key: keyof typeof selectedFilters, items: IAutocompleteItemType[]) => {
  selectedFilters[key] = items
}

const applySelectedFilters = () => {
  nodeStructureStore.updateSelectedCategories(selectedFilters.categories)
  nodeStructureStore.updateSelectedFlows(selectedFilters.flows)

  nodeStructureStore.updateSelectedMonitoringLocations(selectedFilters.locations)
  nodeStructureStore.closeInstancesDrawerModal()
}

watch(() => nodeStructureStore.drawerState.visible, (visible) => {
  if (visible) {
    selectedFilters.categories = [...nodeStructureStore.selectedCategories]
    selectedFilters.flows = [...nodeStructureStore.selectedFlows]
    selectedFilters.locations = [...nodeStructureStore.selectedMonitoringLocations]
  }
})
</script>

<style lang="scss" scoped>
@import "@featherds/table/scss/table";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/themes/variables";

.drawer-content {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.spacer-large {
  margin-bottom: 2rem;
}

.spacer-medium {
  margin-bottom: 0.25rem;
}

.field {
  margin-bottom: 1.25rem;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: var($primary-text-on-surface);
}

.autocomplete-full {
  width: 100%;
}

.footer {
  display: flex;
  gap: 0.75rem;
  padding-top: 20px;
}
</style>
