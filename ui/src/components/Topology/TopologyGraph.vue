<template>
  <div class="topology-graph">
    <div v-if="store.loading" class="topology-graph__loading">
      <FeatherSpinner />
      <span>Loading topology…</span>
    </div>
    <div v-else-if="store.error" class="topology-graph__error">
      {{ store.error }}
    </div>
    <div v-else-if="!store.loading && store.vertices.length === 0" class="topology-graph__empty">
      No nodes found for this layer.
    </div>
    <div ref="graphContainer" class="topology-graph__canvas" />
  </div>
</template>

<script setup lang="ts">
import { FeatherSpinner } from '@featherds/progress'
import useTopology from '@/composables/useTopology'
import { useTopologyStore } from '@/stores/topologyStore'

const store = useTopologyStore()
const graphContainer = ref<HTMLElement | null>(null)

useTopology(graphContainer)
</script>

<style lang="scss" scoped>
.topology-graph {
  flex: 1;
  position: relative;
  min-height: 0;

  &__canvas {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  &__loading,
  &__error,
  &__empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    z-index: 1;
  }
}
</style>
