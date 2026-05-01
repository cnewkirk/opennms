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

<template>
  <div class="svc-uptime-row">
    <div class="svc-uptime-row__header caption">
      <span class="svc-uptime-row__name">{{ serviceName }}</span>
      <span class="svc-uptime-row__sep">·</span>
      <span class="svc-uptime-row__ip">{{ ip }}</span>
      <span class="svc-uptime-row__sep">·</span>
      <span
        class="svc-uptime-row__pct"
        :class="availClass"
      >{{ formatPct(availability) }}%</span>
    </div>

    <div v-if="loading" class="svc-uptime-row__skeleton caption">Loading…</div>

    <template v-else-if="resourceExists">
      <div class="svc-uptime-row__chart">
        <PersesPanel
          :title="`${serviceName} response time`"
          :queries="[query]"
          :time-range="timeRange"
        />
      </div>
      <div class="svc-uptime-row__bar" title="Red = confirmed outage period">
        <div
          v-for="(seg, i) in outageSegments"
          :key="i"
          class="svc-uptime-row__outage"
          :style="{ left: `${seg.startPct}%`, width: `${seg.widthPct}%` }"
        />
      </div>
    </template>

    <div v-else class="svc-uptime-row__no-data caption">
      No response-time data
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Outage } from '@/types'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import useServiceUptimeData from '@/composables/useServiceUptimeData'

const props = defineProps<{
  nodeId: string
  ip: string
  serviceName: string
  availability: number
  outages: Outage[]
  windowStart: number
  windowEnd: number
}>()

const { query, timeRange, outageSegments, resourceExists, loading } =
  useServiceUptimeData(props.nodeId, props.ip, props.serviceName, props.outages, props.windowStart, props.windowEnd)

const formatPct = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

const availClass = computed(() => {
  if (props.availability >= 99) return 'svc-uptime-row__pct--normal'
  if (props.availability >= 95) return 'svc-uptime-row__pct--warning'
  return 'svc-uptime-row__pct--critical'
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/tokens" as fvars;
@use "@/styles/utils";
@import "@/styles/tokens";

.svc-uptime-row {
  margin-bottom: 16px;

  &:last-child { margin-bottom: 0; }

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var($secondary-text-on-surface);
    margin-bottom: 4px;
  }

  &__sep { opacity: 0.4; }

  &__pct {
    font-weight: 600;
    &--normal   { color: fvars.$success; }
    &--warning  { color: fvars.$warning; }
    &--critical { color: fvars.$error; }
  }

  &__skeleton, &__no-data {
    color: var($secondary-text-on-surface);
    padding: 8px 0;
  }

  &__chart {
    width: 100%;
    height: 100px;
  }

  &__bar {
    position: relative;
    width: 100%;
    height: 12px;
    background: transparent;
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;
  }

  &__outage {
    position: absolute;
    height: 100%;
    background: fvars.$error;
    opacity: 0.75;
    border-radius: 2px;
  }
}
</style>
