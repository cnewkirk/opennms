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

import { describe, test, expect } from 'vitest'
import { buildAvailabilityChartData } from '@/composables/useNodeAvailability'
import { NodeAvailability, Outage } from '@/types'

const WINDOW_START = 1000000
const WINDOW_END   = 1086400000  // +24h

const availability: NodeAvailability = {
  id: 1,
  availability: 99.5,
  'service-count': 1,
  'service-down-count': 0,
  ipinterfaces: [{
    id: 1,
    address: '10.0.0.1',
    availability: 99.5,
    services: [{ id: 1, name: 'ICMP', availability: 99.5 }]
  }]
}

describe('buildAvailabilityChartData', () => {
  test('produces one full up segment when there are no outages', () => {
    const { datasets } = buildAvailabilityChartData(availability, [], WINDOW_START, WINDOW_END)
    const up = datasets[0].data
    const down = datasets[1].data
    expect(up).toHaveLength(1)
    expect(up[0]).toEqual({ x: [WINDOW_START, WINDOW_END], y: 'ICMP @ 10.0.0.1' })
    expect(down).toHaveLength(0)
  })

  test('splits into up/down/up segments around a resolved outage', () => {
    const outage: Outage = {
      id: 42, outageId: 42, nodeId: 1, ipAddress: '10.0.0.1', serviceName: 'ICMP',
      nodeLabel: '', location: '', hostname: '', serviceId: 1,
      ifLostService: 1010000, ifRegainedService: 1020000
    }
    const { datasets, downSegmentMeta } = buildAvailabilityChartData(
      availability, [outage], WINDOW_START, WINDOW_END
    )
    const up = datasets[0].data
    const down = datasets[1].data

    expect(up).toHaveLength(2)
    expect(up[0]).toEqual({ x: [WINDOW_START, 1010000], y: 'ICMP @ 10.0.0.1' })
    expect(up[1]).toEqual({ x: [1020000, WINDOW_END], y: 'ICMP @ 10.0.0.1' })
    expect(down).toHaveLength(1)
    expect(down[0]).toEqual({ x: [1010000, 1020000], y: 'ICMP @ 10.0.0.1' })
    expect(downSegmentMeta[0].outageId).toBe(42)
  })

  test('caps an active outage at window end', () => {
    const outage: Outage = {
      id: 99, outageId: 99, nodeId: 1, ipAddress: '10.0.0.1', serviceName: 'ICMP',
      nodeLabel: '', location: '', hostname: '', serviceId: 1,
      ifLostService: 1050000, ifRegainedService: null
    }
    const { datasets } = buildAvailabilityChartData(
      availability, [outage], WINDOW_START, WINDOW_END
    )
    const down = datasets[1].data
    expect(down[0]).toEqual({ x: [1050000, WINDOW_END], y: 'ICMP @ 10.0.0.1' })
  })
})
