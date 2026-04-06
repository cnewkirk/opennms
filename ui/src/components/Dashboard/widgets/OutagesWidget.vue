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
  <div class="outages-widget">
    <div
      v-if="!outages.length"
      class="empty-state"
    >
      <FeatherIcon
        :icon="CheckCircleIcon"
        class="empty-icon"
      />
      <div class="empty-title">All services up</div>
      <div class="empty-subtitle">
        No active outages
        <span v-if="config.categories.length">&nbsp;({{ config.categories.join(', ') }})</span>
      </div>
    </div>
    <table
      v-else
      class="outage-table"
    >
      <thead>
        <tr>
          <th v-if="col('node')">Node</th>
          <th v-if="col('service')">Service</th>
          <th v-if="col('ip')">IP Address</th>
          <th v-if="col('since')">Since</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="outage in outages"
          :key="outage.outageId"
        >
          <td
            v-if="col('node')"
            class="node-label"
          >
            <router-link :to="`/node/${outage.nodeId}`">{{ outage.nodeLabel }}</router-link>
          </td>
          <td v-if="col('service')">{{ outage.serviceName }}</td>
          <td v-if="col('ip')">{{ outage.ipAddress }}</td>
          <td
            v-if="col('since')"
            class="since"
          >{{ outage.ifLostService ? new Date(outage.ifLostService).toLocaleString() : '—' }}</td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="totalCount > outages.length"
      class="more-hint body2"
    >
      Showing {{ outages.length }} of {{ totalCount }} outages
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherIcon } from '@featherds/icon'
import CheckCircleIcon from '@featherds/icon/action/CheckCircle'
import { getActiveOutages } from '@/services/outageService'
import { type WidgetConfig } from '@/services/dashboardConfigService'
import { type Outage } from '@/types'

const props = defineProps<{
  config: WidgetConfig
}>()

const outages = ref<Outage[]>([])
const totalCount = ref(0)

const col = (key: string) => !props.config.columns?.length || props.config.columns.includes(key)

const load = async () => {
  const resp = await getActiveOutages(props.config.categories, props.config.limit)
  if (resp) {
    outages.value = resp.outage
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

.outages-widget {
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

.outage-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    @include body-small;
    padding: 8px 16px;
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

.node-label {
  font-weight: 500;
}

.since {
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
