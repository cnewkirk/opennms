<!-- ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue -->
<template>
  <div class="query-builder">
    <div class="query-builder__layout">
      <!-- Left: resource tree -->
      <ResourceSidebar
        class="query-builder__sidebar"
        :resources="resources"
        :selected-id="selectedResourceId"
        @select-resource="onSelectResource"
      />

      <!-- Middle: attribute list -->
      <AttributeList
        class="query-builder__attrs"
        :resource="selectedResource"
        @add-series="onAddSeries"
      />

      <!-- Right: charts -->
      <div class="query-builder__charts">
        <CustomChart
          v-for="(chart, i) in activeCharts"
          :key="chart.id"
          :series="chart.series"
          :title="chart.title"
          :time-range="timeRange"
          :node-id="nodeId"
          :editable="true"
          @update-series="(s) => updateSeries(i, s)"
          @save="(saved) => onSave(i, saved)"
        />
        <button class="query-builder__add-chart" @click="addChart">+ Add chart</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ResourceSidebar from './ResourceSidebar.vue'
import AttributeList from './AttributeList.vue'
import CustomChart from './CustomChart.vue'
import type { Resource } from '@/types'
import type { ChartSeries, SavedChart } from '@/types/resourceGraphs'
import { SERIES_PALETTE } from '@/types/resourceGraphs'
import { v4 as uuidv4 } from 'uuid'

interface ActiveChart {
  id: string
  title: string
  series: ChartSeries[]
}

const props = defineProps<{
  resources: Resource[]
  timeRange: { start: number; end: number }
  nodeId: string
}>()

const emit = defineEmits<{ 'save-chart': [chart: SavedChart] }>()

const selectedResourceId = ref<string | null>(null)
const selectedResource = computed(
  () => props.resources.find(r => r.id === selectedResourceId.value) ?? null
)

const makeEmptyChart = (): ActiveChart => ({
  id: uuidv4(),
  title: 'Custom Chart',
  series: []
})

const activeCharts = ref<ActiveChart[]>([makeEmptyChart()])

const onSelectResource = (resource: Resource) => {
  selectedResourceId.value = resource.id
}

const onAddSeries = (partial: Omit<ChartSeries, 'color'>) => {
  const last = activeCharts.value[activeCharts.value.length - 1]
  const color = SERIES_PALETTE[last.series.length % SERIES_PALETTE.length]
  last.series = [...last.series, { ...partial, color }]
}

const updateSeries = (chartIdx: number, newSeries: ChartSeries[]) => {
  activeCharts.value[chartIdx].series = newSeries
}

const addChart = () => {
  activeCharts.value.push(makeEmptyChart())
}

const onSave = (chartIdx: number, saved: SavedChart) => {
  activeCharts.value.splice(chartIdx, 1)
  if (activeCharts.value.length === 0) {
    activeCharts.value.push(makeEmptyChart())
  }
  emit('save-chart', saved)
}

// Called by ResourceGraphsPanel when user clicks "Edit" on a saved chart
const loadChart = (chart: SavedChart) => {
  activeCharts.value.push({
    id: uuidv4(),
    title: chart.title,
    series: [...chart.series]
  })
  // Scroll to bottom of panel so the new chart is visible
  nextTick(() => {
    const el = document.querySelector('.query-builder__add-chart')
    el?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

defineExpose({ loadChart })
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.query-builder {
  &__layout {
    display: grid;
    grid-template-columns: 200px 200px 1fr;
    min-height: 480px;
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-surface;
    overflow: hidden;
  }

  &__sidebar,
  &__attrs {
    // These components have their own border-right
    min-height: 480px;
  }

  &__charts {
    padding: 14px;
    overflow-y: auto;
  }

  &__add-chart {
    display: block;
    width: 100%;
    padding: 10px;
    background: none;
    border: 1.5px dashed var($border-on-surface);
    border-radius: vars.$border-radius-surface;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.875rem;
    text-align: center;
    &:hover { background: var($shade-4); border-color: var($primary); }
  }
}
</style>
