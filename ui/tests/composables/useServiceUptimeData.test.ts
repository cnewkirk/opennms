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
import { buildOutageSegments } from '@/composables/useServiceUptimeData'
import { Outage } from '@/types'

const WIN_START = 1_000_000
const WIN_END   = 1_000_000 + 86_400_000  // +24h exactly
const DURATION  = WIN_END - WIN_START       // 86_400_000

const base: Outage = {
  id: 1, outageId: 1, nodeId: 1,
  ipAddress: '10.0.0.1', serviceName: 'ICMP',
  nodeLabel: '', location: '', hostname: '', serviceId: 1
}

describe('buildOutageSegments', () => {
  test('returns empty array when there are no outages', () => {
    expect(buildOutageSegments([], '10.0.0.1', 'ICMP', WIN_START, WIN_END)).toEqual([])
  })

  test('correctly converts a resolved outage to percentage coordinates', () => {
    const outage: Outage = {
      ...base,
      ifLostService: WIN_START + DURATION * 0.25,
      ifRegainedService: WIN_START + DURATION * 0.75
    }
    const [seg] = buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)
    expect(seg.startPct).toBeCloseTo(25)
    expect(seg.widthPct).toBeCloseTo(50)
    expect(seg.outageId).toBe(1)
  })

  test('active outage (ifRegainedService null) extends to 100%', () => {
    const outage: Outage = {
      ...base,
      ifLostService: WIN_START + DURATION * 0.5,
      ifRegainedService: null
    }
    const [seg] = buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)
    expect(seg.startPct).toBeCloseTo(50)
    expect(seg.widthPct).toBeCloseTo(50)
  })

  test('outage that started before window is clamped to startPct=0', () => {
    const outage: Outage = {
      ...base,
      ifLostService: WIN_START - 60_000,
      ifRegainedService: WIN_START + DURATION * 0.1
    }
    const [seg] = buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)
    expect(seg.startPct).toBeCloseTo(0)
    expect(seg.widthPct).toBeCloseTo(10)
  })

  test('ignores outages for different IP', () => {
    const outage: Outage = {
      ...base,
      ipAddress: '10.0.0.2',
      ifLostService: WIN_START + 1000,
      ifRegainedService: WIN_START + 2000
    }
    expect(buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)).toEqual([])
  })

  test('ignores outages for different service name', () => {
    const outage: Outage = {
      ...base,
      serviceName: 'HTTP',
      ifLostService: WIN_START + 1000,
      ifRegainedService: WIN_START + 2000
    }
    expect(buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)).toEqual([])
  })

  test('ignores outages where ifLostService is null', () => {
    const outage: Outage = { ...base, ifLostService: undefined, ifRegainedService: null }
    expect(buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)).toEqual([])
  })

  test('filters out zero-width segments (outage fully before window after clamping)', () => {
    const outage: Outage = {
      ...base,
      ifLostService: WIN_START - 2000,
      ifRegainedService: WIN_START - 1000
    }
    expect(buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)).toEqual([])
  })

  test('uses id as outageId when outageId is absent', () => {
    const { outageId: _, ...noOutageId } = base
    const outage: Outage = { ...noOutageId, ifLostService: WIN_START + 1000, ifRegainedService: WIN_START + 2000 }
    const [seg] = buildOutageSegments([outage], '10.0.0.1', 'ICMP', WIN_START, WIN_END)
    expect(seg.outageId).toBe(1)
  })
})
