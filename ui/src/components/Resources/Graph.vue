///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///
<template>
  <div class="graph-card">
    <!-- Title bar -->
    <div class="graph-card__title-bar">
      <span class="graph-card__title">{{ persesSpec?.title ?? definition }}</span>
      <div class="graph-card__title-actions">
        <button
          v-if="pinnable"
          class="graph-card__pin-btn"
          :class="{ 'graph-card__pin-btn--active': pinned }"
          :title="pinned ? 'Unpin graph' : 'Pin to top'"
          @click="emit('toggle-pin')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>
        <router-link
          v-if="!isSingleGraph"
          :to="`/resource-graphs/graphs/${label}/${definition}/${resourceId}`"
          target="_blank"
          class="graph-card__open-link"
        >Open ↗</router-link>
      </div>
    </div>

    <!-- Chart -->
    <div class="graph-card__chart">
      <PanelLoader v-if="isLoading" :size="36" overlay />
      <PersesPanel
        v-else-if="persesSpec"
        :title="persesSpec.title"
        :queries="[persesSpec.query]"
        :time-range="absoluteTimeRange"
        :y-axis-label="persesSpec.yAxisLabel"
        :palette="persesSpec.palette"
        :visual-mode="persesSpec.visualMode"
      />
      <div v-else class="graph-card__no-data">No graph data available</div>
    </div>

    <!-- Legend -->
    <table v-if="legendRows.length" class="graph-card__legend">
      <thead>
        <tr>
          <th class="graph-card__legend-color"></th>
          <th class="graph-card__legend-name">Series</th>
          <th class="graph-card__legend-val">Last</th>
          <th class="graph-card__legend-val">Min</th>
          <th class="graph-card__legend-val">Max</th>
          <th class="graph-card__legend-val">Avg</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in legendRows" :key="row.name">
          <td class="graph-card__legend-color">
            <span class="graph-card__swatch" :style="{ backgroundColor: row.color }"></span>
          </td>
          <td class="graph-card__legend-name" :title="row.name">{{ row.name }}</td>
          <td class="graph-card__legend-val">{{ row.last }}</td>
          <td class="graph-card__legend-val">{{ row.min }}</td>
          <td class="graph-card__legend-val">{{ row.max }}</td>
          <td class="graph-card__legend-val">{{ row.avg }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Data table — only on single-graph (full) page -->
    <template v-if="isSingleGraph">
      <div class="graph-card__data-divider"></div>
      <div class="graph-card__data-section">
        <div class="graph-card__data-heading">Raw Data</div>
        <GraphDataTable
          v-if="rawGraphData"
          :id="`${label}-${definition}`"
          :convertedGraphData="legacyModel"
          :graphData="rawGraphData"
        />
        <div v-else-if="dataError" class="graph-card__no-data">{{ dataError }}</div>
        <div v-else class="graph-card__no-data">Loading data...</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import RrdGraphConverter from './utils/RrdGraphConverter.class'
import GraphDataTable from './GraphDataTable.vue'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { formatTimestamps, getFormattedLegendStatements } from './utils/LegendFormatter'
import { useGraphStore } from '@/stores/graphStore'
import { format as d3Format } from 'd3'
import type { ConvertedGraphData, GraphMetricsPayload, GraphMetricsResponse, Metric, PersesGraphSpec, PreFabGraph, StartEndTime } from '@/types'
import type { AbsoluteTimeRange } from '@perses-dev/core'

const emit = defineEmits(['addGraphDefinition', 'toggle-pin'])

const props = defineProps({
  definition:    { required: true, type: String },
  resourceId:    { required: true, type: String },
  time:          { required: true, type: Object as PropType<StartEndTime> },
  label:         { required: true, type: String },
  isSingleGraph: { required: true, type: Boolean },
  pinnable:      { type: Boolean, default: false },
  pinned:        { type: Boolean, default: false }
})

const graphStore = useGraphStore()
const isLoading    = ref(true)
const persesSpec   = ref<PersesGraphSpec | null>(null)
const rawGraphData = ref<GraphMetricsResponse | null>(null)
const dataError    = ref<string | null>(null)

const absoluteTimeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date((props.time.startTime as number) * 1000),
  end:   new Date((props.time.endTime as number) * 1000)
}))
const legacyModel  = ref<ConvertedGraphData>({
  title: '', verticalLabel: '', series: [], values: [],
  metrics: [], printStatements: [], properties: {}
})

const siFormat = d3Format('.3s')
const fmtVal = (v: number) => isNaN(v) ? 'N/A' : siFormat(v)

const legendRows = computed(() => {
  const data = rawGraphData.value
  const spec = persesSpec.value
  if (!data || !spec) return []

  // Build metric→display name map from series overrides
  const displayNameMap = new Map<string, string>()
  for (const s of spec.seriesOverrides) {
    if (s.name) displayNameMap.set(s.metric, s.name)
  }

  // Use the same palette as the chart (categorical mode cycles by index)
  const palette = spec.palette
  const fallbackColors = ['#56B4E9', '#009E73', '#0072B2', '#CC79A7', '#F0E442', '#E69F00', '#D55E00']

  const rows: { name: string; color: string; last: string; min: string; max: string; avg: string }[] = []
  let visibleIndex = 0

  for (let i = 0; i < data.labels.length; i++) {
    const label = data.labels[i]
    const values = data.columns[i]?.values
    if (!values || !label) continue

    // Skip transient metrics (internal expressions not meant for display)
    const metric = legacyModel.value.metrics.find(m => m.name === label)
    if (metric?.transient) continue

    const colors = palette.length ? palette : fallbackColors
    const color = colors[visibleIndex % colors.length]
    const displayName = displayNameMap.get(label) || label

    const nums = values.filter(v => !isNaN(v) && v !== null && v !== undefined)
    if (nums.length === 0) {
      rows.push({ name: displayName, color, last: 'N/A', min: 'N/A', max: 'N/A', avg: 'N/A' })
    } else {
      const last = nums[nums.length - 1]!
      const min = Math.min(...nums)
      const max = Math.max(...nums)
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      rows.push({ name: displayName, color, last: fmtVal(last), min: fmtVal(min), max: fmtVal(max), avg: fmtVal(avg) })
    }
    visibleIndex++
  }
  return rows
})

const render = async () => {
  isLoading.value = true
  const definitionData: PreFabGraph | null = await graphStore.getDefinitionData(props.definition)

  if (!definitionData) {
    isLoading.value = false
    emit('addGraphDefinition')
    return
  }

  try {
    const converter = new RrdGraphConverter({
      graphDef: definitionData,
      resourceId: props.resourceId
    })

    persesSpec.value  = converter.toPersesGraphSpec()
    legacyModel.value = converter.model

    // Fetch raw measurements for legend stats (and Data tab on single-graph page)
    const metrics: Metric[] = converter.model.metrics.map((m: Metric): Metric => ({
      aggregation: m.aggregation,
      attribute: m.attribute,
      label: m.name,
      resourceId: m.resourceId,
      transient: m.transient,
      expression: m.expression
    }))

    const start = (props.time.startTime as number) * 1000
    const end   = (props.time.endTime as number) * 1000
    const step  = Math.floor((end - start) / 1000)

    const metricsWithExpressions    = metrics.filter(m => Boolean(m.expression))
    const metricsWithoutExpressions = metrics.filter(m => !m.expression)

    const payload: GraphMetricsPayload = { start, end, step, source: metricsWithoutExpressions }
    if (metricsWithExpressions.length) {
      payload.expression = metricsWithExpressions.map(m => ({
        value: m.expression as string,
        label: m.label as string,
        transient: m.transient as boolean
      }))
    }

    const graphMetrics = await graphStore.getGraphMetrics(payload)
    if (graphMetrics) {
      let formatted = formatTimestamps(graphMetrics, props.time.format)
      formatted = getFormattedLegendStatements(formatted, converter.model)
      rawGraphData.value = formatted
    } else {
      dataError.value = 'No data returned from measurements API'
    }
  } catch (error) {
    dataError.value = `Failed to load data: ${error}`
    console.error('Could not render graph for', props.definition, error)
    emit('addGraphDefinition')
  } finally {
    isLoading.value = false
  }
}

watch(() => props.time, render)
onMounted(render)
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.graph-card {
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-surface;
  background: var($surface);
  overflow: hidden;

  &__title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 6px;
  }

  &__title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    letter-spacing: 0.01em;
  }

  &__open-link {
    font-size: 0.75rem;
    color: var($clickable-normal);
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
    &:hover { text-decoration: underline; }
  }

  &__title-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__pin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: vars.$border-radius-xs;
    background: none;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s, color 0.15s;
    &:hover { opacity: 1; }
    &--active {
      opacity: 1;
      color: var($primary);
      svg { fill: currentColor; }
    }
  }

  &__chart {
    position: relative;
    height: 280px;
    padding: 0 8px;
  }

  &__no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 280px;
    color: var($disabled-text-on-surface);
    font-size: 0.8125rem;
  }

  /* ── Legend ── */
  &__legend {
    width: 100%;
    border-collapse: collapse;
    border: none;
    font-family: var(--feather-font-family);
    font-size: 0.75rem;
    line-height: 1.5;
    color: var($primary-text-on-surface);
    margin-top: 2px;
  }

  &__legend th {
    font-weight: 500;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: left;
    padding: 4px 10px 4px 0;
    border: none;
    border-top: 1px solid var($border-light-on-surface);
    border-bottom: 1px solid var($border-light-on-surface);
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    background: var($surface);
  }

  &__legend td {
    padding: 3px 10px 3px 0;
    border: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__legend tbody tr + tr td {
    border-top: 1px solid var($border-light-on-surface);
  }

  &__legend tbody tr:hover td {
    background: var($border-light-on-surface);
  }

  &__legend-color {
    width: 20px;
    padding-left: 10px !important;
    padding-right: 6px !important;
  }

  &__swatch {
    display: inline-block;
    width: 4px;
    height: 14px;
    border-radius: 2px;
    vertical-align: middle;
  }

  &__legend-name {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__legend-val {
    text-align: right !important;
    font-variant-numeric: tabular-nums;
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 0.6875rem;
    color: var($secondary-text-on-surface);
    width: 60px;
    padding-right: 10px !important;
  }

  /* ── Data section (single-graph page only) ── */
  &__data-divider {
    border-top: 1px solid var($border-light-on-surface);
    margin: 12px 14px 0;
  }

  &__data-section {
    padding: 14px;
  }

  &__data-heading {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    margin-bottom: 10px;
  }
}
</style>
