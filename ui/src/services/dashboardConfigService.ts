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

export type WidgetType = 'summary' | 'outages' | 'alarms' | 'nodes'

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  categories: string[]
  limit: number
  refreshInterval: number  // seconds
  severities: string[]     // for alarm widgets
  colSpan: 3 | 4 | 6 | 12
}

export interface DashboardConfig {
  version: number
  widgets: WidgetConfig[]
}

const STORAGE_KEY = 'opennms.dashboard.config'
const CONFIG_VERSION = 1

const defaultConfig = (): DashboardConfig => ({
  version: CONFIG_VERSION,
  widgets: [
    {
      id: 'widget-summary',
      type: 'summary',
      title: 'Network Summary',
      categories: [],
      limit: 0,
      refreshInterval: 60,
      severities: [],
      colSpan: 12
    },
    {
      id: 'widget-outages',
      type: 'outages',
      title: 'Active Outages',
      categories: [],
      limit: 10,
      refreshInterval: 60,
      severities: [],
      colSpan: 6
    },
    {
      id: 'widget-alarms',
      type: 'alarms',
      title: 'Active Alarms',
      categories: [],
      limit: 10,
      refreshInterval: 60,
      severities: ['CRITICAL', 'MAJOR', 'MINOR'],
      colSpan: 6
    },
    {
      id: 'widget-nodes',
      type: 'nodes',
      title: 'Nodes',
      categories: [],
      limit: 10,
      refreshInterval: 120,
      severities: [],
      colSpan: 12
    }
  ]
})

const loadConfig = (): DashboardConfig => {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (json) {
      const parsed = JSON.parse(json) as DashboardConfig
      if (parsed.version === CONFIG_VERSION) {
        return parsed
      }
    }
  } catch {
    // corrupt storage — fall through to default
  }
  return defaultConfig()
}

const saveConfig = (config: DashboardConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

const resetConfig = (): DashboardConfig => {
  const config = defaultConfig()
  saveConfig(config)
  return config
}

export { loadConfig, saveConfig, resetConfig, defaultConfig }
