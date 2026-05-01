<template>
  <div class="config-form">
    <div class="field">
      <label for="avail-title">Widget Title</label>
      <InputText id="avail-title" v-model="draft.title" class="w-full" />
    </div>

    <div class="field">
      <label>Filter by Categories <span class="hint">(leave empty for all)</span></label>
      <MultiSelect
        v-model="draft.categories"
        :options="allCategories"
        option-label="name"
        option-value="name"
        placeholder="All categories"
        class="w-full"
        filter
      />
      <small v-if="categoryLoadError" class="hint">Could not load categories.</small>
    </div>

    <div class="field">
      <div class="field-row">
        <Checkbox v-model="useCustomTimeRange" binary input-id="avail-tr" />
        <label for="avail-tr" class="checkbox-label">Use custom time range</label>
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
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import API from '@/services'
import type { Category } from '@/types'
import type { AvailabilityWidgetConfig, RelativeWindow } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: AvailabilityWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: AvailabilityWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
const useCustomTimeRange = ref(!!draft.value.timeRange)
const localTimeRangeWindow = ref<RelativeWindow>(draft.value.timeRange?.relativeWindow ?? '24h')

watch([draft, useCustomTimeRange, localTimeRangeWindow], () => {
  const out: AvailabilityWidgetConfig = {
    ...draft.value,
    timeRange: useCustomTimeRange.value
      ? { mode: 'relative', relativeWindow: localTimeRangeWindow.value }
      : undefined
  }
  emit('update:modelValue', out)
}, { deep: true })

const allCategories = ref<Category[]>([])
const categoryLoadError = ref(false)
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

onMounted(async () => {
  const resp = await API.getCategories()
  if (resp) {
    allCategories.value = [...resp.category].sort((a, b) => a.name.localeCompare(b.name))
  } else {
    categoryLoadError.value = true
  }
})
</script>

<style scoped lang="scss">
@import "@/styles/tokens";
@import "@/styles/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-row { display: flex; align-items: center; gap: 8px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.checkbox-label { @include body-large; color: var($primary-text-on-surface); cursor: pointer; }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.w-full { width: 100%; }
</style>
