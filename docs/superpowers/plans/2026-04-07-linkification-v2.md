# Linkification v2 — Node Detail Tabs + Service Card Interactions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the node detail page into 4 tabs (Overview / Activity / Resource Graphs / Network), make service availability cards clickable (jump to Graphs tab) and hoverable (Perses response-time tooltip).

**Architecture:** Pure Vue component changes — FeatherTabContainer in NodeDetails.vue with URL query-param sync (`?tab=`), emit-based navigation from AvailabilityPanel, and a new `ServiceGraphTooltip.vue` wrapper component that Teleports a PersesPanel popover to `<body>`. A targeted `getResourceById` call gates tooltip display to IPs with actual response-time data.

**Tech Stack:** Vue 3, Vue Router, TypeScript, FeatherDS (`@featherds/tabs`), PersesPanel (existing), OpenNMS REST `/rest/resources/:id`

> **Note:** NodesTable, MapAlarmsGrid, and MapNodesGrid linkification (from the original plan) are already implemented — router-links are in place. Do not re-do those.

---

### Task 1: Add `getResourceById` to resourceService

**Files:**
- Modify: `ui/src/services/resourceService.ts`
- Modify: `ui/src/services/index.ts`

This adds a targeted resource-existence check used by the tooltip to suppress itself when no response-time data exists for an IP.

- [ ] **Step 1: Add `getResourceById` to resourceService.ts**

In `ui/src/services/resourceService.ts`, add after the `getResourceForNode` function (before the export):

```ts
const getResourceById = async (id: string): Promise<Resource | null> => {
  try {
    const encodedId = encodeURIComponent(id)
    const resp = await rest.get(`${endpoint}/${encodedId}`)
    if (resp.status === 204) return null
    return resp.data
  } catch {
    return null
  }
}
```

Update the export line at the bottom:

```ts
export { getResources, getResourceForNode, getResourceById }
```

- [ ] **Step 2: Export from services/index.ts**

In `ui/src/services/index.ts`, find the block that imports from `resourceService`:

```ts
import { getResources, getResourceForNode } from './resourceService'
```

Change it to:

```ts
import { getResources, getResourceForNode, getResourceById } from './resourceService'
```

Then find where `getResourceForNode` is listed in the exported object and add `getResourceById` alongside it. The exact line will look like:

```ts
  getResourceForNode,
```

Add after it:

```ts
  getResourceById,
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: no TypeScript errors. If you see `getResourceById` not found, check the export in index.ts.

- [ ] **Step 4: Commit**

```bash
git add ui/src/services/resourceService.ts ui/src/services/index.ts
git commit -m "feat(ui): add getResourceById to resourceService"
```

---

### Task 2: Update NodeActivityTab to use `?subtab=` query param

**Files:**
- Modify: `ui/src/components/NodeDetail/NodeActivityTab.vue`

Currently NodeActivityTab reads/writes `route.query.tab` for its sub-tab (alarms/events/outages/links). We need it to use `route.query.subtab` instead, so the top-level `?tab=` param is free for the section key (overview/activity/graphs/network).

- [ ] **Step 1: Update NodeActivityTab script**

Replace the entire `<script setup lang="ts">` block in `ui/src/components/NodeDetail/NodeActivityTab.vue` with:

```ts
<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
import AlarmsTable from '@/components/Nodes/AlarmsTable.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import EnlinkdLinksTab from '@/components/NodeDetail/EnlinkdLinksTab.vue'
import { usePerspectiveStore } from '@/stores/perspectiveStore'

const TAB_NAMES = ['alarms', 'events', 'outages', 'links'] as const

const props = defineProps<{ nodeId: string; nodeLabel: string; defaultSubTab?: string }>()

const perspectiveStore = usePerspectiveStore()
const route = useRoute()
const router = useRouter()

const initialTab = props.defaultSubTab
  ? Math.max(0, TAB_NAMES.indexOf(props.defaultSubTab as typeof TAB_NAMES[number]))
  : 0
const activeSubTab = ref(initialTab)

const visited = reactive([false, false, false, false])
visited[initialTab] = true

watch(activeSubTab, (idx) => {
  visited[idx] = true
  router.replace({ query: { ...route.query, subtab: TAB_NAMES[idx] } })
})
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/NodeDetail/NodeActivityTab.vue
git commit -m "feat(ui): NodeActivityTab uses subtab query param for sub-tab routing"
```

---

### Task 3: Restructure NodeDetails.vue with FeatherTabContainer

**Files:**
- Modify: `ui/src/containers/NodeDetails.vue`

This is the main structural change. Four top-level tabs with URL sync via `?tab=`. The `perspectiveStore.isProblems` guard on ResourceGraphsPanel is removed. The "View Graphs →" button is removed.

- [ ] **Step 1: Replace the entire NodeDetails.vue**

Write the following to `ui/src/containers/NodeDetails.vue`:

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div v-if="nodeError && !nodeLoading" class="feather-row">
    <div class="feather-col-12 node-detail__error">
      <p class="headline4">Node not found</p>
      <p class="subtitle1">{{ nodeError }}</p>
    </div>
  </div>

  <template v-else>
    <div class="feather-row">
      <div class="feather-col-12">
        <div v-if="nodeLoading" class="node-detail__skeleton headline3">Loading node…</div>
        <template v-else-if="node">
          <NodeHeader :node="node" />
          <AdminActionsBar :nodeId="id" :foreignSource="node.foreignSource" />
        </template>
      </div>
    </div>

    <div v-if="node" class="feather-row">
      <div class="feather-col-12 node-detail__tab-wrap">
        <div class="node-detail__tab-header-row">
          <FeatherTabContainer v-model="activeTab" class="node-detail__tabs">
            <template #tabs>
              <FeatherTab>Overview</FeatherTab>
              <FeatherTab>Activity</FeatherTab>
              <FeatherTab>Resource Graphs</FeatherTab>
              <FeatherTab>Network</FeatherTab>
            </template>

            <!-- Overview -->
            <FeatherTabPanel>
              <CollapsibleSection :title="infoSummary" :collapsed="perspectiveStore.isProblems">
                <div class="node-detail__info-row">
                  <NodeInfoPanel :node="node" />
                  <CategoryPanel :node="node" :isAdmin="adminRole" />
                </div>
              </CollapsibleSection>
              <AvailabilityPanel
                :availability="availability"
                :chartData="chartData"
                :downSegmentMeta="downSegmentMeta"
                :loading="availLoading"
                :error="availError"
                :problemsOnly="perspectiveStore.isProblems"
                :nodeId="id"
                @go-graphs="goToTab('graphs')"
              />
            </FeatherTabPanel>

            <!-- Activity -->
            <FeatherTabPanel>
              <NodeActivityTab
                v-if="tabVisited[1]"
                :nodeId="node.id"
                :nodeLabel="node.label"
                :defaultSubTab="activitySubTab"
              />
            </FeatherTabPanel>

            <!-- Resource Graphs -->
            <FeatherTabPanel>
              <ResourceGraphsPanel v-if="tabVisited[2]" :nodeId="node.id" />
            </FeatherTabPanel>

            <!-- Network -->
            <FeatherTabPanel>
              <NetworkTab
                v-if="tabVisited[3]"
                :nodeId="id"
                :nodeResourceKey="nodeResourceKey"
                @go-graphs="goToTab('graphs')"
                @go-activity="goToTab('activity')"
              />
            </FeatherTabPanel>
          </FeatherTabContainer>

          <div class="node-detail__perspective-wrap">
            <PerspectiveToggle />
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
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
const router = useRouter()
const menuStore = useMenuStore()
const perspectiveStore = usePerspectiveStore()
const id = route.params.id as string

const { node, loading: nodeLoading, error: nodeError } = useNodeDetail(id)
const {
  availability, chartData, downSegmentMeta,
  loading: availLoading, error: availError
} = useNodeAvailability(id)
const { adminRole } = useRole()

// ── Tab routing ──────────────────────────────────────────────────────────────

const TAB_KEYS = ['overview', 'activity', 'graphs', 'network'] as const
type TopTabKey = typeof TAB_KEYS[number]
const ACTIVITY_SUB_KEYS = ['alarms', 'events', 'outages', 'links'] as const

const activeTab = ref(0)
const tabVisited = reactive([true, false, false, false])

const goToTab = (key: TopTabKey) => {
  const idx = TAB_KEYS.indexOf(key)
  activeTab.value = idx
}

// Initialize from URL on mount
onMounted(() => {
  const tabParam = route.query.tab as string

  // Backwards compat: old ?tab=alarms links navigate to Activity with that sub-tab
  if (ACTIVITY_SUB_KEYS.includes(tabParam as any)) {
    activeTab.value = 1
    router.replace({ query: { tab: 'activity', subtab: tabParam } })
    return
  }

  const idx = TAB_KEYS.indexOf(tabParam as TopTabKey)
  if (idx >= 0) activeTab.value = idx
})

// Mark tab visited (lazy-loads heavy panels)
watch(activeTab, (idx) => {
  tabVisited[idx] = true
  const key = TAB_KEYS[idx]
  if (key !== 'activity') {
    // Remove subtab when leaving Activity tab
    const { subtab, ...rest } = route.query
    router.replace({ query: { ...rest, tab: key } })
  } else {
    router.replace({ query: { ...route.query, tab: key } })
  }
})

// Sub-tab for NodeActivityTab (reads ?subtab=)
const activitySubTab = computed(() => {
  const subtab = route.query.subtab as string
  return ACTIVITY_SUB_KEYS.includes(subtab as any) ? subtab : 'alarms'
})

// ── Breadcrumbs / info ───────────────────────────────────────────────────────

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: node.value?.label ?? id, to: '#', position: 'last' }
])

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

const nodeResourceKey = computed(() => {
  if (!node.value) return id
  if (node.value.foreignSource && node.value.foreignId) {
    return `${node.value.foreignSource}:${node.value.foreignId}`
  }
  return id
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.node-detail {
  &__error    { padding: 24px; text-align: center; }
  &__skeleton { padding: 16px; }

  &__tab-wrap { position: relative; }

  &__tab-header-row {
    position: relative;
  }

  &__perspective-wrap {
    position: absolute;
    top: 8px;
    right: 0;
    z-index: 1;
  }

  &__info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
    @media (max-width: 700px) { grid-template-columns: 1fr; }
  }
}

.feather-row + .feather-row {
  margin-top: 12px;
}
</style>
```

- [ ] **Step 2: Build and check for TypeScript errors**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -30
```

Expected: clean build. Common error to watch for: `defaultTab` prop no longer exists on NodeActivityTab — we renamed it to `defaultSubTab`. Fix in both files if needed.

- [ ] **Step 3: Deploy and smoke-test the tab structure**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

Verify bundle hashes match:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Navigate to a node detail page. Verify:
1. Four tabs render: Overview, Activity, Resource Graphs, Network
2. Overview tab shows AvailabilityPanel + NodeInfo + Categories
3. Activity tab shows alarms/events/outages/links sub-tabs
4. Resource Graphs tab shows graphs (may take a moment to load)
5. Network tab shows interface data
6. URL updates to `?tab=graphs` etc. when switching tabs
7. Legacy link `?tab=alarms` redirects to `?tab=activity&subtab=alarms`

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/NodeDetails.vue
git commit -m "feat(ui): restructure node detail page into Overview/Activity/Graphs/Network tabs"
```

---

### Task 4: Update AvailabilityPanel — clickable cards + `go-graphs` emit

**Files:**
- Modify: `ui/src/components/NodeDetail/AvailabilityPanel.vue`

Add `nodeId` and `clickable` props, `go-graphs` emit, and hover/click handlers. The `nodeId` prop is needed by ServiceGraphTooltip (added in Task 5). For now, just add it to the interface so Task 5 can wire it up without re-touching props.

- [ ] **Step 1: Update the `<script setup>` props/emits**

In `ui/src/components/NodeDetail/AvailabilityPanel.vue`, replace the existing `defineProps` block:

```ts
const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  loading: boolean
  error: string | null
  problemsOnly?: boolean
}>()
```

With:

```ts
const emit = defineEmits<{ 'go-graphs': [] }>()

const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  loading: boolean
  error: string | null
  problemsOnly?: boolean
  /** Node ID — passed through to ServiceGraphTooltip for resource lookup */
  nodeId?: string
  /** Whether cards are clickable (navigate to Graphs tab). Default: true */
  clickable?: boolean
}>()

const isClickable = computed(() => props.clickable !== false)
```

- [ ] **Step 2: Update the avail-card template**

In the template, find the avail-card div:

```html
<div
  v-for="svc in iface.services"
  :key="svc.id"
  class="avail-card"
  :class="severityClass(svc.availability)"
>
  <div class="avail-card__name subtitle2">{{ svc.name }}</div>
  <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
</div>
```

Replace with:

```html
<div
  v-for="svc in iface.services"
  :key="svc.id"
  class="avail-card"
  :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
  @click="isClickable && emit('go-graphs')"
>
  <div class="avail-card__name subtitle2">{{ svc.name }}</div>
  <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
</div>
```

- [ ] **Step 3: Add clickable styles**

In the `<style>` block, add inside the `.avail-card` rule:

```scss
.avail-card {
  // ...existing styles...
  &--clickable {
    cursor: pointer;
    transition: box-shadow 0.15s ease, filter 0.15s ease;
    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      filter: brightness(1.04);
    }
  }
}
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

```bash
./deploy-to-container.sh test-opennms
```

Navigate to a node detail page → Overview tab. Click a service card. Verify the tab switches to Resource Graphs.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/NodeDetail/AvailabilityPanel.vue
git commit -m "feat(ui): make availability panel service cards clickable (go-graphs)"
```

---

### Task 5: Create ServiceGraphTooltip.vue

**Files:**
- Create: `ui/src/components/NodeDetail/ServiceGraphTooltip.vue`

A wrapper component that captures hover events, checks resource existence, and Teleports a PersesPanel popover to `<body>`. The avail-card content is placed in its default slot.

- [ ] **Step 1: Create the component**

Create `ui/src/components/NodeDetail/ServiceGraphTooltip.vue`:

```vue
<template>
  <div
    class="svc-tooltip-trigger"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="visible"
        class="svc-tooltip"
        :style="floatStyle"
        @mouseenter="cancelHide"
        @mouseleave="onLeave"
      >
        <div class="svc-tooltip__header caption">
          {{ serviceName }} · {{ ip }} · last 6h
        </div>
        <div class="svc-tooltip__chart">
          <PersesPanel
            :title="`${serviceName} response time`"
            :queries="[query]"
            :time-range="timeRange"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSQuerySpec } from '@/datasource/opennms/types'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { getResourceById } from '@/services'

const props = defineProps<{
  nodeId: string
  ip: string
  serviceName: string
}>()

// ── Resource existence cache ─────────────────────────────────────────────────
// null = unknown, true = exists, false = no response-time resource for this IP
const resourceExists = ref<boolean | null>(null)

const resourceId = computed(
  () => `node[${props.nodeId}].responseTime[${props.ip.replace(/\./g, '_')}]`
)

// ── Tooltip state ────────────────────────────────────────────────────────────
const visible = ref(false)
const floatStyle = ref<Record<string, string>>({})
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const query = computed<OpenNMSQuerySpec>(() => ({
  resourceId: resourceId.value,
  attribute: 'response-time',
  aggregation: 'AVERAGE',
  label: 'Response Time (ms)'
}))

const timeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date(Date.now() - 6 * 60 * 60 * 1000),
  end: new Date()
}))

// ── Hover handlers ───────────────────────────────────────────────────────────
const onEnter = (e: MouseEvent) => {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (visible.value) return

  showTimer = setTimeout(async () => {
    // Check resource existence (cached after first lookup)
    if (resourceExists.value === null) {
      const result = await getResourceById(resourceId.value)
      resourceExists.value = result !== null
    }
    if (!resourceExists.value) return

    // Position below the trigger element
    const el = (e.currentTarget as HTMLElement)
    const rect = el.getBoundingClientRect()
    floatStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${Math.max(8, rect.left)}px`,
      zIndex: '9999'
    }
    visible.value = true
  }, 300)
}

const cancelHide = () => {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

const onLeave = () => {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  hideTimer = setTimeout(() => { visible.value = false }, 150)
}

onUnmounted(() => {
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.svc-tooltip-trigger {
  display: contents; // transparent wrapper — doesn't affect layout
}

.svc-tooltip {
  @include elevation(4);
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  padding: 10px 12px 12px;
  width: 340px;
  pointer-events: auto;

  &__header {
    color: var($secondary-text-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__chart {
    width: 316px;
    height: 160px;
  }
}
</style>
```

> **Note on `display: contents`:** This makes the wrapper div transparent to layout — the slot content renders as if the wrapper div doesn't exist. The avail-card flex layout in AvailabilityPanel is preserved.

- [ ] **Step 2: Build to check TypeScript**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: clean build. If `getResourceById` is not found, verify the export in `ui/src/services/index.ts` from Task 1.

- [ ] **Step 3: Wire ServiceGraphTooltip into AvailabilityPanel**

In `ui/src/components/NodeDetail/AvailabilityPanel.vue`, add the import at the top of `<script setup>`:

```ts
import ServiceGraphTooltip from './ServiceGraphTooltip.vue'
```

In the template, wrap the existing avail-card div with `<ServiceGraphTooltip>`. Find:

```html
<div
  v-for="svc in iface.services"
  :key="svc.id"
  class="avail-card"
  :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
  @click="isClickable && emit('go-graphs')"
>
  <div class="avail-card__name subtitle2">{{ svc.name }}</div>
  <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
</div>
```

Replace with:

```html
<template v-for="svc in iface.services" :key="svc.id">
  <ServiceGraphTooltip
    v-if="nodeId"
    :nodeId="nodeId"
    :ip="iface.address"
    :serviceName="svc.name"
  >
    <div
      class="avail-card"
      :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
      @click="isClickable && emit('go-graphs')"
    >
      <div class="avail-card__name subtitle2">{{ svc.name }}</div>
      <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
    </div>
  </ServiceGraphTooltip>
  <div
    v-else
    class="avail-card"
    :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
    @click="isClickable && emit('go-graphs')"
  >
    <div class="avail-card__name subtitle2">{{ svc.name }}</div>
    <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
  </div>
</template>
```

> The `v-if="nodeId"` / `v-else` pattern avoids putting both `v-if` and `v-for` on the same element (Vue 3 warns about that). Falls back to plain cards when nodeId is absent — keeps AvailabilityPanel usable in contexts without a nodeId.

- [ ] **Step 4: Build and deploy**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Verify CSS has no bare `--feather-*` values:

```bash
grep -c 'var(--feather' ui/src/main/dist/assets/index-*.css
```

Should return a positive number (feather vars present and wrapped in var()). If it returns 0 or the grep finds bare `--feather-` without `var(`, check the scss imports in the new component.

```bash
./deploy-to-container.sh test-opennms
```

Verify bundle hash matches.

- [ ] **Step 5: Verify tooltip behavior in browser**

Navigate to a node detail page. On the Overview tab:

1. Hover over a service availability card (e.g. "ICMP"). Wait 300ms. A tooltip should appear below the card showing a Perses time-series chart labeled "ICMP response time".
2. Move mouse off the card. Tooltip disappears after 150ms.
3. Hover over a service that has no response-time data (if any). No tooltip should appear.
4. Click any card. Active tab switches to Resource Graphs.
5. Hard-refresh (`Cmd+Option+R` in Safari) and verify the page still works.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/NodeDetail/ServiceGraphTooltip.vue ui/src/components/NodeDetail/AvailabilityPanel.vue
git commit -m "feat(ui): add Perses response-time tooltip on service availability cards"
```

---

### Task 6: Final build, deploy, and end-to-end verification

- [ ] **Step 1: Full build**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 2: Deploy**

```bash
./deploy-to-container.sh test-opennms
```

- [ ] **Step 3: Verify bundle hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Both must match.

- [ ] **Step 4: Full E2E check**

Hard-refresh (`Cmd+Option+R` in Safari). Verify all of the following:

| Feature | Expected |
|---------|----------|
| Node detail → Overview tab | Default tab, shows availability cards + node info |
| Node detail → Activity tab | Alarms sub-tab shown by default |
| Node detail → Resource Graphs tab | Graphs load on first visit |
| Node detail → Network tab | Interface data visible |
| `?tab=graphs` URL | Loads directly to Resource Graphs tab |
| `?tab=activity&subtab=events` | Loads Activity → Events sub-tab |
| `?tab=alarms` (legacy) | Redirects to `?tab=activity&subtab=alarms` |
| Service card click | Switches to Resource Graphs tab |
| Service card hover (300ms) | Perses tooltip appears with response-time chart |
| Service card hover for no-data IP | No tooltip |
| Browser back/forward | Tab state restores correctly |

- [ ] **Step 5: Tell user to hard-refresh**
