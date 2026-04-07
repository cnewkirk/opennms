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
        <div class="add-widget-menu">
          <FeatherButton
            text
            @click="addMenuOpen = !addMenuOpen"
          >
            <FeatherIcon :icon="AddIcon" />
            Add Widget
          </FeatherButton>
          <div
            v-if="addMenuOpen"
            class="add-widget-dropdown"
          >
            <button
              v-for="type in WIDGET_TYPES"
              :key="type"
              class="add-widget-item"
              @click="addWidget(type)"
            >
              {{ WIDGET_DEFAULTS[type].title }}
            </button>
          </div>
        </div>
        <FeatherButton
          text
          title="Reset to default layout"
          @click="confirmReset"
        >
          Reset
        </FeatherButton>
      </div>
    </div>

    <div class="dashboard-grid-wrapper">
      <DashboardGrid />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import AddIcon from '@featherds/icon/action/Add'
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig, type WidgetType } from '@/services/dashboardConfigService'
import DashboardGrid from '@/components/Dashboard/DashboardGrid.vue'
import useSnackbar from '@/composables/useSnackbar'

const dashboardStore = useDashboardStore()
const { showSnackBar } = useSnackbar()

const addMenuOpen = ref(false)
const WIDGET_TYPES: WidgetType[] = ['summary', 'outages', 'alarms', 'nodes']

const WIDGET_DEFAULTS: Record<WidgetType, Partial<WidgetConfig>> = {
  summary: { title: 'Network Summary', w: 12, h: 2 },
  outages: { title: 'Active Outages',  w: 6,  h: 3, limit: 10 },
  alarms:  { title: 'Active Alarms',   w: 6,  h: 3, limit: 10, severities: ['CRITICAL', 'MAJOR', 'MINOR'] },
  nodes:   { title: 'Nodes',           w: 12, h: 3, limit: 10 }
}

const addWidget = (type: WidgetType) => {
  addMenuOpen.value = false
  // place new widget at bottom (y=999 lets gridstack find the next open row)
  const widget: WidgetConfig = {
    id: `widget-${type}-${Date.now()}`,
    type,
    categories: [],
    refreshInterval: 60,
    severities: [],
    limit: 10,
    x: 0,
    y: 999,
    w: 6,
    h: 3,
    title: '',
    ...WIDGET_DEFAULTS[type]
  }
  dashboardStore.addWidget(widget)
}

const confirmReset = () => {
  dashboardStore.reset()
  showSnackBar({ msg: 'Dashboard reset to defaults.' })
}

// server-first initialization
onMounted(() => {
  dashboardStore.initialize()
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

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
}

.dashboard-grid-wrapper {
  flex: 1;
  padding: 0 24px 16px;
  overflow: auto;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-widget-menu {
  position: relative;
}

.add-widget-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var($surface);
  border: 1px solid var($border-light-on-surface);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
  min-width: 160px;
  overflow: hidden;
}

.add-widget-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  @include body-large;
  color: var($primary-text-on-surface);

  &:hover {
    background: var($surface-dark);
  }
}

h1 {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}
</style>
