# Resource Graphs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat resource graph highlights with a pinned-graphs section + two-level grouped accordion, so nodes with many resources are navigable instead of overwhelming.

**Architecture:** New `usePinnedGraphs` composable manages pin state in localStorage (user-level defaults + per-node overrides). `useResourceGraphs` returns grouped data instead of a flat list. `ResourceHighlights` is replaced by `PinnedGraphs` + `ResourceAccordion` components. `Graph.vue` gains an optional pin icon.

**Tech Stack:** Vue 3 Composition API, TypeScript, Feather DS SCSS variables, localStorage

**Spec:** `docs/superpowers/specs/2026-04-06-resource-graphs-redesign.md`

---

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `ui/src/composables/usePinnedGraphs.ts` | Pin state: read/write localStorage, resolve pins to HighlightItems |
| Create | `ui/src/components/NodeDetail/PinnedGraphs.vue` | Pinned graphs grid with unpin + "set as default" controls |
| Create | `ui/src/components/NodeDetail/ResourceAccordion.vue` | Filter input + accordion container |
| Create | `ui/src/components/NodeDetail/ResourceTypeGroup.vue` | Single type section: type header → resource rows → graph grid |
| Modify | `ui/src/composables/useResourceGraphs.ts` | Return `ResourceGroup[]` instead of flat `HighlightItem[]` |
| Modify | `ui/src/types/resourceGraphs.ts` | Add new types |
| Modify | `ui/src/components/Resources/Graph.vue:22-33` | Add optional pin icon to title bar |
| Modify | `ui/src/components/NodeDetail/ResourceGraphsPanel.vue:36-43` | Swap ResourceHighlights for PinnedGraphs + ResourceAccordion |
| Delete | `ui/src/components/NodeDetail/ResourceHighlights.vue` | Replaced by PinnedGraphs |

---

### Task 1: Add Types

**Files:**
- Modify: `ui/src/types/resourceGraphs.ts`

- [ ] **Step 1: Add new interfaces to resourceGraphs.ts**

Add after the existing `HighlightItem` interface:

```ts
export interface PinIdentifier {
  resourceId: string
  definition: string
}

export interface ResourceWithDefinitions {
  resourceId: string
  label: string
  definitions: string[]
}

export interface ResourceGroup {
  typeLabel: string
  resources: ResourceWithDefinitions[]
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/types/resourceGraphs.ts
git commit -m "feat(resource-graphs): add types for grouped resources and pin identifiers"
```

---

### Task 2: Update useResourceGraphs to Return Grouped Data

**Files:**
- Modify: `ui/src/composables/useResourceGraphs.ts`

- [ ] **Step 1: Update the composable to return ResourceGroup[] instead of flat highlights**

Replace the entire file content:

```ts
// ui/src/composables/useResourceGraphs.ts
import { ref } from 'vue'
import { getResourceForNode } from '@/services/resourceService'
import { getGraphDefinitionsByResourceId } from '@/services/graphService'
import type { Resource } from '@/types'
import type { SavedChart, ResourceGroup } from '@/types/resourceGraphs'

const storageKey = (nodeId: string) => `resource-charts:${nodeId}`

const useResourceGraphs = (nodeId: string) => {
  const resources = ref<Resource[]>([])
  const resourceGroups = ref<ResourceGroup[]>([])
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
        return { resource: r, definitions: resp.name ?? [] }
      })
    )

    // Group by typeLabel
    const groupMap = new Map<string, ResourceGroup>()
    for (const { resource: r, definitions } of defResults) {
      if (!definitions.length) continue
      const existing = groupMap.get(r.typeLabel)
      const entry = { resourceId: r.id, label: r.label, definitions }
      if (existing) {
        existing.resources.push(entry)
      } else {
        groupMap.set(r.typeLabel, { typeLabel: r.typeLabel, resources: [entry] })
      }
    }
    resourceGroups.value = Array.from(groupMap.values())

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

  return { resources, resourceGroups, savedCharts, loading, error, saveChart, deleteChart, refresh: fetch }
}

export default useResourceGraphs
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useResourceGraphs.ts
git commit -m "feat(resource-graphs): return grouped resources by typeLabel"
```

---

### Task 3: Create usePinnedGraphs Composable

**Files:**
- Create: `ui/src/composables/usePinnedGraphs.ts`

- [ ] **Step 1: Create the composable**

```ts
// ui/src/composables/usePinnedGraphs.ts
import { ref, computed } from 'vue'
import type { PinIdentifier, ResourceGroup, HighlightItem } from '@/types/resourceGraphs'

const DEFAULTS_KEY = 'pinned-graphs:defaults'
const nodeKey = (nodeId: string) => `pinned-graphs:${nodeId}`

const readPins = (key: string): PinIdentifier[] => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writePins = (key: string, pins: PinIdentifier[]) => {
  localStorage.setItem(key, JSON.stringify(pins))
}

const usePinnedGraphs = (nodeId: string, resourceGroups: () => ResourceGroup[]) => {
  const nodePins = ref<PinIdentifier[]>(readPins(nodeKey(nodeId)))
  const defaultPins = ref<PinIdentifier[]>(readPins(DEFAULTS_KEY))
  const hasPerNodePins = computed(() => nodePins.value.length > 0)

  // Active pins: per-node if any exist, otherwise user defaults
  const activePins = computed<PinIdentifier[]>(() =>
    hasPerNodePins.value ? nodePins.value : defaultPins.value
  )

  // Resolve pin identifiers to full HighlightItems using current resource groups
  const pinnedItems = computed<HighlightItem[]>(() => {
    const groups = resourceGroups()
    const items: HighlightItem[] = []
    for (const pin of activePins.value) {
      for (const group of groups) {
        const resource = group.resources.find(r => r.resourceId === pin.resourceId)
        if (resource && resource.definitions.includes(pin.definition)) {
          items.push({ resourceId: pin.resourceId, definition: pin.definition, label: resource.label })
          break
        }
      }
    }
    return items
  })

  const isPinned = (resourceId: string, definition: string): boolean => {
    return activePins.value.some(p => p.resourceId === resourceId && p.definition === definition)
  }

  const togglePin = (item: HighlightItem) => {
    const existing = nodePins.value.findIndex(
      p => p.resourceId === item.resourceId && p.definition === item.definition
    )
    if (existing >= 0) {
      nodePins.value = nodePins.value.filter((_, i) => i !== existing)
    } else {
      nodePins.value = [...nodePins.value, { resourceId: item.resourceId, definition: item.definition }]
    }
    writePins(nodeKey(nodeId), nodePins.value)
  }

  const setAsDefault = () => {
    defaultPins.value = [...nodePins.value]
    writePins(DEFAULTS_KEY, defaultPins.value)
  }

  return { pinnedItems, isPinned, togglePin, setAsDefault, hasPerNodePins }
}

export default usePinnedGraphs
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/usePinnedGraphs.ts
git commit -m "feat(resource-graphs): add usePinnedGraphs composable for pin state management"
```

---

### Task 4: Add Pin Icon to Graph.vue

**Files:**
- Modify: `ui/src/components/Resources/Graph.vue:22-33,106-112,239-270`

- [ ] **Step 1: Add pin props and emit**

In Graph.vue, update the props and emits (lines 104-112):

Replace:
```ts
const emit = defineEmits(['addGraphDefinition'])

const props = defineProps({
  definition:    { required: true, type: String },
  resourceId:    { required: true, type: String },
  time:          { required: true, type: Object as PropType<StartEndTime> },
  label:         { required: true, type: String },
  isSingleGraph: { required: true, type: Boolean }
})
```

With:
```ts
const emit = defineEmits(['addGraphDefinition', 'toggle-pin'])

const props = defineProps({
  definition:    { required: true, type: String },
  resourceId:    { required: true, type: String },
  time:          { required: true, type: Object as PropType<StartEndTime> },
  label:         { required: true, type: String },
  isSingleGraph: { required: true, type: Boolean },
  pinnable:      { type: Boolean, default: false },
  pinned:        { type: Boolean, default: false }
})
```

- [ ] **Step 2: Add pin icon to template title bar**

Replace the title bar (lines 24-33):

```html
    <!-- Title bar -->
    <div class="graph-card__title-bar">
      <span class="graph-card__title">{{ persesSpec?.title ?? definition }}</span>
      <div class="graph-card__title-actions">
        <button
          v-if="pinnable"
          class="graph-card__pin-btn"
          :class="{ 'graph-card__pin-btn--active': pinned }"
          :title="pinned ? 'Unpin graph' : 'Pin to top'"
          @click="emit('toggle-pin')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>
        <router-link
          v-if="!isSingleGraph"
          :to="`/resource-graphs/graphs/${label}/${definition}/${resourceId}`"
          target="_blank"
          class="graph-card__open-link"
        >Open ↗</router-link>
      </div>
    </div>
```

- [ ] **Step 3: Add pin button styles**

Add after the `&__open-link` styles (after line 269):

```scss
  &__title-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__pin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 3px;
    background: none;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s, color 0.15s;
    &:hover { opacity: 1; }
    &--active {
      opacity: 1;
      color: var($primary);
      svg { fill: currentColor; }
    }
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Resources/Graph.vue
git commit -m "feat(resource-graphs): add optional pin icon to Graph card"
```

---

### Task 5: Create PinnedGraphs Component

**Files:**
- Create: `ui/src/components/NodeDetail/PinnedGraphs.vue`

- [ ] **Step 1: Create the component**

```vue
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
@import "@featherds/styles/themes/variables";

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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/NodeDetail/PinnedGraphs.vue
git commit -m "feat(resource-graphs): add PinnedGraphs component"
```

---

### Task 6: Create ResourceTypeGroup Component

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceTypeGroup.vue`

- [ ] **Step 1: Create the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/NodeDetail/ResourceTypeGroup.vue
git commit -m "feat(resource-graphs): add ResourceTypeGroup accordion component"
```

---

### Task 7: Create ResourceAccordion Component

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceAccordion.vue`

- [ ] **Step 1: Create the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/NodeDetail/ResourceAccordion.vue
git commit -m "feat(resource-graphs): add ResourceAccordion container with search filter"
```

---

### Task 8: Wire Everything into ResourceGraphsPanel

**Files:**
- Modify: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue`

- [ ] **Step 1: Replace ResourceHighlights with new components**

Replace the full file content of `ResourceGraphsPanel.vue`:

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
      <!-- Pinned Graphs -->
      <div class="resource-graphs-panel__section-title headline4">Pinned Graphs</div>
      <PinnedGraphs
        :pinnedItems="pinnedItems"
        :time="highlightTime"
        :hasPerNodePins="hasPerNodePins"
        @toggle-pin="togglePin"
        @set-as-default="setAsDefault"
      />

      <!-- Resource Categories -->
      <div class="resource-graphs-panel__section-title headline4">Browse by Category</div>
      <ResourceAccordion
        :groups="resourceGroups"
        :time="highlightTime"
        :isPinned="isPinned"
        @toggle-pin="togglePin"
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
import PinnedGraphs from './PinnedGraphs.vue'
import ResourceAccordion from './ResourceAccordion.vue'
import CustomChart from './ResourceQueryBuilder/CustomChart.vue'
import QueryBuilder from './ResourceQueryBuilder/QueryBuilder.vue'
import useResourceGraphs from '@/composables/useResourceGraphs'
import usePinnedGraphs from '@/composables/usePinnedGraphs'
import type { StartEndTime } from '@/types'
import type { SavedChart, HighlightItem } from '@/types/resourceGraphs'

const props = defineProps<{ nodeId: string }>()

const { resources, resourceGroups, savedCharts, loading, error, saveChart, deleteChart, refresh } =
  useResourceGraphs(props.nodeId)

const { pinnedItems, isPinned, togglePin, setAsDefault, hasPerNodePins } =
  usePinnedGraphs(props.nodeId, () => resourceGroups.value)

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
cd /Users/chance/git/opennms
git add ui/src/components/NodeDetail/ResourceGraphsPanel.vue
git commit -m "feat(resource-graphs): wire PinnedGraphs and ResourceAccordion into panel"
```

---

### Task 9: Remove ResourceHighlights

**Files:**
- Delete: `ui/src/components/NodeDetail/ResourceHighlights.vue`

- [ ] **Step 1: Delete the old component**

```bash
rm ui/src/components/NodeDetail/ResourceHighlights.vue
```

- [ ] **Step 2: Verify no remaining imports**

```bash
cd /Users/chance/git/opennms && grep -r "ResourceHighlights" ui/src/ --include="*.vue" --include="*.ts"
```

Expected: no results (the import was in ResourceGraphsPanel.vue which was fully replaced in Task 8).

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add -u ui/src/components/NodeDetail/ResourceHighlights.vue
git commit -m "chore(resource-graphs): remove replaced ResourceHighlights component"
```

---

### Task 10: Build, Deploy, and Verify

**Files:** None (verification only)

- [ ] **Step 1: Build the UI**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 2: Verify built index.html has correct asset paths**

```bash
grep -o 'src="/opennms/ui/assets/index-[^"]*\.js"' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: `src="/opennms/ui/assets/index-XXXX.js"` path present.

- [ ] **Step 3: Deploy to container**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 4: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Both must match.

- [ ] **Step 5: Verify live HTTP 200**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```

Expected: `200`

- [ ] **Step 6: Manual smoke test**

Navigate to a node detail page. Verify:
- "Pinned Graphs" section shows empty prompt
- "Browse by Category" shows accordion with type groups
- Expanding a type shows resource names
- Expanding a resource shows graphs in 2-column grid
- Pin icon on a graph adds it to the Pinned section
- Unpin removes it
- "Save as default" checkbox works
- Filter input narrows the accordion
- Saved Charts and Query Builder still work
- Time range picker affects all sections

- [ ] **Step 7: Tell user to hard refresh (Cmd+Shift+R)**
