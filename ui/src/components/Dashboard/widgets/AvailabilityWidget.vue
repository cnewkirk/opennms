<template>
  <div class="availability-widget">
    <PanelLoader v-if="isLoading" />
    <template v-else>
      <div class="chart-wrapper">
        <Chart
          type="doughnut"
          :data="chartData"
          :options="chartOptions"
          class="chart"
        />
        <div class="center-text" :class="severityClass">
          {{ displayPercent }}%
        </div>
      </div>
      <div class="availability-sub">availability</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Chart from 'primevue/chart'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import { rest } from '@/services/axiosInstances'
import { useDashboardStore } from '@/stores/dashboardStore'
import { resolveTimeRange, type AvailabilityWidgetConfig } from '@/services/dashboardConfigService'

interface AvailCategoryResp { availability?: number }

const props = defineProps<{ config: AvailabilityWidgetConfig }>()
const dashboardStore = useDashboardStore()

const availability = ref<number>(100)
const isLoading = ref(true)
const displayPercent = computed(() => availability.value.toFixed(1))

const severityClass = computed(() => {
  if (availability.value >= 99) return 'sev-ok'
  if (availability.value >= 95) return 'sev-warn'
  return 'sev-crit'
})

const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#888'

const fillColor = computed(() => {
  if (availability.value >= 99) return getColor('--feather-success')
  if (availability.value >= 95) return getColor('--feather-warning')
  return getColor('--feather-error')
})

const chartData = computed(() => ({
  labels: ['Available', 'Unavailable'],
  datasets: [{
    data: [availability.value, Math.max(0, 100 - availability.value)],
    backgroundColor: [fillColor.value, getColor('--feather-border-light-on-surface')],
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
    tooltip: { enabled: false }
  }
}

const load = async () => {
  isLoading.value = true
  try {
    const tr = props.config.timeRange ?? dashboardStore.timeRange
    const { start, end } = resolveTimeRange(tr)
    const params: Record<string, string> = {
      start: start.toISOString(),
      end:   end.toISOString()
    }
    if (props.config.categories.length) {
      params['category'] = props.config.categories[0]
    }
    const resp = await rest.get('availability/categories', { params })
    const data = resp.data
    // Handle both shapes: { availability: number } or array of category objects
    if (typeof data?.availability === 'number') {
      availability.value = data.availability
    } else if (Array.isArray(data)) {
      const values = (data as AvailCategoryResp[]).map(c => c.availability ?? 100)
      availability.value = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 100
    }
  } catch {
    availability.value = 0
  } finally {
    isLoading.value = false
  }
}

onMounted(load)
defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@import "@/styles/tokens";
@import "@/styles/typography";

.availability-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  gap: 8px;
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
  font-size: 1.4rem;
  font-weight: 700;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1;

  &.sev-ok   { color: var(--feather-success, #4caf50); }
  &.sev-warn { color: var(--feather-warning, #ff9800); }
  &.sev-crit { color: var(--feather-error,   #f44336); }
}

.availability-sub {
  @include body-small;
  color: var($secondary-text-on-surface);
}
</style>
