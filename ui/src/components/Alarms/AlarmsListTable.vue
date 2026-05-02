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
  <div class="alarms-list__filters">
    <div class="alarms-list__filter-group">
      <span class="alarms-list__filter-label caption">Severity</span>
      <div class="alarms-list__severity-chips">
        <button
          v-for="sev in ALL_SEVERITIES"
          :key="sev"
          class="sev-toggle"
          :class="[sev.toLowerCase(), { active: selectedSeverities.includes(sev) }]"
          @click="toggleSeverity(sev)"
        >{{ sev }}</button>
      </div>
    </div>

    <div class="alarms-list__filter-group">
      <span class="alarms-list__filter-label caption">Status</span>
      <div class="alarms-list__seg-group">
        <button
          v-for="opt in ACK_OPTIONS"
          :key="opt.value"
          class="alarms-list__seg-btn"
          :class="{ active: ackStatus === opt.value }"
          @click="ackStatus = opt.value; page = 0; load()"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div class="alarms-list__filter-group alarms-list__filter-group--grow">
      <span class="alarms-list__filter-label caption">Node</span>
      <input
        v-model="nodeSearch"
        type="text"
        placeholder="Search by node label…"
        class="alarms-list__search-input"
      />
    </div>

    <div class="alarms-list__filter-group">
      <span class="alarms-list__filter-label caption">Time Range</span>
      <div class="alarms-list__seg-group">
        <button
          v-for="opt in TIME_OPTIONS"
          :key="opt.value"
          class="alarms-list__seg-btn"
          :class="{ active: timeRange === opt.value }"
          @click="timeRange = opt.value; page = 0; load()"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div class="alarms-list__filter-group alarms-list__col-menu-wrap">
      <button class="alarms-list__col-btn" @click.stop="showColumnMenu = !showColumnMenu">
        Columns ▾
      </button>
      <div v-if="showColumnMenu" class="alarms-list__col-menu" @click.stop>
        <label v-for="col in COLUMN_DEFS" :key="col.key" class="alarms-list__col-item">
          <input type="checkbox" :checked="isVisible(col.key)" @change="toggleColumn(col.key)" />
          {{ col.label }}
        </label>
      </div>
    </div>
  </div>

  <!-- Loading skeleton -->
  <div v-if="loading && !alarms.length" class="alarms-list__skeleton">
    <div v-for="i in 3" :key="i" class="alarms-list__skeleton-row" />
  </div>

  <!-- Error -->
  <div v-else-if="error" class="alarms-list__error">
    <span>{{ error }}</span>
    <button class="alarms-list__retry-btn" @click="load">Retry</button>
  </div>

  <template v-else>
    <!-- Empty state -->
    <div v-if="!alarms.length" class="alarms-list__empty">
      <i class="pi pi-check-circle alarms-list__empty-icon" />
      <div class="subtitle2">{{ hasActiveFilters ? 'No alarms match your filters' : 'No alarms found' }}</div>
      <button v-if="hasActiveFilters" class="alarms-list__reset-link" @click="resetFilters">Reset filters</button>
    </div>

    <template v-else>
      <div class="alarms-list__table-wrap">
      <table class="alarms-list__table">
        <thead>
          <tr>
            <th v-if="isVisible('severity')" class="sortable" @click="setSort('severity')">Severity<span class="sort-icon">{{ sortIndicator('severity') }}</span></th>
            <th v-if="isVisible('id')" class="sortable" @click="setSort('id')">ID<span class="sort-icon">{{ sortIndicator('id') }}</span></th>
            <th v-if="isVisible('nodeLabel')">Node</th>
            <th v-if="isVisible('service')">Service</th>
            <th v-if="isVisible('ipAddress')">IP</th>
            <th v-if="isVisible('count')" class="sortable" @click="setSort('count')">Count<span class="sort-icon">{{ sortIndicator('count') }}</span></th>
            <th v-if="isVisible('lastEventTime')" class="sortable" @click="setSort('lastEventTime')">Last Event<span class="sort-icon">{{ sortIndicator('lastEventTime') }}</span></th>
            <th v-if="isVisible('firstEventTime')" class="sortable" @click="setSort('firstEventTime')">First Event<span class="sort-icon">{{ sortIndicator('firstEventTime') }}</span></th>
            <th v-if="isVisible('ackStatus')">Ack</th>
            <th v-if="isVisible('logMessage')" class="alarms-list__col-wide">Log Message</th>
            <th v-if="isVisible('description')" class="alarms-list__col-wide">Description</th>
            <th v-if="isVisible('uei')">UEI</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="alarm in alarms"
            :key="alarm.id"
            class="alarms-list__row"
            @click="router.push(`/alarm/${alarm.id}`)"
          >
            <td v-if="isVisible('severity')"><SeverityBadge :severity="alarm.severity" /></td>
            <td v-if="isVisible('id')" class="alarms-list__mono">{{ alarm.id }}</td>
            <td v-if="isVisible('nodeLabel')">
              <router-link :to="`/node/${alarm.nodeId}`" @click.stop>{{ alarm.nodeLabel }}</router-link>
            </td>
            <td v-if="isVisible('service')">{{ alarm.serviceType?.name ?? '—' }}</td>
            <td v-if="isVisible('ipAddress')" class="alarms-list__mono">{{ alarm.ipAddress ?? '—' }}</td>
            <td v-if="isVisible('count')">{{ alarm.count }}</td>
            <td v-if="isVisible('lastEventTime')" v-date>{{ alarm.lastEventTime }}</td>
            <td v-if="isVisible('firstEventTime')" v-date>{{ alarm.firstEventTime }}</td>
            <td v-if="isVisible('ackStatus')" class="alarms-list__ack-cell">
              <span v-if="alarm.ackTime" class="caption alarms-list__ack-user" :title="`Acked by ${alarm.ackUser}`">
                {{ alarm.ackUser }}
              </span>
            </td>
            <td v-if="isVisible('logMessage')" class="alarms-list__html-cell" @click.stop>
              <div class="alarms-list__html-cell-inner">
                <button
                  v-if="alarm.logMessage"
                  class="alarms-list__html-badge"
                  :class="{ active: isRaw(alarm.id, 'logMessage') }"
                  title="Toggle raw HTML"
                  @click="toggleRaw(alarm.id, 'logMessage')"
                >HTML</button>
                <pre v-if="isRaw(alarm.id, 'logMessage')" class="alarms-list__raw-text">{{ alarm.logMessage }}</pre>
                <span v-else v-html="alarm.logMessage ?? '—'" class="alarms-list__html-content" />
              </div>
            </td>
            <td v-if="isVisible('description')" class="alarms-list__html-cell" @click.stop>
              <div class="alarms-list__html-cell-inner">
                <button
                  v-if="alarm.description"
                  class="alarms-list__html-badge"
                  :class="{ active: isRaw(alarm.id, 'description') }"
                  title="Toggle raw HTML"
                  @click="toggleRaw(alarm.id, 'description')"
                >HTML</button>
                <pre v-if="isRaw(alarm.id, 'description')" class="alarms-list__raw-text">{{ alarm.description }}</pre>
                <span v-else v-html="alarm.description ?? '—'" class="alarms-list__html-content" />
              </div>
            </td>
            <td v-if="isVisible('uei')" class="alarms-list__mono alarms-list__uei-cell">{{ alarm.uei }}</td>
            <td class="alarms-list__actions" @click.stop>
              <button
                class="alarms-list__action-btn"
                :title="alarm.ackTime ? 'Unacknowledge' : 'Acknowledge'"
                :disabled="actionLoading[alarm.id] != null"
                @click="doAction(alarm, alarm.ackTime ? 'unack' : 'ack')"
              >{{ alarm.ackTime ? '✓' : '○' }}</button>
              <button
                class="alarms-list__action-btn"
                title="Escalate"
                :disabled="actionLoading[alarm.id] != null"
                @click="doAction(alarm, 'escalate')"
              >↑</button>
              <button
                class="alarms-list__action-btn alarms-list__action-btn--danger"
                title="Clear"
                :disabled="actionLoading[alarm.id] != null"
                @click="doAction(alarm, 'clear')"
              >✕</button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <!-- Pagination -->
      <div class="alarms-list__pagination">
        <span class="caption alarms-list__pagination-info">{{ paginationText }}</span>
        <div class="alarms-list__pagination-btns">
          <button :disabled="page === 0" @click="page--; load()">Previous</button>
          <button :disabled="(page + 1) * PAGE_SIZE >= totalCount" @click="page++; load()">Next</button>
        </div>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
import { getAlarms, modifyAlarm } from '@/services/alarmService'
import { type Alarm, type QueryParameters, type AlarmQueryParameters } from '@/types'
import useSnackbar from '@/composables/useSnackbar'
import { loadAlarmPreferences, saveAlarmPreferences } from '@/services/localStorageService'
import { usePerspectiveStore } from '@/stores/perspectiveStore'

const router = useRouter()
const perspectiveStore = usePerspectiveStore()
const { showSnackBar } = useSnackbar()

const COLUMN_DEFS = [
  { key: 'severity',       label: 'Severity',    sortField: 'severity',       defaultOn: true  },
  { key: 'id',             label: 'ID',          sortField: 'id',             defaultOn: true  },
  { key: 'nodeLabel',      label: 'Node',        sortField: null,             defaultOn: true  },
  { key: 'service',        label: 'Service',     sortField: null,             defaultOn: true  },
  { key: 'ipAddress',      label: 'IP',          sortField: null,             defaultOn: true  },
  { key: 'count',          label: 'Count',       sortField: 'count',          defaultOn: true  },
  { key: 'lastEventTime',  label: 'Last Event',  sortField: 'lastEventTime',  defaultOn: true  },
  { key: 'ackStatus',      label: 'Ack',         sortField: null,             defaultOn: true  },
  { key: 'logMessage',     label: 'Log Message', sortField: null,             defaultOn: true  },
  { key: 'description',    label: 'Description', sortField: null,             defaultOn: true  },
  { key: 'uei',            label: 'UEI',         sortField: null,             defaultOn: false },
  { key: 'firstEventTime', label: 'First Event', sortField: 'firstEventTime', defaultOn: false },
]

const DEFAULT_VISIBLE = COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key)

const showColumnMenu = ref(false)
const visibleColumns = ref<string[]>([...DEFAULT_VISIBLE])

const isVisible = (key: string) => visibleColumns.value.includes(key)

const rawMode = ref<Record<string, boolean>>({})
const isRaw = (alarmId: number | string, field: string) => !!rawMode.value[`${alarmId}:${field}`]
const toggleRaw = (alarmId: number | string, field: string) => {
  const key = `${alarmId}:${field}`
  rawMode.value = { ...rawMode.value, [key]: !rawMode.value[key] }
}

const toggleColumn = (key: string) => {
  const idx = visibleColumns.value.indexOf(key)
  if (idx >= 0) {
    visibleColumns.value.splice(idx, 1)
  } else {
    visibleColumns.value.push(key)
  }
  saveAlarmPreferences({ visibleColumns: [...visibleColumns.value] })
}

const PAGE_SIZE = 25

const ALL_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'NORMAL', 'CLEARED']
const DEFAULT_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'NORMAL']

const ACK_OPTIONS = [
  { label: 'All',    value: 'all'    as const },
  { label: 'Unacked', value: 'unacked' as const },
  { label: 'Acked',  value: 'acked'  as const },
]

const TIME_OPTIONS = [
  { label: '24h', value: '24h' as const },
  { label: '7d',  value: '7d'  as const },
  { label: '30d', value: '30d' as const },
  { label: 'All', value: 'all' as const },
]

// Data
const alarms      = ref<Alarm[]>([])
const totalCount  = ref(0)
const loading     = ref(false)
const error       = ref<string | null>(null)
const actionLoading = ref<Record<string, string | null>>({})

// Pagination & sort
const page      = ref(0)
const sortField = ref('lastEventTime')
const sortDesc  = ref(true)

// Filters — initialized based on current perspective
const selectedSeverities = ref<string[]>(perspectiveStore.isProblems ? [...DEFAULT_SEVERITIES] : [...ALL_SEVERITIES])
const ackStatus  = ref<'all' | 'unacked' | 'acked'>(perspectiveStore.isProblems ? 'unacked' : 'all')
const nodeSearch = ref('')
const timeRange  = ref<'24h' | '7d' | '30d' | 'all'>('all')

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(() => {
  const cleanSeverities = perspectiveStore.isProblems ? DEFAULT_SEVERITIES : ALL_SEVERITIES
  const cleanAck = perspectiveStore.isProblems ? 'unacked' : 'all'
  return selectedSeverities.value.length !== cleanSeverities.length ||
    cleanSeverities.some(s => !selectedSeverities.value.includes(s)) ||
    ackStatus.value !== cleanAck ||
    nodeSearch.value.trim() !== '' ||
    timeRange.value !== 'all'
})

const buildCriteria = (): string => {
  const parts: string[] = []

  if (selectedSeverities.value.length > 0 && selectedSeverities.value.length < ALL_SEVERITIES.length) {
    if (selectedSeverities.value.length === 1) {
      parts.push(`severity==${selectedSeverities.value[0]}`)
    } else {
      parts.push(`(${selectedSeverities.value.map(s => `severity==${s}`).join(',')})`)
    }
  }

  if (ackStatus.value === 'unacked') parts.push('alarmAckTime==null')
  else if (ackStatus.value === 'acked') parts.push('alarmAckTime!=null')

  if (nodeSearch.value.trim()) {
    parts.push(`node.label==*${nodeSearch.value.trim()}*`)
  }

  if (timeRange.value !== 'all') {
    const msMap: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
    parts.push(`lastEventTime=ge=${Date.now() - msMap[timeRange.value]}`)
  }

  return parts.join(';')
}

const load = async () => {
  loading.value = true
  error.value = null

  const params: QueryParameters = {
    limit: PAGE_SIZE,
    offset: page.value * PAGE_SIZE,
    orderBy: sortField.value,
    order: sortDesc.value ? 'desc' : 'asc',
  }

  const criteria = buildCriteria()
  if (criteria) params._s = criteria

  const resp = await getAlarms(params)
  loading.value = false

  if (!resp) {
    error.value = 'Failed to load alarms.'
    return
  }

  alarms.value = resp.alarm
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

const toggleSeverity = (sev: string) => {
  const idx = selectedSeverities.value.indexOf(sev)
  if (idx >= 0) {
    selectedSeverities.value.splice(idx, 1)
  } else {
    selectedSeverities.value.push(sev)
  }
  page.value = 0
  load()
}

const resetFilters = () => {
  selectedSeverities.value = [...DEFAULT_SEVERITIES]
  ackStatus.value = 'unacked'
  nodeSearch.value = ''
  timeRange.value = 'all'
  page.value = 0
  load()
}

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
    if (p === 'problems') {
      ackStatus.value = 'unacked'
      selectedSeverities.value = [...DEFAULT_SEVERITIES]
    } else {
      ackStatus.value = 'all'
      selectedSeverities.value = [...ALL_SEVERITIES]
    }
    page.value = 0
    load()
  }
)

const closeColumnMenu = () => { showColumnMenu.value = false }

onUnmounted(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
  document.removeEventListener('click', closeColumnMenu)
})

const doAction = async (alarm: Alarm, action: 'ack' | 'unack' | 'escalate' | 'clear') => {
  actionLoading.value[alarm.id] = action

  const params: AlarmQueryParameters = {}
  if (action === 'ack')      params.ack = true
  if (action === 'unack')    params.ack = false
  if (action === 'escalate') params.escalate = true
  if (action === 'clear')    params.clear = true

  const ok = await modifyAlarm(String(alarm.id), params)
  actionLoading.value[alarm.id] = null

  if (ok === false) {
    showSnackBar({ msg: `Failed to ${action} alarm ${alarm.id}.`, error: true })
    return
  }

  await load()
}

const paginationText = computed(() => {
  if (totalCount.value === 0) return 'No alarms'
  const start = page.value * PAGE_SIZE + 1
  const end = Math.min((page.value + 1) * PAGE_SIZE, totalCount.value)
  return `Showing ${start}–${end} of ${totalCount.value} alarms`
})

onMounted(() => {
  const prefs = loadAlarmPreferences()
  if (prefs?.visibleColumns?.length) {
    visibleColumns.value = prefs.visibleColumns
  }
  document.addEventListener('click', closeColumnMenu)
  load()
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/tokens" as fvars;
@use "@/styles/utils";
@import "@/styles/tokens";
@import "@/styles/typography";

.alarms-list {
  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var($border-light-on-surface);
    align-items: flex-end;
    overflow: visible;
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

  &__severity-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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

  &__empty-icon {
    font-size: 40px;
    color: var($success);
    margin-bottom: 4px;
  }

  &__reset-link {
    @include body-small;
    background: none;
    border: none;
    cursor: pointer;
    color: var($clickable-normal);
    text-decoration: underline;
    padding: 0;
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
  }

  &__mono {
    font-variant-numeric: tabular-nums;
    font-family: monospace;
  }

  &__ack-cell { white-space: nowrap; }

  &__col-menu-wrap {
    position: relative;
    margin-left: auto;
  }

  &__col-btn {
    @include body-small;
    background: none;
    border: 1px solid var($border-light-on-surface);
    border-radius: vars.$border-radius-surface;
    padding: 4px 10px;
    cursor: pointer;
    color: var($primary-text-on-surface);
    white-space: nowrap;
    &:hover { background: var($shade-4); }
  }

  &__col-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 1000;
    background: var($surface);
    border: 1px solid var($border-light-on-surface);
    border-radius: vars.$border-radius-surface;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 8px 0;
    min-width: 160px;
  }

  &__col-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    cursor: pointer;
    @include body-small;
    color: var($primary-text-on-surface);
    &:hover { background: var($shade-4); }
    input[type="checkbox"] { cursor: pointer; accent-color: var($primary); }
  }

  &__col-wide {
    min-width: 180px;
    max-width: 300px;
  }

  &__html-cell {
    vertical-align: middle;
    padding: 0 12px;
  }

  &__html-cell-inner {
    display: flex;
    align-items: baseline;
    gap: 0;
    min-width: 200px;
    max-width: 320px;
    overflow: hidden;
    white-space: nowrap;
  }

  &__html-badge {
    @include body-small;
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: 0.02em;
    padding: 1px 5px;
    border-radius: vars.$border-radius-xs;
    border: 1px solid var($border-light-on-surface);
    background: var($shade-4);
    color: var($secondary-text-on-surface);
    cursor: pointer;
    vertical-align: middle;
    margin-right: 6px;
    flex-shrink: 0;
    &:hover { background: var($shade-3); }
    &.active {
      background: var($primary);
      color: var($primary-text-on-color);
      border-color: var($primary);
    }
  }

  &__html-content {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-height: 1.5em;
    flex: 1;
    min-width: 0;
    vertical-align: middle;
    pointer-events: none;

    // Block-level elements (p, div, etc) inside v-html bypass white-space:nowrap.
    // Force them to display inline so the parent's nowrap and text-overflow apply.
    :deep(p), :deep(div), :deep(li) {
      display: inline;
    }
  }

  &__raw-text {
    @include body-small;
    font-family: monospace;
    font-size: 0.72rem;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 4px 0 0 0;
    padding: 6px 8px;
    background: var($shade-4);
    border-radius: vars.$border-radius-xs;
    color: var($primary-text-on-surface);
    max-height: 160px;
    overflow-y: auto;
  }

  &__uei-cell {
    max-width: 240px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.7rem;
  }

  &__ack-user {
    @include body-small;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__actions {
    white-space: nowrap;
    opacity: 0;
    .alarms-list__row:hover & { opacity: 1; }
  }

  &__action-btn {
    background: none;
    border: 1px solid var($border-light-on-surface);
    border-radius: vars.$border-radius-xs;
    width: 24px;
    height: 24px;
    padding: 0;
    cursor: pointer;
    color: var($clickable-normal);
    font-size: 12px;
    margin-left: 2px;
    &:hover:not(:disabled) { background: var($shade-4); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &--danger { color: var($error); }
  }

  &__pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-top: 1px solid var($border-light-on-surface);
  }

  &__pagination-info {
    color: var($secondary-text-on-surface);
  }

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

// Outlined severity filter chip — severity color as border + text, subtle tinted bg.
// Light mode overrides (solid fill) live in opennms-feather-styles.scss.
.sev-toggle {
  @include body-small;
  border: 1.5px solid transparent;
  border-radius: vars.$border-radius-xs;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  opacity: 0.4;
  background: none;
  transition: opacity 0.1s;
  &.active { opacity: 1; }

  &.critical { color: var($error);         border-color: var($error);         background: utils.alpha(fvars.$error,   0.12); }
  &.major    { color: var($major);         border-color: var($major);         background: utils.alpha(fvars.$major,   0.12); }
  &.minor    { color: var($minor);         border-color: var($minor);         background: utils.alpha(fvars.$minor,   0.12); }
  &.warning  { color: var($warning);       border-color: var($warning);       background: utils.alpha(fvars.$warning, 0.12); }
  &.normal   { color: var($success);       border-color: var($success);       background: utils.alpha(fvars.$success, 0.12); }
  &.cleared  { color: var($cleared);       border-color: var($cleared);       background: utils.alpha(fvars.$cleared, 0.12); }
}

@keyframes shimmer {
  0%   { opacity: 1; }
  50%  { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
