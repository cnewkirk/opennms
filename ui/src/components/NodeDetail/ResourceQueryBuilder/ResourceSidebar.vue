<!-- ui/src/components/NodeDetail/ResourceQueryBuilder/ResourceSidebar.vue -->
<template>
  <div class="resource-sidebar">
    <input
      v-model="filter"
      class="resource-sidebar__filter"
      placeholder="Filter resources…"
      type="search"
    />
    <div v-if="!filteredGroups.length" class="resource-sidebar__empty caption">No resources.</div>
    <div
      v-for="group in filteredGroups"
      :key="group.typeLabel"
      class="resource-sidebar__group"
    >
      <button
        class="resource-sidebar__group-header"
        @click="toggleGroup(group.typeLabel)"
      >
        <span class="resource-sidebar__caret">{{ expanded.has(group.typeLabel) ? '▼' : '▶' }}</span>
        {{ group.typeLabel }}
        <span class="resource-sidebar__count">{{ group.resources.length }}</span>
      </button>
      <div v-if="expanded.has(group.typeLabel)" class="resource-sidebar__items">
        <button
          v-for="resource in group.resources"
          :key="resource.id"
          :class="['resource-sidebar__item', { 'resource-sidebar__item--active': selectedId === resource.id }]"
          @click="$emit('select-resource', resource)"
        >
          {{ resource.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Resource } from '@/types'

const props = defineProps<{
  resources: Resource[]
  selectedId: string | null
}>()

defineEmits<{ 'select-resource': [resource: Resource] }>()

interface ResourceGroup { typeLabel: string; resources: Resource[] }

const filter = ref('')
const expanded = ref(new Set<string>())

const groups = computed<ResourceGroup[]>(() => {
  const map = new Map<string, Resource[]>()
  for (const r of props.resources) {
    const list = map.get(r.typeLabel) ?? []
    map.set(r.typeLabel, [...list, r])
  }
  return Array.from(map.entries()).map(([typeLabel, resources]) => ({ typeLabel, resources }))
})

const filteredGroups = computed(() => {
  if (!filter.value) return groups.value
  const q = filter.value.toLowerCase()
  return groups.value
    .map(g => ({
      ...g,
      resources: g.resources.filter(
        r => r.label.toLowerCase().includes(q) || g.typeLabel.toLowerCase().includes(q)
      )
    }))
    .filter(g => g.resources.length > 0)
})

const toggleGroup = (typeLabel: string) => {
  const s = expanded.value
  if (s.has(typeLabel)) { s.delete(typeLabel); expanded.value = new Set(s) }
  else { expanded.value = new Set([...s, typeLabel]) }
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.resource-sidebar {
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid var($border-on-surface);
  display: flex;
  flex-direction: column;

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

  &__group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 12px;
    background: var($shade-4);
    border: none;
    border-bottom: 1px solid var($border-light-on-surface);
    text-align: left;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 700;
    color: var($secondary-text-on-surface);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    &:hover { filter: brightness(0.97); }
  }

  &__caret { font-size: 0.6rem; }
  &__count { margin-left: auto; font-weight: 400; }

  &__item {
    display: block;
    width: 100%;
    padding: 7px 20px;
    background: none;
    border: none;
    border-bottom: 1px solid var($border-light-on-surface);
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    color: var($primary-text-on-surface);
    &:hover { background: var($shade-4); }
    &--active {
      background: var($shade-4);
      color: var($primary);
      font-weight: 600;
    }
  }

  &__empty {
    padding: 16px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }
}
</style>
