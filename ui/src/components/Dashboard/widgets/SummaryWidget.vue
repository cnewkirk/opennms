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
  <div class="summary-grid">
    <router-link
      v-for="kpi in kpis"
      :key="kpi.label"
      :to="kpi.to"
      class="kpi-card"
      :class="`kpi-card--${kpi.status}`"
    >
      <span class="kpi-value headline3">{{ kpi.value }}</span>
      <span class="kpi-label body2">{{ kpi.label }}</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import API from '@/services'
import { getActiveOutageCount } from '@/services/outageService'
import { type SummaryWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{
  config: SummaryWidgetConfig
}>()

interface Kpi {
  label: string
  value: number | string
  status: 'normal' | 'warning' | 'critical'
  to: string
}

const kpis = ref<Kpi[]>([
  { label: 'Active Outages', value: '—', status: 'normal', to: '/outages' },
  { label: 'Active Alarms',  value: '—', status: 'normal', to: '/alarms' },
  { label: 'Total Nodes',    value: '—', status: 'normal', to: '/nodes' }
])

const load = async () => {
  const [outageCount, alarmResp, nodeResp] = await Promise.all([
    getActiveOutageCount(props.config.categories),
    API.getAlarms({ limit: 0, _s: 'severity!=NORMAL;severity!=CLEARED' } as any),
    API.getNodes({ limit: 0 } as any)
  ])

  kpis.value = [
    {
      label: 'Active Outages',
      value: outageCount,
      status: outageCount > 0 ? 'critical' : 'normal',
      to: '/outages'
    },
    {
      label: 'Active Alarms',
      value: alarmResp ? alarmResp.totalCount : '—',
      status: alarmResp && alarmResp.totalCount > 0 ? 'warning' : 'normal',
      to: '/alarms'
    },
    {
      label: 'Total Nodes',
      value: nodeResp ? nodeResp.totalCount : '—',
      status: 'normal',
      to: '/nodes'
    }
  ]
}

onMounted(load)

defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.summary-grid {
  display: flex;
  gap: 16px;
  padding: 16px;
  flex-wrap: wrap;
}

.kpi-card {
  flex: 1;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border-radius: vars.$border-radius-surface;
  border: 1px solid var($border-light-on-surface);
  background: var($surface);
  gap: 8px;
  text-decoration: none;
  cursor: pointer;
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }

  &--critical {
    border-color: var($error);
    background: color-mix(in srgb, var($error) 8%, var($surface));
    .kpi-value { color: var($error); }
  }

  &--warning {
    border-color: var($warning);
    background: color-mix(in srgb, var($warning) 8%, var($surface));
    // Light mode override (solid amber) lives in opennms-feather-styles.scss.
    .kpi-value { color: var($warning); }
  }
}

.kpi-value {
  @include headline3;
  font-weight: 700;
  color: var($primary-text-on-surface);
}

.kpi-label {
  @include body-small;
  color: var($secondary-text-on-surface);
  text-align: center;
}
</style>
