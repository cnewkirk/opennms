<template>
  <div class="config-form">
    <div class="field">
      <label for="ns-title">Widget Title</label>
      <InputText id="ns-title" v-model="draft.title" class="w-full" />
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
import API from '@/services'
import type { Category } from '@/types'
import type { NodeStatusWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: NodeStatusWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: NodeStatusWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
watch(draft, v => emit('update:modelValue', { ...v }), { deep: true })

const allCategories = ref<Category[]>([])
const categoryLoadError = ref(false)
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
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.w-full { width: 100%; }
</style>
