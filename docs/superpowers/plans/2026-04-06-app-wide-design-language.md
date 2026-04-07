# App-Wide Design Language — Problem-First Perspective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a global "Problems | Full" perspective toggle that silences healthy content by default across Node Detail, Alarms, Outages, and Surveillance Dashboard.

**Architecture:** A Pinia store (`usePerspectiveStore`) holds a single `'problems' | 'full'` value persisted to localStorage. A reusable `PerspectiveToggle.vue` pill renders on each applicable page. Components read `perspectiveStore.isProblems` (or receive it as a prop) and suppress healthy content accordingly. Three shared utility components (`ClearSummary`, `CollapsibleSection`, `StatusSummaryLine`) provide the visual language for collapsed/healthy state.

**Tech Stack:** Vue 3 + Pinia, Feather DS (`@featherds/styles`), SCSS with `var($feather-*)` tokens. Build: `yarn build` in `ui/`. Deploy: `./deploy-to-container.sh test-opennms`.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `ui/src/stores/perspectiveStore.ts` | Global perspective state (`'problems' \| 'full'`) with localStorage persistence |
| `ui/src/components/Common/PerspectiveToggle.vue` | Two-segment pill button rendered on applicable pages |
| `ui/src/components/Common/ClearSummary.vue` | "✓ All X healthy" line replacing suppressed sections |
| `ui/src/components/Common/CollapsibleSection.vue` | Collapsible card wrapper for reference sections |
| `ui/src/components/Common/StatusSummaryLine.vue` | "Showing X of Y with problems" line for list pages |

### Modified files
| File | Change |
|------|--------|
| `ui/src/containers/NodeDetails.vue` | Add page-controls bar (toggle + View Graphs link); wrap info/cat in CollapsibleSection; pass `problemsOnly` to sub-panels; hide ResourceGraphsPanel in problems mode |
| `ui/src/components/NodeDetail/AvailabilityPanel.vue` | Accept `problemsOnly` prop; filter 100% service cards; show ClearSummary when all healthy |
| `ui/src/components/NodeDetail/NetworkTab.vue` | Accept `problemsOnly` prop; filter to down-only endpoints; show ClearSummary when all up |
| `ui/src/components/Nodes/AlarmsTable.vue` | Accept `extraFiql?: string` prop; merge into FIQL query |
| `ui/src/components/Nodes/OutagesTable.vue` | Accept `filterFiql?: string` prop; merge into query params |
| `ui/src/components/NodeDetail/NodeActivityTab.vue` | Read perspectiveStore; pass active-only FIQL to AlarmsTable + OutagesTable |
| `ui/src/containers/Alarms.vue` | Add PerspectiveToggle |
| `ui/src/components/Alarms/AlarmsListTable.vue` | Watch perspectiveStore; reset ackStatus + severities on perspective change |
| `ui/src/containers/Outages.vue` | Add PerspectiveToggle |
| `ui/src/components/Outages/OutagesListTable.vue` | Watch perspectiveStore; reset statusFilter on perspective change |
| `ui/src/containers/SurveillanceDashboard.vue` | Add PerspectiveToggle; pass `dimHealthy` to SurveillanceGrid |
| `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue` | Accept `dimHealthy` prop; reduce opacity on NORMAL cells with 0 downCount |

---

## Task 1: Perspective Store

**Files:**
- Create: `ui/src/stores/perspectiveStore.ts`

- [ ] **Step 1: Create the store**

```ts
// ui/src/stores/perspectiveStore.ts
import { defineStore } from 'pinia'

const STORAGE_KEY = 'onms.perspective'

export const usePerspectiveStore = defineStore('perspectiveStore', () => {
  const perspective = ref<'problems' | 'full'>(
    (localStorage.getItem(STORAGE_KEY) as 'problems' | 'full') ?? 'problems'
  )

  const isProblems = computed(() => perspective.value === 'problems')

  function setPerspective(value: 'problems' | 'full') {
    perspective.value = value
    localStorage.setItem(STORAGE_KEY, value)
  }

  return { perspective, isProblems, setPerspective }
})
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/stores/perspectiveStore.ts
git commit -m "feat(perspective): add usePerspectiveStore with localStorage persistence"
```

---

## Task 2: Shared Components — PerspectiveToggle, ClearSummary, CollapsibleSection, StatusSummaryLine

**Files:**
- Create: `ui/src/components/Common/PerspectiveToggle.vue`
- Create: `ui/src/components/Common/ClearSummary.vue`
- Create: `ui/src/components/Common/CollapsibleSection.vue`
- Create: `ui/src/components/Common/StatusSummaryLine.vue`

- [ ] **Step 1: Create PerspectiveToggle.vue**

```vue
<!-- ui/src/components/Common/PerspectiveToggle.vue -->
<template>
  <div class="perspective-toggle" role="group" aria-label="View perspective">
    <button
      class="perspective-toggle__btn"
      :class="{ 'perspective-toggle__btn--active': store.perspective === 'problems' }"
      @click="store.setPerspective('problems')"
    >Problems</button>
    <button
      class="perspective-toggle__btn"
      :class="{ 'perspective-toggle__btn--active': store.perspective === 'full' }"
      @click="store.setPerspective('full')"
    >Full</button>
  </div>
</template>

<script setup lang="ts">
import { usePerspectiveStore } from '@/stores/perspectiveStore'
const store = usePerspectiveStore()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.perspective-toggle {
  display: inline-flex;
  border: 1px solid var($border-on-surface);
  border-radius: 20px;
  overflow: hidden;

  &__btn {
    padding: 4px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    transition: background 0.12s, color 0.12s;

    &--active {
      background: #0081ad;
      color: #fff;
    }

    &:not(.perspective-toggle__btn--active):hover {
      background: var($shade-4);
    }
  }
}
</style>
```

- [ ] **Step 2: Create ClearSummary.vue**

```vue
<!-- ui/src/components/Common/ClearSummary.vue -->
<template>
  <div class="clear-summary">
    <span class="clear-summary__icon">✓</span>
    <span class="clear-summary__message">{{ message }}</span>
    <button v-if="expandable" class="clear-summary__expand" @click="$emit('expand')">
      Show all ›
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string; expandable?: boolean }>()
defineEmits<{ expand: [] }>()
</script>

<style lang="scss" scoped>
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/styles/themes/variables";

.clear-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  background: utils.alpha(fvars.$success, 0.08);
  border: 1px solid utils.alpha(fvars.$success, 0.25);
  font-size: 0.875rem;
  color: var($secondary-text-on-surface);

  &__icon {
    color: var(--feather-success);
    font-weight: 700;
  }

  &__message {
    flex: 1;
  }

  &__expand {
    background: none;
    border: none;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    &:hover { text-decoration: underline; }
  }
}
</style>
```

- [ ] **Step 3: Create CollapsibleSection.vue**

```vue
<!-- ui/src/components/Common/CollapsibleSection.vue -->
<template>
  <div class="collapsible-section card">
    <button class="collapsible-section__header" @click="isOpen = !isOpen">
      <span class="headline4 collapsible-section__title">{{ title }}</span>
      <span class="collapsible-section__chevron" :class="{ 'collapsible-section__chevron--open': isOpen }">›</span>
    </button>
    <div v-show="isOpen" class="collapsible-section__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ title: string; collapsed: boolean }>()
const isOpen = ref(!props.collapsed)
watch(() => props.collapsed, (v) => { isOpen.value = !v })
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.collapsible-section {
  @include elevation(2);
  border-radius: 4px;
  padding: 0;
  margin-bottom: 16px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;

    &:hover { background: var($shade-4); }
  }

  &__title {
    margin: 0;
  }

  &__chevron {
    font-size: 1.1rem;
    color: var($secondary-text-on-surface);
    transition: transform 0.15s;
    display: inline-block;

    &--open { transform: rotate(90deg); }
  }

  &__body {
    padding: 0 16px 16px;
  }
}
</style>
```

- [ ] **Step 4: Create StatusSummaryLine.vue**

```vue
<!-- ui/src/components/Common/StatusSummaryLine.vue -->
<template>
  <div class="status-summary-line caption">
    Showing {{ shown }} of {{ total }} {{ noun }} with active problems
  </div>
</template>

<script setup lang="ts">
defineProps<{ shown: number; total: number; noun: string }>()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.status-summary-line {
  color: var($secondary-text-on-surface);
  padding: 6px 0;
  font-style: italic;
}
</style>
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Common/PerspectiveToggle.vue \
        ui/src/components/Common/ClearSummary.vue \
        ui/src/components/Common/CollapsibleSection.vue \
        ui/src/components/Common/StatusSummaryLine.vue
git commit -m "feat(perspective): add shared PerspectiveToggle, ClearSummary, CollapsibleSection, StatusSummaryLine"
```

---

## Task 3: Node Detail — Availability Panel Problems Mode

**Files:**
- Modify: `ui/src/components/NodeDetail/AvailabilityPanel.vue`

The panel currently shows all service cards for every IP interface. In problems mode, filter out services at 100% availability. If all services are 100%, replace the entire panel with a ClearSummary.

- [ ] **Step 1: Add `problemsOnly` prop and filter logic**

In `AvailabilityPanel.vue`, add the prop and a computed for filtered interfaces. Replace the `availability.ipinterfaces` loop with `filteredInterfaces`. Add ClearSummary import and usage.

The full updated `<template>` block (replace existing template from line 23):

```vue
<template>
  <div class="availability-panel card">
    <div class="headline4 availability-panel__title">Availability (last 24 hours)</div>

    <div v-if="loading" class="availability-panel__skeleton">Loading…</div>
    <div v-else-if="error" class="availability-panel__error subtitle2">{{ error }}</div>

    <template v-else-if="availability">
      <!-- Problems mode: all healthy -->
      <ClearSummary
        v-if="problemsOnly && allHealthy"
        message="All services healthy"
        :expandable="true"
        @expand="showAll = true"
      />

      <template v-else>
        <!-- Percentage cards grouped by IP interface -->
        <div class="availability-panel__cards">
          <div
            v-for="iface in displayedInterfaces"
            :key="iface.id"
            class="availability-panel__iface-group"
          >
            <div class="availability-panel__iface-header subtitle2">{{ iface.address }}</div>
            <div class="availability-panel__iface-cards">
              <div
                v-for="svc in iface.services"
                :key="svc.id"
                class="avail-card"
                :class="severityClass(svc.availability)"
              >
                <div class="avail-card__name subtitle2">{{ svc.name }}</div>
                <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Expandable timeline -->
        <button class="availability-panel__toggle subtitle2" @click="showChart = !showChart">
          {{ showChart ? '▲ Hide timeline' : '▼ Show timeline' }}
        </button>

        <div v-if="showChart" class="availability-panel__chart-wrap">
          <canvas ref="canvasRef" />
        </div>
      </template>
    </template>
  </div>
</template>
```

Add to the `<script setup>` block, after the existing `props` definition:

```ts
import ClearSummary from '@/components/Common/ClearSummary.vue'

const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  loading: boolean
  error: string | null
  problemsOnly?: boolean
}>()

const showAll = ref(false)

// All interfaces where every service is 100%
const allHealthy = computed(() => {
  if (!props.availability?.ipinterfaces?.length) return true
  return props.availability.ipinterfaces.every(iface =>
    iface.services.every(svc => svc.availability >= 100)
  )
})

// When problemsOnly: filter out 100% services; flatten empty iface groups
const filteredInterfaces = computed(() => {
  if (!props.availability?.ipinterfaces) return []
  return props.availability.ipinterfaces
    .map(iface => ({
      ...iface,
      services: iface.services.filter(svc => svc.availability < 100)
    }))
    .filter(iface => iface.services.length > 0)
})

const displayedInterfaces = computed(() => {
  if (!props.availability?.ipinterfaces) return []
  if (props.problemsOnly && !showAll.value) return filteredInterfaces.value
  return props.availability.ipinterfaces
})
```

- [ ] **Step 2: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/NodeDetail/AvailabilityPanel.vue
git commit -m "feat(perspective): AvailabilityPanel suppresses 100% services in problems mode"
```

---

## Task 4: Node Detail — NetworkTab Problems Mode

**Files:**
- Modify: `ui/src/components/NodeDetail/NetworkTab.vue`

In problems mode, show only endpoints where `isDown === true`. If all interfaces are up, show ClearSummary.

- [ ] **Step 1: Add `problemsOnly` prop, computed filtered list, ClearSummary**

Add to `<script setup>` (after the existing `props` definition):

```ts
import ClearSummary from '@/components/Common/ClearSummary.vue'

// Extend props definition to include problemsOnly
const props = defineProps<{
  nodeId: string
  nodeResourceKey: string
  problemsOnly?: boolean
}>()
```

Add computed after the existing `loading` / `endpoints` refs:

```ts
const showAll = ref(false)

const allUp = computed(() => endpoints.value.every(ep => !ep.isDown))

const displayedEndpoints = computed(() => {
  if (props.problemsOnly && !showAll.value) {
    return endpoints.value.filter(ep => ep.isDown)
  }
  return endpoints.value
})
```

- [ ] **Step 2: Update template**

The `NetworkTab.vue` template currently has this structure at the top of the root div:

```vue
<div v-if="loading" ...>Loading interfaces…</div>
<div v-else-if="!endpoints.length" ...>No interfaces found.</div>
<table v-else class="network-table">...</table>
```

Change it to insert the ClearSummary condition between the empty-state and the table:

```vue
<div v-if="loading" class="network-tab__loading caption">Loading interfaces…</div>
<div v-else-if="!endpoints.length" class="network-tab__empty caption">No interfaces found.</div>
<ClearSummary
  v-else-if="props.problemsOnly && allUp && !showAll"
  :message="`All ${endpoints.length} interfaces up`"
  :expandable="true"
  @expand="showAll = true"
/>
<table v-else class="network-table">
  <!-- all existing thead/tbody markup unchanged -->
  <thead>
    <tr>
      <th class="network-table__expand-col"></th>
      <th>Name</th>
      <th>Address</th>
      <th>Speed</th>
      <th>Status</th>
      <th>Services</th>
    </tr>
  </thead>
  <tbody>
    <template v-for="ep in displayedEndpoints" :key="ep.key">
```

Replace `v-for="ep in endpoints"` with `v-for="ep in displayedEndpoints"` in the tbody — this is the only change inside the table. The rest of the row markup (main row, expanded detail row) is unchanged.

- [ ] **Step 3: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/NodeDetail/NetworkTab.vue
git commit -m "feat(perspective): NetworkTab shows only down interfaces in problems mode"
```

---

## Task 5: Node Detail — AlarmsTable + OutagesTable Active-Only Filter

**Files:**
- Modify: `ui/src/components/Nodes/AlarmsTable.vue`
- Modify: `ui/src/components/Nodes/OutagesTable.vue`

Add an opt-in FIQL filter prop to each table so NodeActivityTab can pass active-only filters in problems mode.

- [ ] **Step 1: Add `extraFiql` prop to AlarmsTable**

In `AlarmsTable.vue`, extend props:

```ts
const props = defineProps<{ nodeId: string; nodeLabel: string; extraFiql?: string }>()
```

Update `buildFiql()` to merge extraFiql:

```ts
const buildFiql = () => {
  const ids = [numericNodeId.value, ...relatedNodeIds.value]
  const nodePart = ids.map(id => `node.id==${id}`).join(',')
  if (props.extraFiql) return `(${nodePart});${props.extraFiql}`
  return nodePart
}
```

- [ ] **Step 2: Add `filterFiql` prop to OutagesTable**

In `OutagesTable.vue`, extend props and merge into initial query params:

```ts
const props = defineProps<{ nodeId: string; filterFiql?: string }>()

const getNodeOutages = async (payload: QueryParameters) => {
  const params: QueryParameters = { ...payload }
  if (props.filterFiql) params._s = props.filterFiql
  nodeStore.getNodeOutages({ id: props.nodeId, queryParameters: params })
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Nodes/AlarmsTable.vue \
        ui/src/components/Nodes/OutagesTable.vue
git commit -m "feat(perspective): add extraFiql/filterFiql props to AlarmsTable and OutagesTable"
```

---

## Task 6: Node Detail — Wire NodeActivityTab to Perspective Store

**Files:**
- Modify: `ui/src/components/NodeDetail/NodeActivityTab.vue`

Read perspectiveStore and pass active-only FIQL to the alarm and outage tables.

- [ ] **Step 1: Update NodeActivityTab**

Replace the entire file with:

```vue
<template>
  <FeatherTabContainer v-model="activeSubTab">
    <template v-slot:tabs>
      <FeatherTab>Alarms</FeatherTab>
      <FeatherTab>Events</FeatherTab>
      <FeatherTab>Outages</FeatherTab>
    </template>

    <FeatherTabPanel>
      <AlarmsTable
        v-if="visited[0]"
        :nodeId="nodeId"
        :nodeLabel="nodeLabel"
        :extraFiql="perspectiveStore.isProblems ? 'severity!=CLEARED;ackTime==null' : undefined"
      />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <EventsTable v-if="visited[1]" :nodeId="nodeId" />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <OutagesTable
        v-if="visited[2]"
        :nodeId="nodeId"
        :filterFiql="perspectiveStore.isProblems ? 'ifRegainedService==null' : undefined"
      />
    </FeatherTabPanel>
  </FeatherTabContainer>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
import AlarmsTable from '@/components/Nodes/AlarmsTable.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import { usePerspectiveStore } from '@/stores/perspectiveStore'

const TAB_NAMES = ['alarms', 'events', 'outages'] as const

const props = defineProps<{ nodeId: string; nodeLabel: string; defaultTab?: string }>()

const perspectiveStore = usePerspectiveStore()

const initialTab = props.defaultTab ? Math.max(0, TAB_NAMES.indexOf(props.defaultTab as typeof TAB_NAMES[number])) : 0
const activeSubTab = ref(initialTab)

const visited = reactive([false, false, false])
visited[initialTab] = true
watch(activeSubTab, (idx) => { visited[idx] = true })
</script>
```

- [ ] **Step 2: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/NodeDetail/NodeActivityTab.vue
git commit -m "feat(perspective): NodeActivityTab passes active-only FIQL in problems mode"
```

---

## Task 7: Node Detail Container — Wire Everything Together

**Files:**
- Modify: `ui/src/containers/NodeDetails.vue`

Add the page-controls bar with PerspectiveToggle and View Graphs button. Wrap NodeInfo+CategoryPanel in CollapsibleSection. Pass `problemsOnly` to AvailabilityPanel, NetworkTab. Hide ResourceGraphsPanel in problems mode.

- [ ] **Step 1: Replace NodeDetails.vue**

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <!-- Page controls: perspective toggle + view graphs shortcut -->
  <div class="feather-row">
    <div class="feather-col-12 node-detail__controls">
      <PerspectiveToggle />
      <button
        v-if="perspectiveStore.isProblems"
        class="node-detail__graphs-link"
        @click="perspectiveStore.setPerspective('full')"
      >View Graphs →</button>
    </div>
  </div>

  <!-- Full-page error if node not found -->
  <div v-if="nodeError && !nodeLoading" class="feather-row">
    <div class="feather-col-12 node-detail__error">
      <p class="headline4">Node not found</p>
      <p class="subtitle1">{{ nodeError }}</p>
    </div>
  </div>

  <template v-else>
    <!-- Header + admin bar -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div v-if="nodeLoading" class="node-detail__skeleton headline3">Loading node…</div>
        <template v-else-if="node">
          <NodeHeader :node="node" />
          <AdminActionsBar
            :nodeId="id"
            :hasSNMPPrimary="true"
            :foreignSource="node.foreignSource"
          />
        </template>
      </div>
    </div>

    <!-- Info + categories — collapsible in problems mode -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <CollapsibleSection :title="infoSummary" :collapsed="perspectiveStore.isProblems">
          <div class="node-detail__info-row">
            <NodeInfoPanel :node="node" />
            <CategoryPanel :node="node" :isAdmin="adminRole" />
          </div>
        </CollapsibleSection>
      </div>
    </div>

    <!-- Availability -->
    <div class="feather-row">
      <div class="feather-col-12">
        <AvailabilityPanel
          :availability="availability"
          :chartData="chartData as any"
          :downSegmentMeta="downSegmentMeta"
          :loading="availLoading"
          :error="availError"
          :problemsOnly="perspectiveStore.isProblems"
        />
      </div>
    </div>

    <!-- Interfaces (NetworkTab) -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12 node-detail__card">
        <NetworkTab
          :nodeId="id"
          :nodeResourceKey="nodeResourceKey"
          :problemsOnly="perspectiveStore.isProblems"
        />
      </div>
    </div>

    <!-- Alarms / Events / Outages -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <NodeActivityTab :nodeId="node.id" :nodeLabel="node.label" :defaultTab="defaultTab" />
      </div>
    </div>

    <!-- Resource Graphs — hidden in problems mode -->
    <div v-if="node && !perspectiveStore.isProblems" class="feather-row">
      <div class="feather-col-12">
        <ResourceGraphsPanel :nodeId="node.id" />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import NodeHeader from '@/components/NodeDetail/NodeHeader.vue'
import AdminActionsBar from '@/components/NodeDetail/AdminActionsBar.vue'
import NodeInfoPanel from '@/components/NodeDetail/NodeInfoPanel.vue'
import CategoryPanel from '@/components/NodeDetail/CategoryPanel.vue'
import AvailabilityPanel from '@/components/NodeDetail/AvailabilityPanel.vue'
import NetworkTab from '@/components/NodeDetail/NetworkTab.vue'
import NodeActivityTab from '@/components/NodeDetail/NodeActivityTab.vue'
import ResourceGraphsPanel from '@/components/NodeDetail/ResourceGraphsPanel.vue'
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import CollapsibleSection from '@/components/Common/CollapsibleSection.vue'
import useNodeDetail from '@/composables/useNodeDetail'
import useNodeAvailability from '@/composables/useNodeAvailability'
import useRole from '@/composables/useRole'
import { usePerspectiveStore } from '@/stores/perspectiveStore'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const perspectiveStore = usePerspectiveStore()
const id = route.params.id as string
const defaultTab = computed(() => (route.query.tab as string) || 'alarms')

const { node, loading: nodeLoading, error: nodeError } = useNodeDetail(id)
const {
  availability, chartData, downSegmentMeta,
  loading: availLoading, error: availError
} = useNodeAvailability(id)
const { adminRole } = useRole()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: node.value?.label ?? id, to: '#', position: 'last' }
])

// Summary line shown as CollapsibleSection title in problems mode
const infoSummary = computed(() => {
  if (!node.value) return 'Node Information'
  const parts: string[] = []
  if (node.value.sysName) parts.push(node.value.sysName)
  else if (node.value.label) parts.push(node.value.label)
  if (node.value.sysLocation) parts.push(node.value.sysLocation)
  const catCount = node.value.categories?.length ?? 0
  if (catCount > 0) parts.push(`${catCount} ${catCount === 1 ? 'category' : 'categories'}`)
  return parts.join(' · ') || 'Node Information'
})

// nodeResourceKey for NetworkTab resource ID construction
const nodeResourceKey = computed(() => {
  if (!node.value) return id
  if (node.value.foreignSource && node.value.foreignId) {
    return `${node.value.foreignSource}:${node.value.foreignId}`
  }
  return id
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.node-detail {
  &__controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 4px;
    margin-bottom: 4px;
  }

  &__graphs-link {
    background: none;
    border: none;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.875rem;
    &:hover { text-decoration: underline; }
  }

  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }

  &__info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;

    @media (max-width: 700px) { grid-template-columns: 1fr; }
  }

  &__card {
    background: var($surface);
    border-radius: 4px;
    margin-bottom: 16px;
    padding: 16px;
  }
}

// Vertical breathing room between card rows on the node detail page.
// The Feather grid has horizontal gutter but no vertical gap by default.
.feather-row + .feather-row {
  margin-top: 12px;
}
</style>
```

Note: `InterfacesTabs` is replaced with `NetworkTab` directly. The existing `NodeDetails.vue` was already using `InterfacesTabs` as a placeholder — `NetworkTab` is the component that was built for this page.

- [ ] **Step 2: Build and deploy**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

Verify `src/main/dist/index.html` has updated asset hash, then deploy:

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

Verify live hash matches:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' src/main/dist/index.html
```

- [ ] **Step 3: Manual verification**

Navigate to `http://localhost:8980/opennms/ui/#/node/1`:
- Problems toggle is active (blue) by default
- Info/categories section shows summary line and is collapsed
- Graphs section is absent; "View Graphs →" button visible in controls row
- Clicking "View Graphs →" switches to Full mode; graphs section appears; info/cat expands

Switch to Full mode:
- All sections render
- Info/categories expanded
- ResourceGraphsPanel visible at bottom

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/NodeDetails.vue
git commit -m "feat(perspective): wire Node Detail container to perspective store"
```

---

## Task 8: Alarms List — Problems Mode

**Files:**
- Modify: `ui/src/containers/Alarms.vue`
- Modify: `ui/src/components/Alarms/AlarmsListTable.vue`

- [ ] **Step 1: Add PerspectiveToggle to Alarms.vue**

Replace the template in `Alarms.vue`:

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>
  <div class="feather-row">
    <div class="feather-col-12 alarms-page__controls">
      <PerspectiveToggle />
    </div>
  </div>
  <div class="feather-row">
    <div class="feather-col-12">
      <div class="card">
        <AlarmsListTable />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import AlarmsListTable from '@/components/Alarms/AlarmsListTable.vue'
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import { useMenuStore } from '@/stores/menuStore'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Alarms', to: '#', position: 'last' }
])
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
.card { background: var($surface); padding: 0; margin-bottom: 16px; border-radius: 4px; }
.alarms-page__controls { padding: 8px 0 4px; }
</style>
```

- [ ] **Step 2: Wire AlarmsListTable to perspectiveStore**

In `AlarmsListTable.vue`, add the store import and a watcher at the top of the `<script setup>` block (after existing imports):

```ts
import { usePerspectiveStore } from '@/stores/perspectiveStore'
const perspectiveStore = usePerspectiveStore()

// Sync filter state to perspective
watch(
  () => perspectiveStore.perspective,
  (p) => {
    if (p === 'problems') {
      ackStatus.value = 'unacked'
      selectedSeverities.value = [...DEFAULT_SEVERITIES]  // excludes CLEARED
    } else {
      ackStatus.value = 'all'
      selectedSeverities.value = [...ALL_SEVERITIES]
    }
    page.value = 0
    load()
  },
  { immediate: true }
)
```

Note: `DEFAULT_SEVERITIES` is already defined as `['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'NORMAL']` (excludes CLEARED). `ALL_SEVERITIES` is `['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'NORMAL', 'CLEARED']`. The `immediate: true` means the filter is applied on mount.

- [ ] **Step 3: Build, deploy, verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build && ./deploy-to-container.sh test-opennms
```

Navigate to `http://localhost:8980/opennms/ui/#/alarms`:
- PerspectiveToggle appears below breadcrumbs
- Problems mode (default): only unacked, non-CLEARED alarms shown
- Switch to Full: all alarms including cleared/acked appear

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/Alarms.vue ui/src/components/Alarms/AlarmsListTable.vue
git commit -m "feat(perspective): Alarms list pre-filters to active-only in problems mode"
```

---

## Task 9: Outages List — Problems Mode

**Files:**
- Modify: `ui/src/containers/Outages.vue`
- Modify: `ui/src/components/Outages/OutagesListTable.vue`

- [ ] **Step 1: Add PerspectiveToggle to Outages.vue**

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>
  <div class="feather-row">
    <div class="feather-col-12 outages-page__controls">
      <PerspectiveToggle />
    </div>
  </div>
  <div class="feather-row">
    <div class="feather-col-12">
      <div class="card">
        <OutagesListTable />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import OutagesListTable from '@/components/Outages/OutagesListTable.vue'
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import { useMenuStore } from '@/stores/menuStore'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Outages', to: '#', position: 'last' }
])
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
.card { background: var($surface); padding: 0; margin-bottom: 16px; border-radius: 4px; }
.outages-page__controls { padding: 8px 0 4px; }
</style>
```

- [ ] **Step 2: Wire OutagesListTable to perspectiveStore**

In `OutagesListTable.vue`, add after existing imports:

```ts
import { usePerspectiveStore } from '@/stores/perspectiveStore'
const perspectiveStore = usePerspectiveStore()

watch(
  () => perspectiveStore.perspective,
  (p) => {
    statusFilter.value = p === 'problems' ? 'current' : 'all'
    page.value = 0
    load()
  },
  { immediate: true }
)
```

- [ ] **Step 3: Build, deploy, verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build && ./deploy-to-container.sh test-opennms
```

Navigate to `http://localhost:8980/opennms/ui/#/outages`:
- Problems mode: only active outages (no resolved rows)
- Full mode: all outages including resolved

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/Outages.vue ui/src/components/Outages/OutagesListTable.vue
git commit -m "feat(perspective): Outages list pre-filters to active-only in problems mode"
```

---

## Task 10: Surveillance Dashboard — Dim Healthy Cells

**Files:**
- Modify: `ui/src/containers/SurveillanceDashboard.vue`
- Modify: `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue`

- [ ] **Step 1: Add `dimHealthy` prop to SurveillanceGrid**

In `SurveillanceGrid.vue`, extend props:

```ts
const props = defineProps<{
  view: SurveillanceView
  grid: CellData[][]
  selectedRow: number | null
  selectedCol: number | null
  dimHealthy?: boolean
}>()
```

Update the `grid-cell` class binding to add a `cell-dimmed` modifier:

```vue
:class="[
  cellClass(grid[ri][ci].worstSeverity),
  { 'cell-empty': grid[ri][ci].nodeCount === 0 },
  { 'cell-selected': selectedRow === ri && selectedCol === ci },
  { 'cell-dimmed': props.dimHealthy && grid[ri][ci].worstSeverity === 'NORMAL' && grid[ri][ci].downCount === 0 }
]"
```

Add to the scoped styles (inside `.surveillance-grid`):

```scss
.cell-dimmed {
  opacity: 0.35;
  pointer-events: none;
}
```

- [ ] **Step 2: Add PerspectiveToggle to SurveillanceDashboard and pass dimHealthy**

In `SurveillanceDashboard.vue`, add import and store usage:

```ts
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import { usePerspectiveStore } from '@/stores/perspectiveStore'
const perspectiveStore = usePerspectiveStore()
```

In the template, add PerspectiveToggle next to the existing controls area. Find the `.header-actions` div and add the toggle alongside it:

```vue
<div class="page-header">
  <h1 class="page-title">Surveillance Dashboard</h1>
  <div class="header-actions">
    <PerspectiveToggle />
    <FeatherSelect
      v-if="allViews.length > 1"
      ...
    />
    <span v-if="lastUpdated" class="last-updated">
      Updated {{ lastUpdated }}
    </span>
  </div>
</div>
```

Pass `dimHealthy` to SurveillanceGrid:

```vue
<SurveillanceGrid
  :view="data.view"
  :grid="data.grid"
  :selectedRow="selectedRow"
  :selectedCol="selectedCol"
  :dimHealthy="perspectiveStore.isProblems"
  @cellClick="onCellClick"
/>
```

- [ ] **Step 3: Build, deploy, verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build && ./deploy-to-container.sh test-opennms
```

Navigate to `http://localhost:8980/opennms/ui/#/surveillance-dashboard`:
- Problems mode: NORMAL cells with 0 downCount appear faded (opacity 0.35), non-clickable
- Full mode: all cells at full opacity and clickable

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/SurveillanceDashboard.vue \
        ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue
git commit -m "feat(perspective): Surveillance Dashboard dims healthy cells in problems mode"
```

---

## Task 11: Card Structure Normalization on Node Detail Panels

**Files:**
- Modify: `ui/src/components/NodeDetail/NodeInfoPanel.vue`
- Modify: `ui/src/components/NodeDetail/CategoryPanel.vue`

The goal is to align both panels with the canonical card pattern used in `AlarmDetail.vue`: `elevation(2)` mixin, `border-radius: 4px`, `padding: 16px`, `headline4` section titles.

Currently both panels use `border-radius: 8px` and a manual `background: var($surface)` without `elevation(2)`. Normalize them.

- [ ] **Step 1: Update NodeInfoPanel.vue styles**

In `NodeInfoPanel.vue`, replace the `.card` style block:

```scss
// Before
.card {
  background: var($surface);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
}

// After
.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}
```

Also add the elevation mixin import at the top of the `<style>` block:

```scss
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";
```

- [ ] **Step 2: Update CategoryPanel.vue styles**

In `CategoryPanel.vue`, replace the `.card` style block:

```scss
// Before
.card {
  background: var(--feather-surface);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
}

// After  (use $-variable form for consistency)
.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}
```

Add the elevation import:

```scss
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";
```

- [ ] **Step 3: Build, deploy, verify**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build && ./deploy-to-container.sh test-opennms
```

Navigate to `/#/node/1` in Full mode. NodeInfoPanel and CategoryPanel should have the same subtle shadow as AlarmDetail cards. Verify in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/NodeDetail/NodeInfoPanel.vue \
        ui/src/components/NodeDetail/CategoryPanel.vue
git commit -m "style: normalize NodeInfoPanel and CategoryPanel to canonical card pattern"
```

---

> **Deferred: Nodes list problems filter**
> Filtering the Nodes list to "only nodes with active problems" requires querying the alarms/outages APIs to get a set of problem node IDs and cross-referencing with the paginated nodes table. The nodes API (`GET /api/v2/nodes`) does not support filtering by active alarm presence directly. This is a follow-on task requiring a dedicated composable (`useProblemNodeIds`) and integration with `nodeStructureStore`. Defer to a separate plan.

---

## Task 12: Final Build, Deploy, and Squash

- [ ] **Step 1: Full build and deploy**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 2: End-to-end verification checklist**

Open `http://localhost:8980/opennms/ui` in a browser (hard refresh: Cmd+Shift+R).

Node Detail (`/#/node/1`):
- [ ] PerspectiveToggle shows "Problems" active by default
- [ ] Info/categories section collapsed to summary line
- [ ] If node has all 100% services: AvailabilityPanel shows ClearSummary
- [ ] If all interfaces up: NetworkTab shows ClearSummary
- [ ] Activity tab shows only active alarms (no CLEARED)
- [ ] ResourceGraphsPanel absent; "View Graphs →" visible
- [ ] Clicking "View Graphs →" switches to Full; graphs appear; info/cat expands
- [ ] Switching back to Problems: graphs hide, info/cat collapses

Alarms (`/#/alarms`):
- [ ] PerspectiveToggle visible
- [ ] Problems mode: only unacked non-CLEARED alarms
- [ ] Full mode: all alarms

Outages (`/#/outages`):
- [ ] Problems mode: only active outages
- [ ] Full mode: all outages

Surveillance Dashboard:
- [ ] Problems mode: healthy cells dimmed
- [ ] Full mode: all cells full opacity

Persistence:
- [ ] Switching perspective on one page persists across navigation to another page
- [ ] Refreshing the page preserves the selected perspective

Dark mode:
- [ ] ClearSummary green tint visible in both light and dark
- [ ] PerspectiveToggle active segment readable in both modes

- [ ] **Step 3: Squash iterative commits into logical groups**

```bash
git log --oneline feature/jmx-config-vue ^develop
```

Squash to 3 commits:
1. `feat(perspective): add perspective store and shared components`
2. `feat(perspective): node detail problems-first mode`
3. `feat(perspective): problems-first mode on alarms, outages, and surveillance dashboard`

```bash
git rebase -i develop
# In editor: squash task commits into the 3 logical groups above
```

- [ ] **Step 4: Verify build hash still matches after rebase**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```
