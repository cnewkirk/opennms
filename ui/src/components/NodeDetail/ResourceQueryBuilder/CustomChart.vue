<!-- ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue -->
<template>
  <div :class="['custom-chart', { 'custom-chart--view': !editable }]">
    <!-- Header -->
    <div class="custom-chart__header">
      <input
        v-if="editable"
        v-model="localTitle"
        class="custom-chart__title-input"
        placeholder="Chart title…"
      />
      <span v-else class="custom-chart__title-text">{{ title }}</span>
      <div class="custom-chart__header-actions">
        <button v-if="!editable" class="custom-chart__btn" @click="$emit('edit')">Edit</button>
        <button v-if="!editable" class="custom-chart__btn custom-chart__btn--danger" @click="$emit('delete')">Delete</button>
        <button
          v-if="editable"
          class="custom-chart__btn custom-chart__btn--primary"
          :disabled="!series.length"
          @click="doSave"
        >Save</button>
      </div>
    </div>

    <!-- Chart area -->
    <div class="custom-chart__body">
      <div v-if="!series.length" class="custom-chart__empty caption">
        Use the sidebar to add metrics.
      </div>
      <div v-else class="custom-chart__panel-wrapper">
        <PersesPanel
          :title="localTitle || 'Custom Chart'"
          :queries="queries"
          :time-range="absoluteTimeRange"
          :series-overrides="seriesOverrides"
        />
      </div>

      <!-- Series list (editable mode only) -->
      <div v-if="series.length && editable" class="custom-chart__series-section">
        <div
          v-for="(s, i) in series"
          :key="i"
          class="custom-chart__series-row"
        >
          <span class="custom-chart__series-resource" :title="s.resourceId">{{ s.resourceLabel }}</span>
          <span class="custom-chart__series-attr">{{ s.attribute }}</span>
          <select
            :value="s.aggregation"
            class="custom-chart__agg"
            @change="updateAggregation(i, ($event.target as HTMLSelectElement).value as 'AVERAGE' | 'MIN' | 'MAX')"
          >
            <option value="AVERAGE">AVG</option>
            <option value="MIN">MIN</option>
            <option value="MAX">MAX</option>
          </select>
          <span
            class="custom-chart__swatch"
            :style="{ background: s.color }"
            :title="`Color: ${s.color} (click to cycle)`"
            @click="cycleColor(i)"
          />
          <button class="custom-chart__remove" title="Remove series" @click="removeSeries(i)">✕</button>
        </div>

        <!-- Time override -->
        <div class="custom-chart__time-row">
          <label class="custom-chart__override-label">
            <input type="checkbox" v-model="useTimeOverride" />
            Override time range
          </label>
          <template v-if="useTimeOverride">
            <input type="datetime-local" v-model="overrideStart" class="custom-chart__dt" />
            <span class="custom-chart__dt-sep">–</span>
            <input type="datetime-local" v-model="overrideEnd" class="custom-chart__dt" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import type { OpenNMSQuerySpec } from '@/datasource/opennms'
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { ChartSeries, SavedChart } from '@/types/resourceGraphs'
import { SERIES_PALETTE } from '@/types/resourceGraphs'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps<{
  series: ChartSeries[]
  title: string
  timeRange: { start: number; end: number }
  nodeId: string
  editable?: boolean
}>()

const emit = defineEmits<{
  'update-series': [series: ChartSeries[]]
  'edit': []
  'delete': []
  'save': [chart: SavedChart]
}>()

const localTitle = ref(props.title)

// Time override
const useTimeOverride = ref(false)
const toLocalDT = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const overrideStart = ref(toLocalDT(props.timeRange.start))
const overrideEnd = ref(toLocalDT(props.timeRange.end))

// Keep override inputs in sync when parent time range changes (if no override active)
watch(() => props.timeRange, (tr) => {
  if (!useTimeOverride.value) {
    overrideStart.value = toLocalDT(tr.start)
    overrideEnd.value = toLocalDT(tr.end)
  }
})

const effectiveRange = computed<{ start: number; end: number }>(() => {
  if (useTimeOverride.value) {
    return {
      start: new Date(overrideStart.value).getTime(),
      end: new Date(overrideEnd.value).getTime()
    }
  }
  return props.timeRange
})

const absoluteTimeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date(effectiveRange.value.start),
  end: new Date(effectiveRange.value.end)
}))

const queries = computed<OpenNMSQuerySpec[]>(() =>
  props.series.map(s => ({
    resourceId: s.resourceId,
    attribute: s.attribute,
    aggregation: s.aggregation,
    label: s.label
  }))
)

const seriesOverrides = computed(() =>
  props.series.map(s => ({ name: s.label, color: s.color }))
)

// Series mutations — emit full replacement array to parent
const removeSeries = (i: number) => {
  emit('update-series', props.series.filter((_, idx) => idx !== i))
}

const updateAggregation = (i: number, agg: 'AVERAGE' | 'MIN' | 'MAX') => {
  emit('update-series', props.series.map((s, idx) => idx === i ? { ...s, aggregation: agg } : s))
}

const cycleColor = (i: number) => {
  const current = SERIES_PALETTE.indexOf(props.series[i].color)
  const nextColor = SERIES_PALETTE[(current + 1) % SERIES_PALETTE.length]
  emit('update-series', props.series.map((s, idx) => idx === i ? { ...s, color: nextColor } : s))
}

const doSave = () => {
  const chart: SavedChart = {
    id: uuidv4(),
    nodeId: props.nodeId,
    title: localTitle.value || 'Custom Chart',
    series: [...props.series],
    timeRange: useTimeOverride.value ? { ...effectiveRange.value } : undefined,
    createdAt: Date.now()
  }
  emit('save', chart)
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.custom-chart {
  @include elevation(1);
  border-radius: vars.$border-radius-surface;
  overflow: hidden;
  margin-bottom: 16px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    background: var($shade-4);
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title-input {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 1.5px solid var($border-on-surface);
    color: var($primary-text-on-surface);
    font-size: 0.95rem;
    font-weight: 600;
    outline: none;
    padding: 2px 4px;
    &:focus { border-bottom-color: var($primary); }
  }

  &__title-text {
    flex: 1;
    font-size: 0.95rem;
    font-weight: 600;
  }

  &__header-actions { display: flex; gap: 8px; }

  &__btn {
    padding: 4px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-xs;
    background: var($surface);
    color: var($primary-text-on-surface);
    cursor: pointer;
    font-size: 0.8rem;
    &:hover { background: var($shade-4); }
    &--primary { color: var($primary); border-color: var($primary); font-weight: 600; }
    &--primary:disabled { opacity: 0.4; cursor: not-allowed; }
    &--danger { color: var(--feather-error); border-color: var(--feather-error); }
    &--danger:hover { background: rgba(var(--feather-error-r), var(--feather-error-g), var(--feather-error-b), 0.08); }
  }

  &__body { padding: 14px; }

  &__panel-wrapper { height: 300px; margin-bottom: 12px; }

  &__empty {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__series-section {
    border-top: 1px solid var($border-light-on-surface);
    padding-top: 10px;
  }

  &__series-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var($border-light-on-surface);
    font-size: 0.8rem;
  }

  &__series-resource {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__series-attr {
    flex: 1;
    font-family: monospace;
    font-size: 0.8rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__agg {
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-xs;
    background: var($surface);
    color: var($primary-text-on-surface);
    padding: 2px 4px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  &__swatch {
    width: 16px;
    height: 16px;
    border-radius: vars.$border-radius-xs;
    cursor: pointer;
    border: 1px solid var($border-on-surface);
    flex-shrink: 0;
    &:hover { transform: scale(1.2); }
  }

  &__remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    font-size: 0.75rem;
    padding: 0 4px;
    flex-shrink: 0;
    &:hover { color: var(--feather-error); }
  }

  &__time-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var($border-light-on-surface);
    font-size: 0.8rem;
  }

  &__override-label {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    white-space: nowrap;
  }

  &__dt {
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-xs;
    background: var($surface);
    color: var($primary-text-on-surface);
    padding: 3px 6px;
    font-size: 0.75rem;
  }

  &__dt-sep { color: var($secondary-text-on-surface); }
}
</style>
