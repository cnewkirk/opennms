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
import { computeGrid, type SurveillanceNode, type SurveillanceAlarm, type SurveillanceOutage, type SurveillanceView } from '@/services/surveillanceDashboardService'

const view: SurveillanceView = {
  name: 'default',
  refreshSeconds: 300,
  rows: [
    { label: 'Routers', categories: ['Routers'] },
    { label: 'Servers', categories: ['Servers'] }
  ],
  columns: [
    { label: 'PROD', categories: ['Production'] },
    { label: 'TEST', categories: ['Test'] }
  ]
}

// Node in Routers+Production → cell (0,0)
const nodeRouterProd: SurveillanceNode = { id: 1, label: 'r1', categories: ['Routers', 'Production'] }
// Node in Servers+Test → cell (1,1)
const nodeServerTest: SurveillanceNode = { id: 2, label: 's1', categories: ['Servers', 'Test'] }
// Node with no matching categories → appears in no cell
const nodeOrphan: SurveillanceNode = { id: 3, label: 'x1', categories: ['Development'] }

const alarmMajor: SurveillanceAlarm = { nodeId: 1, severity: 'MAJOR' }
const alarmMinor: SurveillanceAlarm = { nodeId: 2, severity: 'MINOR' }

const outageNode1: SurveillanceOutage = { nodeId: 1 }

describe('computeGrid', () => {
  it('places nodes in correct cells by category intersection', () => {
    const grid = computeGrid(view, [nodeRouterProd, nodeServerTest, nodeOrphan], [], [])
    expect(grid[0][0].nodeIds).toContain(1)
    expect(grid[0][0].nodeIds).not.toContain(2)
    expect(grid[1][1].nodeIds).toContain(2)
    expect(grid[1][1].nodeIds).not.toContain(1)
    // orphan node is in no cell
    expect(grid[0][0].nodeIds).not.toContain(3)
    expect(grid[1][1].nodeIds).not.toContain(3)
  })

  it('empty cell when no nodes match intersection', () => {
    const grid = computeGrid(view, [nodeRouterProd], [], [])
    expect(grid[1][1].nodeIds).toHaveLength(0)
    expect(grid[1][1].worstSeverity).toBe('NORMAL')
  })

  it('sets worstSeverity from alarms on nodes in cell', () => {
    const grid = computeGrid(view, [nodeRouterProd, nodeServerTest], [alarmMajor, alarmMinor], [])
    expect(grid[0][0].worstSeverity).toBe('MAJOR')
    expect(grid[1][1].worstSeverity).toBe('MINOR')
  })

  it('severity rank: CRITICAL > MAJOR > MINOR > WARNING > NORMAL', () => {
    const nodeBoth: SurveillanceNode = { id: 4, label: 'r2', categories: ['Routers', 'Production'] }
    const alarmCritical: SurveillanceAlarm = { nodeId: 4, severity: 'CRITICAL' }
    const grid = computeGrid(view, [nodeRouterProd, nodeBoth], [alarmMajor, alarmCritical], [])
    expect(grid[0][0].worstSeverity).toBe('CRITICAL')
  })

  it('counts nodes and downCount from outages', () => {
    const grid = computeGrid(view, [nodeRouterProd], [], [outageNode1])
    expect(grid[0][0].nodeCount).toBe(1)
    expect(grid[0][0].downCount).toBe(1)
  })

  it('downCount only counts nodes in that cell', () => {
    const grid = computeGrid(view, [nodeRouterProd, nodeServerTest], [], [outageNode1])
    expect(grid[0][0].downCount).toBe(1)
    expect(grid[1][1].downCount).toBe(0)
  })
})

describe('grid dimensions', () => {
  it('produces grid with correct row and column count', () => {
    const grid = computeGrid(view, [nodeRouterProd], [], [])
    expect(grid).toHaveLength(2)      // 2 rows
    expect(grid[0]).toHaveLength(2)   // 2 columns
  })
})
