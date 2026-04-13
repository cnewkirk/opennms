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
  <div class="alarms-widget">
    <div
      v-if="!alarms.length"
      class="empty-state"
    >
      <FeatherIcon
        :icon="CheckCircleIcon"
        class="empty-icon"
      />
      <div class="empty-title">No alarms</div>
      <div class="empty-subtitle">Network is operating normally</div>
    </div>
    <table
      v-else
      class="alarm-table"
    >
      <thead>
        <tr>
          <th
            v-if="col('severity')"
            :class="sortClass('severity')"
            @click="toggleSort('severity')"
          >Severity</th>
          <th
            v-if="col('node')"
            :class="sortClass('node')"
            @click="toggleSort('node')"
          >Node</th>
          <th v-if="col('message')">Message</th>
          <th
            v-if="col('count')"
            :class="sortClass('count')"
            @click="toggleSort('count')"
          >Count</th>
          <th
            v-if="col('time')"
            :class="sortClass('time')"
            @click="toggleSort('time')"
          >Time</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="alarm in alarms"
          :key="alarm.id"
          :class="`row--${alarm.severity.toLowerCase()}`"
        >
          <td v-if="col('severity')">
            <SeverityBadge :severity="alarm.severity" />
          </td>
          <td v-if="col('node')">
            <router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link>
          </td>
          <td
            v-if="col('message')"
            class="log-msg"
          >{{ alarm.logMessage }}</td>
          <td
            v-if="col('count')"
            class="count"
          >{{ alarm.count }}</td>
          <td
            v-if="col('time')"
            class="time"
          >{{ alarm.lastEventTime ? new Date(alarm.lastEventTime).toLocaleString() : '—' }}</td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="totalCount > alarms.length"
      class="more-hint body2"
    >
      Showing {{ alarms.length }} of {{ totalCount }} alarms
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherIcon } from '@featherds/icon'
import CheckCircleIcon from '@featherds/icon/action/CheckCircle'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
import API from '@/services'
import { type TableWidgetConfig, WIDGET_COLUMNS } from '@/services/dashboardConfigService'
import { type Alarm, type QueryParameters } from '@/types'
import { useDashboardStore } from '@/stores/dashboardStore'

const props = defineProps<{
  config: TableWidgetConfig
}>()

const store = useDashboardStore()
const alarms = ref<Alarm[]>([])
const totalCount = ref(0)

const col = (key: string) => !props.config.columns?.length || props.config.columns.includes(key)

const sortClass = (key: string) => {
  const def = WIDGET_COLUMNS.alarms.find(c => c.key === key)
  if (!def?.sortField) return ''
  if (props.config.sortBy !== key) return 'sortable'
  return props.config.sortDir === 'desc' ? 'sort-desc' : 'sort-asc'
}

const toggleSort = (key: string) => {
  const def = WIDGET_COLUMNS.alarms.find(c => c.key === key)
  if (!def?.sortField) return
  const newDir: 'asc' | 'desc' =
    props.config.sortBy === key && props.config.sortDir === 'asc' ? 'desc' : 'asc'
  store.updateWidget({ ...props.config, sortBy: key, sortDir: newDir })
}

const buildAlarmCriteria = (): string => {
  const parts: string[] = []

  if (props.config.severities.length === 1) {
    parts.push(`severity==${props.config.severities[0]}`)
  } else if (props.config.severities.length > 1) {
    parts.push(`(${props.config.severities.map(s => `severity==${s}`).join(',')})`)
  }

  if (props.config.categories.length === 1) {
    parts.push(`node.categories.name==${props.config.categories[0]}`)
  } else if (props.config.categories.length > 1) {
    parts.push(`(${props.config.categories.map(c => `node.categories.name==${c}`).join(',')})`)
  }

  return parts.join(';')
}

const load = async () => {
  const params: QueryParameters = { limit: props.config.limit }
  const criteria = buildAlarmCriteria()
  if (criteria) params._s = criteria
  if (props.config.sortBy) {
    const def = WIDGET_COLUMNS.alarms.find(c => c.key === props.config.sortBy)
    if (def?.sortField) {
      params.orderBy = def.sortField
      // QueryParameters.order is typed as Feather SORT; cast to satisfy TS
      params.order = (props.config.sortDir ?? 'asc') as typeof params.order
    }
  }

  const resp = await API.getAlarms(params)
  if (resp) {
    alarms.value = resp.alarm
    totalCount.value = resp.totalCount
  }
}

onMounted(load)
watch(() => props.config, load, { deep: true })
defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.alarms-widget {
  padding: 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 6px;
}

.empty-icon {
  font-size: 36px;
  color: var($success);
  margin-bottom: 4px;
}

.empty-title {
  @include subtitle2;
  color: var($primary-text-on-surface);
  font-weight: 600;
}

.empty-subtitle {
  @include body-small;
  color: var($secondary-text-on-surface);
  font-style: italic;
}

.alarm-table {
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
    user-select: none;

    &.sortable { cursor: pointer; }
    &.sort-asc, &.sort-desc { cursor: pointer; color: var($primary-text-on-surface); }
    &.sort-asc::after  { content: ' ▴'; }
    &.sort-desc::after { content: ' ▾'; }
  }

  tbody tr:hover {
    background: var($shade-4);
  }

  a {
    color: var($clickable-normal);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}

.log-msg {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.more-hint {
  @include body-small;
  color: var($secondary-text-on-surface);
  padding: 8px 16px;
  text-align: right;
  font-style: italic;
}
</style>
