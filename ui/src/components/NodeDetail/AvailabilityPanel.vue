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
  <div class="availability-panel card">
    <div class="headline4 availability-panel__title">Availability (last 24 hours)</div>

    <div v-if="loading" class="availability-panel__skeleton">Loading…</div>
    <div v-else-if="error" class="availability-panel__error subtitle2">{{ error }}</div>

    <template v-else-if="availability">
      <!-- Problems mode: all healthy -->
      <ClearSummary
        v-if="problemsOnly && allHealthy"
        message="All services healthy"
        :expandable="true"
        @expand="showAll = true"
      />

      <template v-else>
        <!-- Percentage cards grouped by IP interface -->
        <div class="availability-panel__cards">
          <div
            v-for="iface in displayedInterfaces"
            :key="iface.id"
            class="availability-panel__iface-group"
          >
            <div class="availability-panel__iface-header subtitle2">{{ iface.address }}</div>
            <div class="availability-panel__iface-cards">
              <template v-for="svc in iface.services" :key="svc.id">
                <ServiceGraphTooltip
                  v-if="nodeId"
                  :nodeId="nodeId"
                  :ip="iface.address"
                  :serviceName="svc.name"
                >
                  <div
                    class="avail-card"
                    :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
                    @click="isClickable && emit('go-graphs')"
                  >
                    <div class="avail-card__name subtitle2">{{ svc.name }}</div>
                    <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
                  </div>
                </ServiceGraphTooltip>
                <div
                  v-else
                  class="avail-card"
                  :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
                  @click="isClickable && emit('go-graphs')"
                >
                  <div class="avail-card__name subtitle2">{{ svc.name }}</div>
                  <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Expandable timeline -->
        <button class="availability-panel__toggle subtitle2" @click="showChart = !showChart">
          {{ showChart ? '▲ Hide timeline' : '▼ Show timeline' }}
        </button>

        <div v-if="showChart" class="availability-panel__chart-wrap">
          <canvas ref="canvasRef" />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import { format } from 'date-fns'
import { NodeAvailability } from '@/types'
import { AvailabilityChartData, DownSegmentMeta } from '@/composables/useNodeAvailability'
import ClearSummary from '@/components/Common/ClearSummary.vue'
import ServiceGraphTooltip from './ServiceGraphTooltip.vue'

Chart.register(...registerables)

const emit = defineEmits<{ 'go-graphs': [] }>()

const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  loading: boolean
  error: string | null
  problemsOnly?: boolean
  /** Node ID — passed through to ServiceGraphTooltip for resource lookup */
  nodeId?: string
  /** Whether cards are clickable (navigate to Graphs tab). Default: true */
  clickable?: boolean
}>()

const isClickable = computed(() => props.clickable !== false)

const showAll = ref(false)

const allHealthy = computed(() => {
  if (!props.availability?.ipinterfaces?.length) return true
  return props.availability.ipinterfaces.every(iface =>
    iface.services.every(svc => svc.availability >= 100)
  )
})

const filteredInterfaces = computed(() => {
  if (!props.availability?.ipinterfaces) return []
  return props.availability.ipinterfaces
    .map(iface => ({
      ...iface,
      services: iface.services.filter(svc => svc.availability < 100)
    }))
    .filter(iface => iface.services.length > 0)
})

const displayedInterfaces = computed(() => {
  if (!props.availability?.ipinterfaces) return []
  if (props.problemsOnly && !showAll.value) return filteredInterfaces.value
  return props.availability.ipinterfaces
})

const showChart = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const formatPct = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

const severityClass = (pct: number) => {
  if (pct >= 99) return 'avail-card--normal'
  if (pct >= 95) return 'avail-card--warning'
  return 'avail-card--critical'
}

const now = Date.now()
const windowStart = now - 24 * 60 * 60 * 1000

const buildChart = () => {
  if (!canvasRef.value || !props.chartData) return
  chartInstance?.destroy()

  const serviceLabels = (props.availability?.ipinterfaces ?? []).flatMap(
    iface => iface.services.map(s => `${s.name} @ ${iface.address}`)
  )

  chartInstance = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels: serviceLabels,
      datasets: props.chartData.datasets as any
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: windowStart,
          max: now,
          stacked: false,
          ticks: {
            maxTicksLimit: 7,
            callback: (value) => format(new Date(value as number), 'HH:mm')
          }
        },
        y: { stacked: false }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      onClick: (_event, elements) => {
        if (elements.length && elements[0].datasetIndex === 1) {
          const meta = props.downSegmentMeta[elements[0].index]
          if (meta?.outageId) {
            window.location.href = `/opennms/outage/detail.htm?id=${meta.outageId}`
          }
        }
      }
    }
  })
}

watch(showChart, (visible) => {
  if (visible) {
    nextTick(buildChart)
  } else {
    chartInstance?.destroy()
    chartInstance = null
  }
})

onUnmounted(() => chartInstance?.destroy())
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/styles/themes/variables";
.card { background: var($surface); padding: 16px; margin-bottom: 16px; }
.availability-panel {
  &__title   { margin-bottom: 12px; }
  &__skeleton, &__error { padding: 8px; color: var($secondary-text-on-surface); }
  &__cards        { margin-bottom: 12px; }
  &__iface-group  { margin-bottom: 16px; }
  &__iface-group:last-child { margin-bottom: 0; }
  &__iface-header { color: var($secondary-text-on-surface); margin-bottom: 6px; }
  &__iface-cards  { display: flex; flex-wrap: wrap; gap: 12px; }
  &__toggle  { background: none; border: none; cursor: pointer; color: var($clickable-normal); padding: 4px 0; }
  &__chart-wrap { height: 200px; margin-top: 12px; }
}
.avail-card {
  border-radius: vars.$border-radius-surface;
  padding: 10px 16px;
  min-width: 120px;
  text-align: center;
  &__name { margin-bottom: 2px; }
  &__pct  { font-weight: 700; }
  &--normal   { background: utils.alpha(fvars.$success, 0.12); border: 1px solid utils.alpha(fvars.$success, 0.4); }
  &--warning  { background: utils.alpha(fvars.$warning, 0.12); border: 1px solid utils.alpha(fvars.$warning, 0.4); }
  &--critical { background: utils.alpha(fvars.$error, 0.12);   border: 1px solid utils.alpha(fvars.$error, 0.4); }
  &--clickable {
    cursor: pointer;
    transition: box-shadow 0.15s ease, filter 0.15s ease;
    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      filter: brightness(1.04);
    }
  }
}
</style>
