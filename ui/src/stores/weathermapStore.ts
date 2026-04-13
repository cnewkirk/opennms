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
import { getIntervals } from '@/services/intervalService'

export interface EdgeUtil {
  inBps: number
  outBps: number
  utilPct: number
  ifSpeed: number
}

export interface EdgeLabelData {
  localIfName?: string    // ifName/ifDescr of local connecting interface
  remotePortId?: string   // remote port from LLDP (ldpRemPort after cleanName)
  remoteIfName?: string   // ifName/ifDescr of target node's connecting interface (symmetric LLDP)
  localIp?: string        // primary IP of source node (snmpPrimary === 'P')
  remoteIp?: string       // primary IP of target node
  localMac?: string       // physAddr of local interface
  ifSpeed?: number        // link speed in bits/sec
  remoteMac?: string      // physAddr of target node's connecting interface
  remoteIfSpeed?: number  // ifSpeed of target node's connecting interface
}

/**
 * Canonical edge key for a node pair — used across topology stores, composables, and components.
 * Guarantees stable key regardless of which endpoint is "source" vs "target".
 */
export const edgeKey = (srcId: number, tgtId: number): string =>
  `${Math.min(srcId, tgtId)}-${Math.max(srcId, tgtId)}`

/**
 * Compute utilization % for a full-duplex link.
 * Full-duplex: each direction has independent ifSpeed capacity, so total capacity = 2 * ifSpeed.
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
  const pollInterval = ref(0)    // seconds; initialized from config in start()
  const lastUpdated  = ref<Date | null>(null)

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

    // Collect unique node IDs from all edges
    const nodeIds = new Set<number>()
    for (const e of edges) {
      nodeIds.add(e.source.id)
      nodeIds.add(e.target.id)
    }

    // Fetch SNMP interfaces, node type, IP interfaces, and LLDP enlinkd data for each node
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

    // Fetch utilization for each edge in parallel
    const edgeResults = await Promise.allSettled(
      edges.map(async (e) => {
        const key = edgeKey(e.source.id, e.target.id)
        const srcIface = nodeSnmpMap[e.source.id]
        const tgtIface = nodeSnmpMap[e.target.id]

        // Use the source endpoint's interface (prefer src; fall back to tgt)
        const iface = srcIface ?? tgtIface
        if (!iface) return { key, util: null }

        const nodeId = srcIface ? e.source.id : e.target.id
        const util: InterfaceUtil | null = await fetchInterfaceUtilization(nodeId, iface)
        return { key, util }
      })
    )

    const utilMap: Record<string, EdgeUtil> = {}
    for (const result of edgeResults) {
      if (result.status !== 'fulfilled') continue
      const { key, util } = result.value
      if (!util) continue
      utilMap[key] = {
        inBps:   util.inBps,
        outBps:  util.outBps,
        ifSpeed: util.ifSpeed,
        utilPct: computeUtilPct(util.inBps, util.outBps, util.ifSpeed)
      }
    }

    // Build edgeLabelData — IP + LLDP port correlation per edge
    const vertexLabelById = new Map(_activeVertices.map(v => [v.id, v.label]))
    const labelMap: Record<string, EdgeLabelData> = {}
    for (const e of edges) {
      const key    = edgeKey(e.source.id, e.target.id)
      const srcId  = e.source.id
      const tgtId  = e.target.id
      const data: EdgeLabelData = {}

      data.localIp  = nodeIpMap[srcId]
      data.remoteIp = nodeIpMap[tgtId]

      const enlinkd     = nodeEnlinkdMap[srcId]
      const targetLabel = vertexLabelById.get(String(tgtId))
      if (enlinkd && targetLabel) {
        const lldpLink = enlinkd.lldpLinkNodes.find(l =>
          cleanName(l.lldpRemInfo).toLowerCase() === targetLabel.toLowerCase()
        )
        if (lldpLink) {
          const ifIndexMatch = lldpLink.lldpLocalPort.match(/ifindex:(\d+)/i)
          if (ifIndexMatch) {
            const localIface = nodeIfIndexMap[srcId]?.get(Number(ifIndexMatch[1]))
            if (localIface) {
              data.localIfName = localIface.ifName ?? localIface.ifDescr ?? undefined
              data.localMac    = localIface.physAddr ?? undefined
              data.ifSpeed     = localIface.ifSpeed > 0 ? localIface.ifSpeed : undefined
            }
          } else {
            const cleaned = cleanName(lldpLink.lldpLocalPort)
            data.localIfName = cleaned || undefined
          }
          data.remotePortId = cleanName(lldpLink.ldpRemPort) || undefined
        }
      }

      if (!data.localIfName) {
        const best = nodeSnmpMap[srcId]
        if (best) {
          data.localIfName = best.ifName ?? best.ifDescr ?? undefined
          data.localMac    = best.physAddr ?? undefined
          data.ifSpeed     = best.ifSpeed > 0 ? best.ifSpeed : undefined
        }
      }

      // Symmetric LLDP: look up from tgtId's perspective to get its local interface toward srcId.
      // nodeEnlinkdMap[tgtId] is already fetched above — no extra network call needed.
      const tgtEnlinkd  = nodeEnlinkdMap[tgtId]
      const srcLabel    = vertexLabelById.get(String(srcId))
      if (tgtEnlinkd && srcLabel) {
        const tgtLldpLink = tgtEnlinkd.lldpLinkNodes.find(l =>
          cleanName(l.lldpRemInfo).toLowerCase() === srcLabel.toLowerCase()
        )
        if (tgtLldpLink) {
          const ifIndexMatch = tgtLldpLink.lldpLocalPort.match(/ifindex:(\d+)/i)
          if (ifIndexMatch) {
            const remoteIface = nodeIfIndexMap[tgtId]?.get(Number(ifIndexMatch[1]))
            if (remoteIface) {
              data.remoteIfName  = remoteIface.ifName ?? remoteIface.ifDescr ?? undefined
              data.remoteMac     = remoteIface.physAddr ?? undefined
              data.remoteIfSpeed = remoteIface.ifSpeed > 0 ? remoteIface.ifSpeed : undefined
            }
          } else {
            const cleaned = cleanName(tgtLldpLink.lldpLocalPort)
            data.remoteIfName = cleaned || undefined
          }
        }
      }
      if (!data.remoteIfName) {
        const best = nodeSnmpMap[tgtId]
        if (best) {
          data.remoteIfName  = best.ifName ?? best.ifDescr ?? undefined
          data.remoteMac     = best.physAddr ?? undefined
          data.remoteIfSpeed = best.ifSpeed > 0 ? best.ifSpeed : undefined
        }
      }

      labelMap[key] = data
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
    // Cached for _fetchAll() edge label correlation
    _activeVertices = vertices
    _activeEdges = edges
    if (_timer) clearTimeout(_timer)

    // Initialize poll interval from configured SNMP collection interval
    if (pollInterval.value === 0) {
      const intervals = await getIntervals()
      pollInterval.value = Math.round(intervals.collection.SNMP / 1000) // ms → seconds
    }

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

  return {
    edgeUtilMap, nodeDownMap, edgeLabelData, loading, error, pollInterval, lastUpdated,
    start, stop, refresh, setPollInterval
  }
})
