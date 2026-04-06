<template>
  <div class="type-group">
    <!-- Type header -->
    <button class="type-group__header" @click="typeOpen = !typeOpen">
      <span class="type-group__caret">{{ typeOpen ? '▼' : '▶' }}</span>
      <span class="type-group__label">{{ group.typeLabel }}</span>
      <span class="type-group__count">{{ group.resources.length }}</span>
    </button>

    <!-- Resource list (level 1) -->
    <div v-if="typeOpen" class="type-group__resources">
      <div
        v-for="resource in group.resources"
        :key="resource.resourceId"
        class="type-group__resource"
      >
        <button
          class="type-group__resource-header"
          :class="{ 'type-group__resource-header--open': expandedResources.has(resource.resourceId) }"
          @click="toggleResource(resource.resourceId)"
        >
          <span class="type-group__resource-caret">{{ expandedResources.has(resource.resourceId) ? '▼' : '▶' }}</span>
          <span class="type-group__resource-label">{{ resource.label }}</span>
          <span class="type-group__resource-count">{{ resource.definitions.length }} graphs</span>
        </button>

        <!-- Graphs (level 2) -->
        <div v-if="expandedResources.has(resource.resourceId)" class="type-group__graphs">
          <div
            v-for="def in resource.definitions"
            :key="`${resource.resourceId}-${def}`"
            class="type-group__graph-cell"
          >
            <Graph
              :definition="def"
              :resourceId="resource.resourceId"
              :time="time"
              :label="resource.label"
              :isSingleGraph="false"
              :pinnable="true"
              :pinned="isPinned(resource.resourceId, def)"
              @toggle-pin="$emit('toggle-pin', { resourceId: resource.resourceId, definition: def, label: resource.label })"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Graph from '@/components/Resources/Graph.vue'
import type { ResourceGroup } from '@/types/resourceGraphs'
import type { StartEndTime } from '@/types'

defineProps<{
  group: ResourceGroup
  time: StartEndTime
  isPinned: (resourceId: string, definition: string) => boolean
}>()

defineEmits<{
  'toggle-pin': [item: { resourceId: string; definition: string; label: string }]
}>()

const typeOpen = ref(false)
const expandedResources = ref(new Set<string>())

const toggleResource = (resourceId: string) => {
  const s = new Set(expandedResources.value)
  if (s.has(resourceId)) { s.delete(resourceId) } else { s.add(resourceId) }
  expandedResources.value = s
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.type-group {
  border: 1px solid var($border-light-on-surface);
  border-radius: 4px;
  overflow: hidden;

  & + & { margin-top: 8px; }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    background: var($shade-4);
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    &:hover { filter: brightness(0.97); }
  }

  &__caret { font-size: 0.625rem; color: var($secondary-text-on-surface); }
  &__label { flex: 1; }
  &__count {
    font-weight: 400;
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
  }

  &__resources {
    border-top: 1px solid var($border-light-on-surface);
  }

  &__resource-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 14px 8px 24px;
    background: var($surface);
    border: none;
    border-bottom: 1px solid var($border-light-on-surface);
    text-align: left;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var($primary-text-on-surface);
    &:hover { background: var($shade-4); }
    &--open { font-weight: 600; }
  }

  &__resource-caret { font-size: 0.5625rem; color: var($secondary-text-on-surface); }
  &__resource-label { flex: 1; }
  &__resource-count {
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
  }

  &__graphs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 12px 14px 12px 24px;
    background: var($background);
    border-bottom: 1px solid var($border-light-on-surface);

    @media (max-width: 800px) {
      grid-template-columns: 1fr;
    }
  }

  &__graph-cell {
    min-width: 0;
  }
}
</style>
