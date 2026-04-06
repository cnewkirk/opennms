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
  <div class="feather-row">
    <div class="feather-col-12 container">
      <router-link
        v-if="!isSingleGraph"
        :to="`/resource-graphs/graphs/${label}/${definition}/${resourceId}`"
        target="_blank"
      >
        <FeatherButton secondary class="single-graph-btn">Open</FeatherButton>
      </router-link>
      <div v-if="persesSpec?.title" class="graph-title">{{ persesSpec.title }}</div>
      <FeatherTabContainer class="graph-data-tabs">
        <template v-slot:tabs>
          <FeatherTab>Graph</FeatherTab>
          <FeatherTab>Data</FeatherTab>
        </template>
        <FeatherTabPanel>
          <div class="panel-wrapper">
            <div class="chart-area">
              <PersesPanel
                v-if="persesSpec"
                :title="persesSpec.title"
                :queries="[persesSpec.query]"
                :time-range="absoluteTimeRange"
                :y-axis-label="persesSpec.yAxisLabel"
                :palette="persesSpec.palette"
                :visual-mode="persesSpec.visualMode"
              />
              <div v-else class="panel-error">No graph data available</div>
            </div>
            <div v-if="legendRows.length" class="legend-table-wrap">
              <table class="legend-table">
                <thead>
                  <tr>
                    <th class="legend-color-col"></th>
                    <th class="legend-name-col">Series</th>
                    <th class="legend-val-col">Last</th>
                    <th class="legend-val-col">Min</th>
                    <th class="legend-val-col">Max</th>
                    <th class="legend-val-col">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in legendRows" :key="row.name">
                    <td class="legend-color-col">
                      <span class="legend-swatch" :style="{ backgroundColor: row.color }"></span>
                    </td>
                    <td class="legend-name-col" :title="row.name">{{ row.name }}</td>
                    <td class="legend-val-col">{{ row.last }}</td>
                    <td class="legend-val-col">{{ row.min }}</td>
                    <td class="legend-val-col">{{ row.max }}</td>
                    <td class="legend-val-col">{{ row.avg }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </FeatherTabPanel>
        <FeatherTabPanel>
          <div class="panel-wrapper">
            <GraphDataTable
              v-if="rawGraphData"
              :id="`${label}-${definition}`"
              :convertedGraphData="legacyModel"
              :graphData="rawGraphData"
            />
            <div v-else-if="dataError" class="panel-error">{{ dataError }}</div>
            <div v-else class="panel-error">Loading data...</div>
          </div>
        </FeatherTabPanel>
      </FeatherTabContainer>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import RrdGraphConverter from './utils/RrdGraphConverter.class'
import GraphDataTable from './GraphDataTable.vue'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { formatTimestamps, getFormattedLegendStatements } from './utils/LegendFormatter'
import { useGraphStore } from '@/stores/graphStore'
import { format as d3Format } from 'd3'
import type { ConvertedGraphData, GraphMetricsPayload, GraphMetricsResponse, Metric, PersesGraphSpec, PreFabGraph, StartEndTime } from '@/types'
import type { AbsoluteTimeRange } from '@perses-dev/core'
import { FeatherButton } from '@featherds/button'
import {
  FeatherTab,
  FeatherTabContainer,
  FeatherTabPanel
} from '@featherds/tabs'

const emit = defineEmits(['addGraphDefinition'])

const props = defineProps({
  definition:    { required: true, type: String },
  resourceId:    { required: true, type: String },
  time:          { required: true, type: Object as PropType<StartEndTime> },
  label:         { required: true, type: String },
  isSingleGraph: { required: true, type: Boolean }
})

const graphStore = useGraphStore()
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
  const definitionData: PreFabGraph | null = await graphStore.getDefinitionData(props.definition)

  if (!definitionData) {
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

    // Fetch raw measurements for the Data tab
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
  }
}

watch(() => props.time, render)
onMounted(render)
</script>

<style scoped lang="scss">
.container {
  position: relative;
}
.panel-wrapper {
  height: 470px;
}
.chart-area {
  height: 300px;
}
.graph-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--feather-secondary-text-on-surface);
  text-align: center;
  padding: 8px 0 0;
  letter-spacing: 0.01em;
}

.graph-data-tabs {
  margin-top: 16px;
}
.single-graph-btn {
  position: absolute;
  top: 12px;
  right: 70px;
  z-index: 1;
}
.panel-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--feather-disabled-text-on-surface);
}

/* ── Grafana-style legend table ── */
.legend-table-wrap {
  max-height: 160px;
  overflow-y: auto;
  margin-top: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--feather-border-on-surface) transparent;
}
.legend-table {
  width: 100%;
  border-collapse: collapse;
  border: none;
  font-family: var(--feather-font-family);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--feather-primary-text-on-surface);
}
.legend-table th {
  font-weight: 500;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
  padding: 4px 10px 4px 0;
  border: none;
  border-bottom: 1px solid var(--feather-border-on-surface);
  color: var(--feather-secondary-text-on-surface);
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: var(--feather-surface);
}
.legend-table td {
  padding: 3px 10px 3px 0;
  border: none;
  border-bottom: 1px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Subtle divider only between rows, not on the last one */
.legend-table tbody tr + tr td {
  border-top: 1px solid var(--feather-border-light-on-surface);
}
.legend-table tbody tr:hover td {
  background: var(--feather-border-light-on-surface);
}
.legend-color-col {
  width: 20px;
  padding-left: 2px !important;
  padding-right: 6px !important;
}
.legend-swatch {
  display: inline-block;
  width: 4px;
  height: 14px;
  border-radius: 2px;
  vertical-align: middle;
}
.legend-name-col {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.legend-val-col {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 0.6875rem;
  color: var(--feather-secondary-text-on-surface);
  width: 72px;
}
</style>

<style lang="scss">
.graph-data-tabs {
  ul {
    margin-left: 37px !important;
  }
}
</style>
