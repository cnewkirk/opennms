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
  <div
    v-if="tooltip"
    class="edge-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="edge-tooltip__endpoints">
      {{ tooltip.srcLabel }} ↔ {{ tooltip.tgtLabel }}
    </div>
    <div
      v-for="p in tooltip.protocols"
      :key="p"
      class="edge-tooltip__protocol"
    >
      <span
        class="edge-tooltip__chip"
        :style="{ backgroundColor: getProtocolColor(p) }"
      ></span>
      {{ prettifyProtocol(p) }}
    </div>
    <template v-if="tooltip.util">
      <div
        v-if="tooltip.util.src"
        class="edge-tooltip__util"
      >
        <span class="edge-tooltip__util-node">{{ tooltip.srcLabel }}</span>
        <span
          class="edge-tooltip__util-badge"
          :style="{ backgroundColor: utilizationColor(tooltip.util.src.utilPct) }"
        >{{ Math.round(tooltip.util.src.utilPct) }}%</span>
        <span class="edge-tooltip__util-rates">
          ↑ {{ formatBitsPerSec(tooltip.util.src.inBps) }}bps &nbsp; ↓ {{ formatBitsPerSec(tooltip.util.src.outBps) }}bps
        </span>
      </div>
      <div
        v-if="tooltip.util.tgt"
        class="edge-tooltip__util"
      >
        <span class="edge-tooltip__util-node">{{ tooltip.tgtLabel }}</span>
        <span
          class="edge-tooltip__util-badge"
          :style="{ backgroundColor: utilizationColor(tooltip.util.tgt.utilPct) }"
        >{{ Math.round(tooltip.util.tgt.utilPct) }}%</span>
        <span class="edge-tooltip__util-rates">
          ↑ {{ formatBitsPerSec(tooltip.util.tgt.inBps) }}bps &nbsp; ↓ {{ formatBitsPerSec(tooltip.util.tgt.outBps) }}bps
        </span>
      </div>
    </template>
    <div
      v-if="tooltip.labelData && (tooltip.labelData.localIfName || tooltip.labelData.remotePortId || tooltip.labelData.localIp || tooltip.labelData.remoteIp || tooltip.labelData.localMac || tooltip.labelData.ifSpeed)"
      class="edge-tooltip__label-data"
    >
      <div
        v-if="tooltip.labelData.localIfName || tooltip.labelData.remotePortId"
        class="edge-tooltip__field"
      >
        <span class="edge-tooltip__field-name">{{ humanize('localIfName') }}</span>
        <span>{{ tooltip.labelData.localIfName && tooltip.labelData.remotePortId
          ? `${tooltip.labelData.localIfName} ↔ ${tooltip.labelData.remotePortId}`
          : (tooltip.labelData.localIfName ?? tooltip.labelData.remotePortId) }}</span>
      </div>
      <div
        v-if="tooltip.labelData.localIp || tooltip.labelData.remoteIp"
        class="edge-tooltip__field"
      >
        <span class="edge-tooltip__field-name">{{ humanize('localIp') }}</span>
        <span>{{ [tooltip.labelData.localIp, tooltip.labelData.remoteIp].filter(Boolean).join(' ↔ ') }}</span>
      </div>
      <div v-if="tooltip.labelData.localMac || tooltip.labelData.remoteMac" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">{{ humanize('localMac') }}</span>
        <span>{{ [tooltip.labelData.localMac, tooltip.labelData.remoteMac].filter(Boolean).join(' ↔ ') }}</span>
      </div>
      <div v-if="resolvedSpeed > 0" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">{{ humanize('ifSpeed') }}</span>
        <span>{{ formatBitsPerSec(resolvedSpeed) }}bps</span>
      </div>
    </div>
    <TopologyEdgeGraphs
      v-if="tooltip.labelData"
      :labelData="tooltip.labelData"
      :srcLabel="tooltip.srcLabel"
      :tgtLabel="tooltip.tgtLabel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EdgeLabelData, EdgeUtil } from '@/stores/weathermapStore'
import { getProtocolColor, utilizationColor, formatBitsPerSec, prettifyProtocol } from './protocolColors'
import { humanize } from '@/components/Topology/fieldLabels'
import TopologyEdgeGraphs from './TopologyEdgeGraphs.vue'

export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  util?: EdgeUtil | null
  labelData?: EdgeLabelData | null
}

const props = defineProps<{ tooltip: EdgeTooltipState | null }>()

// Use source ifSpeed; fall back to target ifSpeed if source is absent
const resolvedSpeed = computed(() => {
  const ld = props.tooltip?.labelData
  if (!ld) return 0
  return (ld.ifSpeed ?? 0) > 0 ? ld.ifSpeed! : (ld.tgtIface?.ifSpeed ?? 0)
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.edge-tooltip {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  padding: 8px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  min-width: 160px;
  transform: translate(12px, -50%);

  &__endpoints {
    font-size: 0.75rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
  }

  &__protocol {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    padding: 2px 0;
  }

  &__chip {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: vars.$border-radius-round;
    flex-shrink: 0;
  }

  &__util {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var($border-on-surface);

    & + & {
      margin-top: 4px;
      padding-top: 4px;
      border-top: none;
    }
  }

  &__util-node {
    font-size: 0.68rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    min-width: 52px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__util-badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: vars.$border-radius-xs;
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
  }

  &__util-rates {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
  }

  &__label-data {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var($border-on-surface);
  }

  &__field {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.72rem;
    padding: 1px 0;
    color: var($secondary-text-on-surface);

    &-name {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var($primary-text-on-surface);
      min-width: 40px;
      flex-shrink: 0;
    }
  }
}
</style>
