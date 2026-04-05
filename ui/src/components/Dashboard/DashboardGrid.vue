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
  <div class="dashboard-grid">
    <div
      v-for="widget in widgets"
      :key="widget.id"
      class="dashboard-cell"
      :style="{ gridColumn: `span ${widget.colSpan}` }"
    >
      <WidgetFrame
        :title="widget.title"
        :loading="loadingMap[widget.id]"
        @refresh="refreshWidget(widget.id)"
        @configure="openConfig(widget)"
        @remove="dashboardStore.removeWidget(widget.id)"
      >
        <SummaryWidget
          v-if="widget.type === 'summary'"
          :ref="el => registerRef(widget.id, el)"
          :config="widget"
        />
        <OutagesWidget
          v-else-if="widget.type === 'outages'"
          :ref="el => registerRef(widget.id, el)"
          :config="widget"
        />
        <AlarmsWidget
          v-else-if="widget.type === 'alarms'"
          :ref="el => registerRef(widget.id, el)"
          :config="widget"
        />
        <NodesWidget
          v-else-if="widget.type === 'nodes'"
          :ref="el => registerRef(widget.id, el)"
          :config="widget"
        />
      </WidgetFrame>
    </div>
  </div>

  <WidgetConfigDialog
    v-if="configuringWidget"
    :visible="!!configuringWidget"
    :widget-config="configuringWidget"
    @close="configuringWidget = null"
    @save="onConfigSaved"
  />
</template>

<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig } from '@/services/dashboardConfigService'
import WidgetFrame from './WidgetFrame.vue'
import WidgetConfigDialog from './WidgetConfigDialog.vue'
import SummaryWidget from './widgets/SummaryWidget.vue'
import OutagesWidget from './widgets/OutagesWidget.vue'
import AlarmsWidget from './widgets/AlarmsWidget.vue'
import NodesWidget from './widgets/NodesWidget.vue'

const dashboardStore = useDashboardStore()
const widgets = computed(() => dashboardStore.widgets)

// ref map for calling refresh() on each widget instance
const widgetRefs = ref<Record<string, { refresh: () => void } | null>>({})
const loadingMap = ref<Record<string, boolean>>({})
const configuringWidget = ref<WidgetConfig | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerRef = (id: string, el: any) => {
  widgetRefs.value[id] = el as { refresh: () => void } | null
}

const refreshWidget = async (widgetId: string) => {
  loadingMap.value[widgetId] = true
  await widgetRefs.value[widgetId]?.refresh()
  loadingMap.value[widgetId] = false
}

const openConfig = (widget: WidgetConfig) => {
  configuringWidget.value = { ...widget }
}

const onConfigSaved = (updated: WidgetConfig) => {
  dashboardStore.updateWidget(updated)
  configuringWidget.value = null
}

// auto-refresh based on each widget's refreshInterval
const refreshTimers: Record<string, ReturnType<typeof setInterval>> = {}

const startTimers = () => {
  for (const widget of widgets.value) {
    if (widget.refreshInterval > 0) {
      refreshTimers[widget.id] = setInterval(
        () => refreshWidget(widget.id),
        widget.refreshInterval * 1000
      )
    }
  }
}

const clearTimers = () => {
  for (const timer of Object.values(refreshTimers)) {
    clearInterval(timer)
  }
}

onMounted(startTimers)
onUnmounted(clearTimers)
</script>

<style scoped lang="scss">
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  padding: 16px;
  align-items: start;
}

.dashboard-cell {
  min-height: 0;
}
</style>
