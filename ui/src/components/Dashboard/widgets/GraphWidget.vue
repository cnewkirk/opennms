<template>
  <div class="graph-widget">
    <PersesPanel
      v-if="validSeries.length > 0"
      :title="config.title"
      :queries="queries"
      :time-range="persesTimeRange"
    />
    <div
      v-else
      class="empty-state"
    >
      No series configured. Click the settings icon to add data series.
    </div>
  </div>
</template>

<script setup lang="ts">
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { useDashboardStore } from '@/stores/dashboardStore'
import { resolveTimeRange, type GraphWidgetConfig } from '@/services/dashboardConfigService'
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSBatchQuerySpec } from '@/datasource/opennms'

const props = defineProps<{ config: GraphWidgetConfig }>()

const dashboardStore = useDashboardStore()

const validSeries = computed(() =>
  props.config.series.filter(s => s.nodeId && s.resourceId && s.attribute)
)

const effectiveTimeRange = computed(() => {
  const tr = props.config.timeRange ?? dashboardStore.timeRange
  return resolveTimeRange(tr)
})

// AbsoluteTimeRange from @perses-dev/core requires { start: Date; end: Date }
const persesTimeRange = computed<AbsoluteTimeRange>(() => ({
  start: effectiveTimeRange.value.start,
  end:   effectiveTimeRange.value.end
}))

const queries = computed((): Array<OpenNMSBatchQuerySpec> => {
  if (validSeries.value.length === 0) return []

  const batchSpec: OpenNMSBatchQuerySpec = {
    batch: true,
    sources: validSeries.value.map(s => ({
      resourceId:  s.resourceId,
      attribute:   s.attribute,
      aggregation: 'AVERAGE' as const,
      label:       s.label || s.attribute,
      transient:   false
    })),
    expressions: validSeries.value
      .filter(s => s.expression)
      .map(s => ({
        value:     s.expression!,
        label:     s.label || s.attribute,
        transient: false
      }))
  }

  return [batchSpec]
})

const refresh = () => { /* PersesPanel re-fetches when queries/timeRange props change */ }
defineExpose({ refresh })
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.graph-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  @include body-large;
  color: var($secondary-text-on-surface);
  padding: 24px;
  text-align: center;
}
</style>
