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
      <div class="outages-list__table-wrap">
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
      </div>

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
import { usePerspectiveStore } from '@/stores/perspectiveStore'

const router = useRouter()
const perspectiveStore = usePerspectiveStore()

const STATUS_OPTIONS = [
  { label: 'Current', value: 'current' as const },
  { label: 'All',     value: 'all'     as const }
]

const PAGE_SIZE = 25

const outages    = ref<Outage[]>([])
const totalCount = ref(0)
const loading    = ref(false)
const error      = ref<string | null>(null)

const page       = ref(0)
const sortField  = ref('ifLostService')
const sortDesc   = ref(true)

const statusFilter = ref<'current' | 'all'>(perspectiveStore.isProblems ? 'current' : 'all')
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
    order: sortDesc.value ? SORT.DESCENDING : SORT.ASCENDING
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

watch(
  () => perspectiveStore.perspective,
  (p) => {
    statusFilter.value = p === 'problems' ? 'current' : 'all'
    page.value = 0
    load()
  }
)

onUnmounted(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
})

onMounted(() => load())
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
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
    border-radius: vars.$border-radius-surface;
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
    border-radius: vars.$border-radius-surface;
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
    border-radius: vars.$border-radius-surface;
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
    border-radius: vars.$border-radius-surface;
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

  &__table-wrap {
    overflow-x: auto;
  }

  &__table {
    min-width: 100%;
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
      border-radius: vars.$border-radius-surface;
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
