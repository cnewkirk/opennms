<template>
  <div class="resource-accordion">
    <div v-if="!groups.length" class="resource-accordion__empty caption">
      No resource categories available.
    </div>
    <ResourceTypeGroup
      v-for="group in groups"
      :key="group.typeLabel"
      :group="group"
      :time="time"
      :isPinned="isPinned"
      @toggle-pin="$emit('toggle-pin', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import ResourceTypeGroup from './ResourceTypeGroup.vue'
import type { ResourceGroup, HighlightItem } from '@/types/resourceGraphs'
import type { StartEndTime } from '@/types'

defineProps<{
  groups: ResourceGroup[]
  time: StartEndTime
  isPinned: (resourceId: string, definition: string) => boolean
}>()

defineEmits<{
  'toggle-pin': [item: HighlightItem]
}>()
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.resource-accordion {
  &__empty {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }
}
</style>
