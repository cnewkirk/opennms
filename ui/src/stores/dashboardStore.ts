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
  resetConfig
} from '@/services/dashboardConfigService'

export const useDashboardStore = defineStore('dashboardStore', () => {
  const config = ref<DashboardConfig>(loadConfig())

  const widgets = computed(() => config.value.widgets)

  const updateWidget = (updated: WidgetConfig) => {
    const idx = config.value.widgets.findIndex(w => w.id === updated.id)
    if (idx !== -1) {
      config.value.widgets.splice(idx, 1, updated)
      saveConfig(config.value)
    }
  }

  const addWidget = (widget: WidgetConfig) => {
    config.value.widgets.push(widget)
    saveConfig(config.value)
  }

  const removeWidget = (widgetId: string) => {
    config.value.widgets = config.value.widgets.filter(w => w.id !== widgetId)
    saveConfig(config.value)
  }

  const reset = () => {
    config.value = resetConfig()
  }

  return {
    config,
    widgets,
    updateWidget,
    addWidget,
    removeWidget,
    reset
  }
})
