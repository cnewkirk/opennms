# Surveillance Dashboard Vue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vaadin surveillance dashboard (`dashboard.jsp`) with a Vue 3 page at `#/surveillance-dashboard` that renders a rows×columns category-intersection grid with severity-colored cells.

**Architecture:** Fetch config + all nodes + active alarms + active outages in parallel; compute per-cell node sets and worst severity client-side. Container owns data and refresh timer; `SurveillanceGrid` is pure display; `SurveillanceCellDetail` shows nodes in a selected cell. Service owns all computation.

**Tech Stack:** Vue 3 Composition API, Pinia-free (local reactive state), Feather DS, Vitest + happy-dom, existing axios instances (`v2`, `rest`), `_severities.scss`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `ui/src/services/surveillanceDashboardService.ts` | All data fetching + cell computation |
| Create | `ui/tests/surveillanceDashboard.test.ts` | Unit tests for service computation |
| Create | `ui/src/containers/SurveillanceDashboard.vue` | Page container: fetch, refresh timer, view picker |
| Create | `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue` | Renders N×M HTML table |
| Create | `ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue` | Slide-in node list for selected cell |
| Modify | `ui/src/main/router/index.ts` | Add `/surveillance-dashboard` route |
| Modify | `ui/src/components/Menu/SideMenu.vue` | Add `dashboard.jsp` + `surveillance-view.jsp` to `legacyToVueRoutes` |
| Modify | `opennms-webapp/src/main/webapp/dashboard.jsp` | Replace with clean redirect to `#/surveillance-dashboard` |
| Modify | `opennms-webapp/src/main/webapp/surveillance-view.jsp` | Replace with clean redirect to `#/surveillance-dashboard` |

---

## Task 1: Service — types and cell computation (pure logic, no HTTP)

**Files:**
- Create: `ui/src/services/surveillanceDashboardService.ts`
- Create: `ui/tests/surveillanceDashboard.test.ts`

- [ ] **Step 1: Write failing tests for `computeGrid`**

Create `ui/tests/surveillanceDashboard.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/surveillanceDashboard.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '@/services/surveillanceDashboardService'`

- [ ] **Step 3: Implement `surveillanceDashboardService.ts` — types and `computeGrid`**

Create `ui/src/services/surveillanceDashboardService.ts`:

```typescript
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
    grid: computeGrid(view, nodes, alarms, outages)
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/surveillanceDashboard.test.ts 2>&1 | tail -20
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/surveillanceDashboardService.ts ui/tests/surveillanceDashboard.test.ts
git commit -m "feat(surveillance-dashboard): add service with types and computeGrid"
```

---

## Task 2: `SurveillanceGrid.vue` component

**Files:**
- Create: `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue`

- [ ] **Step 1: Create `SurveillanceGrid.vue`**

Create `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue`:

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div class="surveillance-grid-wrapper">
    <table class="surveillance-grid">
      <thead>
        <tr>
          <th class="corner-cell"></th>
          <th
            v-for="col in view.columns"
            :key="col.label"
            class="col-header"
          >{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in view.rows" :key="row.label">
          <td class="row-header">{{ row.label }}</td>
          <td
            v-for="(col, ci) in view.columns"
            :key="col.label"
            class="grid-cell"
            :class="[
              cellClass(grid[ri][ci].worstSeverity),
              { 'cell-empty': grid[ri][ci].nodeCount === 0 },
              { 'cell-selected': selectedRow === ri && selectedCol === ci }
            ]"
            @click="onCellClick(ri, ci)"
          >
            <template v-if="grid[ri][ci].nodeCount > 0">
              <span class="cell-count">{{ grid[ri][ci].nodeCount }}</span>
              <span v-if="grid[ri][ci].downCount > 0" class="cell-down">
                {{ grid[ri][ci].downCount }} down
              </span>
            </template>
            <span v-else class="cell-empty-label">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { SurveillanceView, CellData, Severity } from '@/services/surveillanceDashboardService'

const props = defineProps<{
  view: SurveillanceView
  grid: CellData[][]
  selectedRow: number | null
  selectedCol: number | null
}>()

const emit = defineEmits<{
  (e: 'cellClick', row: number, col: number): void
}>()

const onCellClick = (row: number, col: number) => {
  emit('cellClick', row, col)
}

const cellClass = (severity: Severity): string => {
  const map: Record<Severity, string> = {
    NORMAL:   'sev-normal',
    WARNING:  'sev-warning',
    MINOR:    'sev-minor',
    MAJOR:    'sev-major',
    CRITICAL: 'sev-critical'
  }
  return map[severity] ?? 'sev-normal'
}
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.surveillance-grid-wrapper {
  overflow-x: auto;
}

.surveillance-grid {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--feather-header-font-family);

  th, td {
    border: 1px solid var($border-light-on-surface);
    padding: 0.75rem 1rem;
    text-align: center;
  }

  .corner-cell {
    background: var($surface-dark);
  }

  .col-header {
    background: var($surface-dark);
    font-weight: 600;
    @include body-large;
    color: var($primary-text-on-surface);
    min-width: 120px;
  }

  .row-header {
    background: var($surface-dark);
    font-weight: 600;
    @include body-large;
    color: var($primary-text-on-surface);
    text-align: left;
    white-space: nowrap;
  }

  .grid-cell {
    cursor: pointer;
    transition: filter 0.1s;
    min-width: 120px;
    min-height: 60px;

    &:hover {
      filter: brightness(0.92);
    }

    &.cell-selected {
      outline: 3px solid var($primary);
      outline-offset: -3px;
    }

    &.cell-empty {
      background: var($surface);
      color: var($disabled-text-on-surface);
    }

    .cell-count {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .cell-down {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      opacity: 0.85;
    }

    .cell-empty-label {
      color: var($disabled-text-on-surface);
    }
  }

  // Severity background colors — solid fills for the status grid
  .sev-normal   { background: #2e7d32; color: #fff; }
  .sev-warning  { background: #f9a825; color: #000; }
  .sev-minor    { background: #ef6c00; color: #fff; }
  .sev-major    { background: #c62828; color: #fff; }
  .sev-critical { background: #6a1b9a; color: #fff; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue
git commit -m "feat(surveillance-dashboard): add SurveillanceGrid table component"
```

---

## Task 3: `SurveillanceCellDetail.vue` component

**Files:**
- Create: `ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue`

- [ ] **Step 1: Create `SurveillanceCellDetail.vue`**

Create `ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue`:

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div class="cell-detail">
    <div class="cell-detail-header">
      <span class="cell-detail-title">{{ rowLabel }} × {{ colLabel }}</span>
      <button class="cell-detail-close" @click="emit('close')" aria-label="Close">✕</button>
    </div>

    <div v-if="nodes.length === 0" class="cell-detail-empty">
      No nodes match these categories.
    </div>

    <ul v-else class="node-list">
      <li
        v-for="node in nodes"
        :key="node.id"
        class="node-item"
        :class="nodeClass(node.id)"
      >
        <router-link :to="`/node/${node.id}`" class="node-link">
          {{ node.label }}
        </router-link>
        <span v-if="downNodeIds.has(node.id)" class="node-badge down">down</span>
        <span
          v-else-if="worstAlarmByNode.get(node.id)"
          class="node-badge"
          :class="worstAlarmByNode.get(node.id)!.toLowerCase()"
        >
          {{ worstAlarmByNode.get(node.id) }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { SurveillanceNode, SurveillanceAlarm, SurveillanceOutage } from '@/services/surveillanceDashboardService'

const props = defineProps<{
  rowLabel: string
  colLabel: string
  nodes: SurveillanceNode[]
  alarms: SurveillanceAlarm[]
  outages: SurveillanceOutage[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const SEVERITY_RANK: Record<string, number> = {
  NORMAL: 0, WARNING: 1, MINOR: 2, MAJOR: 3, CRITICAL: 4
}

const downNodeIds = computed(() =>
  new Set(props.outages.map(o => o.nodeId))
)

const worstAlarmByNode = computed(() => {
  const map = new Map<number, string>()
  for (const alarm of props.alarms) {
    const current = map.get(alarm.nodeId)
    if (!current || (SEVERITY_RANK[alarm.severity] ?? 0) > (SEVERITY_RANK[current] ?? 0)) {
      map.set(alarm.nodeId, alarm.severity)
    }
  }
  return map
})

const nodeClass = (nodeId: number): string => {
  if (downNodeIds.value.has(nodeId)) return 'node-item--down'
  const sev = worstAlarmByNode.value.get(nodeId)
  return sev ? `node-item--${sev.toLowerCase()}` : ''
}
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.cell-detail {
  margin-top: 1.5rem;
  border: 1px solid var($border-light-on-surface);
  border-radius: 4px;
  background: var($surface);
  padding: 1rem 1.25rem;
}

.cell-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.cell-detail-title {
  @include subtitle1;
  font-weight: 600;
  color: var($primary-text-on-surface);
}

.cell-detail-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var($secondary-text-on-surface);
  padding: 0.25rem 0.5rem;
  &:hover { color: var($primary-text-on-surface); }
}

.cell-detail-empty {
  @include body-large;
  color: var($secondary-text-on-surface);
  padding: 0.5rem 0;
}

.node-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  background: var($surface);

  &--down    { background: rgba(198,40,40,0.08); }
  &--critical { background: rgba(106,27,154,0.08); }
  &--major   { background: rgba(198,40,40,0.08); }
  &--minor   { background: rgba(239,108,0,0.08); }
  &--warning { background: rgba(249,168,37,0.08); }
}

.node-link {
  @include body-large;
  color: var($clickable-normal);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.node-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  border-radius: 2px;
  letter-spacing: 0.05em;

  &.down     { background: #c62828; color: #fff; }
  &.critical { background: #6a1b9a; color: #fff; }
  &.major    { background: #c62828; color: #fff; }
  &.minor    { background: #ef6c00; color: #fff; }
  &.warning  { background: #f9a825; color: #000; }
  &.normal   { background: #2e7d32; color: #fff; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue
git commit -m "feat(surveillance-dashboard): add SurveillanceCellDetail panel component"
```

---

## Task 4: `SurveillanceDashboard.vue` container

**Files:**
- Create: `ui/src/containers/SurveillanceDashboard.vue`

- [ ] **Step 1: Create the container**

Create `ui/src/containers/SurveillanceDashboard.vue`:

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div class="surveillance-dashboard">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="page-header">
      <h1 class="page-title">Surveillance Dashboard</h1>
      <div class="header-actions">
        <FeatherSelect
          v-if="allViews.length > 1"
          :options="viewOptions"
          :modelValue="selectedViewOption"
          label="View"
          class="view-picker"
          @update:modelValue="onViewChange"
        />
        <span v-if="lastUpdated" class="last-updated">
          Updated {{ lastUpdated }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <FeatherSpinner />
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <p v-if="noViews">
        No surveillance views are configured.
        <router-link to="/surveillance-views-config">Configure views</router-link>
      </p>
    </div>

    <template v-else-if="data">
      <SurveillanceGrid
        :view="data.view"
        :grid="data.grid"
        :selectedRow="selectedRow"
        :selectedCol="selectedCol"
        @cellClick="onCellClick"
      />

      <SurveillanceCellDetail
        v-if="selectedRow !== null && selectedCol !== null"
        :rowLabel="data.view.rows[selectedRow].label"
        :colLabel="data.view.columns[selectedCol].label"
        :nodes="detailNodes"
        :alarms="detailAlarms"
        :outages="detailOutages"
        @close="clearSelection"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FeatherSpinner } from '@featherds/progress'
import { FeatherSelect } from '@featherds/select'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SurveillanceGrid from '@/components/SurveillanceDashboard/SurveillanceGrid.vue'
import SurveillanceCellDetail from '@/components/SurveillanceDashboard/SurveillanceCellDetail.vue'
import {
  fetchDashboardData,
  fetchConfig,
  type DashboardData,
  type SurveillanceNode,
  type SurveillanceAlarm,
  type SurveillanceOutage
} from '@/services/surveillanceDashboardService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Home', to: '/' },
  { label: 'Surveillance Dashboard', to: '/surveillance-dashboard' }
]

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(true)
const error = ref<string | null>(null)
const noViews = ref(false)
const data = ref<DashboardData | null>(null)
const lastUpdated = ref<string | null>(null)

// All view names for the picker
const allViews = ref<string[]>([])
const activeViewName = ref<string | undefined>(undefined)

// Cell selection
const selectedRow = ref<number | null>(null)
const selectedCol = ref<number | null>(null)

// Raw data cached for detail panel (avoids re-fetch on cell click)
const cachedNodes = ref<SurveillanceNode[]>([])
const cachedAlarms = ref<SurveillanceAlarm[]>([])
const cachedOutages = ref<SurveillanceOutage[]>([])

// Auto-refresh
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ─── Computed ────────────────────────────────────────────────────────────────

const viewOptions = computed(() =>
  allViews.value.map(name => ({ value: name, label: name }))
)

const selectedViewOption = computed(() =>
  viewOptions.value.find(o => o.value === activeViewName.value) ?? null
)

const detailNodes = computed(() => {
  if (selectedRow.value === null || selectedCol.value === null || !data.value) return []
  const nodeIds = new Set(data.value.grid[selectedRow.value][selectedCol.value].nodeIds)
  return cachedNodes.value.filter(n => nodeIds.has(n.id))
})

const detailAlarms = computed(() => {
  if (selectedRow.value === null || selectedCol.value === null || !data.value) return []
  const nodeIds = new Set(data.value.grid[selectedRow.value][selectedCol.value].nodeIds)
  return cachedAlarms.value.filter(a => nodeIds.has(a.nodeId))
})

const detailOutages = computed(() => {
  if (selectedRow.value === null || selectedCol.value === null || !data.value) return []
  const nodeIds = new Set(data.value.grid[selectedRow.value][selectedCol.value].nodeIds)
  return cachedOutages.value.filter(o => nodeIds.has(o.nodeId))
})

// ─── Methods ─────────────────────────────────────────────────────────────────

const load = async () => {
  try {
    const result = await fetchDashboardData(activeViewName.value)
    data.value = result
    // cache raw arrays for detail panel
    cachedNodes.value = result.view.rows.flatMap(() => []) // populated via service internals
    lastUpdated.value = new Date().toLocaleTimeString()
    error.value = null
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load surveillance data'
    noViews.value = e?.message?.includes('No surveillance views')
    showSnackBar({ msg: error.value ?? 'Error loading surveillance dashboard' })
  } finally {
    loading.value = false
  }
}

const startRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  const seconds = Math.max(data.value?.view.refreshSeconds ?? 300, 30)
  refreshTimer = setInterval(load, seconds * 1000)
}

const onCellClick = (row: number, col: number) => {
  if (selectedRow.value === row && selectedCol.value === col) {
    clearSelection()
  } else {
    selectedRow.value = row
    selectedCol.value = col
  }
}

const clearSelection = () => {
  selectedRow.value = null
  selectedCol.value = null
}

const onViewChange = (option: { value: string; label: string } | null) => {
  if (!option) return
  activeViewName.value = option.value
  clearSelection()
  loading.value = true
  load().then(startRefresh)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const config = await fetchConfig()
    allViews.value = config.views.map(v => v.name)
    activeViewName.value = config.defaultView || config.views[0]?.name
  } catch {
    // fetchDashboardData will handle the error
  }
  await load()
  startRefresh()
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.surveillance-dashboard {
  padding: 1.5rem 2rem;
  max-width: 1400px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-picker {
  min-width: 160px;
}

.last-updated {
  @include body-small;
  color: var($secondary-text-on-surface);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.error-state {
  padding: 2rem;
  color: var($error);
  @include body-large;

  a {
    color: var($clickable-normal);
  }
}
</style>
```

**Note:** The container currently passes empty arrays for `cachedNodes/Alarms/Outages` to the detail panel. The service's `fetchDashboardData` bundles everything — in Task 4.1 below, wire the cache properly.

- [ ] **Step 2: Fix the cache wiring in the container**

The `fetchDashboardData` function doesn't expose raw nodes/alarms/outages — the detail panel needs them. Extend the `DashboardData` interface and `fetchDashboardData` to include raw arrays.

In `ui/src/services/surveillanceDashboardService.ts`, update `DashboardData`:

```typescript
export interface DashboardData {
  view: SurveillanceView
  grid: CellData[][]
  nodes: SurveillanceNode[]
  alarms: SurveillanceAlarm[]
  outages: SurveillanceOutage[]
}
```

Update `fetchDashboardData` return statement:

```typescript
  return {
    view,
    grid: computeGrid(view, nodes, alarms, outages),
    nodes,
    alarms,
    outages
  }
```

Update the `load()` function in `SurveillanceDashboard.vue` to populate the caches:

```typescript
const load = async () => {
  try {
    const result = await fetchDashboardData(activeViewName.value)
    data.value = result
    cachedNodes.value = result.nodes
    cachedAlarms.value = result.alarms
    cachedOutages.value = result.outages
    lastUpdated.value = new Date().toLocaleTimeString()
    error.value = null
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load surveillance data'
    noViews.value = e?.message?.includes('No surveillance views')
    showSnackBar({ msg: error.value ?? 'Error loading surveillance dashboard' })
  } finally {
    loading.value = false
  }
}
```

Also update the test in `ui/tests/surveillanceDashboard.test.ts` — add one check for the new fields. Append to the test file:

```typescript
describe('fetchDashboardData shape', () => {
  it('computeGrid produces correct grid dimensions', () => {
    const grid = computeGrid(view, [nodeRouterProd], [], [])
    expect(grid).toHaveLength(2)      // 2 rows
    expect(grid[0]).toHaveLength(2)   // 2 columns
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/surveillanceDashboard.test.ts 2>&1 | tail -20
```

Expected: All 7 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/SurveillanceDashboard.vue ui/src/services/surveillanceDashboardService.ts ui/tests/surveillanceDashboard.test.ts
git commit -m "feat(surveillance-dashboard): add container with refresh, view picker, cell detail wiring"
```

---

## Task 5: Router, redirects, and sidebar

**Files:**
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/components/Menu/SideMenu.vue`
- Modify: `opennms-webapp/src/main/webapp/dashboard.jsp`
- Modify: `opennms-webapp/src/main/webapp/surveillance-view.jsp`

- [ ] **Step 1: Add route to `router/index.ts`**

In `ui/src/main/router/index.ts`, add after the `/wallboard-config` route (around line 353):

```typescript
    {
      path: '/surveillance-dashboard',
      name: 'Surveillance Dashboard',
      component: () => import('@/containers/SurveillanceDashboard.vue')
    },
```

- [ ] **Step 2: Add entries to `legacyToVueRoutes` in `SideMenu.vue`**

In `ui/src/components/Menu/SideMenu.vue`, replace the comment block (around line 53):

```typescript
  // NOTE: dashboard.jsp is the Vaadin surveillance views display — no Vue
  // replacement exists yet. Do NOT add it here until one is built.
  'alarm/index.htm':                'ui/index.html#/alarms',
```

With:

```typescript
  'dashboard.jsp':                  'ui/index.html#/surveillance-dashboard',
  'surveillance-view.jsp':          'ui/index.html#/surveillance-dashboard',
  'alarm/index.htm':                'ui/index.html#/alarms',
```

- [ ] **Step 3: Replace `dashboard.jsp` with clean redirect**

Replace the entire contents of `opennms-webapp/src/main/webapp/dashboard.jsp` with:

```jsp
<%--

    Licensed to The OpenNMS Group, Inc (TOG) under one or more
    contributor license agreements.  See the LICENSE.md file
    distributed with this work for additional information
    regarding copyright ownership.

    TOG licenses this file to You under the GNU Affero General
    Public License Version 3 (the "License") or (at your option)
    any later version.  You may not use this file except in
    compliance with the License.  You may obtain a copy of the
    License at:

         https://www.gnu.org/licenses/agpl-3.0.txt

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
    either express or implied.  See the License for the specific
    language governing permissions and limitations under the
    License.

--%>
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-dashboard"); %>
```

- [ ] **Step 4: Replace `surveillance-view.jsp` with clean redirect**

Replace the entire contents of `opennms-webapp/src/main/webapp/surveillance-view.jsp` with:

```jsp
<%--

    Licensed to The OpenNMS Group, Inc (TOG) under one or more
    contributor license agreements.  See the LICENSE.md file
    distributed with this work for additional information
    regarding copyright ownership.

    TOG licenses this file to You under the GNU Affero General
    Public License Version 3 (the "License") or (at your option)
    any later version.  You may not use this file except in
    compliance with the License.  You may obtain a copy of the
    License at:

         https://www.gnu.org/licenses/agpl-3.0.txt

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
    either express or implied.  See the License for the specific
    language governing permissions and limitations under the
    License.

--%>
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-dashboard"); %>
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/main/router/index.ts ui/src/components/Menu/SideMenu.vue \
  opennms-webapp/src/main/webapp/dashboard.jsp \
  opennms-webapp/src/main/webapp/surveillance-view.jsp
git commit -m "feat(surveillance-dashboard): add route, legacyToVueRoutes, and JSP redirects"
```

---

## Task 6: Build, deploy, and verify

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run 2>&1 | tail -20
```

Expected: All tests PASS (no regressions).

- [ ] **Step 2: Build**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -6
```

Expected: `✓ built in X.XXs`

- [ ] **Step 3: Verify CSS — no bare `--feather-*` values**

```bash
grep -r '\-\-feather-' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | grep -v 'var(--feather' | head -5
```

Expected: no output (all CSS vars wrapped in `var()`)

- [ ] **Step 4: Deploy to container**

```bash
cd /Users/chance/git/opennms && ./ui/deploy-to-container.sh test-opennms 2>&1 | tail -3
```

Expected: `Done. Live bundle: assets/index-XXXXXXXX.js`

- [ ] **Step 5: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: Both lines show the same hash.

- [ ] **Step 6: Deploy JSPs to container**

```bash
podman cp /Users/chance/git/opennms/opennms-webapp/src/main/webapp/dashboard.jsp \
  test-opennms:/opt/opennms/jetty-webapps/opennms/dashboard.jsp
podman cp /Users/chance/git/opennms/opennms-webapp/src/main/webapp/surveillance-view.jsp \
  test-opennms:/opt/opennms/jetty-webapps/opennms/surveillance-view.jsp
```

- [ ] **Step 7: Clear JSP cache and restart**

```bash
podman exec test-opennms find /opt/opennms/data/tmp -name "dashboard_jsp.class" -o -name "surveillance_view_jsp.class" 2>/dev/null | xargs -r podman exec test-opennms rm -f
podman exec --privileged test-opennms /opt/opennms/bin/stop.pl 2>/dev/null
sleep 5
podman exec --privileged test-opennms /opt/opennms/bin/start.pl 2>/dev/null &
sleep 25
```

- [ ] **Step 8: Verify redirects**

```bash
curl -s -o /dev/null -w "dashboard.jsp: %{http_code} -> %{redirect_url}\n" \
  -u admin:notdefault http://localhost:8980/opennms/dashboard.jsp

curl -s -o /dev/null -w "surveillance-view.jsp: %{http_code} -> %{redirect_url}\n" \
  -u admin:notdefault http://localhost:8980/opennms/surveillance-view.jsp
```

Expected:
```
dashboard.jsp: 302 -> http://.../opennms/ui/index.html#/surveillance-dashboard
surveillance-view.jsp: 302 -> http://.../opennms/ui/index.html#/surveillance-dashboard
```

- [ ] **Step 9: Verify Vue SPA loads**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -u admin:notdefault \
  http://localhost:8980/opennms/ui/index.html
```

Expected: `200`

- [ ] **Step 10: Final commit**

```bash
git add -u  # catch any remaining unstaged changes
git status  # verify only expected files
git commit -m "feat(surveillance-dashboard): verified build and deploy"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** config fetch ✓, node/alarm/outage fetch ✓, client-side intersection ✓, severity colors ✓, auto-refresh ✓, view picker ✓, cell detail panel ✓, JSP redirects (both) ✓, legacyToVueRoutes ✓, router route ✓, error states ✓, loading state ✓
- [x] **No placeholders:** All code blocks are complete
- [x] **Type consistency:** `CellData`, `SurveillanceNode`, `SurveillanceAlarm`, `SurveillanceOutage`, `SurveillanceView`, `DashboardData` defined in Task 1 and referenced consistently across Tasks 2–4
- [x] **`DashboardData` extended in Task 4.2** to include `nodes`, `alarms`, `outages` — referenced correctly in container `load()`
- [x] **`fetchConfig` exported** from service — used in container `onMounted`
