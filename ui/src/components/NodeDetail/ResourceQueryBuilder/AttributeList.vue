<!-- ui/src/components/NodeDetail/ResourceQueryBuilder/AttributeList.vue -->
<template>
  <div class="attribute-list">
    <div v-if="!resource" class="attribute-list__empty caption">
      Select a resource to see available attributes.
    </div>
    <template v-else>
      <div class="attribute-list__resource-label">{{ resource.label }}</div>
      <input
        v-model="filter"
        class="attribute-list__filter"
        placeholder="Filter attributes…"
        type="search"
      />
      <div v-if="!filteredAttributes.length" class="attribute-list__empty caption">
        No attributes match.
      </div>
      <div
        v-for="attr in filteredAttributes"
        :key="attr"
        class="attribute-list__item"
      >
        <span class="attribute-list__name">{{ attr }}</span>
        <button
          class="attribute-list__add"
          title="Add to chart"
          @click="addSeries(attr)"
        >+</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Resource } from '@/types'
import type { ChartSeries } from '@/types/resourceGraphs'

const props = defineProps<{ resource: Resource | null }>()

const emit = defineEmits<{
  'add-series': [series: Omit<ChartSeries, 'color'>]
}>()

const filter = ref('')

const attributes = computed(() =>
  props.resource ? Object.keys(props.resource.rrdGraphAttributes) : []
)

const filteredAttributes = computed(() => {
  if (!filter.value) return attributes.value
  const q = filter.value.toLowerCase()
  return attributes.value.filter(a => a.toLowerCase().includes(q))
})

const addSeries = (attr: string) => {
  if (!props.resource) return
  emit('add-series', {
    resourceId: props.resource.id,
    resourceLabel: props.resource.label,
    attribute: attr,
    aggregation: 'AVERAGE',
    label: attr
  })
  filter.value = ''
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.attribute-list {
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid var($border-on-surface);
  display: flex;
  flex-direction: column;

  &__resource-label {
    padding: 8px 12px;
    font-weight: 700;
    font-size: 0.8rem;
    color: var($secondary-text-on-surface);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var($border-on-surface);
    flex-shrink: 0;
  }

  &__filter {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border: none;
    border-bottom: 1px solid var($border-on-surface);
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.875rem;
    outline: none;
    flex-shrink: 0;
    &::placeholder { color: var($secondary-text-on-surface); }
  }

  &__item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var($border-light-on-surface);
    gap: 8px;
    &:hover { background: var($shade-4); }
  }

  &__name {
    flex: 1;
    font-family: monospace;
    font-size: 0.8rem;
    word-break: break-all;
  }

  &__add {
    background: none;
    border: 1.5px solid var($primary);
    border-radius: vars.$border-radius-xs;
    width: 22px;
    height: 22px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    color: var($primary);
    flex-shrink: 0;
    &:hover { background: var($shade-4); }
  }

  &__empty {
    padding: 16px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }
}
</style>
