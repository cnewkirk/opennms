<template>
  <Transition name="topo-panel">
    <div v-if="isVisible" class="topo-panel">
      <div class="topo-panel__header">
        <span class="topo-panel__title">{{ panelTitle }}</span>
        <button type="button" class="topo-panel__close" @click="store.selectElement(null)">✕</button>
      </div>

      <div class="topo-panel__body">

        <!-- ═══ NODE DETAIL ═══ -->
        <template v-if="vertex">

          <!-- Loading shimmer -->
          <div v-if="nodeDetailLoading" class="topo-panel__loading">
            <FeatherSpinner />
            <span>Loading node detail…</span>
          </div>

          <template v-else>
            <!-- Alarms -->
            <template v-if="nodeAlarms.length">
              <div class="topo-panel__section">Alarms</div>
              <div v-for="alarm in nodeAlarms" :key="alarm.id" class="topo-panel__alarm">
                <span :class="['topo-panel__badge', alarm.severity.toLowerCase()]">{{ alarm.severity }}</span>
                <span class="topo-panel__alarm-msg">{{ alarm.logMessage }}</span>
              </div>
            </template>
            <div v-else-if="severityBadge" class="topo-panel__row">
              <span class="topo-panel__key">Alarm Severity</span>
              <span :class="['topo-panel__badge', severityBadge.toLowerCase()]">{{ severityBadge }}</span>
            </div>

            <!-- System info -->
            <div class="topo-panel__section">System</div>
            <div class="topo-panel__row">
              <span class="topo-panel__key">Node ID</span>
              <span class="topo-panel__val">{{ vertex.id }}</span>
            </div>
            <div v-if="nodeDetail?.node.sysName" class="topo-panel__row">
              <span class="topo-panel__key">SNMP Name</span>
              <span class="topo-panel__val">{{ nodeDetail.node.sysName }}</span>
            </div>
            <div v-if="nodeDetail?.node.sysDescription" class="topo-panel__row">
              <span class="topo-panel__key">Description</span>
              <span class="topo-panel__val topo-panel__val--truncate" :title="nodeDetail.node.sysDescription">
                {{ truncate(nodeDetail.node.sysDescription, 80) }}
              </span>
            </div>
            <div v-if="nodeDetail?.node.sysLocation" class="topo-panel__row">
              <span class="topo-panel__key">Location</span>
              <span class="topo-panel__val">{{ stripQuotes(nodeDetail.node.sysLocation) }}</span>
            </div>
            <div v-if="nodeDetail?.node.sysContact" class="topo-panel__row">
              <span class="topo-panel__key">Contact</span>
              <span class="topo-panel__val">{{ stripQuotes(nodeDetail.node.sysContact) }}</span>
            </div>
            <div v-if="nodeDetail?.node.foreignSource" class="topo-panel__row">
              <span class="topo-panel__key">Provisioned</span>
              <span class="topo-panel__val">{{ nodeDetail.node.foreignSource }} / {{ nodeDetail.node.foreignId }}</span>
            </div>
            <div v-if="nodeDetail?.node.categories?.length" class="topo-panel__row">
              <span class="topo-panel__key">Categories</span>
              <div class="topo-panel__chips">
                <span v-for="cat in nodeDetail.node.categories" :key="cat.name" class="topo-panel__cat-chip">
                  {{ cat.name }}
                </span>
              </div>
            </div>

            <!-- IP Interfaces -->
            <template v-if="nodeDetail?.ipInterfaces.length">
              <div class="topo-panel__section">Interfaces</div>
              <div
                v-for="iface in sortedInterfaces"
                :key="iface.id"
                class="topo-panel__iface"
                :class="{ 'topo-panel__iface--primary': iface.snmpPrimary === 'P' }"
              >
                <span class="topo-panel__iface-name">{{ iface.snmpInterface?.ifName || iface.snmpInterface?.ifDescr || '—' }}</span>
                <span class="topo-panel__iface-ip">{{ iface.ipAddress }}</span>
                <span v-if="iface.snmpPrimary === 'P'" class="topo-panel__iface-badge">primary</span>
                <span v-if="iface.isDown" class="topo-panel__iface-badge topo-panel__iface-badge--down">down</span>
              </div>
            </template>

            <!-- Protocol IDs from EnLinkd -->
            <template v-if="nodeDetail?.enlinkd">
              <div class="topo-panel__section">Protocol IDs</div>
              <div v-if="nodeDetail.enlinkd.lldpElementNode" class="topo-panel__row">
                <span class="topo-panel__key">LLDP</span>
                <span class="topo-panel__val topo-panel__val--mono">
                  {{ formatMacFromElem(nodeDetail.enlinkd.lldpElementNode.lldpChassisId) }}
                  <span class="topo-panel__val--dim"> · {{ nodeDetail.enlinkd.lldpElementNode.lldpSysName }}</span>
                </span>
              </div>
              <div v-if="nodeDetail.enlinkd.ospfElementNode" class="topo-panel__row">
                <span class="topo-panel__key">OSPF</span>
                <span class="topo-panel__val topo-panel__val--mono">
                  {{ nodeDetail.enlinkd.ospfElementNode.ospfRouterId }}
                  <span class="topo-panel__val--dim"> · v{{ nodeDetail.enlinkd.ospfElementNode.ospfVersionNumber }}, {{ nodeDetail.enlinkd.ospfElementNode.ospfAdminStat }}</span>
                </span>
              </div>
              <div v-if="nodeDetail.enlinkd.isisElementNode" class="topo-panel__row">
                <span class="topo-panel__key">IS-IS</span>
                <span class="topo-panel__val topo-panel__val--mono">
                  {{ nodeDetail.enlinkd.isisElementNode.isisSysID }}
                  <span class="topo-panel__val--dim"> · {{ nodeDetail.enlinkd.isisElementNode.isisSysAdminState }}</span>
                </span>
              </div>
            </template>
          </template>

          <div class="topo-panel__actions">
            <FeatherButton text @click="goToNodeDetail">View Full Node Detail</FeatherButton>
          </div>
        </template>

        <!-- ═══ EDGE DETAIL ═══ -->
        <template v-else-if="edge">
          <div class="topo-panel__endpoints">
            <span class="topo-panel__endpoint">{{ sourceLabel }}</span>
            <span class="topo-panel__endpoint-sep">↔</span>
            <span class="topo-panel__endpoint">{{ targetLabel }}</span>
          </div>
          <div v-if="sourceIp || targetIp" class="topo-panel__endpoints topo-panel__endpoints--sub">
            <span class="topo-panel__endpoint-ip">{{ sourceIp }}</span>
            <span class="topo-panel__endpoint-sep"></span>
            <span class="topo-panel__endpoint-ip">{{ targetIp }}</span>
          </div>
          <div v-if="edgeProtocols.length" class="topo-panel__chips">
            <span v-for="p in edgeProtocols" :key="p" class="topo-panel__chip">{{ p }}</span>
          </div>

          <div v-if="detailLoading" class="topo-panel__loading">
            <FeatherSpinner />
            <span>Loading link detail…</span>
          </div>

          <template v-else-if="edgeDetail">
            <template v-if="lldpLinks.length">
              <div class="topo-panel__section">LLDP</div>
              <div v-for="(pair, i) in lldpLinks" :key="i" class="topo-panel__proto-block">
                <div class="topo-panel__link-row">
                  <span class="topo-panel__link-node">{{ pair.srcName }}</span>
                  <span class="topo-panel__link-iface">{{ pair.srcPort }}</span>
                  <span class="topo-panel__link-arrow">→</span>
                  <span class="topo-panel__link-node">{{ pair.tgtName }}</span>
                  <span class="topo-panel__link-iface">{{ pair.tgtPort }}</span>
                </div>
                <div v-if="pair.srcMac || pair.tgtMac" class="topo-panel__link-sub">
                  {{ pair.srcMac }}<span v-if="pair.srcMac && pair.tgtMac"> → </span>{{ pair.tgtMac }}
                </div>
              </div>
            </template>

            <template v-if="ospfLinks.length">
              <div class="topo-panel__section">OSPF</div>
              <div v-if="ospfRouterIds" class="topo-panel__kv">
                <span class="topo-panel__kv-key">Router IDs</span>
                <span class="topo-panel__kv-val">{{ ospfRouterIds }}</span>
              </div>
              <div v-for="(link, i) in ospfLinks" :key="i" class="topo-panel__proto-block">
                <div class="topo-panel__link-row">
                  <span class="topo-panel__link-node">{{ link.srcName }}</span>
                  <span v-if="link.localIp" class="topo-panel__link-iface">{{ link.localIp }}</span>
                  <span class="topo-panel__link-arrow">↔</span>
                  <span class="topo-panel__link-node">{{ link.tgtName }}</span>
                  <span v-if="link.remoteIp" class="topo-panel__link-iface">{{ link.remoteIp }}</span>
                </div>
                <div v-if="link.mask" class="topo-panel__link-sub">subnet: {{ link.mask }}</div>
              </div>
            </template>

            <template v-if="isisLinks.length">
              <div class="topo-panel__section">IS-IS</div>
              <div v-if="isisSysIds" class="topo-panel__kv">
                <span class="topo-panel__kv-key">SysIDs</span>
                <span class="topo-panel__kv-val">{{ isisSysIds }}</span>
              </div>
              <div v-for="(link, i) in isisLinks" :key="i" class="topo-panel__proto-block">
                <div class="topo-panel__link-row">
                  <span class="topo-panel__link-node">{{ link.srcName }}</span>
                  <span v-if="link.localCirc" class="topo-panel__link-iface">circ {{ link.localCirc }}</span>
                  <span class="topo-panel__link-arrow">↔</span>
                  <span class="topo-panel__link-node">{{ link.tgtName }}</span>
                  <span v-if="link.remotePort" class="topo-panel__link-iface">{{ link.remotePort }}</span>
                </div>
                <div class="topo-panel__link-sub">
                  state: {{ link.adjState }}<span v-if="link.adjType"> · {{ link.adjType }}</span>
                </div>
              </div>
            </template>

            <div v-if="!lldpLinks.length && !ospfLinks.length && !isisLinks.length" class="topo-panel__empty">
              No L2/L3 detail available for this link.
            </div>
          </template>
        </template>

      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import { useTopologyStore } from '@/stores/topologyStore'
import { isVertex } from '@/types/topology'
import { extractNodeId } from '@/services/enlinkdService'

const store = useTopologyStore()
const router = useRouter()

const isVisible = computed(() => store.selectedElement !== null)

const vertex = computed(() => {
  const el = store.selectedElement
  return el && isVertex(el) ? el : null
})

const edge = computed(() => {
  const el = store.selectedElement
  return el && !isVertex(el) ? el : null
})

const panelTitle = computed(() => {
  if (vertex.value) return vertex.value.label ?? 'Node'
  if (edge.value) return 'Link Detail'
  return ''
})

// ── Node detail ───────────────────────────────────────────────────────────────

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

const nodeDetail = computed(() => {
  if (!nodeId.value) return null
  return store.nodeDetails[nodeId.value] ?? null
})

const nodeDetailLoading = ref(false)

watch(nodeId, async (id) => {
  if (id === null) return
  const tasks: Promise<void>[] = []
  if (store.alarmSeverity[id]) tasks.push(store.loadNodeAlarmDetails(id))
  if (!store.nodeDetails[id]) {
    nodeDetailLoading.value = true
    tasks.push(store.loadNodeDetail(id).finally(() => { nodeDetailLoading.value = false }))
  }
  await Promise.all(tasks)
}, { immediate: true })

const sortedInterfaces = computed(() => {
  if (!nodeDetail.value) return []
  return [...nodeDetail.value.ipInterfaces].sort((a, b) => {
    if (a.snmpPrimary === 'P') return -1
    if (b.snmpPrimary === 'P') return 1
    return (a.ipAddress ?? '').localeCompare(b.ipAddress ?? '')
  })
})

const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s
const stripQuotes = (s: string) => s.replace(/^"|"$/g, '').trim()
const formatMacFromElem = (s: string) => {
  const m = s.match(/macAddress:([a-f0-9]{12})/i)
  if (!m) return s
  const h = m[1]
  return `${h.slice(0,2)}:${h.slice(2,4)}:${h.slice(4,6)}:${h.slice(6,8)}:${h.slice(8,10)}:${h.slice(10)}`
}

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

const edgeDetail = computed(() => edgeKey.value ? store.edgeLinkDetails[edgeKey.value] ?? null : null)
const edgeProtocols = computed(() => edge.value?.protocols ?? [])

const sourceLabel = computed(() => {
  if (!edge.value) return ''
  return store.vertices.find(v => v.id === String(edge.value!.source.id))?.label ?? String(edge.value.source.id)
})
const targetLabel = computed(() => {
  if (!edge.value) return ''
  return store.vertices.find(v => v.id === String(edge.value!.target.id))?.label ?? String(edge.value.target.id)
})
const sourceIp = computed(() => store.vertices.find(v => v.id === String(edge.value?.source.id ?? ''))?.ipAddress ?? '')
const targetIp = computed(() => store.vertices.find(v => v.id === String(edge.value?.target.id ?? ''))?.ipAddress ?? '')

// ── String parsers ────────────────────────────────────────────────────────────
const ifaceName = (s: string) => s.split('(')[0].trim()
const macFromStr = (s: string) => {
  const m = s.match(/macAddress:([a-f0-9]{12})/i)
  if (!m) return ''
  const h = m[1]
  return `${h.slice(0,4)}:${h.slice(4,8)}:${h.slice(8)}`
}
const ipFromOspfPort = (s: string) => {
  const parts = s.split('(')
  for (const p of parts) {
    const c = p.replace(')', '').trim()
    if (/^\d+\.\d+\.\d+\.\d+$/.test(c)) return c
  }
  return ''
}
const parseMask = (s: string) => s.match(/mask:([^)]+)/)?.[1]?.trim() ?? ''
const isisFaceFromPort = (s: string) => s.split('(')[0].trim() || s

// ── LLDP / OSPF / IS-IS computed ─────────────────────────────────────────────
const lldpLinks = computed(() => {
  if (!edgeDetail.value || !edge.value) return []
  const { src, tgt, srcNodeId, tgtNodeId } = edgeDetail.value
  const result: { srcName: string, srcPort: string, srcMac: string, tgtName: string, tgtPort: string, tgtMac: string }[] = []
  const add = (data: typeof src, toNodeId: number, fromName: string) => {
    if (!data) return
    for (const l of data.lldpLinkNodes) {
      if (extractNodeId(l.lldpRemChassisIdUrl) !== String(toNodeId)) continue
      result.push({ srcName: fromName, srcPort: ifaceName(l.lldpLocalPort), srcMac: macFromStr(l.lldpLocalPort), tgtName: l.lldpRemInfo, tgtPort: ifaceName(l.ldpRemPort), tgtMac: macFromStr(l.ldpRemPort) })
    }
  }
  add(src, tgtNodeId, sourceLabel.value)
  add(tgt, srcNodeId, targetLabel.value)
  return result
})

const ospfRouterIds = computed(() => {
  if (!edgeDetail.value) return ''
  const s = edgeDetail.value.src?.ospfElementNode?.ospfRouterId ?? ''
  const t = edgeDetail.value.tgt?.ospfElementNode?.ospfRouterId ?? ''
  return (s && t) ? `${s} ↔ ${t}` : ''
})
const ospfLinks = computed(() => {
  if (!edgeDetail.value || !edge.value) return []
  const { src, tgt, srcNodeId, tgtNodeId } = edgeDetail.value
  const result: { srcName: string, localIp: string, tgtName: string, remoteIp: string, mask: string }[] = []
  const add = (data: typeof src, toNodeId: number, fromName: string) => {
    if (!data) return
    for (const l of data.ospfLinkNodes) {
      if (extractNodeId(l.ospfRemRouterUrl) !== String(toNodeId)) continue
      result.push({ srcName: fromName, localIp: l.ospfLocalPort ? ipFromOspfPort(l.ospfLocalPort) : '', tgtName: l.ospfRemRouterId.split('(')[0].trim(), remoteIp: ipFromOspfPort(l.ospfRemPort), mask: parseMask(l.ospfLinkInfo) })
    }
  }
  add(src, tgtNodeId, sourceLabel.value)
  add(tgt, srcNodeId, targetLabel.value)
  return result
})

const isisSysIds = computed(() => {
  if (!edgeDetail.value) return ''
  const s = edgeDetail.value.src?.isisElementNode?.isisSysID ?? ''
  const t = edgeDetail.value.tgt?.isisElementNode?.isisSysID ?? ''
  return (s && t) ? `${s} ↔ ${t}` : ''
})
const isisLinks = computed(() => {
  if (!edgeDetail.value || !edge.value) return []
  const { src, tgt, srcNodeId, tgtNodeId } = edgeDetail.value
  const result: { srcName: string, localCirc: string, tgtName: string, remotePort: string, adjState: string, adjType: string }[] = []
  const add = (data: typeof src, toNodeId: number, fromName: string) => {
    if (!data) return
    for (const l of data.isisLinkNodes) {
      if (extractNodeId(l.isisISAdjUrl) !== String(toNodeId)) continue
      result.push({ srcName: fromName, localCirc: String(l.isisCircIfIndex), tgtName: l.isisISAdjNeighSysID.split('(')[0].trim(), remotePort: isisFaceFromPort(l.isisISAdjNeighPort), adjState: l.isisISAdjState, adjType: l.isisISAdjNeighSysType.replace('IntermediateSystem', '').replace('l2', 'L2').replace('l1', 'L1') })
    }
  }
  add(src, tgtNodeId, sourceLabel.value)
  add(tgt, srcNodeId, targetLabel.value)
  return result
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@/styles/severities";

.topo-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 360px;
  background: var($surface);
  border-left: 1px solid var($border-on-surface);
  border-radius: 8px 0 0 8px;
  display: flex;
  flex-direction: column;
  z-index: 20;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var($border-on-surface);
    flex-shrink: 0;
  }

  &__title {
    font-weight: 600;
    font-size: 1rem;
  }

  &__close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var($secondary-text-on-surface);
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;

    &:hover {
      background: var($shade-2);
    }
  }

  &__body {
    padding: 14px 16px;
    overflow-y: auto;
    flex: 1;
  }

  // Slide-in transition
  &-enter-active, &-leave-active {
    transition: transform 0.2s ease, opacity 0.15s ease;
  }
  &-enter-from, &-leave-to {
    transform: translateX(100%);
    opacity: 0;
  }

  // ── shared ──
  &__section {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var($primary);
    margin: 14px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var($border-on-surface);

    &:first-child { margin-top: 0; }
  }

  &__row {
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
  }

  &__key {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    margin-bottom: 2px;
  }

  &__val {
    font-size: 0.88rem;
    word-break: break-all;

    &--mono { font-family: monospace; font-size: 0.82rem; }

    &--dim { color: var($secondary-text-on-surface); }

    &--truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: help;
    }
  }

  &__badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: bold;
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

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
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

  &__cat-chip {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    border: 1px solid var($border-on-surface);
    color: var($secondary-text-on-surface);
  }

  // Interfaces
  &__iface {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 0.83rem;

    &--primary &-ip { font-weight: 600; }

    &-name {
      font-family: monospace;
      font-size: 0.8rem;
      color: var($secondary-text-on-surface);
      min-width: 36px;
    }

    &-ip {
      font-family: monospace;
      font-size: 0.82rem;
      flex: 1;
    }

    &-badge {
      font-size: 0.68rem;
      padding: 1px 6px;
      border-radius: 10px;
      background: var($primary);
      color: #fff;

      &--down {
        background: var($error);
      }
    }
  }

  &__actions {
    margin-top: 16px;
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    font-size: 0.85rem;
    color: var($secondary-text-on-surface);
  }

  &__empty {
    font-size: 0.85rem;
    color: var($secondary-text-on-surface);
    padding: 12px 0;
  }

  // Edge-specific
  &__endpoints {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    &--sub { margin-top: -4px; margin-bottom: 10px; }
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

  &__proto-block { margin-bottom: 8px; padding-left: 4px; }

  &__link-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 0.82rem;
  }

  &__link-node { font-weight: 600; }

  &__link-iface {
    font-family: monospace;
    font-size: 0.78rem;
    color: var($secondary-text-on-surface);
    background: var($shade-2);
    padding: 0 4px;
    border-radius: 3px;
  }

  &__link-arrow { color: var($secondary-text-on-surface); flex-shrink: 0; }

  &__link-sub {
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

  &__kv-val { font-family: monospace; font-size: 0.8rem; }
}
</style>
