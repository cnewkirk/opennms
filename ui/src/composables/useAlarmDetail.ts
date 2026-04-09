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

import { SORT } from '@featherds/table'
import { getAlarmById, getAlarmAcknowledgments } from '@/services/alarmService'
import { getEvents } from '@/services/eventService'
import { Alarm, AlarmAcknowledgment, Event } from '@/types'

const useAlarmDetail = (id: string) => {
  const alarm = ref<Alarm | null>(null)
  const acknowledgments = ref<AlarmAcknowledgment[]>([])
  const relatedEvents = ref<Event[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null

    const [alarmResult, acksResult, eventsResult] = await Promise.all([
      getAlarmById(id),
      getAlarmAcknowledgments(id),
      getEvents({ _s: `alarm.id==${id}`, limit: 20, orderBy: 'id', order: SORT.DESCENDING })
    ])

    if (!alarmResult) {
      error.value = `Failed to load alarm ${id}`
    } else {
      alarm.value = alarmResult
      acknowledgments.value = Array.isArray(acksResult) ? acksResult : []
      relatedEvents.value = eventsResult ? eventsResult.event : []
    }
    loading.value = false
  }

  fetch()

  return { alarm, acknowledgments, relatedEvents, loading, error, refresh: fetch }
}

export default useAlarmDetail
