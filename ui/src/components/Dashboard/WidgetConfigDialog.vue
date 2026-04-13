<template>
  <Dialog
    :visible="visible"
    header="Configure Widget"
    modal
    :style="{ minWidth: '420px', maxWidth: '560px' }"
    @update:visible="$emit('close')"
  >
    <SummaryWidgetConfigForm
      v-if="draft.type === 'summary'"
      :model-value="summaryDraft"
      @update:model-value="draft = $event"
    />
    <TableWidgetConfigForm
      v-else-if="draft.type === 'outages' || draft.type === 'alarms' || draft.type === 'nodes'"
      :model-value="tableDraft"
      @update:model-value="draft = $event"
    />
    <GraphWidgetConfigForm
      v-else-if="draft.type === 'graph'"
      :model-value="graphDraft"
      @update:model-value="draft = $event"
    />
    <NodeStatusWidgetConfigForm
      v-else-if="draft.type === 'node-status'"
      :model-value="nodeStatusDraft"
      @update:model-value="draft = $event"
    />
    <AvailabilityWidgetConfigForm
      v-else-if="draft.type === 'availability'"
      :model-value="availabilityDraft"
      @update:model-value="draft = $event"
    />

    <template #footer>
      <Button label="Cancel" text @click="$emit('close')" />
      <Button label="Save" @click="save" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import {
  type WidgetConfig,
  type SummaryWidgetConfig,
  type TableWidgetConfig,
  type GraphWidgetConfig,
  type NodeStatusWidgetConfig,
  type AvailabilityWidgetConfig
} from '@/services/dashboardConfigService'
import SummaryWidgetConfigForm      from './config/SummaryWidgetConfigForm.vue'
import TableWidgetConfigForm        from './config/TableWidgetConfigForm.vue'
import GraphWidgetConfigForm        from './config/GraphWidgetConfigForm.vue'
import NodeStatusWidgetConfigForm   from './config/NodeStatusWidgetConfigForm.vue'
import AvailabilityWidgetConfigForm from './config/AvailabilityWidgetConfigForm.vue'

const props = defineProps<{
  visible: boolean
  widgetConfig: WidgetConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', config: WidgetConfig): void
}>()

const draft = ref<WidgetConfig>({ ...props.widgetConfig })

watch(() => props.widgetConfig, cfg => { draft.value = { ...cfg } })

// Typed computed accessors — avoid TS cast in template expressions
const summaryDraft      = computed(() => draft.value as SummaryWidgetConfig)
const tableDraft        = computed(() => draft.value as TableWidgetConfig)
const graphDraft        = computed(() => draft.value as GraphWidgetConfig)
const nodeStatusDraft   = computed(() => draft.value as NodeStatusWidgetConfig)
const availabilityDraft = computed(() => draft.value as AvailabilityWidgetConfig)

const save = () => emit('save', { ...draft.value })
</script>
