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
  <div
    ref="gridContainerRef"
    class="grid-stack"
  >
    <div
      v-for="widget in widgets"
      :key="widget.id"
      :ref="el => registerItemRef(widget.id, el as HTMLElement)"
      class="grid-stack-item"
      :gs-id="widget.id"
      :gs-x="widget.x"
      :gs-y="widget.y"
      :gs-w="widget.w"
      :gs-h="widget.h"
    >
      <div class="grid-stack-item-content">
        <WidgetFrame
          :title="widget.title"
          :loading="loadingMap[widget.id]"
          @refresh="refreshWidget(widget.id)"
          @configure="openConfig(widget)"
          @remove="onRemove(widget.id)"
        >
          <SummaryWidget
            v-if="widget.type === 'summary'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <OutagesWidget
            v-else-if="widget.type === 'outages'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <AlarmsWidget
            v-else-if="widget.type === 'alarms'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <NodesWidget
            v-else-if="widget.type === 'nodes'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <GraphWidget
            v-else-if="widget.type === 'graph'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget as GraphWidgetConfig"
          />
          <NodeStatusWidget
            v-else-if="widget.type === 'node-status'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget as NodeStatusWidgetConfig"
          />
          <AvailabilityWidget
            v-else-if="widget.type === 'availability'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget as AvailabilityWidgetConfig"
          />
        </WidgetFrame>
      </div>
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
import { type GridStackNode } from 'gridstack'
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig } from '@/services/dashboardConfigService'
import useDashboardLayout from '@/composables/useDashboardLayout'
import WidgetFrame from './WidgetFrame.vue'
import WidgetConfigDialog from './WidgetConfigDialog.vue'
import SummaryWidget from './widgets/SummaryWidget.vue'
import OutagesWidget from './widgets/OutagesWidget.vue'
import AlarmsWidget from './widgets/AlarmsWidget.vue'
import NodesWidget from './widgets/NodesWidget.vue'
import GraphWidget from './widgets/GraphWidget.vue'
import NodeStatusWidget from './widgets/NodeStatusWidget.vue'
import AvailabilityWidget from './widgets/AvailabilityWidget.vue'
import type { GraphWidgetConfig, NodeStatusWidgetConfig, AvailabilityWidgetConfig } from '@/services/dashboardConfigService'

const dashboardStore = useDashboardStore()
const widgets = computed(() => dashboardStore.widgets)

const gridContainerRef = ref<HTMLElement | null>(null)
const itemRefs: Record<string, HTMLElement | null> = {}
const widgetRefs = ref<Record<string, { refresh: () => void } | null>>({})
const loadingMap = ref<Record<string, boolean>>({})
const configuringWidget = ref<WidgetConfig | null>(null)

const registerItemRef = (id: string, el: HTMLElement | null) => {
  if (el) {
    itemRefs[id] = el
  } else {
    delete itemRefs[id]
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerWidgetRef = (id: string, el: any) => {
  widgetRefs.value[id] = el as { refresh: () => void } | null
}

const onLayoutChange = (items: GridStackNode[]) => {
  dashboardStore.updateLayout(items)
}

const { addItem, removeItem } = useDashboardLayout(gridContainerRef, onLayoutChange)

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

const onRemove = (widgetId: string) => {
  const el = itemRefs[widgetId]
  if (el) removeItem(el)
  delete itemRefs[widgetId]
  if (refreshTimers[widgetId]) {
    clearInterval(refreshTimers[widgetId])
    delete refreshTimers[widgetId]
  }
  delete widgetRefs.value[widgetId]
  delete loadingMap.value[widgetId]
  dashboardStore.removeWidget(widgetId)
}

// When a widget is added programmatically (via Dashboard.vue toolbar),
// wait for Vue to render the new item then register it with gridstack
watch(
  () => widgets.value.map(w => w.id),
  (newIds, oldIds = []) => {
    const added = newIds.filter(id => !oldIds.includes(id))
    nextTick(() => {
      for (const id of added) {
        const el = itemRefs[id]
        if (el) addItem(el)
      }
    })
  }
)

// auto-refresh timers
const refreshTimers: Record<string, ReturnType<typeof setInterval>> = {}

onMounted(() => {
  for (const widget of widgets.value) {
    if (widget.refreshInterval > 0) {
      refreshTimers[widget.id] = setInterval(
        () => refreshWidget(widget.id),
        widget.refreshInterval * 1000
      )
    }
  }
})

onUnmounted(() => {
  for (const timer of Object.values(refreshTimers)) clearInterval(timer)
})
</script>

<style scoped lang="scss">
// gridstack needs full height to lay out correctly
.grid-stack {
  width: 100%;
}

// ensure widget content fills the gridstack item
.grid-stack-item-content {
  height: 100%;
  overflow: hidden;
}
</style>
