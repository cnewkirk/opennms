<template>
  <div class="column-select-container">
    <div class="feather-row node-actions-reset">
      <div class="feather-col-9">
      </div>
      <div class="feather-col-3 centered">
        <Button severity="secondary" outlined size="small" @click="resetToDefault">Default</Button>
      </div>
    </div>
  </div>
  <div
    v-for="(col, index) in columns"
    :key="col.id"
  >
    <div class="feather-row column-select-item-wrapper">
      <div class="feather-col-9">
        <div class="col-checkbox-row">
          <Checkbox
            :modelValue="col.selected"
            :binary="true"
            :inputId="`col-${col.id}`"
            @update:modelValue="selectColumn(col)"
          />
          <label :for="`col-${col.id}`" class="col-checkbox-label">{{ col.label }}</label>
        </div>
      </div>
      <div class="feather-col-3 centered">
        <i
          class="pi pi-chevron-up column-order-icon"
          :class="getOrderIconCssClasses(true, index)"
          title="Move Up"
          @click="columnMove(true, index)"
        />
        <i
          class="pi pi-chevron-down column-order-icon column-order-icon-down"
          :class="getOrderIconCssClasses(false, index)"
          title="Move Down"
          @click="columnMove(false, index)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'
import { NodeColumnSelectionItem } from '@/types'

const nodeStructureStore = useNodeStructureStore()

const columns = computed<NodeColumnSelectionItem[]>(() => nodeStructureStore.columns)

const selectColumn = (col: NodeColumnSelectionItem) => {
  const newItem = {
    ...col,
    selected: !col.selected
  }

  nodeStructureStore.updateNodeColumnSelection(newItem)
}

const columnMove = (isUp: boolean, index: number) => {
  if ((isUp && index === 0) || (!isUp && index >= columns.value.length - 1)) {
    return
  }

  const newCols = [...columns.value]
  const movingValue = newCols.splice(index, 1)

  if (isUp) {
    newCols.splice(index - 1, 0, movingValue[0])
  } else {
    newCols.splice(index + 1, 0, movingValue[0])
  }

  newCols.forEach((col, i) => col.order = i)

  nodeStructureStore.setNodeColumnSelection(newCols)
}

const getOrderIconCssClasses = (isUp: boolean, index: number) => {
  if (isUp && index > 0 || !isUp && index < (columns.value.length - 1)) {
    return 'column-order-icon-active'
  }
  return 'column-order-icon-inactive'
}

const resetToDefault = () => {
  nodeStructureStore.resetColumnSelectionToDefault()
}
</script>

<style lang="scss" scoped>

.col-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.col-checkbox-label {
  cursor: pointer;
}

.column-select-container {
  padding: 4px;
}

.column-select-item-wrapper {
  padding-left: 0.5em;
}

.node-actions-reset {
  margin-bottom: 1em;
}

.column-order-icon {
  font-size: 1.1rem;
  cursor: default;

  &-active {
    cursor: pointer;
    color: inherit;
  }

  &-inactive {
    color: #ccc;
    cursor: default;
  }

  &-down {
    margin-left: 4px;
  }
}

.feather-col-3.centered {
  text-align: center;
}
</style>
