import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TopologyVertex, TopologyEdge } from '@/types/topology'
import {
  fetchNodeSnmpIfaces, fetchNodeType,
  fetchInterfaceUtilization, pickBestInterface,
  InterfaceUtil
} from '@/services/measurementsService'

export interface EdgeUtil {
  inBps: number
  outBps: number
  utilPct: number
  ifSpeed: number
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
  const loading      = ref(false)
  const error        = ref<string | null>(null)
  const pollInterval = ref(60)   // seconds; 0 = disabled
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
    if (_activeEdges.length === 0) return

    // Collect unique node IDs from all edges
    const nodeIds = new Set<number>()
    for (const e of _activeEdges) {
      nodeIds.add(e.source.id)
      nodeIds.add(e.target.id)
    }

    // Fetch SNMP interfaces and node type for each node in parallel
    const nodeResults = await Promise.allSettled(
      Array.from(nodeIds).map(async (nodeId) => {
        const [ifaces, type] = await Promise.all([
          fetchNodeSnmpIfaces(nodeId),
          fetchNodeType(nodeId)
        ])
        return { nodeId, ifaces, type }
      })
    )

    // Build nodeSnmpMap and nodeDownMap from results
    const nodeSnmpMap: Record<number, ReturnType<typeof pickBestInterface>> = {}
    const downMap: Record<number, boolean> = {}

    for (const result of nodeResults) {
      if (result.status !== 'fulfilled') continue
      const { nodeId, ifaces, type } = result.value
      nodeSnmpMap[nodeId] = pickBestInterface(ifaces)
      downMap[nodeId] = type !== null && type !== 'A'
    }

    // Fetch utilization for each edge in parallel
    const edgeResults = await Promise.allSettled(
      _activeEdges.map(async (e) => {
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

    // Build new edgeUtilMap
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

    edgeUtilMap.value = utilMap
    nodeDownMap.value = downMap
    lastUpdated.value = new Date()
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

  return {
    edgeUtilMap, nodeDownMap, loading, error, pollInterval, lastUpdated,
    start, stop, refresh, setPollInterval
  }
})
