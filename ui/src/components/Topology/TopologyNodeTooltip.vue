<template>
  <div
    v-if="tooltip"
    class="node-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="node-tooltip__header">
      <span class="node-tooltip__label">{{ tooltip.label }}</span>
      <span
        class="node-tooltip__status"
        :class="isDown ? 'node-tooltip__status--down' : 'node-tooltip__status--up'"
      >{{ isDown ? 'DOWN' : 'UP' }}</span>
    </div>
    <span v-if="tooltip.ip" class="node-tooltip__ip">{{ tooltip.ip }}</span>
  </div>
</template>

<script setup lang="ts">
import { useWeathermapStore } from '@/stores/weathermapStore'

/**
 * State passed from useTopology via TopologyGraph → TopologyNodeTooltip.
 * Matches the inline NodeTooltipState interface in useTopology.ts (they must stay in sync).
 */
export interface NodeTooltipState {
  x: number
  y: number
  label: string
  /** Numeric node ID as a string — passed directly from the Cytoscape node data(). */
  nodeId: string
  /** Primary IP from the vertex (ipAddress field on the topology graph vertex). */
  ip: string | null
}

const props = defineProps<{ tooltip: NodeTooltipState | null }>()

const wmStore = useWeathermapStore()
const isDown = computed(() =>
  props.tooltip ? wmStore.nodeDownMap[Number(props.tooltip.nodeId)] === true : false
)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/styles/themes/variables";

.node-tooltip {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  padding: 8px 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  transform: translate(16px, -50%);

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__status {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: vars.$border-radius-xs;
    border: 1px solid;
    white-space: nowrap;
    flex-shrink: 0;

    &--up {
      color: var(--feather-success);
      border-color: var(--feather-success);
      background: utils.alpha(fvars.$success, 0.12);
    }

    &--down {
      color: var(--feather-error);
      border-color: var(--feather-error);
      background: utils.alpha(fvars.$error, 0.12);
    }
  }

  &__ip {
    font-size: 0.72rem;
    font-family: monospace;
    color: var($secondary-text-on-surface);
    display: block;
  }
}
</style>
