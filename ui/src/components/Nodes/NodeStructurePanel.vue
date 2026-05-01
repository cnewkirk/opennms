<template>
  <h1 class="title">Filtering</h1>
  <div class="button-panel">
    <Button class="category-btn" @click="onClearAll" :disabled="!isAnyFilterSelected">Clear All</Button>
  </div>

  <Accordion :value="openPanels" multiple>
    <AccordionPanel value="categories">
      <AccordionHeader>
        <span v-if="selectedCategoryCount">{{ `Categories (${selectedCategoryCount})` }}</span>
        <span v-else>Categories</span>
        <Button
          v-if="selectedCategoryCount"
          text
          severity="secondary"
          size="small"
          @click.stop="onClearCategories"
          aria-label="Clear categories"
          class="clear-btn"
        >
          <i class="pi pi-times" />
        </Button>
      </AccordionHeader>
      <AccordionContent>
        <div class="category-button-group">
          <div class="category-switcher-container">
            <span>Match All </span>
            <ToggleSwitch v-model="categorySwitchModel" @update:modelValue="onCategorySwitchChange" />
          </div>
        </div>
        <ul class="category-list">
          <li
            v-for="cat of nodeStructureStore.categories"
            :key="cat.name"
            :class="['category-item', { 'category-item--selected': isCategorySelected(cat) }]"
            @click="onCategoryClick(cat)"
          >
            {{ cat.name }}
          </li>
        </ul>
      </AccordionContent>
    </AccordionPanel>

    <AccordionPanel value="flows">
      <AccordionHeader>
        <span v-if="selectedFlowCount">{{ `Flows (${selectedFlowCount})` }}</span>
        <span v-else>Flows</span>
        <Button
          v-if="selectedFlowCount"
          text
          severity="secondary"
          size="small"
          @click.stop="onClearFlows"
          aria-label="Clear flows"
          class="clear-btn"
        >
          <i class="pi pi-times" />
        </Button>
      </AccordionHeader>
      <AccordionContent>
        <ul class="category-list">
          <li
            v-for="flow of flowTypes"
            :key="flow"
            :class="['category-item', { 'category-item--selected': isFlowSelected(flow) }]"
            @click="onFlowClick(flow)"
          >
            {{ flow }}
          </li>
        </ul>
      </AccordionContent>
    </AccordionPanel>

    <AccordionPanel value="locations">
      <AccordionHeader>
        <span v-if="selectedLocationCount">{{ `Locations (${selectedLocationCount})` }}</span>
        <span v-else>Locations</span>
        <Button
          v-if="selectedLocationCount"
          text
          severity="secondary"
          size="small"
          @click.stop="onClearLocations"
          aria-label="Clear locations"
          class="clear-btn"
        >
          <i class="pi pi-times" />
        </Button>
      </AccordionHeader>
      <AccordionContent>
        <ul class="category-list">
          <li
            v-for="loc of locations"
            :key="loc.name"
            :class="['category-item', { 'category-item--selected': isLocationSelected(loc) }]"
            @click="onLocationClick(loc)"
          >
            {{ loc.name }}
          </li>
        </ul>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>

  <div class="search-autocomplete-panel">
    <h1 class="title">Extended Search</h1>
    <ExtendedSearchPanel />
  </div>
</template>

<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'
import { Category, MonitoringLocation, SetOperator } from '@/types'
import ExtendedSearchPanel from './ExtendedSearchPanel.vue'

const nodeStructureStore = useNodeStructureStore()
const openPanels = ref(['categories', 'flows', 'locations'])
const flowTypes = computed<string[]>(() => ['Ingress', 'Egress'])
const categoryMode = computed(() => nodeStructureStore.queryFilter.categoryMode)
const categorySwitchModel = computed({
  get: () => nodeStructureStore.queryFilter.categoryMode === SetOperator.Intersection,
  set: (_val: boolean) => {} // handled by onCategorySwitchChange
})

const locations = computed<MonitoringLocation[]>(() => nodeStructureStore.monitoringLocations)
const selectedCategoryCount = computed<number>(() => nodeStructureStore.queryFilter.selectedCategories?.length || 0)
const selectedFlowCount = computed<number>(() => nodeStructureStore.queryFilter.selectedFlows?.length || 0)
const selectedLocationCount = computed<number>(() => nodeStructureStore.queryFilter.selectedMonitoringLocations?.length || 0)
const isAnyFilterSelected = computed<boolean>(() => nodeStructureStore.isAnyFilterSelected())

const isCategorySelected = (cat: Category) => {
  return nodeStructureStore.queryFilter.selectedCategories.some(c => c.id === cat.id)
}

const isFlowSelected = (flow: string) => {
  return nodeStructureStore.queryFilter.selectedFlows.some(f => f === flow)
}

const isLocationSelected = (loc: MonitoringLocation) => {
  return nodeStructureStore.queryFilter.selectedMonitoringLocations.some(x => x.name === loc.name)
}

const onCategorySwitchChange = (_val: boolean) => {
  const newMode = categoryMode.value === SetOperator.Union ? SetOperator.Intersection : SetOperator.Union
  nodeStructureStore.setCategoryMode(newMode)
}

const onClearCategories = () => {
  // nodeStructureStore.setSelectedCategories([])
}

const onClearFlows = () => {
  // nodeStructureStore.setSelectedFlows([])
}

const onClearLocations = () => {
  nodeStructureStore.updateSelectedMonitoringLocations([])
}

const onClearAll = () => {
  nodeStructureStore.clearAllFiltersAndSelections()
}

/**
* Create a new array of selected items in a hierarchy filter by taking existing items and adding/removing the selected item.
*/
const getNewSelection = <T,>(item: T, isSelected: boolean, existingItems: T[], deselector: ((existingItem: T, clickedItem: T) => boolean)) => {
  if (isSelected) {
    return existingItems.filter(c => deselector(c, item))
  } else {
    return [...existingItems, item]
  }
}

const onCategoryClick = (cat: Category) => {
  const newSelection = getNewSelection(cat, isCategorySelected(cat), nodeStructureStore.queryFilter.selectedCategories, c => c.id !== cat.id)
  // nodeStructureStore.setSelectedCategories(newSelection)
}

const onFlowClick = (flow: string) => {
  const newSelection = getNewSelection(flow, isFlowSelected(flow), nodeStructureStore.queryFilter.selectedFlows, f => f !== flow)
  // nodeStructureStore.setSelectedFlows(newSelection)
}

const onLocationClick = (loc: MonitoringLocation) => {
  const newSelection = getNewSelection(loc, isLocationSelected(loc), nodeStructureStore.queryFilter.selectedMonitoringLocations, x => x.name !== loc.name)
  nodeStructureStore.updateSelectedMonitoringLocations(newSelection)
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@featherds/styles/mixins/elevation";
@import "@/styles/typography";

.button-panel {
  margin-bottom: 6px;
}

.category-btn {
  margin-bottom: 4px;
  margin-right: 4px;
}

.clear-btn {
  margin-left: auto;
}

.category-button-group {
  margin-bottom: 0.5em;

  .category-switcher-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    line-height: 2.25rem;
  }
}

.category-list {
  @include elevation(2);
  background: var($surface);
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

.category-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background: var($shade-4);
  }

  &--selected {
    background: var($shade-3);
    font-weight: 500;
  }
}

.search-autocomplete-panel {
  margin-top: 1.5em;
}

.title {
  @include overline();
  color: var($primary);
  margin-bottom: 8px;
}
</style>
