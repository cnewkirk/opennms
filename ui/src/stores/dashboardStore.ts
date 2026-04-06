///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { defineStore } from 'pinia'
import {
  type WidgetConfig,
  type DashboardConfig,
  loadConfig,
  saveConfig,
  resetConfig,
  loadFromServer,
  saveToServer
} from '@/services/dashboardConfigService'
import { useMenuStore } from '@/stores/menuStore'

interface GridStackNode {
  id?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

export const useDashboardStore = defineStore('dashboardStore', () => {
  const config = ref<DashboardConfig>(loadConfig())
  const menuStore = useMenuStore()

  const widgets = computed(() => config.value.widgets)

  // server-sync debounce handle
  let syncTimer: ReturnType<typeof setTimeout> | null = null

  const persist = () => {
    saveConfig(config.value)
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      const username = menuStore.mainMenu?.username
      if (username) saveToServer(username, config.value)
    }, 2000)
  }

  /** Called on mount — try server first, fall back to localStorage */
  const initialize = async () => {
    const username = menuStore.mainMenu?.username
    if (username) {
      const serverConfig = await loadFromServer(username)
      if (serverConfig) {
        config.value = serverConfig
        saveConfig(serverConfig) // hydrate localStorage cache
        return
      }
    }
    // localStorage already loaded at store init — push it to server if username available
    if (username) saveToServer(username, config.value)
  }

  /** Called by useDashboardLayout on every drag/resize event */
  const updateLayout = (items: GridStackNode[]) => {
    for (const item of items) {
      if (!item.id) continue
      const widget = config.value.widgets.find(w => w.id === item.id)
      if (!widget) continue
      if (item.x !== undefined) widget.x = item.x
      if (item.y !== undefined) widget.y = item.y
      if (item.w !== undefined) widget.w = item.w
      if (item.h !== undefined) widget.h = item.h
    }
    persist()
  }

  const updateWidget = (updated: WidgetConfig) => {
    const idx = config.value.widgets.findIndex(w => w.id === updated.id)
    if (idx !== -1) {
      config.value.widgets.splice(idx, 1, updated)
      persist()
    }
  }

  const addWidget = (widget: WidgetConfig) => {
    config.value.widgets.push(widget)
    persist()
  }

  const removeWidget = (widgetId: string) => {
    config.value.widgets = config.value.widgets.filter(w => w.id !== widgetId)
    persist()
  }

  const reset = () => {
    config.value = resetConfig()
    persist()
  }

  return {
    config,
    widgets,
    initialize,
    updateLayout,
    updateWidget,
    addWidget,
    removeWidget,
    reset
  }
})
