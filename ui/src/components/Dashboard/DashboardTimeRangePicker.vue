<template>
  <div class="time-range-picker">
    <Select
      v-model="selectedPreset"
      :options="presetOptions"
      option-label="label"
      option-value="value"
      class="preset-select"
      @change="onPresetChange"
    />
    <template v-if="selectedPreset === 'custom'">
      <DatePicker
        v-model="absoluteFrom"
        show-time
        hour-format="24"
        date-format="yy-mm-dd"
        placeholder="From"
        class="date-input"
      />
      <span class="separator">→</span>
      <DatePicker
        v-model="absoluteTo"
        show-time
        hour-format="24"
        date-format="yy-mm-dd"
        placeholder="To"
        class="date-input"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboardStore'
import type { DashboardTimeRange } from '@/services/dashboardConfigService'

const dashboardStore = useDashboardStore()
const { timeRange } = storeToRefs(dashboardStore)

const presetOptions = [
  { label: 'Last 1 hour',  value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours',value: '24h' },
  { label: 'Last 7 days',  value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom range…',value: 'custom' }
]

const selectedPreset = ref<string>(
  timeRange.value.mode === 'absolute' ? 'custom' : timeRange.value.relativeWindow
)
const absoluteFrom = ref<Date | null>(timeRange.value.from ? new Date(timeRange.value.from) : null)
const absoluteTo   = ref<Date | null>(timeRange.value.to   ? new Date(timeRange.value.to)   : null)

// Re-sync when the store resets externally (e.g. toolbar Reset button)
watch(timeRange, (tr) => {
  if (tr.mode === 'relative') {
    selectedPreset.value = tr.relativeWindow
    absoluteFrom.value = null
    absoluteTo.value = null
  } else {
    selectedPreset.value = 'custom'
    absoluteFrom.value = tr.from ? new Date(tr.from) : null
    absoluteTo.value = tr.to ? new Date(tr.to) : null
  }
}, { deep: true })

const onPresetChange = () => {
  if (selectedPreset.value === 'custom') return
  dashboardStore.updateTimeRange({
    mode: 'relative',
    relativeWindow: selectedPreset.value as DashboardTimeRange['relativeWindow']
  })
}

watch([absoluteFrom, absoluteTo], () => {
  if (!absoluteFrom.value || !absoluteTo.value) return
  if (absoluteFrom.value >= absoluteTo.value) return
  dashboardStore.updateTimeRange({
    mode: 'absolute',
    relativeWindow: '24h',
    from: absoluteFrom.value.toISOString(),
    to: absoluteTo.value.toISOString()
  })
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";

.time-range-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-select { min-width: 160px; }
.date-input    { width: 160px; }
.separator     { color: var($secondary-text-on-surface); }
</style>
