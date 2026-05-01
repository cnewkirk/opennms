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
import { computed } from 'vue'
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
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@/styles/typography";

.cell-detail {
  margin-top: 1.5rem;
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-surface;
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
  border-radius: vars.$border-radius-surface;
  background: var($surface);

  &--down     { background: rgba(198,40,40,0.08); }
  &--critical { background: rgba(106,27,154,0.08); }
  &--major    { background: rgba(198,40,40,0.08); }
  &--minor    { background: rgba(239,108,0,0.08); }
  &--warning  { background: rgba(249,168,37,0.08); }
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

  &.down     { background: var($major);    color: var($primary-text-on-color); }
  &.critical { background: var($error);    color: var($primary-text-on-color); }
  &.major    { background: var($major);    color: var($primary-text-on-color); }
  &.minor    { background: var($minor);    color: var($primary-text-on-color); }
  &.warning  { background: var($warning);  color: #1a1a2e; }
  &.normal   { background: var($success);  color: var($primary-text-on-color); }
}
</style>
