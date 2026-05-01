# Resource Graph Search-First UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search bar to the node detail Resource Graphs panel that instantly renders matching Graph cards inline as the user types, replacing the need to manually expand the accordion hierarchy.

**Architecture:** A pure `searchResources(groups, query)` function filters the existing `ResourceGroup[]` tree into a flat result list. A new `ResourceSearchResults.vue` renders those results as `<Graph>` cards grouped by resource instance. `ResourceGraphsPanel.vue` shows either the accordion (no query) or the search results (active query) controlled by a single `searchQuery` ref. The accordion's now-redundant internal filter input is removed.

**Tech Stack:** Vue 3, TypeScript, Vitest, `@vueuse/core` (`refDebounced`), existing `Graph.vue`, existing `ResourceGroup`/`ResourceWithDefinitions` types from `@/types/resourceGraphs`.

---

## File Structure

- **Create:** `ui/src/composables/useResourceSearch.ts` — pure `searchResources` function + `useResourceSearch` composable
- **Create:** `ui/tests/composables/useResourceSearch.test.ts` — 7 unit tests for `searchResources`
- **Create:** `ui/src/components/NodeDetail/ResourceSearchResults.vue` — flat results renderer using `<Graph>` cards
- **Modify:** `ui/src/components/NodeDetail/ResourceGraphsPanel.vue` — add search bar, wire composable, conditional render
- **Modify:** `ui/src/components/NodeDetail/ResourceAccordion.vue` — remove internal filter (superseded by panel-level search)

---

## Codebase context (read before coding)

- **Auto-imports in `.vue` files:** `ref`, `computed`, `watch`, `onMounted`, etc. are globally available — no `import { ref } from 'vue'` needed. This is configured via `unplugin-auto-import` in `ui/vite.config.ts`.
- **`.ts` composable files need explicit imports:** Look at `ui/src/composables/useResourceGraphs.ts` — it starts with `import { ref } from 'vue'`. Follow the same pattern.
- **`@vueuse/core` is auto-imported in `.vue` files** but must be explicitly imported in `.ts` files.
- **Types live in `ui/src/types/resourceGraphs.ts`.** The relevant ones are:
  ```typescript
  interface ResourceWithDefinitions { resourceId: string; label: string; definitions: string[] }
  interface ResourceGroup { typeLabel: string; resources: ResourceWithDefinitions[] }
  ```
- **`Graph.vue`** is at `ui/src/components/Resources/Graph.vue`. Its required props: `definition: string`, `resourceId: string`, `time: StartEndTime`, `label: string`, `isSingleGraph: boolean`. Optional: `pinnable: boolean`, `pinned: boolean`. Emits `toggle-pin`.
- **`StartEndTime`** is `{ startTime: number; endTime: number; format: string }` from `@/types`.
- **Test runner:** `cd ui && pnpm test` runs all tests. To run one file: `pnpm vitest run tests/composables/useResourceSearch.test.ts`
- **Build:** `cd ui && pnpm build`
- **Deploy:** from the repo root (`/Users/chance/git/opennms`): `./deploy-to-container.sh test-opennms`
- **Git root:** `/Users/chance/git/opennms` — run all `git` commands from there, not from `ui/`.

---

## Task 1: `searchResources` pure function + unit tests

**Files:**
- Create: `ui/src/composables/useResourceSearch.ts`
- Create: `ui/tests/composables/useResourceSearch.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/composables/useResourceSearch.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { searchResources } from '@/composables/useResourceSearch'
import type { ResourceGroup } from '@/types/resourceGraphs'

const groups: ResourceGroup[] = [
  {
    typeLabel: 'SNMP Interface Data',
    resources: [
      { resourceId: 'node[1].interfaceSnmp[eth0]', label: 'eth0', definitions: ['ifOctets', 'ifErrors'] },
      { resourceId: 'node[1].interfaceSnmp[lo]',   label: 'lo',   definitions: ['ifOctets'] }
    ]
  },
  {
    typeLabel: 'Response Time',
    resources: [
      { resourceId: 'node[1].responseTime[192.168.1.1]', label: '192.168.1.1', definitions: ['icmp'] }
    ]
  }
]

describe('searchResources', () => {
  test('returns empty array for empty query', () => {
    expect(searchResources(groups, '')).toEqual([])
    expect(searchResources(groups, '  ')).toEqual([])
  })

  test('matches on resource label — returns all definitions for that resource', () => {
    const r = searchResources(groups, 'eth0')
    expect(r).toHaveLength(2)
    expect(r.every(x => x.resourceLabel === 'eth0')).toBe(true)
    expect(r.map(x => x.definition)).toEqual(['ifOctets', 'ifErrors'])
  })

  test('matches on definition name — returns only the matching definition', () => {
    const r = searchResources(groups, 'ifErrors')
    expect(r).toHaveLength(1)
    expect(r[0].definition).toBe('ifErrors')
    expect(r[0].resourceLabel).toBe('eth0')
  })

  test('matches on type label — returns all definitions for all resources in that type', () => {
    const r = searchResources(groups, 'snmp interface')
    expect(r).toHaveLength(3) // eth0/ifOctets, eth0/ifErrors, lo/ifOctets
  })

  test('is case-insensitive', () => {
    expect(searchResources(groups, 'ETH0')).toHaveLength(2)
    expect(searchResources(groups, 'ICMP')).toHaveLength(1)
  })

  test('returns empty array when nothing matches', () => {
    expect(searchResources(groups, 'xyzzy')).toEqual([])
  })

  test('caps results at 50', () => {
    const big: ResourceGroup[] = [{
      typeLabel: 'Big',
      resources: [{
        resourceId: 'r1',
        label: 'r1',
        definitions: Array.from({ length: 100 }, (_, i) => `def${i}`)
      }]
    }]
    expect(searchResources(big, 'def')).toHaveLength(50)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/chance/git/opennms/ui && pnpm vitest run tests/composables/useResourceSearch.test.ts
```

Expected: all 7 tests fail with "Cannot find module '@/composables/useResourceSearch'".

- [ ] **Step 3: Create `useResourceSearch.ts`**

Create `ui/src/composables/useResourceSearch.ts`:

```typescript
import { ref, computed, type Ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { ResourceGroup } from '@/types/resourceGraphs'

export interface SearchResultItem {
  typeLabel: string
  resourceId: string
  resourceLabel: string
  definition: string
}

export function searchResources(groups: ResourceGroup[], query: string): SearchResultItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResultItem[] = []

  for (const group of groups) {
    const typeMatch = group.typeLabel.toLowerCase().includes(q)
    for (const resource of group.resources) {
      const resourceMatch = resource.label.toLowerCase().includes(q)
      for (const definition of resource.definitions) {
        const defMatch = definition.toLowerCase().includes(q)
        if (typeMatch || resourceMatch || defMatch) {
          results.push({
            typeLabel: group.typeLabel,
            resourceId: resource.resourceId,
            resourceLabel: resource.label,
            definition
          })
          if (results.length >= 50) return results
        }
      }
    }
  }

  return results
}

export function useResourceSearch(groups: Ref<ResourceGroup[]>) {
  const query = ref('')
  const debouncedQuery = refDebounced(query, 200)
  const results = computed(() => searchResources(groups.value, debouncedQuery.value))
  const isSearching = computed(() => debouncedQuery.value.trim().length > 0)
  return { query, results, isSearching }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/chance/git/opennms/ui && pnpm vitest run tests/composables/useResourceSearch.test.ts
```

Expected: 7 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/composables/useResourceSearch.ts ui/tests/composables/useResourceSearch.test.ts && git commit -m "feat: add searchResources composable with unit tests"
```

---

## Task 2: `ResourceSearchResults` component

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceSearchResults.vue`

- [ ] **Step 1: Create `ResourceSearchResults.vue`**

Create `ui/src/components/NodeDetail/ResourceSearchResults.vue`:

```vue
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
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd /Users/chance/git/opennms/ui && pnpm build 2>&1 | grep -E "^\[.*error\]|^src.*error" | head -20
```

Expected: no error lines.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/components/NodeDetail/ResourceSearchResults.vue && git commit -m "feat: add ResourceSearchResults component for inline graph search"
```

---

## Task 3: Wire search into `ResourceGraphsPanel` + remove accordion filter

**Files:**
- Modify: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue`
- Modify: `ui/src/components/NodeDetail/ResourceAccordion.vue`

### 3a — Update `ResourceGraphsPanel.vue`

Read the current file at `ui/src/components/NodeDetail/ResourceGraphsPanel.vue` before editing. Make the following three changes:

- [ ] **Step 1: Add imports**

In the `<script setup>` block, add these two imports alongside the existing ones:

```typescript
import ResourceSearchResults from './ResourceSearchResults.vue'
import { useResourceSearch } from '@/composables/useResourceSearch'
```

- [ ] **Step 2: Add composable call**

In the `<script setup>` block, after the existing `const { pinnedItems, isPinned, togglePin, setAsDefault, hasPerNodePins } = ...` line, add:

```typescript
const { query: searchQuery, results: searchResults, isSearching } = useResourceSearch(
  computed(() => resourceGroups.value)
)
const searchCapped = computed(() => searchResults.value.length >= 50)
```

- [ ] **Step 3: Add search bar to template**

In the `<template>`, immediately after the closing `</div>` of the `resource-graphs-panel__time-bar` div, add:

```html
<!-- Search bar -->
<div class="resource-graphs-panel__search-wrap">
  <input
    v-model="searchQuery"
    class="resource-graphs-panel__search"
    type="search"
    placeholder="Search graphs… (e.g. eth0, icmp, octets)"
  />
</div>
```

- [ ] **Step 4: Replace the `<template v-else>` content**

Replace the entire `<template v-else>` block (everything between `<template v-else>` and its closing `</template>`) with:

```html
<template v-else>
  <!-- Search results (active query) -->
  <ResourceSearchResults
    v-if="isSearching"
    :results="searchResults"
    :query="searchQuery"
    :time="highlightTime"
    :isPinned="isPinned"
    :capped="searchCapped"
    @toggle-pin="togglePin"
  />

  <!-- Browse mode (no query) -->
  <template v-else>
    <div class="resource-graphs-panel__section-title headline4">Pinned Graphs</div>
    <PinnedGraphs
      :pinnedItems="pinnedItems"
      :time="highlightTime"
      :hasPerNodePins="hasPerNodePins"
      @toggle-pin="togglePin"
      @set-as-default="setAsDefault"
    />

    <div class="resource-graphs-panel__section-title headline4">Browse by Category</div>
    <ResourceAccordion
      :groups="resourceGroups"
      :time="highlightTime"
      :isPinned="isPinned"
      @toggle-pin="togglePin"
    />

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

    <div class="resource-graphs-panel__section-title headline4">Build Custom Charts</div>
    <QueryBuilder
      ref="queryBuilderRef"
      :resources="resources"
      :time-range="globalRange"
      :node-id="nodeId"
      @save-chart="saveChart"
    />
  </template>
</template>
```

- [ ] **Step 5: Add SCSS for search bar**

In the `.resource-graphs-panel` SCSS block, add alongside the existing rules:

```scss
&__search-wrap {
  padding: 10px 0 14px;
  border-bottom: 1px solid var($border-light-on-surface);
  margin-bottom: 16px;
}

&__search {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  background: var($surface);
  color: var($primary-text-on-surface);
  font-size: 0.875rem;
  outline: none;
  &::placeholder { color: var($secondary-text-on-surface); }
  &:focus { border-color: var($primary); }
}
```

### 3b — Update `ResourceAccordion.vue`

Read the current file at `ui/src/components/NodeDetail/ResourceAccordion.vue` before editing.

- [ ] **Step 6: Remove internal filter from `ResourceAccordion.vue`**

Replace the entire file content with this simplified version (the accordion now just renders its `groups` prop directly — no filtering, since search is handled at the panel level):

```vue
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
@use '@/styles/vars' as vars;
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
```

- [ ] **Step 7: Build**

```bash
cd /Users/chance/git/opennms/ui && pnpm build 2>&1 | grep -E "^\[.*error\]|^src.*error" | head -20
```

Expected: no error lines.

- [ ] **Step 8: Run full test suite**

```bash
cd /Users/chance/git/opennms/ui && pnpm test
```

Expected: all tests pass including the 7 new `useResourceSearch` tests.

- [ ] **Step 9: Deploy and verify manually**

```bash
cd /Users/chance/git/opennms && ./deploy-to-container.sh test-opennms
```

Open the node detail page for any node that has interface or response-time resources. Verify:

1. No query → accordion shows as before, search bar is visible above it
2. Type `eth` → accordion hides, matching Graph cards render grouped by resource
3. Type `icmp` → only ICMP response-time graphs show
4. Type `ifOct` → only ifOctets graphs show across all resources
5. Type `xyzzy` → "No graphs match" message shown
6. Clear the search input → accordion returns
7. Pinning a graph from search results works (pin button in graph card)

- [ ] **Step 10: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/components/NodeDetail/ResourceGraphsPanel.vue ui/src/components/NodeDetail/ResourceAccordion.vue && git commit -m "feat: search-first graph discovery in ResourceGraphsPanel"
```
