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

export interface SurveillanceViewRowOrColumn {
  label: string
  categories: string[]
}

export interface SurveillanceView {
  name: string
  refreshSeconds: number
  rows: SurveillanceViewRowOrColumn[]
  columns: SurveillanceViewRowOrColumn[]
}

export interface SurveillanceViewConfig {
  defaultView: string
  views: SurveillanceView[]
}

const BASE = 'surveillance-view-config'

export const getConfig = async (): Promise<SurveillanceViewConfig> => {
  const resp = await v2.get<SurveillanceViewConfig>(BASE)
  return resp.data
}

export const saveConfig = async (config: SurveillanceViewConfig): Promise<void> => {
  await v2.put(BASE, config)
}
