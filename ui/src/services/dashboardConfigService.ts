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

import { rest } from './axiosInstances'

export type WidgetType = 'summary' | 'outages' | 'alarms' | 'nodes'

export interface ColumnDef {
  key: string
  label: string
}

/** Available columns per widget type. Order determines display order. */
export const WIDGET_COLUMNS: Record<Exclude<WidgetType, 'summary'>, ColumnDef[]> = {
  alarms: [
    { key: 'severity', label: 'Severity' },
    { key: 'node',     label: 'Node' },
    { key: 'message',  label: 'Message' },
    { key: 'count',    label: 'Count' },
    { key: 'time',     label: 'Time' }
  ],
  outages: [
    { key: 'node',    label: 'Node' },
    { key: 'service', label: 'Service' },
    { key: 'ip',      label: 'IP Address' },
    { key: 'since',   label: 'Since' }
  ],
  nodes: [
    { key: 'node',       label: 'Node' },
    { key: 'location',   label: 'Location' },
    { key: 'categories', label: 'Categories' }
  ]
}

const DEFAULT_COLUMNS: Record<Exclude<WidgetType, 'summary'>, string[]> = {
  alarms:  ['severity', 'node', 'message', 'count'],
  outages: ['node', 'service', 'ip'],
  nodes:   ['node', 'location', 'categories']
}

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  // gridstack layout
  x?: number
  y?: number
  w?: number
  h?: number
  colSpan?: number
  // widget settings
  categories: string[]
  limit: number
  refreshInterval: number
  severities: string[]
  /** Visible column keys. Undefined / empty = all columns (backward compat). */
  columns?: string[]
}

export interface DashboardConfig {
  version: number
  widgets: WidgetConfig[]
}

const STORAGE_KEY = 'opennms.dashboard.config'
const CONFIG_VERSION = 2
const USER_PROP_KEY = 'ui.dashboard.layout'

const defaultConfig = (): DashboardConfig => ({
  version: CONFIG_VERSION,
  widgets: [
    { id: 'widget-summary', type: 'summary', title: 'Network Summary',  x: 0, y: 0, w: 12, h: 2, categories: [], limit: 0,  refreshInterval: 60,  severities: [] },
    { id: 'widget-outages', type: 'outages', title: 'Active Outages',   x: 0, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: [],                                 columns: DEFAULT_COLUMNS.outages },
    { id: 'widget-alarms',  type: 'alarms',  title: 'Active Alarms',    x: 6, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: ['CRITICAL', 'MAJOR', 'MINOR'],     columns: DEFAULT_COLUMNS.alarms },
    { id: 'widget-nodes',   type: 'nodes',   title: 'Nodes',            x: 0, y: 5, w: 12, h: 3, categories: [], limit: 10, refreshInterval: 120, severities: [],                                 columns: DEFAULT_COLUMNS.nodes }
  ]
})

/** Returns true if the parsed config has the new x/y/w/h layout fields */
const isValidV2Config = (config: DashboardConfig): boolean =>
  config.version === CONFIG_VERSION &&
  config.widgets.length > 0 &&
  config.widgets.every(w =>
    typeof w.x === 'number' &&
    typeof w.y === 'number' &&
    typeof w.w === 'number' &&
    typeof w.h === 'number'
  )

const loadConfig = (): DashboardConfig => {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (json) {
      const parsed = JSON.parse(json) as DashboardConfig
      if (isValidV2Config(parsed)) return parsed
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

const loadFromServer = async (username: string): Promise<DashboardConfig | null> => {
  try {
    const resp = await rest.get(`users/${username}/properties/${USER_PROP_KEY}`)
    const json = resp.data?.value as string | undefined
    if (!json) return null
    const parsed = JSON.parse(json) as DashboardConfig
    if (isValidV2Config(parsed)) return parsed
  } catch {
    // 404 or parse error — no server config yet
  }
  return null
}

const saveToServer = async (username: string, config: DashboardConfig): Promise<void> => {
  try {
    await rest.put(`users/${username}/properties/${USER_PROP_KEY}`, { value: JSON.stringify(config) })
  } catch {
    // non-fatal — localStorage is the fallback
  }
}

export { loadConfig, saveConfig, resetConfig, defaultConfig, loadFromServer, saveToServer }
