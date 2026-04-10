<template>
  <div
    v-if="tooltip"
    class="node-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="node-tooltip__header">
      <span class="node-tooltip__label">{{ tooltip.label }}</span>
      <span v-if="tooltip.ip" class="node-tooltip__ip">{{ tooltip.ip }}</span>
    </div>

    <div v-if="loading" class="node-tooltip__loading">Loading…</div>

    <div v-else-if="bwQuery" class="node-tooltip__chart">
      <!--
        Bandwidth chart — in + out bits/sec for the node's primary SNMP interface.
        Uses a batch query: two transient DEF sources (ifHCInOctets, ifHCOutOctets
        as raw bytes/sec from the SNMP collector) plus CDEF expressions that multiply
        by 8 to produce rendered bps series.  Works regardless of TSS backend
        (RRDtool, Newts, Cortex, etc.) because the transformation is done by
        the OpenNMS measurements API JEXL evaluator, not the storage layer.
        Time range: last 2 hours — short enough for hover, long enough to see trends.
      -->
      <PersesPanel
        :title="'Bandwidth · last 2h'"
        :queries="[bwQuery]"
        :time-range="timeRange"
      />
    </div>

    <div v-else class="node-tooltip__no-data">No interface data available</div>
  </div>
</template>

<script setup lang="ts">
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSBatchQuerySpec } from '@/datasource/opennms/types'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import {
  fetchNodeSnmpIfaces,
  pickBestInterface,
  buildSnmpResourceId
} from '@/services/measurementsService'

/**
 * State passed from useTopology via TopologyGraph → TopologyNodeTooltip.
 * Matches the inline NodeTooltipState interface in useTopology.ts (they must stay in sync).
 */
export interface NodeTooltipState {
  x: number
  y: number
  label: string
  /** Numeric node ID as a string — passed directly from the Cytoscape node data(). */
  nodeId: string
  /** Primary IP from the vertex (ipAddress field on the topology graph vertex). */
  ip: string | null
}

const props = defineProps<{ tooltip: NodeTooltipState | null }>()

// ── Primary SNMP interface lookup ─────────────────────────────────────────────
//
// We need the primary SNMP interface to build the measurements resource ID.
// Resource ID format: node[{numericId}].interfaceSnmp[{ifName}-{physAddr}]
// Built by buildSnmpResourceId() in measurementsService.ts.
//
// pickBestInterface() picks the highest-speed, operationally-up, non-loopback
// interface from the node's SNMP interface list — the same heuristic the
// weathermap uses when choosing which interface to poll for edge utilization.
const loading = ref(false)
const snmpResourceId = ref<string | null>(null)

watch(
  () => props.tooltip?.nodeId,
  async (nodeId) => {
    snmpResourceId.value = null
    if (!nodeId) { loading.value = false; return }

    loading.value = true
    const requestedId = nodeId  // capture for stale-response guard

    const ifaces = await fetchNodeSnmpIfaces(Number(nodeId))

    // Guard: if the tooltip moved to a different node while we were fetching, discard.
    if (props.tooltip?.nodeId !== requestedId) return

    const best = pickBestInterface(ifaces)
    snmpResourceId.value = best ? buildSnmpResourceId(Number(nodeId), best) : null
    loading.value = false
  },
  { immediate: true }
)

// ── Bandwidth batch query ─────────────────────────────────────────────────────
//
// Two DEF sources (transient — not rendered directly) for the raw byte-counter
// rates, plus two CDEF expressions that multiply by 8 to get bits/sec.
//
// Why batch + CDEF instead of two simple queries?  The OpenNMS measurements API
// evaluates CDEF JEXL expressions server-side and they MUST reference DEF variable
// names from the same request body.  Two separate PersesPanel queries would each
// be independent HTTP calls and couldn't share variable labels.
//
// Note: ifHCInOctets / ifHCOutOctets are the SNMP OIDs for high-capacity octets.
// OpenNMS stores them as rates (bytes/sec already derived from the counter diff).
// The * 8 converts bytes/sec → bits/sec regardless of which TSS backend is in use.
const bwQuery = computed<OpenNMSBatchQuerySpec | null>(() => {
  if (!snmpResourceId.value) return null
  const rid = snmpResourceId.value
  return {
    batch: true,
    sources: [
      {
        resourceId: rid,
        attribute: 'ifHCInOctets',
        aggregation: 'AVERAGE',
        label: 'inOctets',
        transient: true   // fetch but don't render — used only in CDEF below
      },
      {
        resourceId: rid,
        attribute: 'ifHCOutOctets',
        aggregation: 'AVERAGE',
        label: 'outOctets',
        transient: true
      }
    ],
    expressions: [
      { value: 'inOctets * 8',  label: 'In (bps)'  },
      { value: 'outOctets * 8', label: 'Out (bps)' }
    ]
  }
})

// timeRange is computed (not ref) so it captures "now" each time the tooltip appears.
const timeRange = computed<AbsoluteTimeRange>(() => ({
  start: new Date(Date.now() - 2 * 60 * 60 * 1000),
  end: new Date()
}))
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.node-tooltip {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  padding: 10px 12px 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 320px;
  transform: translate(16px, -50%);

  &__header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__ip {
    font-size: 0.75rem;
    font-family: monospace;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__chart {
    width: 296px;
    height: 160px;
  }

  &__loading,
  &__no-data {
    font-size: 0.78rem;
    color: var($secondary-text-on-surface);
    padding: 4px 0;
  }
}
</style>
