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
import { MonitoringLocationApiResponse, MonitoringLocation } from '@/types'

const endpoint = '/monitoringLocations'

const normalize = (loc: MonitoringLocation) => {
  loc.name = loc['location-name']
  loc.area = loc['monitoring-area']
  return loc
}

export const getMonitoringLocations = async (): Promise<MonitoringLocationApiResponse | false> => {
  try {
    const resp = await v2.get(endpoint)
    const data = resp.data as MonitoringLocationApiResponse
    data.location.forEach(normalize)
    return data
  } catch (err) {
    return false
  }
}

export const createMonitoringLocation = async (loc: Partial<MonitoringLocation>): Promise<boolean> => {
  try {
    await v2.post(endpoint, {
      'location-name': loc['location-name'],
      'monitoring-area': loc['monitoring-area'] ?? '',
      priority: loc.priority ?? 100,
      geolocation: loc.geolocation ?? null,
      latitude: loc.latitude ?? null,
      longitude: loc.longitude ?? null,
      tags: loc.tags ?? []
    })
    return true
  } catch (err) {
    return false
  }
}

export const updateMonitoringLocation = async (name: string, loc: Partial<MonitoringLocation>): Promise<boolean> => {
  try {
    await v2.put(`${endpoint}/${encodeURIComponent(name)}`, {
      'location-name': name,
      'monitoring-area': loc['monitoring-area'] ?? '',
      priority: loc.priority ?? 100,
      geolocation: loc.geolocation ?? null,
      latitude: loc.latitude ?? null,
      longitude: loc.longitude ?? null,
      tags: loc.tags ?? []
    })
    return true
  } catch (err) {
    return false
  }
}

export const deleteMonitoringLocation = async (name: string): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${encodeURIComponent(name)}`)
    return true
  } catch (err) {
    return false
  }
}
