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
    <div v-if="tooltip.util" class="edge-tooltip__util">
      <span
        class="edge-tooltip__util-badge"
        :style="{ backgroundColor: utilizationColor(tooltip.util.utilPct) }"
      >{{ Math.round(tooltip.util.utilPct) }}%</span>
      <span class="edge-tooltip__util-rates">
        ↑ {{ formatBitsPerSec(tooltip.util.inBps) }}bps &nbsp; ↓ {{ formatBitsPerSec(tooltip.util.outBps) }}bps
      </span>
    </div>
    <div
      v-if="tooltip.labelData && (tooltip.labelData.localIfName || tooltip.labelData.remotePortId || tooltip.labelData.localIp || tooltip.labelData.remoteIp || tooltip.labelData.localMac || tooltip.labelData.ifSpeed)"
      class="edge-tooltip__label-data"
    >
      <div
        v-if="tooltip.labelData.localIfName || tooltip.labelData.remotePortId"
        class="edge-tooltip__field"
      >
        <span class="edge-tooltip__field-name">Port</span>
        <span>{{ tooltip.labelData.localIfName && tooltip.labelData.remotePortId
          ? `${tooltip.labelData.localIfName} ↔ ${tooltip.labelData.remotePortId}`
          : (tooltip.labelData.localIfName ?? tooltip.labelData.remotePortId) }}</span>
      </div>
      <div
        v-if="tooltip.labelData.localIp || tooltip.labelData.remoteIp"
        class="edge-tooltip__field"
      >
        <span class="edge-tooltip__field-name">IP</span>
        <span>{{ [tooltip.labelData.localIp, tooltip.labelData.remoteIp].filter(Boolean).join(' ↔ ') }}</span>
      </div>
      <div v-if="tooltip.labelData.localMac" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">MAC</span>
        <span>{{ tooltip.labelData.localMac }}</span>
      </div>
      <div v-if="tooltip.labelData.ifSpeed != null && tooltip.labelData.ifSpeed > 0" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">Speed</span>
        <span>{{ formatBitsPerSec(tooltip.labelData.ifSpeed) }}bps</span>
      </div>
    </div>

    <!--
      Bandwidth time-series chart — shows in + out bits/sec for the local interface
      of this link over the last 2 hours.  Only rendered when we can build a
      measurements resource ID from srcNodeId + labelData.localIfName + localMac.

      Batch query: two transient DEF sources (ifHCInOctets/OutOctets, stored as
      bytes/sec rates) + two CDEF expressions (* 8 → bits/sec).  Backend-agnostic:
      the CDEF multiplication is evaluated by the OpenNMS measurements API, not
      the TSS storage layer.
    -->
    <div v-if="bwQuery" class="edge-tooltip__chart">
      <PersesPanel
        title="Bandwidth · last 2h"
        :queries="[bwQuery]"
        :time-range="timeRange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSBatchQuerySpec } from '@/datasource/opennms/types'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { EdgeLabelData } from '@/stores/weathermapStore'
import { getProtocolColor, prettifyProtocol, utilizationColor, formatBitsPerSec } from './protocolColors'

export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  /** Numeric OpenNMS node ID of the source vertex — used to build measurements resource ID. */
  srcNodeId: string | null
  util?: { utilPct: number; inBps: number; outBps: number } | null
  labelData?: EdgeLabelData | null
}

const props = defineProps<{ tooltip: EdgeTooltipState | null }>()

// Build the SNMP interface resource ID for the local (source) side of this link.
// Format: node[{srcNodeId}].interfaceSnmp[{ifName}-{physAddr}]
// physAddr (MAC) may be empty for some interfaces; measurements API still works.
const localResourceId = computed<string | null>(() => {
  const t = props.tooltip
  if (!t?.srcNodeId || !t.labelData?.localIfName) return null
  const mac = t.labelData.localMac ?? ''
  return `node[${t.srcNodeId}].interfaceSnmp[${t.labelData.localIfName}-${mac}]`
})

const bwQuery = computed<OpenNMSBatchQuerySpec | null>(() => {
  const rid = localResourceId.value
  if (!rid) return null
  return {
    batch: true,
    sources: [
      { resourceId: rid, attribute: 'ifHCInOctets',  aggregation: 'AVERAGE', label: 'inOctets',  transient: true },
      { resourceId: rid, attribute: 'ifHCOutOctets', aggregation: 'AVERAGE', label: 'outOctets', transient: true }
    ],
    expressions: [
      { value: 'inOctets * 8',  label: 'In (bps)'  },
      { value: 'outOctets * 8', label: 'Out (bps)' }
    ]
  }
})

// Captured at render time; refreshes each time the tooltip appears on a new edge.
const timeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date(Date.now() - 2 * 60 * 60 * 1000),
  end: new Date()
}))
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
  padding: 10px 12px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  width: 340px;
  transform: translate(12px, -50%);
  overflow: hidden;

  &__endpoints {
    font-size: 0.75rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  &__chart {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var($border-on-surface);
    // Explicit block size — the PersesPanel fills 100% of this, so the
    // React tree renders exactly at this height. overflow:hidden is a
    // safety clip in case any React child escapes.
    height: 180px;
    overflow: hidden;
    // Negative side margins let the chart bleed to the tooltip edge for
    // a more integrated, full-bleed appearance
    margin-left: -12px;
    margin-right: -12px;
    padding-left: 4px;
    padding-right: 4px;
  }
}
</style>
