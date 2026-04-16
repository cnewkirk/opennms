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

// ─── Public types ────────────────────────────────────────────────────────────

export type Severity = 'NORMAL' | 'WARNING' | 'MINOR' | 'MAJOR' | 'CRITICAL'

export interface SurveillanceRowOrColumn {
  label: string
  categories: string[]
}

export interface SurveillanceView {
  name: string
  refreshSeconds: number
  rows: SurveillanceRowOrColumn[]
  columns: SurveillanceRowOrColumn[]
}

export interface SurveillanceViewConfig {
  defaultView: string
  views: SurveillanceView[]
}

/** Minimal node shape needed for grid computation */
export interface SurveillanceNode {
  id: number
  label: string
  categories: string[]
}

/** Minimal alarm shape needed for severity computation */
export interface SurveillanceAlarm {
  nodeId: number
  severity: string
}

/** Minimal outage shape needed for down-count */
export interface SurveillanceOutage {
  nodeId: number
}

export interface CellData {
  nodeIds: number[]
  nodeCount: number
  downCount: number
  worstSeverity: Severity
}

export interface DashboardData {
  view: SurveillanceView
  grid: CellData[][]
  nodes: SurveillanceNode[]
  alarms: SurveillanceAlarm[]
  outages: SurveillanceOutage[]
}

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  NORMAL: 0, WARNING: 1, MINOR: 2, MAJOR: 3, CRITICAL: 4
}

const worstOf = (a: Severity, b: string): Severity => {
  const bNorm = b.toUpperCase()
  if ((SEVERITY_RANK[bNorm] ?? -1) > (SEVERITY_RANK[a] ?? 0)) {
    return bNorm as Severity
  }
  return a
}

// ─── Pure computation ────────────────────────────────────────────────────────

/**
 * Computes the NxM grid of CellData from fetched raw data.
 * No HTTP calls — accepts pre-fetched data, making it unit-testable.
 */
export const computeGrid = (
  view: SurveillanceView,
  nodes: SurveillanceNode[],
  alarms: SurveillanceAlarm[],
  outages: SurveillanceOutage[]
): CellData[][] => {
  const outageNodeIds = new Set(outages.map(o => o.nodeId))

  return view.rows.map(row =>
    view.columns.map(col => {
      const rowCats = new Set(row.categories)
      const colCats = new Set(col.categories)

      const cellNodes = nodes.filter(n =>
        n.categories.some(c => rowCats.has(c)) &&
        n.categories.some(c => colCats.has(c))
      )

      const cellNodeIds = cellNodes.map(n => n.id)
      const cellNodeIdSet = new Set(cellNodeIds)

      const cellAlarms = alarms.filter(a => cellNodeIdSet.has(a.nodeId))
      const worstSeverity = cellAlarms.reduce<Severity>(
        (worst, alarm) => worstOf(worst, alarm.severity),
        'NORMAL'
      )

      const downCount = cellNodes.filter(n => outageNodeIds.has(n.id)).length

      return {
        nodeIds: cellNodeIds,
        nodeCount: cellNodeIds.length,
        downCount,
        worstSeverity
      } satisfies CellData
    })
  )
}

// ─── HTTP fetching ───────────────────────────────────────────────────────────

/** Fetches the surveillance view config from the server */
export const fetchConfig = async (): Promise<SurveillanceViewConfig> => {
  const resp = await v2.get<SurveillanceViewConfig>('surveillance-view-config')
  return resp.data
}

/** Fetches all nodes (up to 1000) with their categories */
const fetchNodes = async (): Promise<SurveillanceNode[]> => {
  const resp = await v2.get<{ node: any[] }>('nodes', { params: { limit: 1000 } })
  return (resp.data.node ?? []).map((n: any) => ({
    id: Number(n.id),
    label: n.label ?? '',
    categories: (n.categories ?? []).map((c: any) =>
      typeof c === 'string' ? c : c.name ?? ''
    )
  }))
}

/** Fetches active (non-normal, non-cleared) alarms */
const fetchAlarms = async (): Promise<SurveillanceAlarm[]> => {
  const resp = await v2.get<{ alarm: any[] }>('alarms', {
    params: { limit: 1000, _s: 'severity!=CLEARED;severity!=NORMAL' }
  })
  return (resp.data.alarm ?? []).map((a: any) => ({
    nodeId: Number(a.nodeId),
    severity: a.severity ?? 'NORMAL'
  }))
}

/** Fetches currently open outages */
const fetchOutages = async (): Promise<SurveillanceOutage[]> => {
  const resp = await v2.get<{ outage: any[] }>('outages', {
    params: { limit: 1000, _s: 'ifRegainedService==null' }
  })
  return (resp.data.outage ?? []).map((o: any) => ({
    nodeId: Number(o.nodeId)
  }))
}

/**
 * Fetches all data needed for the dashboard and computes the grid.
 * @param viewName - optional view name; uses defaultView if omitted
 */
export const fetchDashboardData = async (viewName?: string): Promise<DashboardData> => {
  const [config, nodes, alarms, outages] = await Promise.all([
    fetchConfig(),
    fetchNodes(),
    fetchAlarms(),
    fetchOutages()
  ])

  const targetName = viewName ?? config.defaultView
  const view = config.views.find(v => v.name === targetName) ?? config.views[0]

  if (!view) throw new Error('No surveillance views configured')

  return {
    view,
    grid: computeGrid(view, nodes, alarms, outages),
    nodes,
    alarms,
    outages
  }
}
