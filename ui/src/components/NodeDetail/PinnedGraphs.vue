<template>
  <div class="pinned-graphs">
    <div v-if="!pinnedItems.length" class="pinned-graphs__empty caption">
      Pin graphs from the categories below to keep them here.
    </div>
    <template v-else>
      <div class="pinned-graphs__grid">
        <div
          v-for="item in pinnedItems"
          :key="`${item.resourceId}-${item.definition}`"
          class="pinned-graphs__cell"
        >
          <Graph
            :definition="item.definition"
            :resourceId="item.resourceId"
            :time="time"
            :label="item.label"
            :isSingleGraph="false"
            :pinnable="true"
            :pinned="true"
            @toggle-pin="$emit('toggle-pin', item)"
          />
        </div>
      </div>
      <div class="pinned-graphs__actions">
        <label v-if="hasPerNodePins" class="pinned-graphs__default-toggle">
          <input type="checkbox" @change="$emit('set-as-default')" />
          <span>Save as default for all nodes</span>
        </label>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Graph from '@/components/Resources/Graph.vue'
import type { HighlightItem } from '@/types/resourceGraphs'
import type { StartEndTime } from '@/types'

defineProps<{
  pinnedItems: HighlightItem[]
  time: StartEndTime
  hasPerNodePins: boolean
}>()

defineEmits<{
  'toggle-pin': [item: HighlightItem]
  'set-as-default': []
}>()
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.pinned-graphs {
  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    @media (max-width: 800px) {
      grid-template-columns: 1fr;
    }
  }

  &__cell {
    min-width: 0;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    padding: 8px 0 0;
  }

  &__default-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    input { cursor: pointer; }
    &:hover span { color: var($primary-text-on-surface); }
  }
}
</style>
