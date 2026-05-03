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
  <PanelLoader v-if="isLoading" overlay />
  <div v-else class="summary-grid">
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
import PanelLoader from '@/components/Common/PanelLoader.vue'
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

const isLoading = ref(true)
const kpis = ref<Kpi[]>([
  { label: 'Active Outages', value: 0,   status: 'normal', to: '/outages' },
  { label: 'Active Alarms',  value: 0,   status: 'normal', to: '/alarms' },
  { label: 'Total Nodes',    value: 0,   status: 'normal', to: '/nodes' }
])

const load = async () => {
  isLoading.value = true
  try {
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
        value: alarmResp ? alarmResp.totalCount : 0,
        status: alarmResp && alarmResp.totalCount > 0 ? 'warning' : 'normal',
        to: '/alarms'
      },
      {
        label: 'Total Nodes',
        value: nodeResp ? nodeResp.totalCount : 0,
        status: 'normal',
        to: '/nodes'
      }
    ]
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@/styles/typography";

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
  padding: 28px 20px;
  border-radius: vars.$border-radius-surface;
  border: 1px solid var($border-light-on-surface);
  background: var($surface);
  gap: 8px;
  text-decoration: none;
  cursor: pointer;
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }

  // Light mode (default): explicit rgba values to avoid color-mix() interaction with
  // Feather DS CSS vars that both theme files set unconditionally in :root.
  &--critical {
    border-color: #b71c1c;
    background: rgba(183, 28, 28, 0.18);
    .kpi-value { color: #b71c1c; }
  }

  &--warning {
    border-color: #f9a825;
    background: rgba(249, 168, 37, 0.18);
    .kpi-value { color: #856400; }
  }
}

// Dark mode overrides — full selector in :global() to prevent Vue's CSS scoper
// from stripping the descendant and applying styles to html directly.
:global(html.open-dark .kpi-card--critical)           { background: rgba(248, 113, 113, 0.28); border-color: #fca5a5; }
:global(html.open-dark .kpi-card--critical .kpi-value){ color: #fca5a5; }
:global(html.open-dark .kpi-card--warning)            { background: rgba(251, 191, 36, 0.28);  border-color: #fde047; }
:global(html.open-dark .kpi-card--warning .kpi-value) { color: #fde047; }

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
