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
  <div class="dashboard-container">
    <div class="dashboard-toolbar">
      <h1 class="headline4">Dashboard</h1>
      <div class="toolbar-actions">
        <DashboardTimeRangePicker v-if="hasTimeAwareWidgets" />

        <SplitButton
          label="Add Widget"
          :model="addWidgetItems"
          text
        />
        <Button
          text
          label="Reset"
          title="Reset to default layout"
          @click="confirmReset"
        />
      </div>
    </div>

    <div class="dashboard-grid-wrapper">
      <DashboardGrid />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import SplitButton from 'primevue/splitbutton'
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig, type WidgetType, DEFAULT_COLUMNS } from '@/services/dashboardConfigService'
import DashboardGrid from '@/components/Dashboard/DashboardGrid.vue'
import DashboardTimeRangePicker from '@/components/Dashboard/DashboardTimeRangePicker.vue'
import useSnackbar from '@/composables/useSnackbar'

const dashboardStore = useDashboardStore()
const { showSnackBar } = useSnackbar()

const hasTimeAwareWidgets = computed(() =>
  dashboardStore.widgets.some(w => w.type === 'graph' || w.type === 'availability')
)

const WIDGET_DEFAULTS: Record<WidgetType, Partial<WidgetConfig>> = {
  summary:       { title: 'Network Summary', w: 12, h: 2, categories: [] },
  outages:       { title: 'Active Outages',  w: 6,  h: 3, limit: 10, categories: [], severities: [], columns: DEFAULT_COLUMNS.outages },
  alarms:        { title: 'Active Alarms',   w: 6,  h: 3, limit: 10, categories: [], severities: ['CRITICAL', 'MAJOR', 'MINOR'], columns: DEFAULT_COLUMNS.alarms },
  nodes:         { title: 'Nodes',           w: 12, h: 3, limit: 10, categories: [], severities: [], columns: DEFAULT_COLUMNS.nodes },
  graph:         { title: 'Graph',           w: 6,  h: 4, series: [], stack: false },
  'node-status': { title: 'Node Status',     w: 4,  h: 3, categories: [] },
  availability:  { title: 'Availability',    w: 4,  h: 3, categories: [] }
}

const addWidget = (type: WidgetType) => {
  const widget = {
    id: `widget-${type}-${Date.now()}`,
    type,
    refreshInterval: 60,
    x: 0,
    y: 999,
    w: 6,
    h: 3,
    title: '',
    ...WIDGET_DEFAULTS[type]
  } as WidgetConfig
  dashboardStore.addWidget(widget)
}

const WIDGET_TYPES: WidgetType[] = ['summary', 'outages', 'alarms', 'nodes', 'graph', 'node-status', 'availability']
const WIDGET_LABELS: Record<WidgetType, string> = {
  summary:      'Network Summary',
  outages:      'Active Outages',
  alarms:       'Active Alarms',
  nodes:        'Nodes',
  graph:        'Graph',
  'node-status':'Node Status',
  availability: 'Availability'
}

const addWidgetItems = WIDGET_TYPES.map(type => ({
  label: WIDGET_LABELS[type],
  command: () => addWidget(type)
}))

const confirmReset = () => {
  dashboardStore.reset()
  showSnackBar({ msg: 'Dashboard reset to defaults.' })
}

onMounted(() => { dashboardStore.initialize() })
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@/styles/typography";

.dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px 8px;
  flex-shrink: 0;
  gap: 16px;
}

.dashboard-grid-wrapper {
  flex: 1;
  padding: 0 16px 0;
  overflow: auto;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

h1 {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}
</style>
