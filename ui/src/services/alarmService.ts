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

import { v2, rest } from './axiosInstances'
import { QueryParameters, AlarmQueryParameters, AlarmApiResponse, Alarm, AlarmAcknowledgment } from '@/types'
import { queryParametersHandler } from './serviceHelpers'

const endpoint = '/alarms'

const getAlarms = async (queryParameters?: QueryParameters): Promise<AlarmApiResponse | false> => {
  let endpointWithQueryString = ''

  if (queryParameters) {
    endpointWithQueryString = queryParametersHandler(queryParameters, endpoint)
  }

  try {
    const resp = await v2.get(endpointWithQueryString || endpoint)

    // no content from server
    if (resp.status === 204) {
      return { alarm: [], totalCount: 0, count: 0, offset: 0 }
    }

    return resp.data
  } catch (err) {
    return false
  }
}

const modifyAlarm = async (alarmId: string, alarmQueryParameters: AlarmQueryParameters): Promise<string | false> => {
  let endpointWithQueryString = ''

  if (alarmQueryParameters) {
    endpointWithQueryString = queryParametersHandler(alarmQueryParameters, endpoint + '/' + alarmId)
  }

  try {
    const resp = await rest.put(endpointWithQueryString, '')
    return resp.data
  } catch (err) {
    return false
  }
}

const getAlarmById = async (id: string | number): Promise<Alarm | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${id}`)
    return resp.data
  } catch (err) {
    return false
  }
}

const getNodeAlarms = async (nodeId: number, limit = 10): Promise<Alarm[]> => {
  try {
    const resp = await v2.get(endpoint, {
      params: { '_s': `nodeId==${nodeId}`, limit }
    })
    if (resp.status === 204) return []
    return resp.data?.alarm ?? []
  } catch {
    return []
  }
}

const getAlarmAcknowledgments = async (id: string | number): Promise<AlarmAcknowledgment[]> => {
  try {
    const resp = await rest.get(`/acks?alarmId=${id}`)
    return resp.data?.ack ?? []
  } catch (err) {
    return []
  }
}

const saveStickyMemo = async (id: string | number, body: string): Promise<boolean> => {
  try {
    await v2.put(`${endpoint}/${id}/memo`, body, {
      headers: { 'Content-Type': 'text/plain' }
    })
    return true
  } catch (err) {
    return false
  }
}

const deleteStickyMemo = async (id: string | number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${id}/memo`)
    return true
  } catch (err) {
    return false
  }
}

const saveJournalMemo = async (id: string | number, body: string): Promise<boolean> => {
  try {
    await v2.put(`${endpoint}/${id}/journal`, body, {
      headers: { 'Content-Type': 'text/plain' }
    })
    return true
  } catch (err) {
    return false
  }
}

const deleteJournalMemo = async (id: string | number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${id}/journal`)
    return true
  } catch (err) {
    return false
  }
}

export {
  getAlarms,
  getNodeAlarms,
  modifyAlarm,
  getAlarmById,
  getAlarmAcknowledgments,
  saveStickyMemo,
  deleteStickyMemo,
  saveJournalMemo,
  deleteJournalMemo
}
