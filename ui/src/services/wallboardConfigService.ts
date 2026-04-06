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

import { v2 } from './axiosInstances'

export interface DashletEntry {
  dashletName: string
  title: string
  duration: number
  priority: number
  boostDuration: number
  boostPriority: number
  parameters: Record<string, string>
}

export interface WallboardEntry {
  title: string
  default: boolean
  dashlets: DashletEntry[]
}

export interface WallboardsConfig {
  wallboards: WallboardEntry[]
}

export const DASHLET_TYPES = [
  'Alarms', 'BSM', 'Map', 'Summary', 'RTC', 'Topology', 'Charts', 'Undefined'
] as const

export type DashletType = typeof DASHLET_TYPES[number]

const BASE = 'wallboard-config'

export const getConfig = async (): Promise<WallboardsConfig> => {
  const resp = await v2.get<WallboardsConfig>(BASE)
  return resp.data
}

export const saveConfig = async (config: WallboardsConfig): Promise<void> => {
  await v2.put(BASE, config)
}

export const makeDefaultDashlet = (): DashletEntry => ({
  dashletName: 'Alarms',
  title: '',
  duration: 15,
  priority: 5,
  boostDuration: 0,
  boostPriority: 0,
  parameters: {}
})

export const makeDefaultWallboard = (): WallboardEntry => ({
  title: 'New Board',
  default: false,
  dashlets: []
})
