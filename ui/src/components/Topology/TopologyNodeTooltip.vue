<template>
  <div
    v-if="tooltip"
    class="node-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="node-tooltip__header">
      <span class="node-tooltip__label">{{ tooltip.label }}</span>
      <span v-if="tooltip.ip" class="node-tooltip__ip">{{ tooltip.ip }}</span>
    </div>
    <template v-if="tooltip.ip">
      <div class="node-tooltip__chart">
        <PersesPanel
          :title="'Response Time'"
          :queries="[query]"
          :time-range="timeRange"
        />
      </div>
    </template>
    <div v-else class="node-tooltip__no-ip">No IP address recorded</div>
  </div>
</template>

<script setup lang="ts">
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSQuerySpec } from '@/datasource/opennms/types'
import PersesPanel from '@/components/Perses/PersesPanel.vue'

export interface NodeTooltipState {
  x: number
  y: number
  label: string
  nodeId: string
  ip: string | null
}

const props = defineProps<{ tooltip: NodeTooltipState | null }>()

const resourceId = computed(() =>
  props.tooltip ? `node[${props.tooltip.nodeId}].responseTime[${props.tooltip.ip}]` : ''
)

const query = computed<OpenNMSQuerySpec>(() => ({
  resourceId: resourceId.value,
  attribute: 'response-time',
  aggregation: 'AVERAGE',
  label: 'Response Time (ms)'
}))

const timeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date(Date.now() - 6 * 60 * 60 * 1000),
  end: new Date()
}))
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.node-tooltip {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  padding: 10px 12px 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 320px;
  transform: translate(16px, -50%);

  &__header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__ip {
    font-size: 0.75rem;
    font-family: monospace;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__chart {
    height: 120px;
    overflow: hidden;
  }

  &__no-ip {
    font-size: 0.78rem;
    color: var($secondary-text-on-surface);
    padding: 4px 0;
  }
}
</style>
