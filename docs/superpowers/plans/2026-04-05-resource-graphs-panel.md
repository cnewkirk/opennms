# Resource Graphs Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a resource graphs panel into the node detail page with a pre-fab highlights section and a Grafana-like query builder for composing custom charts from any available metric.

**Architecture:** A new `ResourceGraphsPanel.vue` (under `components/NodeDetail/`) owns global time range state and composes three sections: pre-fab highlights (using existing `Graph.vue`), saved charts (read from localStorage), and a query builder (resource sidebar → attribute list → PersesPanel charts). A `useResourceGraphs(nodeId)` composable fetches the resource tree and pre-fab graph definitions, and manages localStorage persistence via a typed `SavedChart` contract.

**Tech Stack:** Vue 3 + Composition API (auto-imports: `ref`, `computed`, `watch`), Pinia (graphStore for `Graph.vue`), `PersesPanel.vue` + `OpenNMSQuerySpec` for custom chart rendering, `uuid` v4 for chart IDs, Feather DS SCSS tokens, Vitest + Vue Test Utils for tests.

---

## File Map

| File | Role |
|------|------|
| `ui/src/types/resourceGraphs.ts` | `ChartSeries`, `SavedChart`, `HighlightItem`, `SERIES_PALETTE` |
| `ui/src/composables/useResourceGraphs.ts` | Fetch resources + pre-fab graphs; localStorage CRUD |
| `ui/tests/composables/useResourceGraphs.test.ts` | Composable test |
| `ui/src/components/NodeDetail/ResourceGraphsPanel.vue` | Panel container; time range state |
| `ui/src/components/NodeDetail/ResourceHighlights.vue` | Pre-fab graph grid |
| `ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue` | Orchestrates sidebar + attribute list + charts |
| `ui/src/components/NodeDetail/ResourceQueryBuilder/ResourceSidebar.vue` | Resource tree browser |
| `ui/src/components/NodeDetail/ResourceQueryBuilder/AttributeList.vue` | Attribute picker per resource |
| `ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue` | Single chart (editable + view modes) |
| `ui/src/containers/NodeDetails.vue` | **Modify:** add `<ResourceGraphsPanel>` below OutagesTable |

---

## Task 1: Types

**Files:**
- Create: `ui/src/types/resourceGraphs.ts`

- [ ] **Step 1: Create the types file**

```typescript
// ui/src/types/resourceGraphs.ts

export const SERIES_PALETTE = [
  '#1976d2', '#2e7d32', '#f57c00', '#c62828',
  '#6a1b9a', '#00838f', '#558b2f', '#4527a0'
]

export interface ChartSeries {
  resourceId: string
  resourceLabel: string
  attribute: string
  aggregation: 'AVERAGE' | 'MIN' | 'MAX'
  label: string
  color: string
}

export interface SavedChart {
  id: string                                   // uuid v4
  nodeId: string
  title: string
  series: ChartSeries[]
  timeRange?: { start: number; end: number }   // undefined = inherit global (ms epoch)
  createdAt: number                            // ms epoch
}

export interface HighlightItem {
  resourceId: string
  definition: string   // pre-fab graph name, e.g. "nodeSnmp.cpuPercentage"
  label: string        // resource label for display
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/types/resourceGraphs.ts
git commit -m "feat(resource-graphs): add ChartSeries, SavedChart, HighlightItem types"
```

---

## Task 2: `useResourceGraphs` Composable

**Files:**
- Create: `ui/src/composables/useResourceGraphs.ts`
- Create: `ui/tests/composables/useResourceGraphs.test.ts`

**Context:** `getResourceForNode(nodeId)` returns the node's top-level `Resource` with children in `.children.resource[]`. Each child has `rrdGraphAttributes` (attribute keys for the sidebar) and an `id` used to fetch applicable graph definition names via `getGraphDefinitionsByResourceId`. The composable builds `HighlightItem[]` from those definition names — one item per (resourceId, definitionName) pair. `savedCharts` is read from `localStorage.getItem('resource-charts:{nodeId}')` synchronously on init, and written on every save/delete.

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/composables/useResourceGraphs.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import useResourceGraphs from '@/composables/useResourceGraphs'
import * as resourceService from '@/services/resourceService'
import * as graphService from '@/services/graphService'
import type { Resource, ResourceDefinitionsApiResponse } from '@/types'
import type { SavedChart } from '@/types/resourceGraphs'

const mockChild: Resource = {
  id: 'node[1].nodeSnmp[]', label: 'SNMP Node Data', name: 'nodeSnmp',
  typeLabel: 'SNMP Node Data', parentId: 'node[1]', link: '',
  rrdGraphAttributes: { cpuRawUser: {}, memAvailReal: {} },
  externalValueAttributes: {}, stringPropertyAttributes: {}
}

const mockTopResource: Resource = {
  id: 'node[1]', label: 'node1', name: 'node[1]',
  typeLabel: 'Node', parentId: null, link: '',
  rrdGraphAttributes: {}, externalValueAttributes: {}, stringPropertyAttributes: {},
  children: { resource: [mockChild], count: 1, offset: 0, totalCount: 1 }
}

const mockDefs: ResourceDefinitionsApiResponse = {
  name: ['nodeSnmp.cpuPercentage', 'nodeSnmp.memoryUsage'],
  count: 2, offset: 0, totalCount: 2
}

describe('useResourceGraphs', () => {
  beforeEach(() => {
    createTestingPinia()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  test('fetches resources and builds highlights', async () => {
    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))

    expect(wrapper.vm.loading).toBe(true)
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.vm.error).toBeNull()
    expect(wrapper.vm.resources).toHaveLength(1)
    expect(wrapper.vm.resources[0].id).toBe('node[1].nodeSnmp[]')
    expect(wrapper.vm.highlights).toEqual([
      { resourceId: 'node[1].nodeSnmp[]', definition: 'nodeSnmp.cpuPercentage', label: 'SNMP Node Data' },
      { resourceId: 'node[1].nodeSnmp[]', definition: 'nodeSnmp.memoryUsage',   label: 'SNMP Node Data' }
    ])
  })

  test('sets error when resource fetch fails', async () => {
    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(null)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.error).toBe('Could not load resources for this node')
    expect(wrapper.vm.resources).toHaveLength(0)
    expect(wrapper.vm.highlights).toHaveLength(0)
  })

  test('saveChart appends to savedCharts and writes localStorage', async () => {
    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    const chart: SavedChart = { id: 'abc', nodeId: '1', title: 'My Chart', series: [], createdAt: 1000 }
    wrapper.vm.saveChart(chart)

    expect(wrapper.vm.savedCharts).toHaveLength(1)
    expect(wrapper.vm.savedCharts[0].id).toBe('abc')
    const stored = JSON.parse(localStorage.getItem('resource-charts:1') ?? '[]')
    expect(stored[0].id).toBe('abc')
  })

  test('deleteChart removes from savedCharts and localStorage', async () => {
    const chart: SavedChart = { id: 'abc', nodeId: '1', title: 'My Chart', series: [], createdAt: 1000 }
    localStorage.setItem('resource-charts:1', JSON.stringify([chart]))

    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.savedCharts).toHaveLength(1)
    wrapper.vm.deleteChart('abc')
    expect(wrapper.vm.savedCharts).toHaveLength(0)
    const stored = JSON.parse(localStorage.getItem('resource-charts:1') ?? '[]')
    expect(stored).toHaveLength(0)
  })

  test('loads saved charts from localStorage synchronously on init', () => {
    const chart: SavedChart = { id: 'xyz', nodeId: '1', title: 'Saved', series: [], createdAt: 500 }
    localStorage.setItem('resource-charts:1', JSON.stringify([chart]))

    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))

    // savedCharts is populated synchronously before the async fetch
    expect(wrapper.vm.savedCharts).toHaveLength(1)
    expect(wrapper.vm.savedCharts[0].id).toBe('xyz')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ui && pnpm test run tests/composables/useResourceGraphs.test.ts
```

Expected: FAIL — "Cannot find module '@/composables/useResourceGraphs'"

- [ ] **Step 3: Implement the composable**

```typescript
// ui/src/composables/useResourceGraphs.ts
import { getResourceForNode } from '@/services/resourceService'
import { getGraphDefinitionsByResourceId } from '@/services/graphService'
import type { Resource } from '@/types'
import type { SavedChart, HighlightItem } from '@/types/resourceGraphs'

const storageKey = (nodeId: string) => `resource-charts:${nodeId}`

const useResourceGraphs = (nodeId: string) => {
  const resources = ref<Resource[]>([])
  const highlights = ref<HighlightItem[]>([])
  const savedCharts = ref<SavedChart[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  // Load saved charts synchronously on init
  try {
    const raw = localStorage.getItem(storageKey(nodeId))
    savedCharts.value = raw ? JSON.parse(raw) : []
  } catch {
    savedCharts.value = []
  }

  const persistSaved = () => {
    localStorage.setItem(storageKey(nodeId), JSON.stringify(savedCharts.value))
  }

  const fetch = async () => {
    loading.value = true
    error.value = null

    const topResource = await getResourceForNode(nodeId)
    if (!topResource) {
      error.value = 'Could not load resources for this node'
      loading.value = false
      return
    }

    const children = topResource.children?.resource ?? []
    resources.value = children

    const defResults = await Promise.all(
      children.map(async (r) => {
        const resp = await getGraphDefinitionsByResourceId(r.id)
        return { resourceId: r.id, label: r.label, definitions: resp.name ?? [] }
      })
    )

    highlights.value = defResults.flatMap(r =>
      r.definitions.map(def => ({
        resourceId: r.resourceId,
        definition: def,
        label: r.label
      }))
    )

    loading.value = false
  }

  const saveChart = (chart: SavedChart) => {
    savedCharts.value = [...savedCharts.value, chart]
    persistSaved()
  }

  const deleteChart = (id: string) => {
    savedCharts.value = savedCharts.value.filter(c => c.id !== id)
    persistSaved()
  }

  fetch()

  return { resources, highlights, savedCharts, loading, error, saveChart, deleteChart, refresh: fetch }
}

export default useResourceGraphs
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ui && pnpm test run tests/composables/useResourceGraphs.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/useResourceGraphs.ts ui/tests/composables/useResourceGraphs.test.ts
git commit -m "feat(resource-graphs): add useResourceGraphs composable with localStorage persistence"
```

---

## Task 3: `ResourceHighlights.vue`

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceHighlights.vue`

**Context:** Uses existing `Graph.vue` (`ui/src/components/Resources/Graph.vue`) which handles `RrdGraphConverter` + `PersesPanel` internally. `Graph.vue` needs `definition` (graph name), `resourceId`, `time` (StartEndTime with unix **seconds**), `label`, and `isSingleGraph`. Setting `isSingleGraph=false` shows an "Open" link that navigates to the full standalone graph page — useful here.

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/NodeDetail/ResourceHighlights.vue -->
<template>
  <div class="resource-highlights">
    <div v-if="loading" class="resource-highlights__empty caption">Loading graphs…</div>
    <div v-else-if="!highlights.length" class="resource-highlights__empty caption">
      No performance graphs available for this node.
    </div>
    <template v-else>
      <div class="resource-highlights__grid">
        <div
          v-for="item in visibleHighlights"
          :key="`${item.resourceId}-${item.definition}`"
          class="resource-highlights__cell"
        >
          <Graph
            :definition="item.definition"
            :resourceId="item.resourceId"
            :time="time"
            :label="item.label"
            :isSingleGraph="false"
          />
        </div>
      </div>
      <button
        v-if="highlights.length > INITIAL_COUNT"
        class="resource-highlights__toggle"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show fewer' : `Show all ${highlights.length} graphs` }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import Graph from '@/components/Resources/Graph.vue'
import type { HighlightItem } from '@/types/resourceGraphs'
import type { StartEndTime } from '@/types'

const props = defineProps<{
  highlights: HighlightItem[]
  time: StartEndTime
  loading: boolean
}>()

const INITIAL_COUNT = 4
const showAll = ref(false)
const visibleHighlights = computed(() =>
  showAll.value ? props.highlights : props.highlights.slice(0, INITIAL_COUNT)
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.resource-highlights {
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

  &__toggle {
    display: block;
    margin: 14px auto 0;
    background: none;
    border: none;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 4px 8px;
    &:hover { text-decoration: underline; }
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceHighlights.vue
git commit -m "feat(resource-graphs): add ResourceHighlights grid component"
```

---

## Task 4: `ResourceSidebar.vue`

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceQueryBuilder/ResourceSidebar.vue`

**Context:** Resources are grouped by `typeLabel` (e.g. "SNMP Node Data", "Response Time", "SNMP Interface Data"). Clicking a group header toggles its expansion; clicking a resource item emits `select-resource`. The filter hides groups/resources whose label doesn't match.

- [ ] **Step 1: Create the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceQueryBuilder/ResourceSidebar.vue
git commit -m "feat(resource-graphs): add ResourceSidebar collapsible resource tree"
```

---

## Task 5: `AttributeList.vue`

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceQueryBuilder/AttributeList.vue`

**Context:** `resource.rrdGraphAttributes` is `Record<string, unknown>` — the keys are the attribute names available for that resource (e.g. `cpuRawUser`, `ifHCInOctets`). Clicking `+` emits `add-series` with a partial `ChartSeries` (no `color` — the parent QueryBuilder assigns color from the palette). Default aggregation is `AVERAGE`.

- [ ] **Step 1: Create the component**

```vue
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
    border-radius: 3px;
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
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceQueryBuilder/AttributeList.vue
git commit -m "feat(resource-graphs): add AttributeList attribute picker"
```

---

## Task 6: `CustomChart.vue`

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue`

**Context:** Used in two modes controlled by the `editable` prop. When `editable=true` (in the query builder): shows series list, aggregation pickers, color swatches, time override toggle, and a Save button. When `editable=false` (in the saved charts section): shows only the chart with Edit and Delete buttons.

`PersesPanel` requires `queries: OpenNMSQuerySpec[]` and `timeRange: AbsoluteTimeRange` (Date objects). `AbsoluteTimeRange` comes from `@perses-dev/core`. The panel's internal time range is in ms; we convert to Date for PersesPanel.

The `series` prop is owned by the parent (QueryBuilder or ResourceGraphsPanel). To update aggregation or cycle colors, this component emits `update-series` with a full replacement array. The parent replaces its state, which flows back down via the prop.

The `SERIES_PALETTE` and `v4` are imported from `@/types/resourceGraphs` and `uuid` respectively.

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue -->
<template>
  <div :class="['custom-chart', { 'custom-chart--view': !editable }]">
    <!-- Header -->
    <div class="custom-chart__header">
      <input
        v-if="editable"
        v-model="localTitle"
        class="custom-chart__title-input"
        placeholder="Chart title…"
      />
      <span v-else class="custom-chart__title-text">{{ title }}</span>
      <div class="custom-chart__header-actions">
        <button v-if="!editable" class="custom-chart__btn" @click="$emit('edit')">Edit</button>
        <button v-if="!editable" class="custom-chart__btn custom-chart__btn--danger" @click="$emit('delete')">Delete</button>
        <button
          v-if="editable"
          class="custom-chart__btn custom-chart__btn--primary"
          :disabled="!series.length"
          @click="doSave"
        >Save</button>
      </div>
    </div>

    <!-- Chart area -->
    <div class="custom-chart__body">
      <div v-if="!series.length" class="custom-chart__empty caption">
        Use the sidebar to add metrics.
      </div>
      <div v-else class="custom-chart__panel-wrapper">
        <PersesPanel
          :title="localTitle || 'Custom Chart'"
          :queries="queries"
          :time-range="absoluteTimeRange"
          :series-overrides="seriesOverrides"
        />
      </div>

      <!-- Series list (editable mode only) -->
      <div v-if="series.length && editable" class="custom-chart__series-section">
        <div
          v-for="(s, i) in series"
          :key="i"
          class="custom-chart__series-row"
        >
          <span class="custom-chart__series-resource" :title="s.resourceId">{{ s.resourceLabel }}</span>
          <span class="custom-chart__series-attr">{{ s.attribute }}</span>
          <select
            :value="s.aggregation"
            class="custom-chart__agg"
            @change="updateAggregation(i, ($event.target as HTMLSelectElement).value as 'AVERAGE' | 'MIN' | 'MAX')"
          >
            <option value="AVERAGE">AVG</option>
            <option value="MIN">MIN</option>
            <option value="MAX">MAX</option>
          </select>
          <span
            class="custom-chart__swatch"
            :style="{ background: s.color }"
            :title="`Color: ${s.color} (click to cycle)`"
            @click="cycleColor(i)"
          />
          <button class="custom-chart__remove" title="Remove series" @click="removeSeries(i)">✕</button>
        </div>

        <!-- Time override -->
        <div class="custom-chart__time-row">
          <label class="custom-chart__override-label">
            <input type="checkbox" v-model="useTimeOverride" />
            Override time range
          </label>
          <template v-if="useTimeOverride">
            <input type="datetime-local" v-model="overrideStart" class="custom-chart__dt" />
            <span class="custom-chart__dt-sep">–</span>
            <input type="datetime-local" v-model="overrideEnd" class="custom-chart__dt" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import type { OpenNMSQuerySpec } from '@/datasource/opennms'
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { ChartSeries, SavedChart } from '@/types/resourceGraphs'
import { SERIES_PALETTE } from '@/types/resourceGraphs'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps<{
  series: ChartSeries[]
  title: string
  timeRange: { start: number; end: number }
  nodeId: string
  editable?: boolean
}>()

const emit = defineEmits<{
  'update-series': [series: ChartSeries[]]
  'edit': []
  'delete': []
  'save': [chart: SavedChart]
}>()

const localTitle = ref(props.title)

// Time override
const useTimeOverride = ref(false)
const toLocalDT = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const overrideStart = ref(toLocalDT(props.timeRange.start))
const overrideEnd = ref(toLocalDT(props.timeRange.end))

// Keep override inputs in sync when parent time range changes (if no override active)
watch(() => props.timeRange, (tr) => {
  if (!useTimeOverride.value) {
    overrideStart.value = toLocalDT(tr.start)
    overrideEnd.value = toLocalDT(tr.end)
  }
})

const effectiveRange = computed<{ start: number; end: number }>(() => {
  if (useTimeOverride.value) {
    return {
      start: new Date(overrideStart.value).getTime(),
      end: new Date(overrideEnd.value).getTime()
    }
  }
  return props.timeRange
})

const absoluteTimeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date(effectiveRange.value.start),
  end: new Date(effectiveRange.value.end)
}))

const queries = computed<OpenNMSQuerySpec[]>(() =>
  props.series.map(s => ({
    resourceId: s.resourceId,
    attribute: s.attribute,
    aggregation: s.aggregation,
    label: s.label
  }))
)

const seriesOverrides = computed(() =>
  props.series.map(s => ({ name: s.label, color: s.color }))
)

// Series mutations — emit full replacement array to parent
const removeSeries = (i: number) => {
  emit('update-series', props.series.filter((_, idx) => idx !== i))
}

const updateAggregation = (i: number, agg: 'AVERAGE' | 'MIN' | 'MAX') => {
  emit('update-series', props.series.map((s, idx) => idx === i ? { ...s, aggregation: agg } : s))
}

const cycleColor = (i: number) => {
  const current = SERIES_PALETTE.indexOf(props.series[i].color)
  const nextColor = SERIES_PALETTE[(current + 1) % SERIES_PALETTE.length]
  emit('update-series', props.series.map((s, idx) => idx === i ? { ...s, color: nextColor } : s))
}

const doSave = () => {
  const chart: SavedChart = {
    id: uuidv4(),
    nodeId: props.nodeId,
    title: localTitle.value || 'Custom Chart',
    series: [...props.series],
    timeRange: useTimeOverride.value ? { ...effectiveRange.value } : undefined,
    createdAt: Date.now()
  }
  emit('save', chart)
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.custom-chart {
  @include elevation(1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    background: var($shade-4);
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title-input {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 1.5px solid var($border-on-surface);
    color: var($primary-text-on-surface);
    font-size: 0.95rem;
    font-weight: 600;
    outline: none;
    padding: 2px 4px;
    &:focus { border-bottom-color: var($primary); }
  }

  &__title-text {
    flex: 1;
    font-size: 0.95rem;
    font-weight: 600;
  }

  &__header-actions { display: flex; gap: 8px; }

  &__btn {
    padding: 4px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    cursor: pointer;
    font-size: 0.8rem;
    &:hover { background: var($shade-4); }
    &--primary { color: var($primary); border-color: var($primary); font-weight: 600; }
    &--primary:disabled { opacity: 0.4; cursor: not-allowed; }
    &--danger { color: var(--feather-error); border-color: var(--feather-error); }
    &--danger:hover { background: rgba(var(--feather-error-r), var(--feather-error-g), var(--feather-error-b), 0.08); }
  }

  &__body { padding: 14px; }

  &__panel-wrapper { height: 300px; margin-bottom: 12px; }

  &__empty {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__series-section {
    border-top: 1px solid var($border-light-on-surface);
    padding-top: 10px;
  }

  &__series-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var($border-light-on-surface);
    font-size: 0.8rem;
  }

  &__series-resource {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__series-attr {
    flex: 1;
    font-family: monospace;
    font-size: 0.8rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__agg {
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    padding: 2px 4px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  &__swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    cursor: pointer;
    border: 1px solid var($border-on-surface);
    flex-shrink: 0;
    &:hover { transform: scale(1.2); }
  }

  &__remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    font-size: 0.75rem;
    padding: 0 4px;
    flex-shrink: 0;
    &:hover { color: var(--feather-error); }
  }

  &__time-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var($border-light-on-surface);
    font-size: 0.8rem;
  }

  &__override-label {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    white-space: nowrap;
  }

  &__dt {
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    padding: 3px 6px;
    font-size: 0.75rem;
  }

  &__dt-sep { color: var($secondary-text-on-surface); }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue
git commit -m "feat(resource-graphs): add CustomChart component with Perses rendering and series management"
```

---

## Task 7: `QueryBuilder.vue`

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue`

**Context:** Owns `activeCharts` — an array of in-progress (unsaved) charts. Coordinates `ResourceSidebar` → `AttributeList` → `CustomChart`. When `AttributeList` emits `add-series`, it appends to the last active chart with an auto-assigned palette color. When a `CustomChart` emits `save`, it removes that chart from the active list (auto-creates a new empty one if the list would be empty) and re-emits `save-chart` to the parent panel. Exposes `loadChart(chart: SavedChart)` so `ResourceGraphsPanel` can re-load a saved chart into the builder for editing.

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue -->
<template>
  <div class="query-builder">
    <div class="query-builder__layout">
      <!-- Left: resource tree -->
      <ResourceSidebar
        class="query-builder__sidebar"
        :resources="resources"
        :selected-id="selectedResourceId"
        @select-resource="onSelectResource"
      />

      <!-- Middle: attribute list -->
      <AttributeList
        class="query-builder__attrs"
        :resource="selectedResource"
        @add-series="onAddSeries"
      />

      <!-- Right: charts -->
      <div class="query-builder__charts">
        <CustomChart
          v-for="(chart, i) in activeCharts"
          :key="chart.id"
          :series="chart.series"
          :title="chart.title"
          :time-range="timeRange"
          :node-id="nodeId"
          :editable="true"
          @update-series="(s) => updateSeries(i, s)"
          @save="(saved) => onSave(i, saved)"
        />
        <button class="query-builder__add-chart" @click="addChart">+ Add chart</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ResourceSidebar from './ResourceSidebar.vue'
import AttributeList from './AttributeList.vue'
import CustomChart from './CustomChart.vue'
import type { Resource } from '@/types'
import type { ChartSeries, SavedChart } from '@/types/resourceGraphs'
import { SERIES_PALETTE } from '@/types/resourceGraphs'
import { v4 as uuidv4 } from 'uuid'

interface ActiveChart {
  id: string
  title: string
  series: ChartSeries[]
}

const props = defineProps<{
  resources: Resource[]
  timeRange: { start: number; end: number }
  nodeId: string
}>()

const emit = defineEmits<{ 'save-chart': [chart: SavedChart] }>()

const selectedResourceId = ref<string | null>(null)
const selectedResource = computed(
  () => props.resources.find(r => r.id === selectedResourceId.value) ?? null
)

const makeEmptyChart = (): ActiveChart => ({
  id: uuidv4(),
  title: 'Custom Chart',
  series: []
})

const activeCharts = ref<ActiveChart[]>([makeEmptyChart()])

const onSelectResource = (resource: Resource) => {
  selectedResourceId.value = resource.id
}

const onAddSeries = (partial: Omit<ChartSeries, 'color'>) => {
  const last = activeCharts.value[activeCharts.value.length - 1]
  const color = SERIES_PALETTE[last.series.length % SERIES_PALETTE.length]
  last.series = [...last.series, { ...partial, color }]
}

const updateSeries = (chartIdx: number, newSeries: ChartSeries[]) => {
  activeCharts.value[chartIdx].series = newSeries
}

const addChart = () => {
  activeCharts.value.push(makeEmptyChart())
}

const onSave = (chartIdx: number, saved: SavedChart) => {
  activeCharts.value.splice(chartIdx, 1)
  if (activeCharts.value.length === 0) {
    activeCharts.value.push(makeEmptyChart())
  }
  emit('save-chart', saved)
}

// Called by ResourceGraphsPanel when user clicks "Edit" on a saved chart
const loadChart = (chart: SavedChart) => {
  activeCharts.value.push({
    id: uuidv4(),
    title: chart.title,
    series: [...chart.series]
  })
  // Scroll to bottom of panel so the new chart is visible
  nextTick(() => {
    const el = document.querySelector('.query-builder__add-chart')
    el?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

defineExpose({ loadChart })
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.query-builder {
  &__layout {
    display: grid;
    grid-template-columns: 200px 200px 1fr;
    min-height: 480px;
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    overflow: hidden;
  }

  &__sidebar,
  &__attrs {
    // These components have their own border-right
    min-height: 480px;
  }

  &__charts {
    padding: 14px;
    overflow-y: auto;
  }

  &__add-chart {
    display: block;
    width: 100%;
    padding: 10px;
    background: none;
    border: 1.5px dashed var($border-on-surface);
    border-radius: 4px;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.875rem;
    text-align: center;
    &:hover { background: var($shade-4); border-color: var($primary); }
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue
git commit -m "feat(resource-graphs): add QueryBuilder orchestrating sidebar, attribute list, and charts"
```

---

## Task 8: `ResourceGraphsPanel.vue`

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue`

**Context:** Owns the global `{ start, end }` time range (ms epoch). Converts it to `StartEndTime` (unix **seconds**) for `ResourceHighlights` → `Graph.vue`, since `Graph.vue` multiplies by 1000 internally. Holds a ref to `QueryBuilder` to call its `loadChart` method when a user edits a saved chart (which first deletes it from saved, then pushes it into the active builder list). Uses `date-fns` `sub` and `getUnixTime`, already installed in the project.

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/NodeDetail/ResourceGraphsPanel.vue -->
<template>
  <div class="card resource-graphs-panel">
    <div class="feather-row resource-graphs-panel__header">
      <div class="feather-col-12 headline3">Resource Graphs</div>
    </div>

    <!-- Global time range picker -->
    <div class="resource-graphs-panel__time-bar">
      <button
        v-for="preset in PRESETS"
        :key="preset.label"
        :class="['resource-graphs-panel__preset', { 'resource-graphs-panel__preset--active': activePreset === preset.label }]"
        @click="applyPreset(preset)"
      >{{ preset.label }}</button>
      <button
        :class="['resource-graphs-panel__preset', { 'resource-graphs-panel__preset--active': activePreset === 'custom' }]"
        @click="showCustom = !showCustom"
      >Custom</button>
      <template v-if="showCustom">
        <input type="datetime-local" v-model="customStart" class="resource-graphs-panel__dt" />
        <span class="resource-graphs-panel__dt-sep">–</span>
        <input type="datetime-local" v-model="customEnd" class="resource-graphs-panel__dt" />
        <button class="resource-graphs-panel__apply" @click="applyCustom">Apply</button>
      </template>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="resource-graphs-panel__loading caption">Loading resources…</div>
    <div v-else-if="error" class="resource-graphs-panel__error">
      <span>{{ error }}</span>
      <button class="resource-graphs-panel__retry" @click="refresh">Retry</button>
    </div>

    <template v-else>
      <!-- Highlights -->
      <div class="resource-graphs-panel__section-title headline4">Highlights</div>
      <ResourceHighlights
        :highlights="highlights"
        :time="highlightTime"
        :loading="loading"
      />

      <!-- Saved Charts -->
      <template v-if="savedCharts.length">
        <div class="resource-graphs-panel__section-title headline4">Saved Charts</div>
        <div class="resource-graphs-panel__saved-grid">
          <CustomChart
            v-for="chart in savedCharts"
            :key="chart.id"
            :series="chart.series"
            :title="chart.title"
            :time-range="chart.timeRange ?? globalRange"
            :node-id="nodeId"
            :editable="false"
            @edit="editSavedChart(chart)"
            @delete="deleteChart(chart.id)"
          />
        </div>
      </template>

      <!-- Query Builder -->
      <div class="resource-graphs-panel__section-title headline4">Build Custom Charts</div>
      <QueryBuilder
        ref="queryBuilderRef"
        :resources="resources"
        :time-range="globalRange"
        :node-id="nodeId"
        @save-chart="saveChart"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import ResourceHighlights from './ResourceHighlights.vue'
import CustomChart from './ResourceQueryBuilder/CustomChart.vue'
import QueryBuilder from './ResourceQueryBuilder/QueryBuilder.vue'
import useResourceGraphs from '@/composables/useResourceGraphs'
import type { StartEndTime } from '@/types'
import type { SavedChart } from '@/types/resourceGraphs'

const props = defineProps<{ nodeId: string }>()

const { resources, highlights, savedCharts, loading, error, saveChart, deleteChart, refresh } =
  useResourceGraphs(props.nodeId)

// ── Time range ──────────────────────────────────────────────────────────────

interface Preset { label: string; ms: number }
const PRESETS: Preset[] = [
  { label: '1h',  ms: 1 * 60 * 60 * 1000 },
  { label: '6h',  ms: 6 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 }
]

const nowMs = () => Date.now()
const toLocalDT = (ms: number) =>
  new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const activePreset = ref('24h')
const showCustom = ref(false)
const customStart = ref(toLocalDT(nowMs() - 24 * 60 * 60 * 1000))
const customEnd = ref(toLocalDT(nowMs()))

const globalRange = ref<{ start: number; end: number }>({
  start: nowMs() - 24 * 60 * 60 * 1000,
  end: nowMs()
})

const applyPreset = (preset: Preset) => {
  activePreset.value = preset.label
  showCustom.value = false
  const end = nowMs()
  globalRange.value = { start: end - preset.ms, end }
}

const applyCustom = () => {
  activePreset.value = 'custom'
  globalRange.value = {
    start: new Date(customStart.value).getTime(),
    end: new Date(customEnd.value).getTime()
  }
}

// Graph.vue StartEndTime uses unix seconds (it multiplies by 1000 internally)
const highlightTime = computed<StartEndTime>(() => ({
  startTime: Math.floor(globalRange.value.start / 1000),
  endTime: Math.floor(globalRange.value.end / 1000),
  format: 'hours'
}))

// ── Saved chart editing ──────────────────────────────────────────────────────

const queryBuilderRef = ref<InstanceType<typeof QueryBuilder> | null>(null)

const editSavedChart = (chart: SavedChart) => {
  deleteChart(chart.id)
  queryBuilderRef.value?.loadChart(chart)
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";

.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 4px;
}

.resource-graphs-panel {
  &__header { margin-bottom: 8px; }

  &__time-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 0 14px;
    border-bottom: 1px solid var($border-light-on-surface);
    margin-bottom: 16px;
  }

  &__preset {
    padding: 4px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    cursor: pointer;
    font-size: 0.8rem;
    &:hover { background: var($shade-4); }
    &--active { background: var($primary); color: #fff; border-color: var($primary); }
  }

  &__dt {
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: var($surface);
    color: var($primary-text-on-surface);
    padding: 3px 6px;
    font-size: 0.8rem;
  }

  &__dt-sep { color: var($secondary-text-on-surface); }

  &__apply {
    padding: 4px 10px;
    border: 1px solid var($primary);
    border-radius: 3px;
    background: var($primary);
    color: #fff;
    cursor: pointer;
    font-size: 0.8rem;
  }

  &__section-title {
    margin: 20px 0 10px;
  }

  &__saved-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 8px;

    @media (max-width: 800px) {
      grid-template-columns: 1fr;
    }
  }

  &__loading,
  &__error {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
  }

  &__retry {
    margin-left: 12px;
    padding: 4px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    background: none;
    cursor: pointer;
    font-size: 0.875rem;
    &:hover { background: var($shade-4); }
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceGraphsPanel.vue
git commit -m "feat(resource-graphs): add ResourceGraphsPanel with time range, highlights, saved charts, and query builder"
```

---

## Task 9: Wire into NodeDetails + Build Verification

**Files:**
- Modify: `ui/src/containers/NodeDetails.vue`

- [ ] **Step 1: Add the import**

In `ui/src/containers/NodeDetails.vue`, add to the import block (after `OutagesTable` import):

```typescript
import ResourceGraphsPanel from '@/components/NodeDetail/ResourceGraphsPanel.vue'
```

- [ ] **Step 2: Add the panel below OutagesTable**

In the template, after the Outages block (lines 98–103):

```vue
    <!-- Resource Graphs -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <ResourceGraphsPanel :nodeId="node.id" />
      </div>
    </div>
```

- [ ] **Step 3: Build**

```bash
cd ui && pnpm run build 2>&1 | tail -20
```

Expected: build completes with no errors. Warnings about chunk size are acceptable.

- [ ] **Step 4: Verify CSS has no bare custom property references**

```bash
grep -l ': --feather' ui/src/main/dist/assets/*.css
```

Expected: no files printed (empty output).

- [ ] **Step 5: Deploy to test container**

```bash
podman cp ui/src/main/dist/. test-opennms:/opt/opennms/jetty-webapps/opennms/ui/
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/containers/NodeDetails.vue
git commit -m "feat(resource-graphs): wire ResourceGraphsPanel into node detail page"
```

---

## Post-Implementation Checklist

- [ ] Navigate to a node detail page and verify the Resource Graphs panel loads
- [ ] Confirm Highlights section renders pre-fab graphs (2-column grid, "Show all" toggle works)
- [ ] Expand a resource group in the sidebar, click a resource, confirm attributes appear
- [ ] Click `+` on an attribute, confirm it appears as a series in the active chart
- [ ] Confirm the chart renders in PersesPanel with a line
- [ ] Save the chart, confirm it appears in Saved Charts section
- [ ] Reload the page, confirm the saved chart is still there (localStorage persistence)
- [ ] Click Edit on a saved chart, confirm it loads into the builder and is removed from Saved Charts
- [ ] Click Delete on a saved chart, confirm it disappears
- [ ] Change the global time range, confirm all charts update
- [ ] Enable time override on a chart, confirm it uses its own range while others use global
- [ ] Click "Open" on a highlights graph, confirm it navigates to the standalone graph page
