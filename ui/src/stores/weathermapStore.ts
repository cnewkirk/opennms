import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TopologyVertex, TopologyEdge } from '@/types/topology'
import { SnmpInterface } from '@/types'
import {
  fetchNodeSnmpIfaces, fetchNodeType,
  fetchInterfaceUtilization, pickBestInterface, fetchNodeIpInterfaces,
  InterfaceUtil
} from '@/services/measurementsService'
import { getNodeEnlinkd, cleanName, NodeEnlinkdData } from '@/services/enlinkdService'

export interface EdgeEndpointUtil {
  inBps: number
  outBps: number
  utilPct: number
  ifSpeed: number
}

export interface EdgeUtil {
  src: EdgeEndpointUtil | null
  tgt: EdgeEndpointUtil | null
  /** max(src.utilPct, tgt.utilPct) — drives edge color on canvas */
  utilPct: number
  /** combined bps across both endpoints — drives edge width on canvas */
  totalBps: number
}

export interface EdgeLabelData {
  localIfName?: string    // ifName/ifDescr of local connecting interface
  remotePortId?: string   // remote port from LLDP (ldpRemPort after cleanName)
  localIp?: string        // primary IP of source node (snmpPrimary === 'P')
  remoteIp?: string       // primary IP of target node
  localMac?: string       // physAddr of local interface
  remoteMac?: string      // lldpRemChassisId from LLDP link (remote chassis MAC)
  ifSpeed?: number        // link speed in bits/sec
  srcNodeId?: number      // source node ID
  srcIface?: SnmpInterface // resolved local interface (from LLDP or SNMP fallback)
  tgtNodeId?: number      // target node ID
  tgtIface?: SnmpInterface // resolved remote interface (from reverse LLDP)
}

/** Stable canonical key for an edge between two nodes. */
export const edgeKey = (srcId: number, tgtId: number): string =>
  `${Math.min(srcId, tgtId)}-${Math.max(srcId, tgtId)}`

/**
 * Compute utilization % for a full-duplex link.
 * utilPct = (inBps + outBps) / (2 * ifSpeed) * 100, capped at 100.
 */
export const computeUtilPct = (inBps: number, outBps: number, ifSpeed: number): number => {
  if (ifSpeed <= 0) return 0
  const raw = ((inBps + outBps) / (2 * ifSpeed)) * 100
  return Math.min(100, Math.round(raw * 10) / 10)
}

export const useWeathermapStore = defineStore('weathermapStore', () => {
  const edgeUtilMap  = ref<Record<string, EdgeUtil>>({})
  const nodeDownMap  = ref<Record<number, boolean>>({})
  const edgeLabelData = ref<Record<string, EdgeLabelData>>({})
  const loading      = ref(false)
  const error        = ref<string | null>(null)
  const pollInterval = ref(30)   // seconds; 0 = disabled
  const lastUpdated  = ref<Date | null>(null)
  const selectedTime = ref<Date | null>(null)  // null = live

  // When set, overrides ifSpeed as the utilization denominator.
  // Useful for assessing utilization against a committed/contracted rate
  // rather than physical line speed (e.g., in a lab with virtual 10 Gbps NICs).
  const _REFBPS_KEY = 'opennms-topology-reference-bps'
  const referenceBps = ref<number | null>(
    (() => { const v = localStorage.getItem(_REFBPS_KEY); return v ? Number(v) : null })()
  )
  watch(referenceBps, v => {
    if (v === null) localStorage.removeItem(_REFBPS_KEY)
    else localStorage.setItem(_REFBPS_KEY, String(v))
  })

  let _timer: ReturnType<typeof setTimeout> | null = null
  let _activeVertices: TopologyVertex[] = []
  let _activeEdges: TopologyEdge[] = []

  const _scheduleNext = () => {
    if (_timer) clearTimeout(_timer)
    if (pollInterval.value <= 0) return
    _timer = setTimeout(() => refresh(), pollInterval.value * 1000)
  }

  const _fetchAll = async () => {
    const edges = _activeEdges   // snapshot to prevent mid-flight mutation on rapid start() calls
    if (edges.length === 0) return

    // Step 1 — Collect unique node IDs from all edges
    const nodeIds = new Set<number>()
    for (const e of edges) {
      nodeIds.add(e.source.id)
      nodeIds.add(e.target.id)
    }

    // Step 2 — Fetch SNMP interfaces, node type, IP interfaces, and LLDP enlinkd data for each node
    const nodeResults = await Promise.allSettled(
      Array.from(nodeIds).map(async (nodeId) => {
        const [ifaces, type, ipIfaces, enlinkd] = await Promise.all([
          fetchNodeSnmpIfaces(nodeId),
          fetchNodeType(nodeId),
          fetchNodeIpInterfaces(nodeId),
          getNodeEnlinkd(nodeId)
        ])
        return { nodeId, ifaces, type, ipIfaces, enlinkd }
      })
    )

    const nodeSnmpMap: Record<number, ReturnType<typeof pickBestInterface>> = {}
    const nodeIfIndexMap: Record<number, Map<number, SnmpInterface>> = {}
    const nodeIpMap: Record<number, string | undefined> = {}
    const nodeEnlinkdMap: Record<number, NodeEnlinkdData | null> = {}
    const downMap: Record<number, boolean> = {}

    for (const result of nodeResults) {
      if (result.status !== 'fulfilled') continue
      const { nodeId, ifaces, type, ipIfaces, enlinkd } = result.value
      nodeSnmpMap[nodeId] = pickBestInterface(ifaces)
      nodeIfIndexMap[nodeId] = new Map(ifaces.map(i => [i.ifIndex, i]))
      downMap[nodeId] = type !== null && type !== 'A'
      nodeIpMap[nodeId] = ipIfaces.find(ip => ip.snmpPrimary === 'P')?.ipAddress
      nodeEnlinkdMap[nodeId] = enlinkd
    }

    // Step 3 — Build edgeLabelData via LLDP correlation BEFORE the utilization fetch so that
    // srcIface/tgtIface (the specific connecting interfaces identified via LLDP) are available
    // for the per-endpoint utilization queries in Step 4.
    const vertexLabelById = new Map(_activeVertices.map(v => [v.id, v.label]))
    const labelMap: Record<string, EdgeLabelData> = {}
    for (const e of edges) {
      const key   = edgeKey(e.source.id, e.target.id)
      const srcId = e.source.id
      const tgtId = e.target.id
      const data: EdgeLabelData = {}

      data.srcNodeId = srcId
      data.tgtNodeId = tgtId
      data.localIp   = nodeIpMap[srcId]
      data.remoteIp  = nodeIpMap[tgtId]

      // Forward LLDP — source node's view of the link
      const enlinkd     = nodeEnlinkdMap[srcId]
      const targetLabel = vertexLabelById.get(String(tgtId))
      if (enlinkd && targetLabel) {
        const lldpLink = enlinkd.lldpLinkNodes.find(l =>
          cleanName(l.lldpRemInfo).toLowerCase() === targetLabel.toLowerCase()
        )
        if (lldpLink) {
          const ifIndexMatch = lldpLink.lldpLocalPort.match(/ifindex:(\d+)/i)
          if (ifIndexMatch) {
            const localIface = nodeIfIndexMap[srcId].get(Number(ifIndexMatch[1]))
            if (localIface) {
              data.localIfName = localIface.ifName ?? localIface.ifDescr ?? undefined
              data.localMac    = localIface.physAddr ?? undefined
              data.ifSpeed     = localIface.ifSpeed > 0 ? localIface.ifSpeed : undefined
              data.srcIface    = localIface
            }
          } else {
            data.localIfName = cleanName(lldpLink.lldpLocalPort) || undefined
          }
          data.remotePortId = cleanName(lldpLink.ldpRemPort) || undefined
          data.remoteMac    = lldpLink.lldpRemChassisId || undefined
        }
      }

      // Reverse LLDP — target node's view of the link; identifies tgtIface and fills gaps
      const tgtEnlinkd = nodeEnlinkdMap[tgtId]
      const srcLabel   = vertexLabelById.get(String(srcId))
      if (tgtEnlinkd && srcLabel) {
        const reverseLldp = tgtEnlinkd.lldpLinkNodes.find(l =>
          cleanName(l.lldpRemInfo).toLowerCase() === srcLabel.toLowerCase()
        )
        if (reverseLldp) {
          const ifIndexMatch = reverseLldp.lldpLocalPort.match(/ifindex:(\d+)/i)
          if (ifIndexMatch) {
            const remoteIface = nodeIfIndexMap[tgtId]?.get(Number(ifIndexMatch[1]))
            if (remoteIface) {
              // Always capture tgtIface when reverse LLDP identifies the interface
              data.tgtIface  = remoteIface
              data.remoteMac = data.remoteMac ?? remoteIface.physAddr ?? undefined
              if (!data.remotePortId) {
                data.remotePortId = remoteIface.ifName ?? remoteIface.ifDescr ?? undefined
              }
            }
          } else if (!data.remotePortId) {
            data.remotePortId = cleanName(reverseLldp.lldpLocalPort) || undefined
          }
          if (!data.localIfName) {
            data.localIfName = cleanName(reverseLldp.ldpRemPort) || undefined
          }
        }
      }

      // Fallbacks — use best SNMP interface when LLDP didn't identify the connecting interface
      if (!data.srcIface) {
        const best = nodeSnmpMap[srcId]
        if (best) {
          data.localIfName = data.localIfName ?? best.ifName ?? best.ifDescr ?? undefined
          data.localMac    = data.localMac    ?? best.physAddr ?? undefined
          data.ifSpeed     = data.ifSpeed     ?? (best.ifSpeed > 0 ? best.ifSpeed : undefined)
          data.srcIface    = best
        }
      }
      if (!data.tgtIface) {
        const best = nodeSnmpMap[tgtId]
        if (best) data.tgtIface = best
      }

      labelMap[key] = data
    }

    // Step 4 — Fetch utilization from BOTH endpoints in parallel using LLDP-correlated interfaces
    const toEndpointUtil = (u: InterfaceUtil | null): EdgeEndpointUtil | null => {
      if (!u) return null
      const effectiveSpeed = referenceBps.value ?? u.ifSpeed
      return {
        inBps:   u.inBps,
        outBps:  u.outBps,
        ifSpeed: u.ifSpeed,
        utilPct: computeUtilPct(u.inBps, u.outBps, effectiveSpeed)
      }
    }

    const edgeResults = await Promise.allSettled(
      edges.map(async (e) => {
        const key  = edgeKey(e.source.id, e.target.id)
        const data = labelMap[key]
        const [srcUtil, tgtUtil] = await Promise.all([
          data?.srcIface
            ? fetchInterfaceUtilization(e.source.id, data.srcIface, selectedTime.value ?? undefined)
            : Promise.resolve(null),
          data?.tgtIface
            ? fetchInterfaceUtilization(e.target.id, data.tgtIface, selectedTime.value ?? undefined)
            : Promise.resolve(null)
        ])
        return { key, srcUtil, tgtUtil }
      })
    )

    const utilMap: Record<string, EdgeUtil> = {}
    for (const result of edgeResults) {
      if (result.status !== 'fulfilled') continue
      const { key, srcUtil, tgtUtil } = result.value
      const src = toEndpointUtil(srcUtil)
      const tgt = toEndpointUtil(tgtUtil)
      if (!src && !tgt) continue
      utilMap[key] = {
        src,
        tgt,
        utilPct:  Math.max(src?.utilPct ?? 0, tgt?.utilPct ?? 0),
        totalBps: (src ? src.inBps + src.outBps : 0) + (tgt ? tgt.inBps + tgt.outBps : 0)
      }
    }

    edgeUtilMap.value   = utilMap
    nodeDownMap.value   = downMap
    edgeLabelData.value = labelMap
    lastUpdated.value   = new Date()
  }

  const refresh = async () => {
    loading.value = true
    error.value = null
    try {
      await _fetchAll()
    } catch (err) {
      error.value = 'Weathermap unavailable'
    } finally {
      loading.value = false
      _scheduleNext()
    }
  }

  const start = async (vertices: TopologyVertex[], edges: TopologyEdge[]) => {
    // _activeVertices kept for potential future use (e.g., marking isolated/unconnected nodes as down)
    _activeVertices = vertices
    _activeEdges = edges
    if (_timer) clearTimeout(_timer)
    await refresh()
  }

  const stop = () => {
    if (_timer) { clearTimeout(_timer); _timer = null }
  }

  const setPollInterval = (seconds: number) => {
    pollInterval.value = seconds
    if (_timer) { clearTimeout(_timer); _timer = null }
    if (seconds > 0) _scheduleNext()
  }

  const setTime = async (t: Date | null) => {
    selectedTime.value = t
    if (t === null) {
      // Resume auto-refresh via normal path (refresh() calls _scheduleNext in finally)
      await refresh()
    } else {
      // Historical mode: cancel timer, fetch snapshot without rescheduling
      if (_timer) { clearTimeout(_timer); _timer = null }
      loading.value = true
      error.value   = null
      try {
        await _fetchAll()
      } catch {
        error.value = 'Weathermap unavailable'
      } finally {
        loading.value = false
        // Do NOT call _scheduleNext() — historical mode has no auto-refresh
      }
    }
  }

  const setReferenceBps = (bps: number | null) => { referenceBps.value = bps }

  return {
    edgeUtilMap, nodeDownMap, edgeLabelData, loading, error, pollInterval, lastUpdated,
    selectedTime, referenceBps,
    start, stop, refresh, setPollInterval, setTime, setReferenceBps
  }
})
