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

import { describe, it, expect } from 'vitest'
import { extractIdFromUrl, edgeLabel, statusColor } from '@/services/bsmService'

describe('extractIdFromUrl', () => {
  it('extracts numeric id from BSM URL', () => {
    expect(extractIdFromUrl('/api/v2/business-services/42')).toBe(42)
  })
  it('handles URL with trailing slash', () => {
    expect(extractIdFromUrl('/api/v2/business-services/7/')).toBe(7)
  })
})

describe('edgeLabel', () => {
  it('labels ip-service edge with node and service', () => {
    const edge = {
      type: 'ip-service' as const,
      id: 1, operationalStatus: 'NORMAL',
      mapFunction: { type: 'Identity', properties: {} }, weight: 1,
      ipService: { id: 1, nodeLabel: 'router1', ipAddress: '10.0.0.1', serviceName: 'ICMP' },
      friendlyName: undefined
    }
    expect(edgeLabel(edge)).toBe('router1 / 10.0.0.1 / ICMP')
  })
  it('labels ip-service edge with friendly name when present', () => {
    const edge = {
      type: 'ip-service' as const,
      id: 1, operationalStatus: 'NORMAL',
      mapFunction: { type: 'Identity', properties: {} }, weight: 1,
      ipService: { id: 1, nodeLabel: 'router1', ipAddress: '10.0.0.1', serviceName: 'ICMP' },
      friendlyName: 'My Router ICMP'
    }
    expect(edgeLabel(edge)).toBe('My Router ICMP')
  })
  it('labels reduction-key edge', () => {
    const edge = {
      type: 'reduction-key' as const,
      id: 2, operationalStatus: 'NORMAL',
      mapFunction: { type: 'Identity', properties: {} }, weight: 1,
      reductionKey: 'uei.opennms.org/test::1', friendlyName: undefined
    }
    expect(edgeLabel(edge)).toBe('uei.opennms.org/test::1')
  })
  it('labels reduction-key edge with friendly name', () => {
    const edge = {
      type: 'reduction-key' as const,
      id: 2, operationalStatus: 'NORMAL',
      mapFunction: { type: 'Identity', properties: {} }, weight: 1,
      reductionKey: 'uei.opennms.org/test::1', friendlyName: 'My Alert'
    }
    expect(edgeLabel(edge)).toBe('My Alert')
  })
  it('labels child edge', () => {
    const edge = {
      type: 'child' as const,
      id: 3, operationalStatus: 'NORMAL',
      mapFunction: { type: 'Identity', properties: {} }, weight: 1,
      childId: 5
    }
    expect(edgeLabel(edge)).toBe('Child Service #5')
  })
  it('labels application edge', () => {
    const edge = {
      type: 'application' as const,
      id: 4, operationalStatus: 'NORMAL',
      mapFunction: { type: 'Identity', properties: {} }, weight: 1,
      application: { id: 2, applicationName: 'WebApp' }
    }
    expect(edgeLabel(edge)).toBe('WebApp')
  })
})

describe('statusColor', () => {
  it('returns correct color class for CRITICAL', () => {
    expect(statusColor('CRITICAL')).toBe('status-critical')
  })
  it('returns correct color class for NORMAL', () => {
    expect(statusColor('NORMAL')).toBe('status-normal')
  })
  it('returns indeterminate class for unknown status', () => {
    expect(statusColor('UNKNOWN')).toBe('status-indeterminate')
  })
})
