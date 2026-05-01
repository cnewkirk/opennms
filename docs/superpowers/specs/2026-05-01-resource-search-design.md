# Resource Graph Search-First UI Design

**Goal:** Replace the accordion-only browse flow in `ResourceGraphsPanel` with a search-first experience: typing instantly renders matching `<Graph>` cards inline without any click-to-expand steps.

**Architecture:** A pure `searchResources` function filters the existing `ResourceGroup[]` tree into a flat `SearchResult[]` list. A new `ResourceSearchResults.vue` renders those results. `ResourceGraphsPanel.vue` shows either the accordion (no query) or the search results (active query) based on a single `searchQuery` ref.

**Tech Stack:** Vue 3 + TypeScript, existing `Graph.vue`, existing `ResourceGroup`/`ResourceWithDefinitions` types from `@/types/resourceGraphs`.

---

## File Structure

- Create: `ui/src/composables/useResourceSearch.ts` — pure `searchResources` function + `useResourceSearch` composable
- Create: `ui/src/components/NodeDetail/ResourceSearchResults.vue` — flat results renderer
- Create: `ui/tests/composables/useResourceSearch.test.ts` — unit tests for `searchResources`
- Modify: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue` — add top-level search bar, conditional render
- Modify: `ui/src/components/NodeDetail/ResourceAccordion.vue` — remove internal filter input (superseded)

---

## Task 1: Pure search function + tests

**Files:**
- Create: `ui/src/composables/useResourceSearch.ts`
- Create: `ui/tests/composables/useResourceSearch.test.ts`

### Data types

```typescript
// ui/src/composables/useResourceSearch.ts
import type { ResourceGroup } from '@/types/resourceGraphs'

export interface SearchResultItem {
  typeLabel: string
  resourceId: string
  resourceLabel: string
  definition: string
}
```

### Search logic

`searchResources(groups, query)` returns a flat `SearchResultItem[]`:

- Normalise query: `query.trim().toLowerCase()`
- Empty query → return `[]`
- For each `group` in `groups`, for each `resource` in `group.resources`:
  - A resource **matches** if `group.typeLabel`, `resource.label`, or **any** `definition` in `resource.definitions` contains the normalised query
  - For a matching resource, emit one `SearchResultItem` per `definition` — but only emit definitions that themselves match, OR emit all definitions if the match was on `typeLabel` or `resource.label`
- Cap output at 50 items total; caller receives the slice

```typescript
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
```

### Composable wrapper

```typescript
export function useResourceSearch(groups: Ref<ResourceGroup[]>) {
  const query = ref('')
  const debouncedQuery = refDebounced(query, 200)  // @vueuse/core
  const results = computed(() => searchResources(groups.value, debouncedQuery.value))
  const isSearching = computed(() => debouncedQuery.value.trim().length > 0)
  return { query, results, isSearching }
}
```

### Tests

```typescript
// ui/tests/composables/useResourceSearch.test.ts
import { describe, it, expect } from 'vitest'
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
  it('returns empty array for empty query', () => {
    expect(searchResources(groups, '')).toEqual([])
    expect(searchResources(groups, '  ')).toEqual([])
  })

  it('matches on resource label', () => {
    const r = searchResources(groups, 'eth0')
    expect(r).toHaveLength(2)
    expect(r.every(x => x.resourceLabel === 'eth0')).toBe(true)
  })

  it('matches on definition name', () => {
    const r = searchResources(groups, 'ifErrors')
    expect(r).toHaveLength(1)
    expect(r[0].definition).toBe('ifErrors')
  })

  it('matches on type label — returns all definitions for all resources in that type', () => {
    const r = searchResources(groups, 'snmp interface')
    expect(r).toHaveLength(3) // eth0/ifOctets, eth0/ifErrors, lo/ifOctets
  })

  it('is case-insensitive', () => {
    expect(searchResources(groups, 'ETH0')).toHaveLength(2)
    expect(searchResources(groups, 'ICMP')).toHaveLength(1)
  })

  it('returns empty array when nothing matches', () => {
    expect(searchResources(groups, 'xyzzy')).toEqual([])
  })

  it('caps results at 50', () => {
    // build a group with 100 definitions on one resource
    const big: ResourceGroup[] = [{
      typeLabel: 'Big',
      resources: [{ resourceId: 'r1', label: 'r1', definitions: Array.from({ length: 100 }, (_, i) => `def${i}`) }]
    }]
    expect(searchResources(big, 'def')).toHaveLength(50)
  })
})
```

- [ ] **Step 1: Create `useResourceSearch.ts`** with `SearchResultItem` type, `searchResources` function, and `useResourceSearch` composable exactly as above.

- [ ] **Step 2: Create the test file** with all seven test cases above.

- [ ] **Step 3: Run tests**

```bash
cd ui && pnpm test --run tests/composables/useResourceSearch.test.ts
```

Expected: 7 passing.

- [ ] **Step 4: Commit**

```bash
git add ui/src/composables/useResourceSearch.ts ui/tests/composables/useResourceSearch.test.ts
git commit -m "feat: add searchResources composable with unit tests"
```

---

## Task 2: ResourceSearchResults component

**Files:**
- Create: `ui/src/components/NodeDetail/ResourceSearchResults.vue`

This component receives the flat `SearchResultItem[]` and renders them grouped by resource. For each resource group it shows a header (`resourceLabel · typeLabel`) and then the `<Graph>` cards in a 2-column grid (matching the existing accordion grid layout).

It also accepts `totalCount` (number of results before the 50-cap) so it can render "Showing first 50 matches — refine your search" when capped.

```vue
<template>
  <div class="search-results">
    <div class="search-results__meta caption">
      {{ resultMeta }}
    </div>
    <div v-if="!groupedResults.length" class="search-results__empty caption">
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
      map.set(item.resourceId, { resourceId: item.resourceId, resourceLabel: item.resourceLabel, typeLabel: item.typeLabel, items: [] })
    }
    map.get(item.resourceId)!.items.push(item)
  }
  return [...map.values()]
})

const resultMeta = computed(() => {
  const total = props.results.length
  if (total === 0) return ''
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

- [ ] **Step 1: Create `ResourceSearchResults.vue`** with the template, script, and styles exactly as above.

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd ui && pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceSearchResults.vue
git commit -m "feat: add ResourceSearchResults component for inline graph search"
```

---

## Task 3: Wire search into ResourceGraphsPanel + remove accordion filter

**Files:**
- Modify: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue`
- Modify: `ui/src/components/NodeDetail/ResourceAccordion.vue`

### Changes to ResourceGraphsPanel.vue

Add the search bar below the time bar. Use `useResourceSearch` composable. When `isSearching` is true, render `<ResourceSearchResults>` instead of the pinned/accordion/query-builder sections.

The search input replaces nothing visible — it's a new element. The `ResourceAccordion`'s internal filter is removed (next step).

Add to imports:

```typescript
import ResourceSearchResults from './ResourceSearchResults.vue'
import { useResourceSearch } from '@/composables/useResourceSearch'
```

Add to script setup (after the existing composable calls):

```typescript
const { query: searchQuery, results: searchResults, isSearching } = useResourceSearch(
  computed(() => resourceGroups.value)
)
const searchCapped = computed(() => searchResults.value.length >= 50)
```

Add to template, immediately after `</div>` closing the `__time-bar`:

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

Replace the entire `<template v-else>` block with:

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

Add to SCSS:

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
  &:focus { border-color: var($primary); box-shadow: 0 0 0 2px color-mix(in srgb, var($primary) 15%, transparent); }
}
```

### Changes to ResourceAccordion.vue

Remove the `filter` ref, `filteredGroups` computed, and the `<input>` search element. The prop `groups` is now pre-filtered from the parent (or passed as-is since search is handled at panel level). The accordion just renders what it receives.

The template becomes:

```html
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
```

Remove from script: `const filter = ref('')` and `const filteredGroups = computed(...)`.
Remove from style: `&__filter { ... }`.

- [ ] **Step 1: Update `ResourceGraphsPanel.vue`** — add search bar markup, import `ResourceSearchResults` and `useResourceSearch`, wire `isSearching` conditional render.

- [ ] **Step 2: Update `ResourceAccordion.vue`** — remove internal `filter` ref, `filteredGroups` computed, `<input>` element, and `__filter` SCSS block.

- [ ] **Step 3: Build**

```bash
cd ui && pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Deploy and verify manually**
  - Open node detail page for a node with interface resources
  - Confirm no search query → accordion shows as before
  - Type "eth" → `ResourceSearchResults` appears with matching Graph cards rendering
  - Clear query → accordion returns
  - Type "icmp" → only ICMP graphs shown
  - Type "xyzzy" → "No graphs match" message

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/NodeDetail/ResourceGraphsPanel.vue ui/src/components/NodeDetail/ResourceAccordion.vue
git commit -m "feat: add search-first graph discovery to ResourceGraphsPanel"
```
