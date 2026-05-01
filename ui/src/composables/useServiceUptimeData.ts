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

import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSQuerySpec } from '@/datasource/opennms/types'
import type { Outage } from '@/types'
import API from '@/services'

export interface OutageSegment {
  startPct: number
  widthPct: number
  outageId: number
}

/** Pure function — exported for unit tests. */
export const buildOutageSegments = (
  outages: Outage[],
  ip: string,
  serviceName: string,
  windowStart: number,
  windowEnd: number
): OutageSegment[] => {
  const duration = windowEnd - windowStart
  return outages
    .filter(o => o.ipAddress === ip && o.serviceName === serviceName && o.ifLostService != null)
    .map(o => {
      const start = Math.max(o.ifLostService!, windowStart)
      const end = o.ifRegainedService != null
        ? Math.min(o.ifRegainedService, windowEnd)
        : windowEnd
      return {
        startPct: ((start - windowStart) / duration) * 100,
        widthPct: ((end - start) / duration) * 100,
        outageId: o.outageId ?? o.id
      }
    })
    .filter(s => s.widthPct > 0)
}

/**
 * Per-service composable: discovers the RRD attribute (same technique as ServiceGraphTooltip)
 * and returns a ready query + time range for PersesPanel.
 *
 * nodeId must be in foreignSource:foreignId form or numeric — same as ServiceGraphTooltip.
 */
const useServiceUptimeData = (
  nodeId: string,
  ip: string,
  serviceName: string,
  outages: Readonly<Outage[]>,
  windowStart: number,
  windowEnd: number
) => {
  const resourceExists = ref<boolean | null>(null)
  const rrdAttribute = ref<string>('icmp')
  const loading = ref(true)

  const resourceId = computed(() => `node[${nodeId}].responseTime[${ip}]`)

  const timeRange = computed<AbsoluteTimeRange>(() => ({
    start: new Date(windowStart),
    end: new Date(windowEnd)
  }))

  const query = computed<OpenNMSQuerySpec>(() => ({
    resourceId: resourceId.value,
    attribute: rrdAttribute.value,
    aggregation: 'AVERAGE',
    label: 'Response Time (ms)'
  }))

  const outageSegments = computed<OutageSegment[]>(() =>
    buildOutageSegments(outages as Outage[], ip, serviceName, windowStart, windowEnd)
  )

  onMounted(async () => {
    const result = await API.getResourceById(resourceId.value)
    if (result) {
      const attrs = Object.keys((result as any).rrdGraphAttributes ?? {})
      if (attrs.length > 0) rrdAttribute.value = attrs[0]
    }
    resourceExists.value = result !== null
    loading.value = false
  })

  return { query, timeRange, outageSegments, resourceExists, loading }
}

export default useServiceUptimeData
