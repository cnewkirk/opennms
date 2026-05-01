<template>
  <div class="series-builder">
    <div
      v-for="(series, idx) in localSeries"
      :key="series.id"
      class="series-row"
    >
      <div class="series-row-top">
        <span class="series-num">{{ idx + 1 }}</span>

        <!-- Node picker -->
        <Select
          v-model="series.nodeId"
          :options="nodes"
          option-label="label"
          option-value="id"
          placeholder="Node…"
          filter
          class="series-select"
          @change="() => onNodeChange(series)"
        />

        <!-- Resource picker -->
        <Select
          v-model="series.resourceId"
          :options="resourcesFor[series.nodeId] ?? []"
          option-label="label"
          option-value="id"
          placeholder="Resource…"
          :disabled="!series.nodeId"
          filter
          class="series-select"
          @change="() => onResourceChange(series)"
        />

        <!-- Attribute picker -->
        <Select
          v-model="series.attribute"
          :options="attrsFor[series.resourceId] ?? []"
          placeholder="Attribute…"
          :disabled="!series.resourceId"
          class="series-select"
          @change="() => onAttrChange(series)"
        />

        <!-- Color -->
        <ColorPicker v-model="series.color" />

        <!-- Remove -->
        <Button
          text
          rounded
          severity="danger"
          size="small"
          @click="removeSeries(idx)"
        >
          <i class="pi pi-times" />
        </Button>
      </div>

      <!-- Label -->
      <InputText
        v-model="series.label"
        placeholder="Series label"
        class="series-label-input"
      />

      <!-- Advanced toggle -->
      <div class="advanced-toggle">
        <Button
          text
          size="small"
          @click="toggleAdvanced(series.id)"
        >
          <i :class="advancedOpen[series.id] ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
          Advanced
        </Button>
      </div>

      <Textarea
        v-if="advancedOpen[series.id]"
        v-model="series.expression"
        placeholder="CDEF/JEXL expression override (clears to use dropdowns)"
        class="expression-input"
        rows="2"
        auto-resize
      />
    </div>

    <Button
      text
      label="+ Add Series"
      @click="addSeries"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import { rest } from '@/services/axiosInstances'
import API from '@/services'
import type { GraphSeries } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: GraphSeries[] }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: GraphSeries[]): void }>()

// Deep copy so we can mutate locally
const localSeries = ref<GraphSeries[]>(props.modelValue.map(s => ({ ...s })))
const advancedOpen = ref<Record<string, boolean>>({})

// Cache node list, resources per nodeId, attributes per resourceId
const nodes = ref<{ id: string; label: string }[]>([])
const resourcesFor = ref<Record<string, { id: string; label: string }[]>>({})
const attrsFor     = ref<Record<string, string[]>>({})

onMounted(async () => {
  const resp = await API.getNodes({ limit: 1000 })
  if (resp) {
    nodes.value = resp.node.map(n => ({
      id: String(n.id),
      label: n.label ?? String(n.id)
    }))
  }
  // Pre-populate resource/attr caches for existing series
  for (const s of localSeries.value) {
    if (s.nodeId) await loadResources(s.nodeId)
    if (s.resourceId) await loadAttributes(s.resourceId)
  }
})

const loadResources = async (nodeId: string) => {
  if (resourcesFor.value[nodeId]) return
  try {
    const resp = await rest.get(`resources/fornode/${encodeURIComponent(nodeId)}`)
    const resources = resp.data?.children?.resource ?? []
    resourcesFor.value[nodeId] = resources.map((r: any) => ({
      id: r.id,
      label: r.label ?? r.id
    }))
  } catch {
    resourcesFor.value[nodeId] = []
  }
}

const loadAttributes = async (resourceId: string) => {
  if (attrsFor.value[resourceId]) return
  try {
    const resp = await rest.get(`resources/${encodeURIComponent(resourceId)}`)
    attrsFor.value[resourceId] = Object.keys(resp.data?.rrdGraphAttributes ?? {})
  } catch {
    attrsFor.value[resourceId] = []
  }
}

const onNodeChange = async (series: GraphSeries) => {
  series.resourceId = ''
  series.attribute = ''
  await loadResources(series.nodeId)
}

const onResourceChange = async (series: GraphSeries) => {
  series.attribute = ''
  await loadAttributes(series.resourceId)
}

const onAttrChange = (series: GraphSeries) => {
  if (!series.label || series.label === '') series.label = series.attribute
}

const toggleAdvanced = (id: string) => {
  advancedOpen.value[id] = !advancedOpen.value[id]
}

const addSeries = () => {
  const id = `series-${Date.now()}`
  localSeries.value.push({
    id,
    nodeId: '',
    resourceId: '',
    attribute: '',
    label: '',
    color: undefined,
    expression: undefined
  })
}

const removeSeries = (idx: number) => {
  localSeries.value.splice(idx, 1)
}

// Single emit path for all mutations — color, label (no handlers), and structural changes
// (node/resource/attribute/add/remove handlers mutate localSeries and rely on this watcher)
watch(localSeries, () => {
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}, { deep: true })
</script>

<style scoped lang="scss">
@import "@/styles/tokens";
@import "@featherds/styles/mixins/typography";

.series-builder { display: flex; flex-direction: column; gap: 12px; }

.series-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var($border-light-on-surface);
  border-radius: 6px;
}

.series-row-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.series-num {
  @include body-small;
  color: var($secondary-text-on-surface);
  min-width: 16px;
}

.series-select { min-width: 140px; flex: 1; }

.series-label-input { width: 100%; }

.advanced-toggle { align-self: flex-start; }

.expression-input { width: 100%; font-family: monospace; }
</style>
