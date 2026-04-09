# Outage Pages — Vue Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JSP outage list and detail pages with Vue SPA equivalents, consistent with the Alarms/Events pattern.

**Architecture:** Three new Vue files (container + list table + detail), one new service function, extended Outage type, two new router routes, and one menu URL change. No Spring/servlet changes. Legacy JSP URLs remain accessible but unlinked.

**Tech Stack:** Vue 3 Composition API, TypeScript, Axios (v2 instance at `/opennms/api/v2`), Vue Router, SCSS with Feather DS tokens.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Modify** | `ui/src/types/index.ts` | Add missing fields to `Outage` interface |
| **Modify** | `ui/src/services/outageService.ts` | Add `getOutage(id)` single-record fetch |
| **Create** | `ui/src/components/Outages/OutagesListTable.vue` | Sortable, filterable, paginated outage table |
| **Create** | `ui/src/containers/Outages.vue` | List page — breadcrumb + OutagesListTable |
| **Create** | `ui/src/containers/OutageDetail.vue` | Detail page — fetch by ID, display fields |
| **Modify** | `ui/src/main/router/index.ts` | Add `/outages` and `/outage/:id` routes |
| **Modify** | `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-default.json` | Point Outages menu link to Vue SPA |
| **Modify** | `ui/tests/datasource/opennms-client.test.ts` | Add `getOutage` unit tests |

---

## Task 1: Extend Outage type

**Files:**
- Modify: `ui/src/types/index.ts`

- [ ] **Step 1: Locate the Outage interface**

Open `ui/src/types/index.ts` and find the `Outage` interface (currently around line 295). It looks like:

```ts
export interface Outage {
  id: number
  nodeId: number
  ipAddress: string
  serviceId: number
  nodeLabel: string
  location: string
  hostname: string
  serviceName?: string
  outageId?: number
  ifLostService?: number
  ifRegainedService?: number | null
  monitoredService?: {
    serviceType?: { name: string; id: number }
    [key: string]: unknown
  }
}
```

- [ ] **Step 2: Add missing detail fields**

Replace the interface with:

```ts
export interface Outage {
  id: number
  nodeId: number
  ipAddress: string
  serviceId: number
  nodeLabel: string
  location: string
  hostname: string
  serviceName?: string
  /** v2 API outage ID field */
  outageId?: number
  ifLostService?: number        // ms timestamp — present in v2 API responses
  ifRegainedService?: number | null  // null means still active
  monitoredService?: {
    serviceType?: { name: string; id: number }
    [key: string]: unknown
  }
  /** ID of the event that caused the outage (lost service event) */
  lostServiceEventId?: number
  /** ID of the event that resolved the outage (regained service event) */
  regainedServiceEventId?: number | null
  /** Location from which the outage was detected (perspective monitoring) */
  perspectiveLocation?: string | null
  /** Requisition (foreign source) the node belongs to */
  foreignSource?: string | null
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/types/index.ts
git commit -m "feat(types): add detail fields to Outage interface"
```

---

## Task 2: Add getOutage service function + tests

**Files:**
- Modify: `ui/src/services/outageService.ts`
- Modify: `ui/tests/datasource/opennms-client.test.ts`

The `v2` axios instance in `ui/src/services/axiosInstances.ts` has `baseURL: '/opennms/api/v2'`. So `v2.get('/outages/42')` hits `GET /opennms/api/v2/outages/42`.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block at the bottom of `ui/tests/datasource/opennms-client.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
// (existing imports stay at top of file)
import { getOutage, getOutages } from '@/services/outageService'

describe('outageService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getOutage', () => {
    test('fetches a single outage by ID', async () => {
      const mockOutage = {
        id: 42,
        nodeId: 1,
        ipAddress: '192.168.1.1',
        serviceId: 1,
        nodeLabel: 'test-node',
        location: 'Default',
        hostname: 'test-node',
        ifLostService: 1700000000000,
        ifRegainedService: null,
        lostServiceEventId: 100,
        regainedServiceEventId: null,
        perspectiveLocation: null,
        foreignSource: 'Test'
      }

      vi.mock('@/services/axiosInstances', () => ({
        v2: {
          get: vi.fn().mockResolvedValue({ status: 200, data: mockOutage })
        }
      }))

      const result = await getOutage(42)
      expect(result).toMatchObject({ id: 42, nodeLabel: 'test-node' })
    })

    test('returns false on API error', async () => {
      vi.mock('@/services/axiosInstances', () => ({
        v2: {
          get: vi.fn().mockRejectedValue(new Error('Network error'))
        }
      }))

      const result = await getOutage(99)
      expect(result).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chance/git/opennms/ui
../../target/node/yarn/dist/bin/yarn test --run tests/datasource/opennms-client.test.ts 2>&1 | tail -20
```

Expected: FAIL — `getOutage is not exported from outageService`

- [ ] **Step 3: Add getOutage to outageService.ts**

Add the following to `ui/src/services/outageService.ts`, below `getActiveOutageCount`:

```ts
const getOutage = async (id: number | string): Promise<Outage | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${id}`)
    return resp.data as Outage
  } catch {
    return false
  }
}
```

Also add `Outage` to the import from `@/types` at the top of the file:

```ts
import { v2 } from './axiosInstances'
import { type Outage, OutagesApiResponse } from '@/types'
```

And add `getOutage` to the export at the bottom:

```ts
export { getOutages, getActiveOutages, getActiveOutageCount, buildActiveOutageCriteria, getOutage }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui
../../target/node/yarn/dist/bin/yarn test --run tests/datasource/opennms-client.test.ts 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/outageService.ts ui/tests/datasource/opennms-client.test.ts
git commit -m "feat(outages): add getOutage service function with tests"
```

---

## Task 3: OutagesListTable component

**Files:**
- Create: `ui/src/components/Outages/OutagesListTable.vue`

This mirrors `ui/src/components/Alarms/AlarmsListTable.vue` but is simpler — no severity chips, no ack actions. Columns: ID, Requisition, Node, Location, Interface, Service, Down Since, Restored, Perspective.

- [ ] **Step 1: Create the component**

Create `ui/src/components/Outages/OutagesListTable.vue`:

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <!-- Filter bar -->
  <div class="outages-list__filters">
    <div class="outages-list__filter-group">
      <span class="outages-list__filter-label caption">Status</span>
      <div class="outages-list__seg-group">
        <button
          v-for="opt in STATUS_OPTIONS"
          :key="opt.value"
          class="outages-list__seg-btn"
          :class="{ active: statusFilter === opt.value }"
          @click="statusFilter = opt.value; page = 0; load()"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div class="outages-list__filter-group outages-list__filter-group--grow">
      <span class="outages-list__filter-label caption">Node</span>
      <input
        v-model="nodeSearch"
        type="text"
        placeholder="Search by node label…"
        class="outages-list__search-input"
      />
    </div>
  </div>

  <!-- Loading skeleton -->
  <div v-if="loading && !outages.length" class="outages-list__skeleton">
    <div v-for="i in 5" :key="i" class="outages-list__skeleton-row" />
  </div>

  <!-- Error -->
  <div v-else-if="error" class="outages-list__error">
    <span>{{ error }}</span>
    <button class="outages-list__retry-btn" @click="load">Retry</button>
  </div>

  <template v-else>
    <!-- Empty state -->
    <div v-if="!outages.length" class="outages-list__empty">
      <div class="subtitle2">{{ statusFilter === 'current' ? 'No active outages' : 'No outages found' }}</div>
    </div>

    <template v-else>
      <table class="outages-list__table">
        <thead>
          <tr>
            <th class="sortable" @click="setSort('id')">ID<span class="sort-icon">{{ sortIndicator('id') }}</span></th>
            <th>Requisition</th>
            <th class="sortable" @click="setSort('node.label')">Node<span class="sort-icon">{{ sortIndicator('node.label') }}</span></th>
            <th>Location</th>
            <th>Interface</th>
            <th>Service</th>
            <th class="sortable" @click="setSort('ifLostService')">Down Since<span class="sort-icon">{{ sortIndicator('ifLostService') }}</span></th>
            <th class="sortable" @click="setSort('ifRegainedService')">Restored<span class="sort-icon">{{ sortIndicator('ifRegainedService') }}</span></th>
            <th>Perspective</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="outage in outages"
            :key="outage.id"
            class="outages-list__row"
            :class="outage.ifRegainedService == null ? 'outages-list__row--active' : ''"
            @click="router.push(`/outage/${outage.id}`)"
          >
            <td class="outages-list__mono">{{ outage.id }}</td>
            <td>{{ outage.foreignSource ?? '—' }}</td>
            <td>
              <router-link v-if="outage.nodeId" :to="`/node/${outage.nodeId}`" @click.stop>
                {{ outage.nodeLabel }}
              </router-link>
              <span v-else>—</span>
            </td>
            <td>{{ outage.location ?? '—' }}</td>
            <td class="outages-list__mono">
              <a
                v-if="outage.ipAddress && outage.nodeId"
                :href="`/opennms/element/interface.jsp?node=${outage.nodeId}&intf=${outage.ipAddress}`"
                @click.stop
              >{{ outage.ipAddress }}</a>
              <span v-else-if="outage.ipAddress">{{ outage.ipAddress }}</span>
              <span v-else>—</span>
            </td>
            <td>
              <a
                v-if="outage.serviceName && outage.nodeId && outage.ipAddress"
                :href="`/opennms/element/service.jsp?node=${outage.nodeId}&intf=${outage.ipAddress}&service=${outage.serviceId}`"
                @click.stop
              >{{ outage.serviceName }}</a>
              <span v-else-if="outage.serviceName">{{ outage.serviceName }}</span>
              <span v-else>—</span>
            </td>
            <td v-date>{{ outage.ifLostService }}</td>
            <td>
              <span v-if="outage.ifRegainedService != null" v-date>{{ outage.ifRegainedService }}</span>
              <span v-else class="outages-list__status-active">Active</span>
            </td>
            <td>{{ outage.perspectiveLocation ?? '—' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="outages-list__pagination">
        <span class="caption outages-list__pagination-info">{{ paginationText }}</span>
        <div class="outages-list__pagination-btns">
          <button :disabled="page === 0" @click="page--; load()">Previous</button>
          <button :disabled="(page + 1) * PAGE_SIZE >= totalCount" @click="page++; load()">Next</button>
        </div>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { getOutages } from '@/services/outageService'
import { type Outage } from '@/types'
import { SORT } from '@featherds/table'

const router = useRouter()

const STATUS_OPTIONS = [
  { label: 'Current', value: 'current' as const },
  { label: 'All',     value: 'all'     as const },
]

const PAGE_SIZE = 25

const outages    = ref<Outage[]>([])
const totalCount = ref(0)
const loading    = ref(false)
const error      = ref<string | null>(null)

const page       = ref(0)
const sortField  = ref('ifLostService')
const sortDesc   = ref(true)

const statusFilter = ref<'current' | 'all'>('current')
const nodeSearch   = ref('')

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const buildCriteria = (): string => {
  const parts: string[] = []
  if (statusFilter.value === 'current') parts.push('ifRegainedService==null')
  if (nodeSearch.value.trim()) parts.push(`node.label==*${nodeSearch.value.trim()}*`)
  return parts.join(';')
}

const load = async () => {
  loading.value = true
  error.value = null

  const params: Record<string, string | number> = {
    limit: PAGE_SIZE,
    offset: page.value * PAGE_SIZE,
    orderBy: sortField.value,
    order: sortDesc.value ? SORT.DESCENDING : SORT.ASCENDING,
  }

  const criteria = buildCriteria()
  if (criteria) params._s = criteria

  const resp = await getOutages(params)
  loading.value = false

  if (!resp) {
    error.value = 'Failed to load outages.'
    return
  }

  outages.value = resp.outage
  totalCount.value = resp.totalCount
}

const setSort = (field: string) => {
  if (sortField.value === field) {
    sortDesc.value = !sortDesc.value
  } else {
    sortField.value = field
    sortDesc.value = true
  }
  page.value = 0
  load()
}

const sortIndicator = (field: string): string => {
  if (sortField.value !== field) return ''
  return sortDesc.value ? ' ▼' : ' ▲'
}

const paginationText = computed(() => {
  if (totalCount.value === 0) return 'No outages'
  const start = page.value * PAGE_SIZE + 1
  const end = Math.min((page.value + 1) * PAGE_SIZE, totalCount.value)
  return `Showing ${start}–${end} of ${totalCount.value} outages`
})

watch(nodeSearch, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 0
    load()
  }, 300)
})

onUnmounted(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
})

onMounted(() => load())
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.outages-list {
  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var($border-light-on-surface);
    align-items: flex-end;
  }

  &__filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    &--grow { flex: 1; min-width: 180px; }
  }

  &__filter-label {
    @include body-small;
    color: var($secondary-text-on-surface);
    font-weight: 600;
  }

  &__seg-group {
    display: flex;
    border: 1px solid var($border-light-on-surface);
    border-radius: 4px;
    overflow: hidden;
  }

  &__seg-btn {
    @include body-small;
    background: none;
    border: none;
    border-right: 1px solid var($border-light-on-surface);
    padding: 4px 10px;
    cursor: pointer;
    color: var($primary-text-on-surface);
    &:last-child { border-right: none; }
    &:hover { background: var($shade-4); }
    &.active {
      background: var($primary);
      color: var($primary-text-on-color);
    }
  }

  &__search-input {
    @include body-large;
    background: var($surface);
    border: 1px solid var($border-light-on-surface);
    border-radius: 4px;
    padding: 4px 10px;
    color: var($primary-text-on-surface);
    width: 100%;
    &:focus { outline: 2px solid var($primary); outline-offset: -1px; }
  }

  &__skeleton {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__skeleton-row {
    height: 36px;
    border-radius: 4px;
    background: var($shade-4);
    animation: shimmer 1.4s infinite;
  }

  &__error {
    padding: 24px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var($error);
    @include body-large;
  }

  &__retry-btn {
    @include body-small;
    background: none;
    border: 1px solid var($primary);
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
    color: var($primary);
    &:hover { background: var($shade-4); }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 16px;
    gap: 8px;
    color: var($primary-text-on-surface);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;

    th, td {
      @include body-small;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var($border-light-on-surface);
    }

    th {
      @include subtitle2;
      color: var($secondary-text-on-surface);
      font-weight: 600;
      white-space: nowrap;
      &.sortable { cursor: pointer; user-select: none; &:hover { color: var($primary-text-on-surface); } }
    }

    a {
      color: var($clickable-normal);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  }

  &__row {
    cursor: pointer;
    &:hover td { background: var($shade-4); }
    &--active td:first-child { border-left: 3px solid var($error); }
  }

  &__mono {
    font-variant-numeric: tabular-nums;
    font-family: monospace;
  }

  &__status-active {
    color: var($error);
    font-weight: 600;
    @include body-small;
  }

  &__pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-top: 1px solid var($border-light-on-surface);
  }

  &__pagination-info { color: var($secondary-text-on-surface); }

  &__pagination-btns {
    display: flex;
    gap: 8px;
    button {
      @include body-small;
      background: none;
      border: 1px solid var($border-light-on-surface);
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      color: var($primary-text-on-surface);
      &:hover:not(:disabled) { background: var($shade-4); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }
}

@keyframes shimmer {
  0%   { opacity: 1; }
  50%  { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/Outages/OutagesListTable.vue
git commit -m "feat(outages): add OutagesListTable component"
```

---

## Task 4: Outages container (list page)

**Files:**
- Create: `ui/src/containers/Outages.vue`

- [ ] **Step 1: Create the container**

Create `ui/src/containers/Outages.vue`:

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
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
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/Outages.vue
git commit -m "feat(outages): add Outages list container"
```

---

## Task 5: OutageDetail container (detail page)

**Files:**
- Create: `ui/src/containers/OutageDetail.vue`

- [ ] **Step 1: Create the container**

Create `ui/src/containers/OutageDetail.vue`:

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <!-- Error state -->
  <div v-if="error && !loading" class="feather-row">
    <div class="feather-col-12 outage-detail__error">
      <p class="headline4">Outage not found</p>
      <p class="subtitle1">{{ error }}</p>
      <router-link to="/outages">← Back to Outages</router-link>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 outage-detail__skeleton headline3">Loading outage…</div>
  </div>

  <template v-else-if="outage">
    <div class="feather-row">
      <div class="feather-col-12">
        <div :class="['card', 'outage-detail__header', outage.ifRegainedService == null ? 'outage-detail__header--active' : 'outage-detail__header--resolved']">
          <div class="headline3">Outage {{ outage.id }}</div>
          <div class="subtitle1">{{ outage.ifRegainedService == null ? 'Active' : 'Resolved' }}</div>
        </div>
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Details</div>
          <dl class="outage-detail__grid">
            <dt>Node</dt>
            <dd>
              <router-link v-if="outage.nodeId" :to="`/node/${outage.nodeId}`">{{ outage.nodeLabel }}</router-link>
              <span v-else>—</span>
            </dd>

            <dt>Requisition</dt>
            <dd>{{ outage.foreignSource ?? '—' }}</dd>

            <dt>Interface</dt>
            <dd>
              <a
                v-if="outage.ipAddress && outage.nodeId"
                :href="`/opennms/element/interface.jsp?node=${outage.nodeId}&intf=${outage.ipAddress}`"
              >{{ outage.ipAddress }}</a>
              <span v-else-if="outage.ipAddress">{{ outage.ipAddress }}</span>
              <span v-else>—</span>
            </dd>

            <dt>Service</dt>
            <dd>
              <a
                v-if="outage.serviceName && outage.nodeId && outage.ipAddress"
                :href="`/opennms/element/service.jsp?node=${outage.nodeId}&intf=${outage.ipAddress}&service=${outage.serviceId}`"
              >{{ outage.serviceName }}</a>
              <span v-else-if="outage.serviceName">{{ outage.serviceName }}</span>
              <span v-else>—</span>
            </dd>

            <dt>Down Since</dt>
            <dd v-date>{{ outage.ifLostService }}</dd>

            <dt>Lost Service Event</dt>
            <dd>
              <router-link v-if="outage.lostServiceEventId" :to="`/event/${outage.lostServiceEventId}`">
                {{ outage.lostServiceEventId }}
              </router-link>
              <span v-else>—</span>
            </dd>

            <dt>Restored</dt>
            <dd>
              <span v-if="outage.ifRegainedService != null" v-date>{{ outage.ifRegainedService }}</span>
              <span v-else class="outage-detail__status-active">Active</span>
            </dd>

            <dt>Restored Event</dt>
            <dd>
              <router-link v-if="outage.regainedServiceEventId" :to="`/event/${outage.regainedServiceEventId}`">
                {{ outage.regainedServiceEventId }}
              </router-link>
              <span v-else>—</span>
            </dd>

            <template v-if="outage.perspectiveLocation">
              <dt>Perspective</dt>
              <dd>{{ outage.perspectiveLocation }}</dd>
            </template>

            <template v-if="outage.location">
              <dt>Monitoring Location</dt>
              <dd>{{ outage.location }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getOutage } from '@/services/outageService'
import { useMenuStore } from '@/stores/menuStore'
import { type Outage, type BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const id = route.params.id as string

const outage  = ref<Outage | null>(null)
const loading = ref(true)
const error   = ref<string | null>(null)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home',    to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Outages', to: '/outages' },
  { label: `Outage ${id}`, to: '#', position: 'last' }
])

onMounted(async () => {
  const result = await getOutage(id)
  loading.value = false
  if (!result) {
    error.value = `No outage found with ID ${id}.`
  } else {
    outage.value = result
  }
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/mixins/elevation";

.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;

  &__section-title { margin-bottom: 12px; }
}

.outage-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }

  &__header {
    margin-bottom: 16px;
    border-left: 4px solid transparent;

    &--active   { border-left-color: var($error); }
    &--resolved { border-left-color: var($success); }
  }

  &__grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;

    dt {
      color: var($secondary-text-on-surface);
      font-weight: 600;
      white-space: nowrap;
    }

    dd {
      margin: 0;
      word-break: break-word;

      a {
        color: var($clickable-normal);
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }
  }

  &__status-active {
    color: var($error);
    font-weight: 600;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/OutageDetail.vue
git commit -m "feat(outages): add OutageDetail container"
```

---

## Task 6: Add Vue router routes

**Files:**
- Modify: `ui/src/main/router/index.ts`

- [ ] **Step 1: Add the two routes**

In `ui/src/main/router/index.ts`, find the block containing the existing `/alarm/:id` route (around line 180). Add the outage routes immediately after it:

```ts
    {
      path: '/outages',
      name: 'Outages',
      component: () => import('@/containers/Outages.vue')
    },
    {
      path: '/outage/:id',
      name: 'Outage Detail',
      component: () => import('@/containers/OutageDetail.vue')
    },
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/main/router/index.ts
git commit -m "feat(outages): add /outages and /outage/:id routes"
```

---

## Task 7: Update menu link

**Files:**
- Modify: `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-default.json`

- [ ] **Step 1: Update the Outages menu entry**

Find the outages entry (around line 163):

```json
{
  "id": "outages",
  "name": "Outages",
  "url": "outage/index.jsp",
  "locationMatch": "outage",
  "roles": null
},
```

Change `"url"` to:

```json
{
  "id": "outages",
  "name": "Outages",
  "url": "ui/index.html#/outages",
  "locationMatch": "outage",
  "roles": null
},
```

- [ ] **Step 2: Commit**

```bash
git add opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-default.json
git commit -m "feat(menu): point Outages menu item to Vue SPA route"
```

---

## Task 8: Build, deploy, and verify

**Files:** None (build + deploy steps)

- [ ] **Step 1: Build the Vue SPA**

```bash
cd /Users/chance/git/opennms/ui
/Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: exit 0, no errors.

- [ ] **Step 2: Verify built index.html references hashed assets**

```bash
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: one match like `assets/index-AbCdEfGh.js`.

- [ ] **Step 3: Verify CSS has no bare --feather-* values**

```bash
grep -c '\-\-feather-' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css || echo "0"
```

Expected: 0 (all `--feather-*` must be inside `var()`).

- [ ] **Step 4: Deploy to container**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

Expected: deploy script exits 0.

- [ ] **Step 5: Verify live bundle hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Both lines must be identical.

- [ ] **Step 6: Verify the JS bundle is served**

```bash
HASH=$(grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html)
curl -s -o /dev/null -w "%{http_code}" -L "http://localhost:8980/opennms/ui/$HASH"
```

Expected: `200`

- [ ] **Step 7: Smoke-test the list route**

```bash
curl -s -o /dev/null -w "%{http_code}" -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/outages?limit=1"
```

Expected: `200` or `204` (confirms the API the Vue list calls is reachable)

- [ ] **Step 8: Tell user to verify in browser**

Navigate to `http://localhost:8980/opennms/ui/#/outages` — verify:
- List loads with Current filter active
- Clicking a row navigates to `/outage/:id` and shows the detail card
- Node links navigate to the Vue NodeDetails page
- Menu "Outages" item navigates to the Vue list

Hard-refresh with `Cmd+Shift+R` before testing.
