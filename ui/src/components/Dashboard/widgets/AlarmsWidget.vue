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
          <th>Severity</th>
          <th>Node</th>
          <th>Message</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="alarm in alarms"
          :key="alarm.id"
          :class="`row--${alarm.severity.toLowerCase()}`"
        >
          <td>
            <span :class="`severity-badge severity-${alarm.severity.toLowerCase()}`">
              {{ alarm.severity }}
            </span>
          </td>
          <td>
            <router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link>
          </td>
          <td class="log-msg">{{ alarm.logMessage }}</td>
          <td class="count">{{ alarm.count }}</td>
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
import API from '@/services'
import { type WidgetConfig } from '@/services/dashboardConfigService'
import { type Alarm, type QueryParameters } from '@/types'

const props = defineProps<{
  config: WidgetConfig
}>()

const alarms = ref<Alarm[]>([])
const totalCount = ref(0)

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

.severity-badge {
  @include body-small;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

// Severity colors — using OpenNMS-standard palette
.severity-critical   { background: #cc0000; color: #fff; }
.severity-major      { background: #ff3300; color: #fff; }
.severity-minor      { background: #ff9900; color: #000; }
.severity-warning    { background: #ffcc00; color: #000; }
.severity-normal     { background: #336600; color: #fff; }
.severity-indeterminate { background: #999; color: #fff; }
.severity-cleared    { background: #d0d0d0; color: #333; }

.more-hint {
  @include body-small;
  color: var($secondary-text-on-surface);
  padding: 8px 16px;
  text-align: right;
  font-style: italic;
}
</style>
