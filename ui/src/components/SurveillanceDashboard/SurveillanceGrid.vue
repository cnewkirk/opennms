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
              { 'cell-selected': selectedRow === ri && selectedCol === ci },
              { 'cell-dimmed': props.dimHealthy && grid[ri][ci].worstSeverity === 'NORMAL' && grid[ri][ci].downCount === 0 }
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
  dimHealthy?: boolean
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
@import "@/styles/tokens";
@import "@/styles/typography";

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
  .sev-normal   { background: var($success);  color: var($primary-text-on-color); }
  .sev-warning  { background: var($warning);  color: #1a1a2e; }
  .sev-minor    { background: var($minor);    color: var($primary-text-on-color); }
  .sev-major    { background: var($major);    color: var($primary-text-on-color); }
  .sev-critical { background: var($error);    color: var($primary-text-on-color); }

  .cell-dimmed {
    opacity: 0.35;
    pointer-events: none;
  }
}
</style>
