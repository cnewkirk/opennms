<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <InputText
        placeholder="Search/Filter Resources"
        :modelValue="searchValue"
        @update:modelValue="search"
        class="search-input"
      />
      <ul class="resource-list">
        <li class="resource-list-header">Resources</li>
        <li
          v-for="resource in resources"
          :key="resource.label"
          class="resource-list-item"
          @click="selectResource(resource.name)"
        >{{ resource.label }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { useGraphStore } from '@/stores/graphStore'
import { useResourceStore } from '@/stores/resourceStore'
import { Resource, UpdateModelFunction } from '@/types'

const graphStore = useGraphStore()
const resourceStore = useResourceStore()
const searchValue = ref('')

const resources = computed<Resource[]>(() => resourceStore.getFilteredResourcesList())

const search: UpdateModelFunction = (val: string) => resourceStore.setSearchValue(val || '')

const selectResource = (name: string) => {
  resourceStore.getResourcesForNode(name)
  graphStore.getPreFabGraphs(name)
}
</script>

<style scoped lang="scss">
@import "@/styles/tokens";

.search-input {
  width: 100%;
  margin-bottom: 8px;
}

.resource-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
}

.resource-list-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var($secondary-text-on-surface);
  border-bottom: 1px solid var($border-on-surface);
}

.resource-list-item {
  padding: 10px 12px;
  cursor: pointer;
  color: var($primary-text-on-surface);

  &:hover {
    background: var($surface-dark);
  }

  & + & {
    border-top: 1px solid var($border-on-surface);
  }
}
</style>
