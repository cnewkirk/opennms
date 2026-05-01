<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <div v-if="resources.length" class="action-buttons">
        <Button @click="selectAll">Select All</Button>
        <Button @click="clearAll">Clear All</Button>
        <Button @click="graphAll">Graph All</Button>
        <Button @click="graphSelected" :disabled="!resourceIsSelected">Graph Selected</Button>
      </div>
      <ul class="resource-list">
        <template v-for="(resources, header) in groupedResourcesObject" :key="header">
          <li class="resource-list-header">{{ header }}</li>
          <li v-for="resource in resources" :key="resource.label" class="resource-list-item">
            <label class="checkbox-label">
              <Checkbox
                :modelValue="selectedResourceObject[resource.id]"
                binary
                @change="selectCheckbox(resource.id)"
              />
              {{ resource.label }}
            </label>
          </li>
          <li class="resource-list-separator" />
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { groupBy } from 'lodash'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { useGraphStore } from '@/stores/graphStore'
import { useResourceStore } from '@/stores/resourceStore'
import { Resource } from '@/types'

interface GroupedResourcesObject {
  [x: string]: Resource[]
}

const graphStore = useGraphStore()
const resourceStore = useResourceStore()
const router = useRouter()

const selectedResourceObject = ref<any>({})

const resources = computed<Resource[]>(() => resourceStore.nodeResource.children?.resource || [])
const groupedResourcesObject = computed<GroupedResourcesObject>(() => groupBy(resources.value, 'typeLabel'))
const resourceIsSelected = computed<boolean>(() => Object.values(selectedResourceObject.value).includes(true))

const selectCheckbox = (resourceId: string) => selectedResourceObject.value[resourceId] = !selectedResourceObject.value[resourceId]

const selectAll = () => {
  for (const resource of resources.value) {
    selectedResourceObject.value[resource.id] = true
  }
}

const clearAll = () => selectedResourceObject.value = {}

const graphSelected = async () => {
  const selectedIds = []

  for (const key in selectedResourceObject.value) {
    if (selectedResourceObject.value[key]) {
      selectedIds.push(key)
    }
  }

  await graphStore.getGraphDefinitionsByResourceIds(selectedIds, resources.value)
  router.push('/resource-graphs/graphs')
}

const graphAll = async () => {
  const resourceIds = resources.value.map(resource => resource.id)
  graphStore.getGraphDefinitionsByResourceIds(resourceIds, resources.value)
  router.push('/resource-graphs/graphs')
}
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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
  padding: 6px 12px;
  color: var($primary-text-on-surface);

  &:hover {
    background: var($surface-dark);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
}

.resource-list-separator {
  height: 1px;
  background: var($border-on-surface);
}
</style>
