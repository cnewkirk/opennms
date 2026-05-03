<template>
  <div class="node-status-widget">
    <PanelLoader v-if="isLoading" />
    <template v-else>
    <div class="chart-wrapper">
      <Chart
        type="doughnut"
        :data="chartData"
        :options="chartOptions"
        class="chart"
      />
      <!-- CSS overlay for center text — avoids Chart.js plugin scoping issues with multiple instances -->
      <div class="center-text">{{ totalCount }}</div>
    </div>
    <div class="legend">
      <span class="legend-item up">
        <span class="legend-dot" />
        {{ upCount }} up
      </span>
      <span class="legend-item down">
        <span class="legend-dot" />
        {{ downCount }} down
      </span>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Chart from 'primevue/chart'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import API from '@/services'
import { getActiveOutageCount } from '@/services/outageService'
import type { NodeStatusWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ config: NodeStatusWidgetConfig }>()

const totalCount = ref(0)
const downCount  = ref(0)
const upCount    = computed(() => Math.max(0, totalCount.value - downCount.value))
const isLoading  = ref(true)

const load = async () => {
  isLoading.value = true
  try {
    const params: Record<string, string | number> = { limit: 0 }
    if (props.config.categories.length) {
      params['category'] = props.config.categories.join(',')
    }
    const [nodeResp, outageDown] = await Promise.all([
      API.getNodes(params),
      getActiveOutageCount(props.config.categories)
    ])
    totalCount.value = nodeResp ? nodeResp.totalCount : 0
    downCount.value  = Math.min(outageDown, totalCount.value)
  } catch {
    totalCount.value = 0
    downCount.value  = 0
  } finally {
    isLoading.value = false
  }
}

// Read CSS vars at runtime so colors respect dark/light mode
const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#888'

const chartData = computed(() => ({
  labels: ['Up', 'Down'],
  datasets: [{
    data: [upCount.value, downCount.value],
    backgroundColor: [
      getColor('--feather-success'),
      getColor('--feather-error')
    ],
    borderWidth: 0,
    hoverOffset: 4
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true }
  }
}

onMounted(load)
defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@import "@/styles/tokens";
@import "@/styles/typography";

.node-status-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  gap: 12px;
}

.chart-wrapper {
  position: relative;
  width: 160px;
  height: 160px;
}

.chart {
  width: 160px !important;
  height: 160px !important;
}

.center-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.6rem;
  font-weight: 700;
  color: var($primary-text-on-surface);
  pointer-events: none;
  z-index: 1;
}

.legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  @include body-small;
  color: var($primary-text-on-surface);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.up   .legend-dot { background: var(--feather-success, #4caf50); }
.down .legend-dot { background: var(--feather-error, #f44336); }
</style>
