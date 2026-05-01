<template>
  <div class="search-results">
    <div v-if="results.length" class="search-results__meta caption">
      {{ resultMeta }}
    </div>
    <div v-if="!results.length" class="search-results__empty caption">
      No graphs match "{{ query }}"
    </div>
    <div v-for="group in groupedResults" :key="group.resourceId" class="search-results__group">
      <div class="search-results__group-header">
        <span class="search-results__group-label">{{ group.resourceLabel }}</span>
        <span class="search-results__group-type">{{ group.typeLabel }}</span>
      </div>
      <div class="search-results__grid">
        <Graph
          v-for="item in group.items"
          :key="`${item.resourceId}-${item.definition}`"
          :definition="item.definition"
          :resourceId="item.resourceId"
          :time="time"
          :label="item.resourceLabel"
          :isSingleGraph="false"
          :pinnable="true"
          :pinned="isPinned(item.resourceId, item.definition)"
          @toggle-pin="$emit('toggle-pin', { resourceId: item.resourceId, definition: item.definition, label: item.resourceLabel })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Graph from '@/components/Resources/Graph.vue'
import type { SearchResultItem } from '@/composables/useResourceSearch'
import type { StartEndTime } from '@/types'
import type { HighlightItem } from '@/types/resourceGraphs'

const props = defineProps<{
  results: SearchResultItem[]
  query: string
  time: StartEndTime
  isPinned: (resourceId: string, definition: string) => boolean
  capped: boolean
}>()

defineEmits<{ 'toggle-pin': [item: HighlightItem] }>()

interface ResultGroup {
  resourceId: string
  resourceLabel: string
  typeLabel: string
  items: SearchResultItem[]
}

const groupedResults = computed<ResultGroup[]>(() => {
  const map = new Map<string, ResultGroup>()
  for (const item of props.results) {
    if (!map.has(item.resourceId)) {
      map.set(item.resourceId, {
        resourceId: item.resourceId,
        resourceLabel: item.resourceLabel,
        typeLabel: item.typeLabel,
        items: []
      })
    }
    map.get(item.resourceId)!.items.push(item)
  }
  return [...map.values()]
})

const resultMeta = computed(() => {
  const total = props.results.length
  const resourceCount = groupedResults.value.length
  const base = `${total} graph${total !== 1 ? 's' : ''} across ${resourceCount} resource${resourceCount !== 1 ? 's' : ''}`
  return props.capped ? `${base} — showing first 50, refine your search` : base
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.search-results {
  &__meta {
    color: var($secondary-text-on-surface);
    padding: 4px 0 12px;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__group {
    & + & { margin-top: 20px; }
  }

  &__group-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__group-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
  }

  &__group-type {
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    @media (max-width: 800px) {
      grid-template-columns: 1fr;
    }
  }
}
</style>
