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
      <FeatherTabContainer class="graph-data-tabs">
        <template v-slot:tabs>
          <FeatherTab>Graph</FeatherTab>
          <FeatherTab>Data</FeatherTab>
        </template>
        <FeatherTabPanel>
          <div class="panel-wrapper">
            <PersesPanel
              v-if="persesSpec"
              :title="persesSpec.title"
              :queries="[persesSpec.query]"
              :time-range="absoluteTimeRange"
              :y-axis-label="persesSpec.yAxisLabel"
              :series-overrides="persesSpec.seriesOverrides"
            />
            <div v-else class="panel-error">No graph data available</div>
          </div>
        </FeatherTabPanel>
        <FeatherTabPanel>
          <div class="panel-wrapper" v-if="rawGraphData">
            <GraphDataTable
              :id="`${label}-${definition}`"
              :convertedGraphData="legacyModel"
              :graphData="rawGraphData"
            />
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
import { useGraphStore } from '@/stores/graphStore'
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

const absoluteTimeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date((props.time.startTime as number) * 1000),
  end:   new Date((props.time.endTime as number) * 1000)
}))
const legacyModel  = ref<ConvertedGraphData>({
  title: '', verticalLabel: '', series: [], values: [],
  metrics: [], printStatements: [], properties: {}
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

    rawGraphData.value = await graphStore.getGraphMetrics(payload)
  } catch (error) {
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
  height: 370px;
}
.graph-data-tabs {
  margin-top: 50px;
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
</style>

<style lang="scss">
.graph-data-tabs {
  ul {
    margin-left: 37px !important;
  }
}
</style>
