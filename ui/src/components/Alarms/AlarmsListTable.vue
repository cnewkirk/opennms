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
      <FeatherIcon :icon="CheckCircleIcon" class="alarms-list__empty-icon" />
      <div class="subtitle2">{{ hasActiveFilters ? 'No alarms match your filters' : 'No alarms found' }}</div>
      <button v-if="hasActiveFilters" class="alarms-list__reset-link" @click="resetFilters">Reset filters</button>
    </div>

    <template v-else>
      <table class="alarms-list__table">
        <thead>
          <tr>
            <th class="sortable" @click="setSort('severity')">Severity<span class="sort-icon">{{ sortIndicator('severity') }}</span></th>
            <th class="sortable" @click="setSort('id')">ID<span class="sort-icon">{{ sortIndicator('id') }}</span></th>
            <th>Node</th>
            <th>Service</th>
            <th>IP</th>
            <th class="sortable" @click="setSort('count')">Count<span class="sort-icon">{{ sortIndicator('count') }}</span></th>
            <th class="sortable" @click="setSort('lastEventTime')">Last Event<span class="sort-icon">{{ sortIndicator('lastEventTime') }}</span></th>
            <th>Ack</th>
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
            <td><SeverityBadge :severity="alarm.severity" /></td>
            <td class="alarms-list__mono">{{ alarm.id }}</td>
            <td>
              <router-link :to="`/node/${alarm.nodeId}`" @click.stop>{{ alarm.nodeLabel }}</router-link>
            </td>
            <td>{{ alarm.serviceType?.name ?? '—' }}</td>
            <td class="alarms-list__mono">{{ alarm.ipAddress ?? '—' }}</td>
            <td>{{ alarm.count }}</td>
            <td v-date>{{ alarm.lastEventTime }}</td>
            <td class="alarms-list__ack-cell">
              <span v-if="alarm.ackTime" class="caption alarms-list__ack-user" :title="`Acked by ${alarm.ackUser}`">
                {{ alarm.ackUser }}
              </span>
            </td>
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
import { FeatherIcon } from '@featherds/icon'
import CheckCircleIcon from '@featherds/icon/action/CheckCircle'
import { SORT } from '@featherds/table'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
import { getAlarms, modifyAlarm } from '@/services/alarmService'
import { type Alarm, type QueryParameters, type AlarmQueryParameters } from '@/types'
import useSnackbar from '@/composables/useSnackbar'

const router = useRouter()
const { showSnackBar } = useSnackbar()

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

// Filters
const selectedSeverities = ref<string[]>([...DEFAULT_SEVERITIES])
const ackStatus  = ref<'all' | 'unacked' | 'acked'>('unacked')
const nodeSearch = ref('')
const timeRange  = ref<'24h' | '7d' | '30d' | 'all'>('all')

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(() =>
  selectedSeverities.value.length !== DEFAULT_SEVERITIES.length ||
  DEFAULT_SEVERITIES.some(s => !selectedSeverities.value.includes(s)) ||
  ackStatus.value !== 'unacked' ||
  nodeSearch.value.trim() !== '' ||
  timeRange.value !== 'all'
)

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
    parts.push(`nodeLabel==*${nodeSearch.value.trim()}*`)
  }

  if (timeRange.value !== 'all') {
    const msMap: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
    parts.push(`lastEventTime>=${new Date(Date.now() - msMap[timeRange.value]).toISOString()}`)
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
    order: sortDesc.value ? SORT.DESCENDING : SORT.ASCENDING,
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

onUnmounted(() => { if (searchDebounce) clearTimeout(searchDebounce) })

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

onMounted(load)
</script>

<style lang="scss" scoped>
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.alarms-list {
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

  &__severity-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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
  }

  &__mono {
    font-variant-numeric: tabular-nums;
    font-family: monospace;
  }

  &__ack-cell { white-space: nowrap; }

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
    border-radius: 3px;
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
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      color: var($primary-text-on-surface);
      &:hover:not(:disabled) { background: var($shade-4); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }
}

.sev-toggle {
  @include body-small;
  border: 1.5px solid transparent;
  border-radius: 3px;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  opacity: 0.35;
  background: none;
  transition: opacity 0.1s;
  &.active { opacity: 1; }

  &.critical      { color: var($error);         border-color: var($error);         background: utils.alpha(fvars.$error,         0.12); }
  &.major         { color: var($major);         border-color: var($major);         background: utils.alpha(fvars.$major,         0.12); }
  &.minor         { color: var($minor);         border-color: var($minor);         background: utils.alpha(fvars.$minor,         0.12); }
  &.warning       { color: var($warning);       border-color: var($warning);       background: utils.alpha(fvars.$warning,       0.12); }
  &.normal        { color: var($success);       border-color: var($success);       background: utils.alpha(fvars.$success,       0.12); }
  &.cleared       { color: var($cleared);       border-color: var($cleared);       background: utils.alpha(fvars.$cleared,       0.12); }
}

@keyframes shimmer {
  0%   { opacity: 1; }
  50%  { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
