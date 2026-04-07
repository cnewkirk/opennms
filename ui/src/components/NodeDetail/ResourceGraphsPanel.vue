<!-- ui/src/components/NodeDetail/ResourceGraphsPanel.vue -->
<template>
  <div class="card resource-graphs-panel">
    <div class="feather-row resource-graphs-panel__header">
      <div class="feather-col-12 headline3">Resource Graphs</div>
    </div>

    <!-- Global time range picker -->
    <div class="resource-graphs-panel__time-bar">
      <button
        v-for="preset in PRESETS"
        :key="preset.label"
        :class="['resource-graphs-panel__preset', { 'resource-graphs-panel__preset--active': activePreset === preset.label }]"
        @click="applyPreset(preset)"
      >{{ preset.label }}</button>
      <button
        :class="['resource-graphs-panel__preset', { 'resource-graphs-panel__preset--active': activePreset === 'custom' }]"
        @click="showCustom = !showCustom"
      >Custom</button>
      <template v-if="showCustom">
        <input type="datetime-local" v-model="customStart" class="resource-graphs-panel__dt" />
        <span class="resource-graphs-panel__dt-sep">–</span>
        <input type="datetime-local" v-model="customEnd" class="resource-graphs-panel__dt" />
        <button class="resource-graphs-panel__apply" @click="applyCustom">Apply</button>
      </template>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="resource-graphs-panel__loading caption">Loading resources…</div>
    <div v-else-if="error" class="resource-graphs-panel__error">
      <span>{{ error }}</span>
      <button class="resource-graphs-panel__retry" @click="refresh">Retry</button>
    </div>

    <template v-else>
      <!-- Pinned Graphs -->
      <div class="resource-graphs-panel__section-title headline4">Pinned Graphs</div>
      <PinnedGraphs
        :pinnedItems="pinnedItems"
        :time="highlightTime"
        :hasPerNodePins="hasPerNodePins"
        @toggle-pin="togglePin"
        @set-as-default="setAsDefault"
      />

      <!-- Resource Categories -->
      <div class="resource-graphs-panel__section-title headline4">Browse by Category</div>
      <ResourceAccordion
        :groups="resourceGroups"
        :time="highlightTime"
        :isPinned="isPinned"
        @toggle-pin="togglePin"
      />

      <!-- Saved Charts -->
      <template v-if="savedCharts.length">
        <div class="resource-graphs-panel__section-title headline4">Saved Charts</div>
        <div class="resource-graphs-panel__saved-grid">
          <CustomChart
            v-for="chart in savedCharts"
            :key="chart.id"
            :series="chart.series"
            :title="chart.title"
            :time-range="chart.timeRange ?? globalRange"
            :node-id="nodeId"
            :editable="false"
            @edit="editSavedChart(chart)"
            @delete="deleteChart(chart.id)"
          />
        </div>
      </template>

      <!-- Query Builder -->
      <div class="resource-graphs-panel__section-title headline4">Build Custom Charts</div>
      <QueryBuilder
        ref="queryBuilderRef"
        :resources="resources"
        :time-range="globalRange"
        :node-id="nodeId"
        @save-chart="saveChart"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import PinnedGraphs from './PinnedGraphs.vue'
import ResourceAccordion from './ResourceAccordion.vue'
import CustomChart from './ResourceQueryBuilder/CustomChart.vue'
import QueryBuilder from './ResourceQueryBuilder/QueryBuilder.vue'
import useResourceGraphs from '@/composables/useResourceGraphs'
import usePinnedGraphs from '@/composables/usePinnedGraphs'
import type { StartEndTime } from '@/types'
import type { SavedChart, HighlightItem } from '@/types/resourceGraphs'

const props = defineProps<{ nodeId: string }>()

const { resources, resourceGroups, savedCharts, loading, error, saveChart, deleteChart, refresh } =
  useResourceGraphs(props.nodeId)

const { pinnedItems, isPinned, togglePin, setAsDefault, hasPerNodePins } =
  usePinnedGraphs(props.nodeId, () => resourceGroups.value)

// ── Time range ──────────────────────────────────────────────────────────────

interface Preset { label: string; ms: number }
const PRESETS: Preset[] = [
  { label: '1h',  ms: 1 * 60 * 60 * 1000 },
  { label: '6h',  ms: 6 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 }
]

const nowMs = () => Date.now()
const toLocalDT = (ms: number) =>
  new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const activePreset = ref('24h')
const showCustom = ref(false)
const customStart = ref(toLocalDT(nowMs() - 24 * 60 * 60 * 1000))
const customEnd = ref(toLocalDT(nowMs()))

const globalRange = ref<{ start: number; end: number }>({
  start: nowMs() - 24 * 60 * 60 * 1000,
  end: nowMs()
})

const applyPreset = (preset: Preset) => {
  activePreset.value = preset.label
  showCustom.value = false
  const end = nowMs()
  globalRange.value = { start: end - preset.ms, end }
}

const applyCustom = () => {
  activePreset.value = 'custom'
  globalRange.value = {
    start: new Date(customStart.value).getTime(),
    end: new Date(customEnd.value).getTime()
  }
}

const highlightTime = computed<StartEndTime>(() => ({
  startTime: Math.floor(globalRange.value.start / 1000),
  endTime: Math.floor(globalRange.value.end / 1000),
  format: 'hours'
}))

// ── Saved chart editing ──────────────────────────────────────────────────────

const queryBuilderRef = ref<InstanceType<typeof QueryBuilder> | null>(null)

const editSavedChart = (chart: SavedChart) => {
  deleteChart(chart.id)
  queryBuilderRef.value?.loadChart(chart)
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";

.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: vars.$border-radius-surface;
}

.resource-graphs-panel {
  &__header { margin-bottom: 8px; }

  &__time-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 0 14px;
    border-bottom: 1px solid var($border-light-on-surface);
    margin-bottom: 16px;
  }

  &__preset {
    padding: 4px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    cursor: pointer;
    font-size: 0.8rem;
    &:hover { background: var($shade-4); }
    &--active { background: var($primary); color: #fff; border-color: var($primary); }
  }

  &__dt {
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    padding: 3px 6px;
    font-size: 0.8rem;
  }

  &__dt-sep { color: var($secondary-text-on-surface); }

  &__apply {
    padding: 4px 10px;
    border: 1px solid var($primary);
    border-radius: 3px;
    background: var($primary);
    color: #fff;
    cursor: pointer;
    font-size: 0.8rem;
  }

  &__section-title {
    margin: 20px 0 10px;
  }

  &__saved-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 8px;

    @media (max-width: 800px) {
      grid-template-columns: 1fr;
    }
  }

  &__loading,
  &__error {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
  }

  &__retry {
    margin-left: 12px;
    padding: 4px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: none;
    cursor: pointer;
    font-size: 0.875rem;
    &:hover { background: var($shade-4); }
  }
}
</style>
