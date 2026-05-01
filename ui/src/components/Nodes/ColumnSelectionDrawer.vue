<template>
  <Drawer
    v-model:visible="nodeStructureStore.columnsDrawerState.visible"
    header="Customize Columns"
    position="right"
    style="width: 55em"
    id="column-selection-drawer"
    data-test="column-selection-drawer"
  >
    <div class="drawer-content">
      <section>
        <h3>Customize the available columns</h3>
        <p>Select which columns you wish to showcase</p>
      </section>
      <div class="spacer-large"></div>
      <Draggable
        v-model="selectedColumns"
        item-key="value"
        handle=".drag-handle"
        class="columns-drag-container"
      >
        <template #item="{ index }">
          <div class="column-row">
            <Button text severity="secondary" class="drag-handle drag-btn" aria-label="Drag to reorder">
              <i class="pi pi-bars" />
            </Button>
            <Select
              v-model="selectedColumns[index]"
              :options="getAvailableOptions(index)"
              optionLabel="name"
              :placeholder="'Select column...'"
              class="columns-selector"
            />
            <Button text severity="secondary" @click="removeColumn(index)" aria-label="Remove column">
              <i class="pi pi-times" />
            </Button>
          </div>
        </template>
      </Draggable>
      <div class="spacer-medium"></div>
      <div class="button-column">
        <Button
          severity="secondary"
          outlined
          :disabled="selectedColumns.length >= 10"
          @click="addColumn"
        >
          Add Column
        </Button>
        <Button
          severity="secondary"
          outlined
          @click="resetColumns"
        >
          Reset Columns
        </Button>
        <Button
          @click="customizeTable"
        >
          Customize Table
        </Button>
      </div>
    </div>
  </Drawer>
</template>

<script lang="ts" setup>
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Draggable from 'vuedraggable'
import { saveNodePreferences } from '@/services/localStorageService'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'
import { NodeColumnSelectionItem } from '@/types'
import { defaultColumns } from './utils'

interface ColumnOption {
  name: string
  value: string
}

const nodeStructureStore = useNodeStructureStore()
const columns = ref<NodeColumnSelectionItem[]>(defaultColumns)
const selectedColumns = ref<ColumnOption[]>([])

const initializeSelectedColumns = (cols: NodeColumnSelectionItem[]) => {
  selectedColumns.value = cols
    .filter(col => col.selected)
    .sort((a, b) => a.order - b.order)
    .map(col => ({ name: col.label, value: col.id }))
}

const getAvailableOptions = (currentIndex: number): ColumnOption[] => {
  const currentSelection = selectedColumns.value[currentIndex]?.value

  return columns.value
    .filter(col =>
      !selectedColumns.value.some((sc, i) => i !== currentIndex && sc.value === col.id) ||
      col.id === currentSelection
    )
    .map(col => ({ name: col.label, value: col.id }))
}

const addColumn = () => {
  if (selectedColumns.value.length < 10) {
    selectedColumns.value = [
      ...selectedColumns.value,
      { name: '', value: '' }
    ]
  }
}

const removeColumn = (index: number) => {
  selectedColumns.value = selectedColumns.value.filter((_, i) => i !== index)
}

const customizeTable = async() => {
  nodeStructureStore.columns = selectedColumns.value.map((col, index) => ({
    id: col.value as string,
    label: col.name as string,
    selected: true,
    order: index
  }))

  const nodePrefs = await nodeStructureStore.getNodePreferences()
  saveNodePreferences(nodePrefs)
  nodeStructureStore.columnsDrawerState.visible = false
}

const resetColumns = async () => {
  nodeStructureStore.columns = [...defaultColumns]
  const nodePrefs = await nodeStructureStore.getNodePreferences()
  saveNodePreferences(nodePrefs)
  nodeStructureStore.columnsDrawerState.visible = false
}

watch(() => nodeStructureStore.columns, (newColumns) => {
  initializeSelectedColumns(newColumns)
}, { immediate: true, deep: true })
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/table" as *;
@import "@/styles/elevation";
@import "@/styles/typography";
@import "@/styles/tokens";

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

.column-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 80%;
  margin-bottom: 1rem;
  border: 1px solid var($border-on-surface);
  padding: 4px 8px;
  border-radius: vars.$border-radius-surface;
}

.drag-btn {
  cursor: grab;
  padding: 0.25rem;
}

.columns-selector {
  flex: 1;
}

.button-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}
</style>
