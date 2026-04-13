<template>
  <div class="config-form">
    <div class="field">
      <label>Widget Title</label>
      <InputText v-model="draft.title" class="w-full" />
    </div>

    <!-- GraphSeriesBuilder is added in Task 8 -->
    <div class="field placeholder-note">
      Series builder coming soon — configure series after adding the widget.
    </div>

    <div class="field">
      <div class="field-row">
        <Checkbox v-model="draft.stack" binary input-id="graph-stack" />
        <label for="graph-stack" class="checkbox-label">Stack series</label>
      </div>
    </div>

    <div class="field">
      <div class="field-row">
        <Checkbox v-model="useCustomTimeRange" binary input-id="graph-tr" />
        <label for="graph-tr" class="checkbox-label">Use custom time range</label>
      </div>
    </div>

    <template v-if="useCustomTimeRange">
      <div class="field">
        <label>Window</label>
        <Select
          v-model="localTimeRangeWindow"
          :options="windowOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
    </template>

    <div class="field">
      <label>Refresh Interval</label>
      <Select
        v-model="draft.refreshInterval"
        :options="refreshOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import type { GraphWidgetConfig, RelativeWindow } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: GraphWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: GraphWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
const useCustomTimeRange = ref(!!draft.value.timeRange)
const localTimeRangeWindow = ref<RelativeWindow>(draft.value.timeRange?.relativeWindow ?? '24h')

watch([draft, useCustomTimeRange, localTimeRangeWindow], () => {
  emit('update:modelValue', {
    ...draft.value,
    timeRange: useCustomTimeRange.value
      ? { mode: 'relative', relativeWindow: localTimeRangeWindow.value }
      : undefined
  })
}, { deep: true })

const windowOptions = [
  { label: 'Last 1 hour',   value: '1h' },
  { label: 'Last 6 hours',  value: '6h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days',   value: '7d' },
  { label: 'Last 30 days',  value: '30d' }
]
const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute',   value: 60 },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 }
]
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-row { display: flex; align-items: center; gap: 8px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.checkbox-label { @include body-large; color: var($primary-text-on-surface); cursor: pointer; }
.placeholder-note { @include body-small; color: var($secondary-text-on-surface); font-style: italic; }
.w-full { width: 100%; }
</style>
