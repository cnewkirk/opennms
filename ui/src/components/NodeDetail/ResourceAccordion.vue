<template>
  <div class="resource-accordion">
    <input
      v-model="filter"
      class="resource-accordion__filter"
      placeholder="Filter resources…"
      type="search"
    />
    <div v-if="!filteredGroups.length" class="resource-accordion__empty caption">
      No resource categories available.
    </div>
    <ResourceTypeGroup
      v-for="group in filteredGroups"
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

const props = defineProps<{
  groups: ResourceGroup[]
  time: StartEndTime
  isPinned: (resourceId: string, definition: string) => boolean
}>()

defineEmits<{
  'toggle-pin': [item: HighlightItem]
}>()

const filter = ref('')

const filteredGroups = computed(() => {
  if (!filter.value) return props.groups
  const q = filter.value.toLowerCase()
  return props.groups
    .map(g => ({
      ...g,
      resources: g.resources.filter(
        r => r.label.toLowerCase().includes(q) || g.typeLabel.toLowerCase().includes(q)
      )
    }))
    .filter(g => g.resources.length > 0)
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.resource-accordion {
  &__filter {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.875rem;
    outline: none;
    margin-bottom: 12px;
    &::placeholder { color: var($secondary-text-on-surface); }
    &:focus { border-color: var($primary); }
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }
}
</style>
