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
      <!-- Percentage cards -->
      <div class="availability-panel__cards">
        <template v-for="iface in availability.ipinterfaces" :key="iface.id">
          <div
            v-for="svc in iface.services"
            :key="svc.id"
            class="avail-card"
            :class="severityClass(svc.availability)"
          >
            <div class="avail-card__name subtitle2">{{ svc.name }}</div>
            <div class="avail-card__ip caption">{{ iface.address }}</div>
            <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
          </div>
        </template>
      </div>

      <!-- Expandable timeline -->
      <button class="availability-panel__toggle subtitle2" @click="showChart = !showChart">
        {{ showChart ? '▲ Hide timeline' : '▼ Show timeline' }}
      </button>

      <div v-if="showChart" class="availability-panel__chart-wrap">
        <canvas ref="canvasRef" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import { format } from 'date-fns'
import { NodeAvailability } from '@/types'
import { AvailabilityChartData, DownSegmentMeta } from '@/composables/useNodeAvailability'

Chart.register(...registerables)

const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  loading: boolean
  error: string | null
}>()

const showChart = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const formatPct = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

const severityClass = (pct: number) => {
  if (pct >= 99) return 'avail-card--green'
  if (pct >= 95) return 'avail-card--amber'
  return 'avail-card--red'
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
@import "@featherds/styles/themes/variables";
.card { background: var($surface); padding: 16px; margin-bottom: 16px; }
.availability-panel {
  &__title   { margin-bottom: 12px; }
  &__skeleton, &__error { padding: 8px; color: var($secondary-text-on-surface); }
  &__cards   { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  &__toggle  { background: none; border: none; cursor: pointer; color: var($clickable-normal); padding: 4px 0; }
  &__chart-wrap { height: 200px; margin-top: 12px; }
}
.avail-card {
  border-radius: 8px;
  padding: 10px 16px;
  min-width: 120px;
  text-align: center;
  &__name { margin-bottom: 2px; }
  &__ip   { opacity: 0.7; margin-bottom: 4px; }
  &__pct  { font-weight: 700; }
  &--green { background: rgba(102,187,106,0.15); border: 1px solid rgba(102,187,106,0.5); }
  &--amber { background: rgba(255,193,7,0.15);   border: 1px solid rgba(255,193,7,0.5); }
  &--red   { background: rgba(227,93,91,0.15);   border: 1px solid rgba(227,93,91,0.5); }
}
</style>
