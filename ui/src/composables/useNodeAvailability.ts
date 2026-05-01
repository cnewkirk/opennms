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

import { getNodeAvailabilityPercentage, getNodeById } from '@/services/nodeService'
import { getOutages } from '@/services/outageService'
import { NodeAvailability, Outage } from '@/types'
import { sub } from 'date-fns'

export interface ChartSegment {
  x: [number, number]
  y: string
}

export interface DownSegmentMeta {
  outageId: number
}

export interface AvailabilityChartData {
  datasets: [
    { label: 'Up';   backgroundColor: string; borderWidth: 0; data: ChartSegment[] },
    { label: 'Down'; backgroundColor: string; borderWidth: 0; data: ChartSegment[] }
  ]
  downSegmentMeta: DownSegmentMeta[]
}

/** Pure transform — exported for testing. */
export const buildAvailabilityChartData = (
  availability: NodeAvailability,
  outages: Outage[],
  windowStart: number,
  windowEnd: number
): AvailabilityChartData => {
  const upSegments: ChartSegment[] = []
  const downSegments: ChartSegment[] = []
  const downSegmentMeta: DownSegmentMeta[] = []

  for (const iface of availability.ipinterfaces) {
    for (const svc of iface.services) {
      const label = `${svc.name} @ ${iface.address}`
      const svcOutages = outages
        .filter(o => o.ipAddress === iface.address && o.serviceName === svc.name && o.ifLostService != null)
        .sort((a, b) => (a.ifLostService ?? 0) - (b.ifLostService ?? 0))

      let cursor = windowStart
      for (const outage of svcOutages) {
        const lostAt = Math.max(outage.ifLostService!, windowStart)
        const regainedAt = outage.ifRegainedService != null
          ? Math.min(outage.ifRegainedService, windowEnd)
          : windowEnd

        if (cursor < lostAt) {
          upSegments.push({ x: [cursor, lostAt], y: label })
        }
        downSegments.push({ x: [lostAt, regainedAt], y: label })
        downSegmentMeta.push({ outageId: outage.outageId ?? outage.id })
        cursor = regainedAt
      }
      if (cursor < windowEnd) {
        upSegments.push({ x: [cursor, windowEnd], y: label })
      }
    }
  }

  return {
    datasets: [
      { label: 'Up',   backgroundColor: 'rgba(102,187,106,0.85)', borderWidth: 0, data: upSegments },
      { label: 'Down', backgroundColor: 'rgba(227,93,91,0.85)',   borderWidth: 0, data: downSegments }
    ],
    downSegmentMeta
  }
}

const useNodeAvailability = (nodeId: string) => {
  const availability = ref<NodeAvailability | null>(null)
  const chartData = ref<AvailabilityChartData | null>(null)
  const downSegmentMeta = ref<DownSegmentMeta[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const outages = ref<Outage[]>([])
  const windowStartMs = ref<number>(0)
  const windowEndMs   = ref<number>(0)

  const fetch = async () => {
    loading.value = true
    error.value = null

    const now = Date.now()
    const windowStart = sub(now, { hours: 24 }).getTime()
    windowEndMs.value   = now
    windowStartMs.value = sub(now, { hours: 24 }).getTime()

    // /rest/availability/nodes/{id} only accepts numeric IDs.
    // Resolve foreignSource:foreignId to the numeric ID first.
    let numericId = nodeId
    if (nodeId.includes(':')) {
      const node = await getNodeById(nodeId)
      if (!node) {
        error.value = 'Failed to load availability data'
        loading.value = false
        return
      }
      numericId = node.id
    }

    const [avResult, outageResult] = await Promise.all([
      getNodeAvailabilityPercentage(numericId),
      getOutages({
        _s: `node.id==${numericId};ifLostService=ge=${windowStart}`,
        limit: 0
      })
    ])

    const fetchedOutages = outageResult ? outageResult.outage : []
    outages.value = fetchedOutages

    if (!avResult) {
      error.value = 'Failed to load availability data'
      loading.value = false
      return
    }

    availability.value = avResult
    const result = buildAvailabilityChartData(avResult, fetchedOutages, windowStart, now)
    chartData.value = result
    downSegmentMeta.value = result.downSegmentMeta
    loading.value = false
  }

  fetch()

  return { availability, chartData, downSegmentMeta, outages, windowStartMs, windowEndMs, loading, error }
}

export default useNodeAvailability
