<template>
  <FeatherDrawer
    v-model="isVisible"
    :labels="{ close: 'Close', title: panelTitle }"
    width="380px"
  >
    <div class="detail-panel">

      <!-- ═══ NODE DETAIL ═══ -->
      <template v-if="vertex">
        <div class="detail-panel__row">
          <span class="detail-panel__key">Label</span>
          <span class="detail-panel__val">{{ vertex.label }}</span>
        </div>
        <div v-if="vertex.ipAddress" class="detail-panel__row">
          <span class="detail-panel__key">IP Address</span>
          <span class="detail-panel__val">{{ vertex.ipAddress }}</span>
        </div>
        <div v-if="vertex.id" class="detail-panel__row">
          <span class="detail-panel__key">Node ID</span>
          <span class="detail-panel__val">{{ vertex.id }}</span>
        </div>
        <div v-if="vertex.namespace" class="detail-panel__row">
          <span class="detail-panel__key">Namespace</span>
          <span class="detail-panel__val">{{ vertex.namespace }}</span>
        </div>
        <div v-if="vertex.tooltipText" class="detail-panel__row">
          <span class="detail-panel__key">Info</span>
          <span class="detail-panel__val detail-panel__val--html" v-html="vertex.tooltipText" />
        </div>

        <template v-if="nodeAlarms.length">
          <div class="detail-panel__section-header">Active Alarms</div>
          <div v-for="alarm in nodeAlarms" :key="alarm.id" class="detail-panel__alarm">
            <span :class="['detail-panel__badge', alarm.severity.toLowerCase()]">{{ alarm.severity }}</span>
            <span class="detail-panel__alarm-msg">{{ alarm.logMessage }}</span>
          </div>
        </template>
        <div v-else-if="severityBadge" class="detail-panel__row">
          <span class="detail-panel__key">Alarm Severity</span>
          <span :class="['detail-panel__badge', severityBadge.toLowerCase()]">{{ severityBadge }}</span>
        </div>

        <div class="detail-panel__actions">
          <FeatherButton text @click="goToNodeDetail">View Node Detail</FeatherButton>
        </div>
      </template>

      <!-- ═══ EDGE DETAIL ═══ -->
      <template v-else-if="edge">
        <!-- Endpoints row -->
        <div class="detail-panel__endpoints">
          <span class="detail-panel__endpoint">{{ sourceLabel }}</span>
          <span class="detail-panel__endpoint-sep">↔</span>
          <span class="detail-panel__endpoint">{{ targetLabel }}</span>
        </div>

        <!-- IPs if known -->
        <div v-if="sourceIp || targetIp" class="detail-panel__endpoints detail-panel__endpoints--sub">
          <span class="detail-panel__endpoint-ip">{{ sourceIp }}</span>
          <span class="detail-panel__endpoint-sep"></span>
          <span class="detail-panel__endpoint-ip">{{ targetIp }}</span>
        </div>

        <!-- Protocol chips -->
        <div v-if="edgeProtocols.length" class="detail-panel__chips">
          <span v-for="p in edgeProtocols" :key="p" class="detail-panel__chip">{{ p }}</span>
        </div>

        <!-- Loading state -->
        <div v-if="detailLoading" class="detail-panel__loading">
          <FeatherSpinner />
          <span>Loading link detail…</span>
        </div>

        <template v-else-if="edgeDetail">
          <!-- LLDP section -->
          <template v-if="lldpLinks.length">
            <div class="detail-panel__proto-header">LLDP</div>
            <div v-for="(pair, i) in lldpLinks" :key="i" class="detail-panel__proto-block">
              <div class="detail-panel__link-row">
                <span class="detail-panel__link-node">{{ pair.srcName }}</span>
                <span class="detail-panel__link-iface">{{ pair.srcPort }}</span>
                <span class="detail-panel__link-arrow">→</span>
                <span class="detail-panel__link-node">{{ pair.tgtName }}</span>
                <span class="detail-panel__link-iface">{{ pair.tgtPort }}</span>
              </div>
              <div v-if="pair.srcMac || pair.tgtMac" class="detail-panel__link-macs">
                <span v-if="pair.srcMac">{{ pair.srcMac }}</span>
                <span v-if="pair.srcMac && pair.tgtMac"> → </span>
                <span v-if="pair.tgtMac">{{ pair.tgtMac }}</span>
              </div>
            </div>
          </template>

          <!-- OSPF section -->
          <template v-if="ospfLinks.length">
            <div class="detail-panel__proto-header">OSPF</div>
            <div v-if="ospfRouterIds" class="detail-panel__kv">
              <span class="detail-panel__kv-key">Router IDs</span>
              <span class="detail-panel__kv-val">{{ ospfRouterIds }}</span>
            </div>
            <div v-for="(link, i) in ospfLinks" :key="i" class="detail-panel__proto-block">
              <div class="detail-panel__link-row">
                <span class="detail-panel__link-node">{{ link.srcName }}</span>
                <span v-if="link.localIp" class="detail-panel__link-iface">{{ link.localIp }}</span>
                <span class="detail-panel__link-arrow">↔</span>
                <span class="detail-panel__link-node">{{ link.tgtName }}</span>
                <span v-if="link.remoteIp" class="detail-panel__link-iface">{{ link.remoteIp }}</span>
              </div>
              <div v-if="link.mask" class="detail-panel__link-macs">subnet: {{ link.mask }}</div>
            </div>
          </template>

          <!-- IS-IS section -->
          <template v-if="isisLinks.length">
            <div class="detail-panel__proto-header">IS-IS</div>
            <div v-if="isisSysIds" class="detail-panel__kv">
              <span class="detail-panel__kv-key">SysIDs</span>
              <span class="detail-panel__kv-val">{{ isisSysIds }}</span>
            </div>
            <div v-for="(link, i) in isisLinks" :key="i" class="detail-panel__proto-block">
              <div class="detail-panel__link-row">
                <span class="detail-panel__link-node">{{ link.srcName }}</span>
                <span v-if="link.localCirc" class="detail-panel__link-iface">circ {{ link.localCirc }}</span>
                <span class="detail-panel__link-arrow">↔</span>
                <span class="detail-panel__link-node">{{ link.tgtName }}</span>
                <span v-if="link.remotePort" class="detail-panel__link-iface">{{ link.remotePort }}</span>
              </div>
              <div class="detail-panel__link-macs">
                state: {{ link.adjState }}
                <span v-if="link.adjType"> · {{ link.adjType }}</span>
              </div>
            </div>
          </template>

          <div v-if="!lldpLinks.length && !ospfLinks.length && !isisLinks.length"
               class="detail-panel__empty">
            No L2/L3 detail available for this link.
          </div>
        </template>
      </template>
    </div>
  </FeatherDrawer>
</template>

<script setup lang="ts">
import { FeatherDrawer } from '@featherds/drawer'
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import { useTopologyStore } from '@/stores/topologyStore'
import { isVertex } from '@/types/topology'
import { extractNodeId } from '@/services/enlinkdService'

const store = useTopologyStore()
const router = useRouter()

const isVisible = computed({
  get: () => store.selectedElement !== null,
  set: (val) => { if (!val) store.selectElement(null) }
})

const vertex = computed(() => {
  const el = store.selectedElement
  return el && isVertex(el) ? el : null
})

const edge = computed(() => {
  const el = store.selectedElement
  return el && !isVertex(el) ? el : null
})

const panelTitle = computed(() => {
  if (vertex.value) return vertex.value.label ?? 'Node Detail'
  if (edge.value) return 'Link Detail'
  return ''
})

// ── Node detail ──────────────────────────────────────────────────────────────

const severityBadge = computed(() => {
  if (!vertex.value?.id) return null
  return store.alarmSeverity[parseInt(vertex.value.id, 10)] ?? null
})

const nodeId = computed(() => {
  if (!vertex.value?.id) return null
  const id = parseInt(vertex.value.id, 10)
  return isNaN(id) ? null : id
})

const nodeAlarms = computed(() => {
  if (!nodeId.value) return []
  return store.nodeAlarmDetails[nodeId.value] ?? []
})

watch(nodeId, (id) => {
  if (id !== null && store.alarmSeverity[id]) store.loadNodeAlarmDetails(id)
}, { immediate: true })

const goToNodeDetail = () => {
  if (vertex.value?.id) router.push(`/node/${vertex.value.id}`)
}

// ── Edge detail ───────────────────────────────────────────────────────────────

const edgeKey = computed(() => {
  if (!edge.value) return ''
  const s = edge.value.source.id; const t = edge.value.target.id
  return `${Math.min(s, t)}-${Math.max(s, t)}`
})

const detailLoading = ref(false)

watch(edge, async (e) => {
  if (!e) return
  const s = e.source.id; const t = e.target.id
  const key = `${Math.min(s, t)}-${Math.max(s, t)}`
  if (!store.edgeLinkDetails[key]) {
    detailLoading.value = true
    await store.loadEdgeLinkDetail(key, s, t)
    detailLoading.value = false
  }
}, { immediate: true })

const edgeDetail = computed(() => {
  if (!edgeKey.value) return null
  return store.edgeLinkDetails[edgeKey.value] ?? null
})

const edgeProtocols = computed(() => edge.value?.protocols ?? [])

const sourceLabel = computed(() => {
  if (!edge.value) return ''
  const v = store.vertices.find(v => v.id === String(edge.value!.source.id))
  return v?.label ?? String(edge.value.source.id)
})

const targetLabel = computed(() => {
  if (!edge.value) return ''
  const v = store.vertices.find(v => v.id === String(edge.value!.target.id))
  return v?.label ?? String(edge.value.target.id)
})

const sourceIp = computed(() => {
  if (!edge.value) return ''
  return store.vertices.find(v => v.id === String(edge.value!.source.id))?.ipAddress ?? ''
})

const targetIp = computed(() => {
  if (!edge.value) return ''
  return store.vertices.find(v => v.id === String(edge.value!.target.id))?.ipAddress ?? ''
})

// ── String parsers for enlinkd API format ─────────────────────────────────────
// Values like "eth1(ifindex:3)(macAddress:ee476eb73421)" → "eth1"
const ifaceName = (s: string) => s.split('(')[0].trim()
// "(macAddress:b65c76867284)" or "leaf-01(macAddress:...)" → "b65c:7686:7284" styled
const macFromStr = (s: string) => {
  const m = s.match(/macAddress:([a-f0-9]{12})/i)
  if (!m) return ''
  const h = m[1]
  return `${h.slice(0,4)}:${h.slice(4,8)}:${h.slice(8)}`
}
// "eth1()(ifindex:3)(10.101.1.1)" → "10.101.1.1"
const ipFromOspfPort = (s: string) => {
  const parts = s.split('(')
  for (const p of parts) {
    const clean = p.replace(')', '').trim()
    if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) return clean
  }
  return ''
}
// "leaf-01(router id:10.255.0.21)" → { name: "leaf-01", id: "10.255.0.21" }
const parseRouter = (s: string) => ({
  name: s.split('(')[0].trim(),
  id: s.match(/router id:([^)]+)/)?.[1]?.trim() ?? ''
})
// "leaf-01(ISSysID:00010aff0015)" → { name: "leaf-01", sysId: "00010aff0015" }
const parseIsis = (s: string) => ({
  name: s.split('(')[0].trim(),
  sysId: s.match(/ISSysID:([^)]+)/)?.[1]?.trim() ?? ''
})
// "(mask:255.255.255.252)" → "255.255.255.252"
const parseMask = (s: string) => s.match(/mask:([^)]+)/)?.[1]?.trim() ?? ''
// "eth1()(ifindex:2)" → "eth1"
const isisFaceFromPort = (s: string) => s.split('(')[0].trim() || s

// ── LLDP computed ─────────────────────────────────────────────────────────────
const lldpLinks = computed(() => {
  if (!edgeDetail.value || !edge.value) return []
  const { src, tgt, srcNodeId, tgtNodeId } = edgeDetail.value
  const result: { srcName: string, srcPort: string, srcMac: string, tgtName: string, tgtPort: string, tgtMac: string }[] = []

  const addLinks = (data: typeof src, fromNodeId: number, toNodeId: number, fromName: string) => {
    if (!data) return
    for (const l of data.lldpLinkNodes) {
      if (extractNodeId(l.lldpRemChassisIdUrl) !== String(toNodeId)) continue
      result.push({
        srcName: fromName,
        srcPort: ifaceName(l.lldpLocalPort),
        srcMac: macFromStr(l.lldpLocalPort),
        tgtName: l.lldpRemInfo,
        tgtPort: ifaceName(l.ldpRemPort),
        tgtMac: macFromStr(l.ldpRemPort)
      })
    }
  }

  addLinks(src, srcNodeId, tgtNodeId, sourceLabel.value)
  addLinks(tgt, tgtNodeId, srcNodeId, targetLabel.value)
  return result
})

// ── OSPF computed ─────────────────────────────────────────────────────────────
const ospfRouterIds = computed(() => {
  if (!edgeDetail.value) return ''
  const srcId = edgeDetail.value.src?.ospfElementNode?.ospfRouterId ?? ''
  const tgtId = edgeDetail.value.tgt?.ospfElementNode?.ospfRouterId ?? ''
  if (!srcId && !tgtId) return ''
  return `${srcId} ↔ ${tgtId}`
})

const ospfLinks = computed(() => {
  if (!edgeDetail.value || !edge.value) return []
  const { src, tgt, srcNodeId, tgtNodeId } = edgeDetail.value
  const result: { srcName: string, localIp: string, tgtName: string, remoteIp: string, mask: string }[] = []

  const addLinks = (data: typeof src, toNodeId: number, fromName: string) => {
    if (!data) return
    for (const l of data.ospfLinkNodes) {
      if (extractNodeId(l.ospfRemRouterUrl) !== String(toNodeId)) continue
      const remR = parseRouter(l.ospfRemRouterId)
      result.push({
        srcName: fromName,
        localIp: l.ospfLocalPort ? ipFromOspfPort(l.ospfLocalPort) : '',
        tgtName: remR.name,
        remoteIp: ipFromOspfPort(l.ospfRemPort),
        mask: parseMask(l.ospfLinkInfo)
      })
    }
  }

  addLinks(src, tgtNodeId, sourceLabel.value)
  addLinks(tgt, srcNodeId, targetLabel.value)
  return result
})

// ── IS-IS computed ────────────────────────────────────────────────────────────
const isisSysIds = computed(() => {
  if (!edgeDetail.value) return ''
  const srcSysId = edgeDetail.value.src?.isisElementNode?.isisSysID ?? ''
  const tgtSysId = edgeDetail.value.tgt?.isisElementNode?.isisSysID ?? ''
  if (!srcSysId && !tgtSysId) return ''
  return `${srcSysId} ↔ ${tgtSysId}`
})

const isisLinks = computed(() => {
  if (!edgeDetail.value || !edge.value) return []
  const { src, tgt, srcNodeId, tgtNodeId } = edgeDetail.value
  const result: { srcName: string, localCirc: string, tgtName: string, remotePort: string, adjState: string, adjType: string }[] = []

  const addLinks = (data: typeof src, toNodeId: number, fromName: string) => {
    if (!data) return
    for (const l of data.isisLinkNodes) {
      if (extractNodeId(l.isisISAdjUrl) !== String(toNodeId)) continue
      const adj = parseIsis(l.isisISAdjNeighSysID)
      result.push({
        srcName: fromName,
        localCirc: String(l.isisCircIfIndex),
        tgtName: adj.name || String(toNodeId),
        remotePort: isisFaceFromPort(l.isisISAdjNeighPort),
        adjState: l.isisISAdjState,
        adjType: l.isisISAdjNeighSysType.replace('IntermediateSystem', '').replace('l1', 'L1').replace('l2', 'L2')
      })
    }
  }

  addLinks(src, tgtNodeId, sourceLabel.value)
  addLinks(tgt, srcNodeId, targetLabel.value)
  return result
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@/styles/severities";

.detail-panel {
  padding: 16px;
  overflow-y: auto;

  &__row {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
  }

  &__key {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    margin-bottom: 2px;
  }

  &__val {
    font-size: 0.9rem;
    word-break: break-all;

    &--html :deep(p) {
      margin: 0 0 4px;
      &:last-child { margin-bottom: 0; }
    }
  }

  &__badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: bold;
  }

  &__section-header {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    margin: 4px 0 8px;
  }

  &__alarm {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__alarm-msg {
    font-size: 0.82rem;
    line-height: 1.4;
    flex: 1;
  }

  &__actions {
    margin-top: 16px;
  }

  // Edge-specific styles

  &__endpoints {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    &--sub {
      margin-top: -4px;
      margin-bottom: 10px;
    }
  }

  &__endpoint {
    font-weight: 600;
    font-size: 0.95rem;
    flex: 1;
    word-break: break-all;
  }

  &__endpoint-ip {
    font-size: 0.8rem;
    color: var($secondary-text-on-surface);
    font-family: monospace;
    flex: 1;
  }

  &__endpoint-sep {
    font-size: 0.9rem;
    color: var($secondary-text-on-surface);
    flex-shrink: 0;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }

  &__chip {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.78rem;
    font-weight: 600;
    background-color: var($primary);
    color: #fff;
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    font-size: 0.85rem;
    color: var($secondary-text-on-surface);
  }

  &__proto-header {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var($primary);
    margin: 14px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var($border-on-surface);
  }

  &__proto-block {
    margin-bottom: 8px;
    padding-left: 4px;
  }

  &__link-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 0.82rem;
  }

  &__link-node {
    font-weight: 600;
  }

  &__link-iface {
    font-family: monospace;
    font-size: 0.78rem;
    color: var($secondary-text-on-surface);
    background: var($shade-2);
    padding: 0 4px;
    border-radius: 3px;
  }

  &__link-arrow {
    color: var($secondary-text-on-surface);
    flex-shrink: 0;
  }

  &__link-macs {
    font-size: 0.75rem;
    font-family: monospace;
    color: var($secondary-text-on-surface);
    margin-top: 2px;
    padding-left: 2px;
  }

  &__kv {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-bottom: 6px;
    font-size: 0.82rem;
  }

  &__kv-key {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
    flex-shrink: 0;
  }

  &__kv-val {
    font-family: monospace;
    font-size: 0.8rem;
  }

  &__empty {
    font-size: 0.85rem;
    color: var($secondary-text-on-surface);
    padding: 12px 0;
  }
}
</style>
