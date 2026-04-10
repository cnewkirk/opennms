# Node Detail Vue SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `element/node.jsp` with a fully REST-driven Vue 3 page at `/#/node/:id`, replacing server-rendered PNGs with a Chart.js availability timeline.

**Architecture:** Composable-per-panel pattern — each composable fetches its own data independently so panels render as their data arrives. `NodeDetails.vue` (already exists as a stub at `ui/src/containers/NodeDetails.vue`) is built out to assemble all panels. The route `/node/:id` already exists in the router. Node URLs default to `foreignSource:foreignId` format for human readability; numeric IDs are honored for backward compatibility.

**Tech Stack:** Vue 3, Vite, Pinia, Feather DS, Chart.js 3.9 (already registered via `registerables`), date-fns (already installed), vitest + @vue/test-utils (tests in `ui/tests/`), auto-import (Vue/VueRouter composables auto-available — no explicit import needed).

---

## File Map

| Status | File | Purpose |
|---|---|---|
| **Modify** | `ui/src/types/index.ts` | Add `ifLostService`/`ifRegainedService` to `Outage` |
| **Modify** | `ui/src/components/Nodes/utils.ts` | Add `getNodeCriteria()` helper |
| **Create** | `ui/src/composables/useNodeDetail.ts` | Fetch single node via v2 API |
| **Create** | `ui/src/composables/useNodeAvailability.ts` | Fetch availability % + outage timeline data |
| **Create** | `ui/src/components/NodeDetail/NodeHeader.vue` | Label, status, location, foreign source |
| **Create** | `ui/src/components/NodeDetail/NodeInfoPanel.vue` | SNMP attrs + asset description |
| **Create** | `ui/src/components/NodeDetail/CategoryPanel.vue` | Category chips + admin edit link |
| **Create** | `ui/src/components/NodeDetail/AdminActionsBar.vue` | Rescan (REST) + admin nav links |
| **Create** | `ui/src/components/NodeDetail/AvailabilityPanel.vue` | Pct cards + Chart.js timeline |
| **Modify** | `ui/src/containers/NodeDetails.vue` | Build out stub → full page |
| **Modify** | `opennms-webapp/src/main/webapp/element/node.jsp` | sendRedirect to Vue route |
| **Modify** | `ui/src/components/Dashboard/widgets/NodesWidget.vue` | Use `router-link` + `getNodeCriteria` |
| **Modify** | `ui/src/components/Dashboard/widgets/AlarmsWidget.vue` | Use `router-link` (numeric ID) |
| **Modify** | `ui/src/components/Dashboard/widgets/OutagesWidget.vue` | Use `router-link` (numeric ID) |
| **Create** | `ui/tests/composables/useNodeDetail.test.ts` | Unit tests |
| **Create** | `ui/tests/composables/useNodeAvailability.test.ts` | Unit tests (chart transform) |
| **Create** | `ui/tests/utils/nodeUtils.test.ts` | Unit tests for getNodeCriteria |

---

## Task 1: Extend Outage type and add getNodeCriteria utility

**Files:**
- Modify: `ui/src/types/index.ts` (Outage interface, ~line 251)
- Modify: `ui/src/components/Nodes/utils.ts`
- Create: `ui/tests/utils/nodeUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `ui/tests/utils/nodeUtils.test.ts`:
```typescript
import { describe, test, expect } from 'vitest'
import { getNodeCriteria } from '@/components/Nodes/utils'
import { Node } from '@/types'

const baseNode = {
  id: '42', label: 'myserver', location: 'Default',
  type: 'A', createTime: 0, primaryInterface: 0,
  categories: [], assetRecord: {} as any
} as Node

describe('getNodeCriteria', () => {
  test('returns foreignSource:foreignId when both are present', () => {
    const node = { ...baseNode, foreignSource: 'selfmonitor', foreignId: 'localhost' }
    expect(getNodeCriteria(node)).toBe('selfmonitor:localhost')
  })

  test('falls back to numeric id when foreignSource is missing', () => {
    const node = { ...baseNode, foreignSource: '', foreignId: 'localhost' }
    expect(getNodeCriteria(node)).toBe('42')
  })

  test('falls back to numeric id when foreignId is missing', () => {
    const node = { ...baseNode, foreignSource: 'selfmonitor', foreignId: '' }
    expect(getNodeCriteria(node)).toBe('42')
  })

  test('falls back to numeric id when both are missing', () => {
    expect(getNodeCriteria(baseNode)).toBe('42')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (getNodeCriteria not exported yet)**
```bash
cd ui && pnpm run test -- tests/utils/nodeUtils.test.ts
```
Expected: `getNodeCriteria` is not a function / export not found.

- [ ] **Step 3: Add Outage timing fields to `ui/src/types/index.ts`**

Find the `Outage` interface (~line 251) and add two fields:
```typescript
export interface Outage {
  nodeId: number
  ipAddress: string
  serviceIs: number
  nodeLabel: string
  location: string
  hostname: string
  serviceName: string
  outageId: number
  ifLostService?: number        // ms timestamp — present in v2 API responses
  ifRegainedService?: number | null  // null means still active
}
```

- [ ] **Step 4: Add `getNodeCriteria` to `ui/src/components/Nodes/utils.ts`**

Add after the existing imports and before `getTableCssClasses`:
```typescript
/**
 * Returns a node criteria string for use in Vue Router links.
 * Prefers foreignSource:foreignId (human-readable) when both are present;
 * falls back to the numeric node ID for backward compatibility.
 */
export const getNodeCriteria = (node: Node): string => {
  if (node.foreignSource && node.foreignId) {
    return `${node.foreignSource}:${node.foreignId}`
  }
  return node.id
}
```

- [ ] **Step 5: Run tests — expect PASS**
```bash
cd ui && pnpm run test -- tests/utils/nodeUtils.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 6: Commit**
```bash
git add ui/src/types/index.ts ui/src/components/Nodes/utils.ts ui/tests/utils/nodeUtils.test.ts
git commit -m "feat(node-detail): extend Outage type with timing fields; add getNodeCriteria helper"
```

---

## Task 2: useNodeDetail composable

**Files:**
- Create: `ui/src/composables/useNodeDetail.ts`
- Create: `ui/tests/composables/useNodeDetail.test.ts`

- [ ] **Step 1: Write failing test**

Create `ui/tests/composables/useNodeDetail.test.ts`:
```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import useNodeDetail from '@/composables/useNodeDetail'
import * as nodeService from '@/services/nodeService'

const mockNode = {
  id: '1', label: 'test-node', location: 'Default', type: 'A',
  foreignSource: 'test', foreignId: 'node1', createTime: 0,
  sysName: 'test', sysDescription: '', sysContact: '', sysLocation: '',
  sysObjectId: '.1.3', categories: [], assetRecord: {} as any, primaryInterface: 0
}

describe('useNodeDetail', () => {
  beforeEach(() => {
    createTestingPinia()
    vi.restoreAllMocks()
  })

  test('fetches node and sets loading states correctly', async () => {
    vi.spyOn(nodeService, 'getNodeById' as any).mockResolvedValue(mockNode)

    const wrapper = mount(defineComponent({
      setup() { return useNodeDetail('1') },
      template: '<div />'
    }))

    // loading starts true
    expect(wrapper.vm.loading).toBe(true)
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.node).toEqual(mockNode)
    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.vm.error).toBeNull()
  })

  test('sets error when fetch fails', async () => {
    vi.spyOn(nodeService, 'getNodeById' as any).mockResolvedValue(false)

    const wrapper = mount(defineComponent({
      setup() { return useNodeDetail('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.node).toBeNull()
    expect(wrapper.vm.error).toBe('Failed to load node details')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**
```bash
cd ui && pnpm run test -- tests/composables/useNodeDetail.test.ts
```

- [ ] **Step 3: Create `ui/src/composables/useNodeDetail.ts`**

Note: `nodeService` exports `getNodeById` — import it directly (not via store, to keep page state local).

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { getNodeById } from '@/services/nodeService'
import { Node } from '@/types'

const useNodeDetail = (nodeId: string) => {
  const node = ref<Node | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null
    const result = await getNodeById(nodeId)
    if (result) {
      node.value = result
    } else {
      error.value = 'Failed to load node details'
    }
    loading.value = false
  }

  fetch()

  return { node, loading, error, refresh: fetch }
}

export default useNodeDetail
```

- [ ] **Step 4: Run test — expect PASS**
```bash
cd ui && pnpm run test -- tests/composables/useNodeDetail.test.ts
```

- [ ] **Step 5: Commit**
```bash
git add ui/src/composables/useNodeDetail.ts ui/tests/composables/useNodeDetail.test.ts
git commit -m "feat(node-detail): add useNodeDetail composable"
```

---

## Task 3: useNodeAvailability composable

This is the most logic-heavy composable — it fetches availability percentages and transforms outage history into Chart.js floating bar segments.

**Files:**
- Create: `ui/src/composables/useNodeAvailability.ts`
- Create: `ui/tests/composables/useNodeAvailability.test.ts`

- [ ] **Step 1: Write failing test**

Create `ui/tests/composables/useNodeAvailability.test.ts`:
```typescript
import { describe, test, expect } from 'vitest'
import { buildAvailabilityChartData } from '@/composables/useNodeAvailability'
import { NodeAvailability, Outage } from '@/types'

const WINDOW_START = 1000000
const WINDOW_END   = 1086400000  // +24h

const availability: NodeAvailability = {
  id: 1,
  availability: 99.5,
  'service-count': 1,
  'service-down-count': 0,
  ipinterfaces: [{
    id: 1,
    address: '10.0.0.1',
    availability: 99.5,
    services: [{ id: 1, name: 'ICMP', availability: 99.5 }]
  }]
}

describe('buildAvailabilityChartData', () => {
  test('produces one full up segment when there are no outages', () => {
    const { datasets } = buildAvailabilityChartData(availability, [], WINDOW_START, WINDOW_END)
    const up = datasets[0].data
    const down = datasets[1].data
    expect(up).toHaveLength(1)
    expect(up[0]).toEqual({ x: [WINDOW_START, WINDOW_END], y: 'ICMP @ 10.0.0.1' })
    expect(down).toHaveLength(0)
  })

  test('splits into up/down/up segments around a resolved outage', () => {
    const outage: Outage = {
      outageId: 42, nodeId: 1, ipAddress: '10.0.0.1', serviceName: 'ICMP',
      nodeLabel: '', location: '', hostname: '', serviceIs: 1,
      ifLostService: 1010000, ifRegainedService: 1020000
    }
    const { datasets, downSegmentMeta } = buildAvailabilityChartData(
      availability, [outage], WINDOW_START, WINDOW_END
    )
    const up = datasets[0].data
    const down = datasets[1].data

    expect(up).toHaveLength(2)
    expect(up[0]).toEqual({ x: [WINDOW_START, 1010000], y: 'ICMP @ 10.0.0.1' })
    expect(up[1]).toEqual({ x: [1020000, WINDOW_END], y: 'ICMP @ 10.0.0.1' })
    expect(down).toHaveLength(1)
    expect(down[0]).toEqual({ x: [1010000, 1020000], y: 'ICMP @ 10.0.0.1' })
    expect(downSegmentMeta[0].outageId).toBe(42)
  })

  test('caps an active outage at window end', () => {
    const outage: Outage = {
      outageId: 99, nodeId: 1, ipAddress: '10.0.0.1', serviceName: 'ICMP',
      nodeLabel: '', location: '', hostname: '', serviceIs: 1,
      ifLostService: 1050000, ifRegainedService: null
    }
    const { datasets } = buildAvailabilityChartData(
      availability, [outage], WINDOW_START, WINDOW_END
    )
    const down = datasets[1].data
    expect(down[0]).toEqual({ x: [1050000, WINDOW_END], y: 'ICMP @ 10.0.0.1' })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**
```bash
cd ui && pnpm run test -- tests/composables/useNodeAvailability.test.ts
```

- [ ] **Step 3: Create `ui/src/composables/useNodeAvailability.ts`**

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { getNodeAvailabilityPercentage } from '@/services/nodeService'
import { getOutages } from '@/services/outageService'
import { NodeAvailability, Outage } from '@/types'
import { sub } from 'date-fns'

export interface ChartSegment {
  x: [number, number]
  y: string
}

export interface DownSegmentMeta {
  outageId: number
}

export interface AvailabilityChartData {
  datasets: [
    { label: 'Up';   backgroundColor: string; borderWidth: 0; data: ChartSegment[] },
    { label: 'Down'; backgroundColor: string; borderWidth: 0; data: ChartSegment[] }
  ]
  downSegmentMeta: DownSegmentMeta[]
}

/** Pure transform — exported for testing. */
export const buildAvailabilityChartData = (
  availability: NodeAvailability,
  outages: Outage[],
  windowStart: number,
  windowEnd: number
): AvailabilityChartData => {
  const upSegments: ChartSegment[] = []
  const downSegments: ChartSegment[] = []
  const downSegmentMeta: DownSegmentMeta[] = []

  for (const iface of availability.ipinterfaces) {
    for (const svc of iface.services) {
      const label = `${svc.name} @ ${iface.address}`
      const svcOutages = outages
        .filter(o => o.ipAddress === iface.address && o.serviceName === svc.name && o.ifLostService != null)
        .sort((a, b) => (a.ifLostService ?? 0) - (b.ifLostService ?? 0))

      let cursor = windowStart
      for (const outage of svcOutages) {
        const lostAt = Math.max(outage.ifLostService!, windowStart)
        const regainedAt = outage.ifRegainedService != null
          ? Math.min(outage.ifRegainedService, windowEnd)
          : windowEnd

        if (cursor < lostAt) {
          upSegments.push({ x: [cursor, lostAt], y: label })
        }
        downSegments.push({ x: [lostAt, regainedAt], y: label })
        downSegmentMeta.push({ outageId: outage.outageId })
        cursor = regainedAt
      }
      if (cursor < windowEnd) {
        upSegments.push({ x: [cursor, windowEnd], y: label })
      }
    }
  }

  return {
    datasets: [
      { label: 'Up',   backgroundColor: 'rgba(102,187,106,0.85)', borderWidth: 0, data: upSegments },
      { label: 'Down', backgroundColor: 'rgba(227,93,91,0.85)',   borderWidth: 0, data: downSegments }
    ],
    downSegmentMeta
  }
}

const useNodeAvailability = (nodeId: string) => {
  const availability = ref<NodeAvailability | null>(null)
  const chartData = ref<AvailabilityChartData | null>(null)
  const downSegmentMeta = ref<DownSegmentMeta[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null

    const now = Date.now()
    const windowStart = sub(now, { hours: 24 }).getTime()

    const [avResult, outageResult] = await Promise.all([
      getNodeAvailabilityPercentage(nodeId),
      getOutages({
        _s: `monitoredService.ipInterface.node.id==${nodeId};ifLostService=ge=${windowStart}`,
        limit: 0
      })
    ])

    if (!avResult) {
      error.value = 'Failed to load availability data'
      loading.value = false
      return
    }

    availability.value = avResult
    const outages = outageResult ? outageResult.outage : []
    const result = buildAvailabilityChartData(avResult, outages, windowStart, now)
    chartData.value = result.datasets as any
    downSegmentMeta.value = result.downSegmentMeta
    loading.value = false
  }

  fetch()

  return { availability, chartData, downSegmentMeta, loading, error }
}

export default useNodeAvailability
```

- [ ] **Step 4: Run test — expect PASS**
```bash
cd ui && pnpm run test -- tests/composables/useNodeAvailability.test.ts
```

- [ ] **Step 5: Commit**
```bash
git add ui/src/composables/useNodeAvailability.ts ui/tests/composables/useNodeAvailability.test.ts
git commit -m "feat(node-detail): add useNodeAvailability composable with Chart.js segment transform"
```

---

## Task 4: NodeHeader component

**Files:**
- Create: `ui/src/components/NodeDetail/NodeHeader.vue`

- [ ] **Step 1: Create `ui/src/components/NodeDetail/NodeHeader.vue`**

```vue
<template>
  <div class="node-header">
    <div class="node-header__title">
      <span class="headline2">{{ node.label }}</span>
      <span class="status-badge" :class="statusClass">{{ statusText }}</span>
    </div>
    <div class="node-header__meta subtitle1">
      <span v-if="node.location">Location: {{ node.location }}</span>
      <span v-if="node.foreignSource && node.foreignId" class="node-header__fssource">
        {{ node.foreignSource }}:{{ node.foreignId }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Node } from '@/types'

const props = defineProps<{ node: Node }>()

const statusText = computed(() => props.node.type === 'A' ? 'UP' : 'DOWN')
const statusClass = computed(() => props.node.type === 'A' ? 'status-badge--up' : 'status-badge--down')
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.node-header {
  padding: 12px 16px;
  background: var($surface);
  margin-bottom: 16px;
  &__title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  &__meta {
    display: flex;
    gap: 16px;
    margin-top: 4px;
    color: var($secondary-text-on-surface);
  }
  &__fssource {
    font-family: monospace;
    font-size: 0.85em;
  }
}
.status-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  &--up   { background: var($success); color: var($success-text-on-color); }
  &--down { background: var($error);   color: var($error-text-on-color); }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add ui/src/components/NodeDetail/NodeHeader.vue
git commit -m "feat(node-detail): add NodeHeader component"
```

---

## Task 5: NodeInfoPanel component

**Files:**
- Create: `ui/src/components/NodeDetail/NodeInfoPanel.vue`

- [ ] **Step 1: Create `ui/src/components/NodeDetail/NodeInfoPanel.vue`**

```vue
<template>
  <div class="info-panel card">
    <div class="headline4 info-panel__title">Node Information</div>
    <dl class="info-panel__list">
      <template v-if="node.sysName">
        <dt>Name</dt><dd>{{ node.sysName }}</dd>
      </template>
      <template v-if="node.sysObjectId">
        <dt>sysObjectID</dt><dd>{{ node.sysObjectId }}</dd>
      </template>
      <template v-if="node.sysLocation">
        <dt>Location</dt><dd>{{ node.sysLocation }}</dd>
      </template>
      <template v-if="node.sysContact">
        <dt>Contact</dt><dd>{{ node.sysContact }}</dd>
      </template>
      <template v-if="node.sysDescription">
        <dt>Description</dt><dd class="info-panel__desc">{{ node.sysDescription }}</dd>
      </template>
      <template v-if="node.assetRecord?.description">
        <dt>Asset</dt><dd class="info-panel__desc">{{ node.assetRecord.description }}</dd>
      </template>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { Node } from '@/types'
defineProps<{ node: Node }>()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.card {
  background: var($surface);
  padding: 16px;
  margin-bottom: 16px;
}
.info-panel {
  &__title { margin-bottom: 12px; }
  &__list {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;
    dt { color: var($secondary-text-on-surface); font-weight: 600; white-space: nowrap; }
    dd { margin: 0; word-break: break-word; }
  }
  &__desc { font-style: italic; }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add ui/src/components/NodeDetail/NodeInfoPanel.vue
git commit -m "feat(node-detail): add NodeInfoPanel component"
```

---

## Task 6: CategoryPanel component

**Files:**
- Create: `ui/src/components/NodeDetail/CategoryPanel.vue`

- [ ] **Step 1: Create `ui/src/components/NodeDetail/CategoryPanel.vue`**

```vue
<template>
  <div class="category-panel card">
    <div class="category-panel__header headline4">
      Categories
      <a v-if="isAdmin" :href="editCategoriesUrl" class="category-panel__edit subtitle2">Edit</a>
    </div>
    <div class="category-panel__chips">
      <span v-for="cat in node.categories" :key="cat.id" class="chip">{{ cat.name }}</span>
      <span v-if="!node.categories?.length" class="subtitle2" style="color: var(--feather-secondary-text-on-surface)">
        No categories assigned
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Node } from '@/types'

const props = defineProps<{ node: Node; isAdmin: boolean }>()
const editCategoriesUrl = computed(
  () => `/opennms/admin/categories.htm?node=${props.node.id}`
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.card { background: var($surface); padding: 16px; margin-bottom: 16px; }
.category-panel {
  &__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  &__edit { font-size: 0.85rem; color: var($clickable-normal); text-decoration: none; }
  &__chips { display: flex; flex-wrap: wrap; gap: 8px; }
}
.chip {
  background: var($shade-4);
  border-radius: 16px;
  padding: 2px 12px;
  font-size: 0.85rem;
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add ui/src/components/NodeDetail/CategoryPanel.vue
git commit -m "feat(node-detail): add CategoryPanel component"
```

---

## Task 7: AdminActionsBar component

**Files:**
- Create: `ui/src/components/NodeDetail/AdminActionsBar.vue`

- [ ] **Step 1: Create `ui/src/components/NodeDetail/AdminActionsBar.vue`**

```vue
<template>
  <div v-if="adminRole" class="admin-bar">
    <FeatherButton :disabled="rescanning" @click="rescan">
      {{ rescanning ? 'Rescanning…' : 'Rescan' }}
    </FeatherButton>

    <a v-if="hasSNMPPrimary" :href="updateSnmpUrl" class="admin-bar__link">
      Update SNMP
    </a>
    <a :href="scheduleOutageUrl" class="admin-bar__link">Schedule Outage</a>
    <a v-if="foreignSource" :href="editRequisitionUrl" class="admin-bar__link">
      Edit in Requisition
    </a>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import useRole from '@/composables/useRole'
import useSnackbar from '@/composables/useSnackbar'
import { v2 } from '@/services/axiosInstances'

const props = defineProps<{
  nodeId: string
  hasSNMPPrimary: boolean
  foreignSource?: string
}>()

const { adminRole } = useRole()
const { showSnackBar } = useSnackbar()

const rescanning = ref(false)

const rescan = async () => {
  rescanning.value = true
  try {
    await v2.put(`/nodes/${props.nodeId}/rescan`)
    showSnackBar({ msg: 'Node rescan triggered successfully.' })
  } catch {
    showSnackBar({ msg: 'Failed to trigger rescan.', error: true })
  } finally {
    rescanning.value = false
  }
}

const updateSnmpUrl     = computed(() => `/opennms/admin/snmpConfig.htm?node=${props.nodeId}`)
const scheduleOutageUrl = computed(() => `/opennms/admin/sched-outages/editoutage.jsp`)
const editRequisitionUrl = computed(
  () => `/opennms/admin/editForeignSource.jsp?foreignSource=${props.foreignSource}`
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.admin-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  flex-wrap: wrap;
  &__link {
    color: var($clickable-normal);
    text-decoration: none;
    font-size: 0.9rem;
    &:hover { text-decoration: underline; }
  }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add ui/src/components/NodeDetail/AdminActionsBar.vue
git commit -m "feat(node-detail): add AdminActionsBar with Rescan REST action and admin nav links"
```

---

## Task 8: AvailabilityPanel component

**Files:**
- Create: `ui/src/components/NodeDetail/AvailabilityPanel.vue`

This replaces `NodeAvailabilityGraph.vue` (which uses server-rendered PNG timeline).

- [ ] **Step 1: Create `ui/src/components/NodeDetail/AvailabilityPanel.vue`**

```vue
<template>
  <div class="availability-panel card">
    <div class="headline4 availability-panel__title">Availability (last 24 hours)</div>

    <div v-if="loading" class="availability-panel__skeleton">Loading…</div>
    <div v-else-if="error" class="availability-panel__error subtitle2">{{ error }}</div>

    <template v-else-if="availability">
      <!-- Percentage cards -->
      <div class="availability-panel__cards">
        <template v-for="iface in availability.ipinterfaces" :key="iface.id">
          <div
            v-for="svc in iface.services"
            :key="svc.id"
            class="avail-card"
            :class="severityClass(svc.availability)"
          >
            <div class="avail-card__name subtitle2">{{ svc.name }}</div>
            <div class="avail-card__ip caption">{{ iface.address }}</div>
            <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
          </div>
        </template>
      </div>

      <!-- Expandable timeline -->
      <button class="availability-panel__toggle subtitle2" @click="showChart = !showChart">
        {{ showChart ? '▲ Hide timeline' : '▼ Show timeline' }}
      </button>

      <div v-if="showChart" class="availability-panel__chart-wrap">
        <canvas ref="canvasRef" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Chart, registerables } from 'chart.js'
import { format } from 'date-fns'
import { NodeAvailability } from '@/types'
import { AvailabilityChartData, DownSegmentMeta } from '@/composables/useNodeAvailability'

Chart.register(...registerables)

const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  loading: boolean
  error: string | null
}>()

const showChart = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const formatPct = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

const severityClass = (pct: number) => {
  if (pct >= 99) return 'avail-card--green'
  if (pct >= 95) return 'avail-card--amber'
  return 'avail-card--red'
}

const now = Date.now()
const windowStart = now - 24 * 60 * 60 * 1000

const buildChart = () => {
  if (!canvasRef.value || !props.chartData) return
  chartInstance?.destroy()

  const serviceLabels = (props.availability?.ipinterfaces ?? []).flatMap(
    iface => iface.services.map(s => `${s.name} @ ${iface.address}`)
  )

  chartInstance = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels: serviceLabels,
      datasets: props.chartData as any
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: windowStart,
          max: now,
          stacked: false,
          ticks: {
            maxTicksLimit: 7,
            callback: (value) => format(new Date(value as number), 'HH:mm')
          }
        },
        y: { stacked: false }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      onClick: (_event, elements) => {
        if (elements.length && elements[0].datasetIndex === 1) {
          const meta = props.downSegmentMeta[elements[0].index]
          if (meta?.outageId) {
            window.location.href = `/opennms/outage/detail.htm?id=${meta.outageId}`
          }
        }
      }
    }
  })
}

watch(showChart, (visible) => {
  if (visible) {
    nextTick(buildChart)
  } else {
    chartInstance?.destroy()
    chartInstance = null
  }
})

onUnmounted(() => chartInstance?.destroy())
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.card { background: var($surface); padding: 16px; margin-bottom: 16px; }
.availability-panel {
  &__title   { margin-bottom: 12px; }
  &__skeleton, &__error { padding: 8px; color: var($secondary-text-on-surface); }
  &__cards   { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  &__toggle  { background: none; border: none; cursor: pointer; color: var($clickable-normal); padding: 4px 0; }
  &__chart-wrap { height: 200px; margin-top: 12px; }
}
.avail-card {
  border-radius: 8px;
  padding: 10px 16px;
  min-width: 120px;
  text-align: center;
  &__name { margin-bottom: 2px; }
  &__ip   { opacity: 0.7; margin-bottom: 4px; }
  &__pct  { font-weight: 700; }
  &--green { background: rgba(102,187,106,0.15); border: 1px solid rgba(102,187,106,0.5); }
  &--amber { background: rgba(255,193,7,0.15);   border: 1px solid rgba(255,193,7,0.5); }
  &--red   { background: rgba(227,93,91,0.15);   border: 1px solid rgba(227,93,91,0.5); }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add ui/src/components/NodeDetail/AvailabilityPanel.vue
git commit -m "feat(node-detail): add AvailabilityPanel with REST-driven percentage cards and Chart.js timeline"
```

---

## Task 9: Build out NodeDetails.vue container

**Files:**
- Modify: `ui/src/containers/NodeDetails.vue`

The existing file is a stub with breadcrumbs and a placeholder message. Replace it entirely.

- [ ] **Step 1: Rewrite `ui/src/containers/NodeDetails.vue`**

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
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
            :hasSNMPPrimary="!!node.primaryInterface"
            :foreignSource="node.foreignSource"
          />
        </template>
      </div>
    </div>

    <!-- Info + categories (two-column) -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-6">
        <NodeInfoPanel :node="node" />
      </div>
      <div class="feather-col-6">
        <CategoryPanel :node="node" :isAdmin="adminRole" />
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
        />
      </div>
    </div>

    <!-- Interfaces -->
    <div class="feather-row">
      <div class="feather-col-12">
        <InterfacesTabs />
      </div>
    </div>

    <!-- Events -->
    <div class="feather-row">
      <div class="feather-col-12">
        <EventsTable />
      </div>
    </div>

    <!-- Outages -->
    <div class="feather-row">
      <div class="feather-col-12">
        <OutagesTable />
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
import InterfacesTabs from '@/components/Nodes/InterfacesTabs.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import useNodeDetail from '@/composables/useNodeDetail'
import useNodeAvailability from '@/composables/useNodeAvailability'
import useRole from '@/composables/useRole'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const id = route.params.id as string

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
</script>

<style lang="scss" scoped>
.node-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }
}
</style>
```

- [ ] **Step 2: Run the full test suite to catch any regressions**
```bash
cd ui && pnpm run test
```
Expected: All existing tests pass. New tests pass.

- [ ] **Step 3: Build the Vue SPA to confirm no TypeScript/compile errors**
```bash
cd ui && pnpm run build
```
Expected: Build completes with no errors.

- [ ] **Step 4: Commit**
```bash
git add ui/src/containers/NodeDetails.vue
git commit -m "feat(node-detail): build out NodeDetails container with all panels assembled"
```

---

## Task 10: Update widget links to use Vue router

**Files:**
- Modify: `ui/src/components/Dashboard/widgets/NodesWidget.vue`
- Modify: `ui/src/components/Dashboard/widgets/AlarmsWidget.vue`
- Modify: `ui/src/components/Dashboard/widgets/OutagesWidget.vue`

NodesWidget has full Node objects — use `getNodeCriteria` for human-friendly links.
AlarmsWidget/OutagesWidget only have `nodeId` (no foreignSource) — use numeric ID via router-link.

- [ ] **Step 1: Update `NodesWidget.vue`**

Open `ui/src/components/Dashboard/widgets/NodesWidget.vue`. Find line ~51:
```html
<a :href="`/opennms/element/node.jsp?node=${node.id}`">{{ node.label }}</a>
```
Replace with:
```html
<router-link :to="`/node/${getNodeCriteria(node)}`">{{ node.label }}</router-link>
```
Add import at the top of the `<script setup>` block:
```typescript
import { getNodeCriteria } from '@/components/Nodes/utils'
```

- [ ] **Step 2: Update `AlarmsWidget.vue`**

Open `ui/src/components/Dashboard/widgets/AlarmsWidget.vue`. Find line ~54:
```html
<a :href="`/opennms/element/node.page?node=${alarm.nodeId}`">{{ alarm.nodeLabel }}</a>
```
Replace with:
```html
<router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link>
```

- [ ] **Step 3: Update `OutagesWidget.vue`**

Open `ui/src/components/Dashboard/widgets/OutagesWidget.vue`. Find line ~51:
```html
<a :href="`/opennms/element/node.page?node=${outage.nodeId}`">{{ outage.nodeLabel }}</a>
```
Replace with:
```html
<router-link :to="`/node/${outage.nodeId}`">{{ outage.nodeLabel }}</router-link>
```

- [ ] **Step 4: Build to confirm no errors**
```bash
cd ui && pnpm run build
```

- [ ] **Step 5: Commit**
```bash
git add ui/src/components/Dashboard/widgets/NodesWidget.vue \
        ui/src/components/Dashboard/widgets/AlarmsWidget.vue \
        ui/src/components/Dashboard/widgets/OutagesWidget.vue
git commit -m "feat(node-detail): update dashboard widget links to Vue router (#/node/:id)"
```

---

## Task 11: node.jsp redirect

**Files:**
- Modify: `opennms-webapp/src/main/webapp/element/node.jsp`

- [ ] **Step 1: Replace `node.jsp` with redirect**

Replace the entire contents of `opennms-webapp/src/main/webapp/element/node.jsp` with:

```jsp
<%--
  Redirects legacy node detail URL to the Vue SPA node detail page.
  Handles both ?node=123 (numeric) and ?node=foreignSource:foreignId formats
  since ElementUtil.getNodeId() passes the param value through as-is.
--%>
<%@ page import="org.opennms.web.element.ElementUtil" %>
<%
  try {
    String nodeId = ElementUtil.getNodeId(request, getServletContext());
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/node/" + nodeId);
  } catch (Exception e) {
    response.sendError(HttpServletResponse.SC_NOT_FOUND, "Node not found");
  }
%>
```

- [ ] **Step 2: Commit**
```bash
git add opennms-webapp/src/main/webapp/element/node.jsp
git commit -m "feat(node-detail): redirect node.jsp to Vue SPA at /#/node/:id"
```

---

## Task 12: Deploy overlay and E2E verify

- [ ] **Step 1: Build and deploy the overlay**
```bash
./build-dark-mode-overlay.sh
podman rm -f test-opennms 2>/dev/null
podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms -e OPENNMS_DBUSER=opennms -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
```
Wait for container to be ready (HTTP health check, max 60s / 12 polls):
```bash
for i in $(seq 1 12); do
  curl -sf http://localhost:8980/opennms/login.jsp > /dev/null && echo "Ready after ${i}x5s" && break
  echo "Waiting... ($i/12)"
  sleep 5
done
```

- [ ] **Step 2: Build and deploy Vue SPA**
```bash
cd ui && pnpm run build
podman cp src/main/dist/. test-opennms:/opt/opennms/jetty-webapps/opennms/ui/
```

- [ ] **Step 3: Run E2E checklist**

| # | Test | Expected |
|---|------|----------|
| 1 | Navigate to `http://localhost:8980/opennms/element/node.jsp?node=1` | Redirects to `/#/node/1` |
| 2 | Click a node in the dashboard Nodes widget | Navigates to `/#/node/foreignSource:foreignId` (human-friendly URL) |
| 3 | Click a node label in Alarms widget | Navigates to `/#/node/{nodeId}` |
| 4 | NodeHeader shows label, location, UP badge | ✓ |
| 5 | NodeInfoPanel shows SNMP attributes | ✓ |
| 6 | CategoryPanel shows category chips | ✓ |
| 7 | Availability cards render with correct colors (≥99% green) | ✓ |
| 8 | Click "Show timeline" — Chart.js horizontal bar chart appears | ✓ |
| 9 | Red outage bar is clickable → opens `/opennms/outage/detail.htm?id=...` | ✓ |
| 10 | IP and SNMP interfaces tabs load | ✓ |
| 11 | Recent events panel loads | ✓ |
| 12 | Recent outages panel loads | ✓ |
| 13 | As admin: Rescan button visible, clicking fires PUT rescan + shows toast | ✓ |
| 14 | As non-admin: AdminActionsBar hidden | ✓ |
| 15 | Test in dark mode: no hardcoded colors, all panels themed | ✓ |
| 16 | Node with no foreignSource: URL uses numeric ID (`/#/node/42`) | ✓ |
| 17 | Node with no SNMP primary: Update SNMP link hidden | ✓ |
| 18 | Node not in requisition: Edit in Requisition link hidden | ✓ |

- [ ] **Step 4: Final commit (if any fixups from E2E)**

Squash any fixup commits before push per `feedback_squash_before_push`:
```bash
git rebase -i HEAD~N  # squash iterative fixes into logical task commits
```

---

## Notes

- `EventsTable.vue` and `OutagesTable.vue` read `route.params.id` internally — they self-fetch for the current route's node ID without needing props.
- `InterfacesTabs.vue` similarly manages its own data fetching.
- `NodeAvailabilityGraph.vue` (the old PNG-based component) is NOT deleted — it's just no longer used in `NodeDetails.vue`. Leave it in place until a cleanup PR.
- The `FeatherButton` `loading` prop triggers a built-in spinner; no custom spinner needed for Rescan.
- Do not delete Vaadin's `features/vaadin-jmxconfiggenerator/` or `features/vaadin-dashboard/` yet — removal is a separate PR after full validation.
