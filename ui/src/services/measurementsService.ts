import { rest, v2 } from './axiosInstances'
import { SnmpInterface, SnmpInterfaceApiResponse, IpInterface, IpInterfaceApiResponse } from '@/types'
import { cached } from './cacheService'
import { getIntervals } from './intervalService'

/** Align t down to the nearest step boundary so cache keys are stable within a collection window. */
const _floor = (t: number, step: number) => Math.floor(t / step) * step

export interface InterfaceUtil {
  inBps: number   // bits/sec inbound
  outBps: number  // bits/sec outbound
  ifSpeed: number // link capacity in bits/sec
}

/**
 * Build the OpenNMS measurements resource ID for an SNMP interface.
 * Format: node[<nodeId>].interfaceSnmp[<ifName>-<physAddr>] or node[<nodeId>].interfaceSnmp[<ifName>]
 */
export const buildSnmpResourceId = (nodeId: number, iface: SnmpInterface): string => {
  const name = iface.ifName ?? iface.ifDescr ?? String(iface.ifIndex)
  const suffix = iface.physAddr ? `${name}-${iface.physAddr}` : name
  return `node[${nodeId}].interfaceSnmp[${suffix}]`
}

/**
 * Pick the best interface for weathermap display: highest-speed, operationally up, non-loopback.
 * ifType 24 = softwareLoopback
 */
export const pickBestInterface = (ifaces: SnmpInterface[]): SnmpInterface | null => {
  const candidates = ifaces.filter(i => i.ifOperStatus === 1 && i.ifType !== 24)
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) => cur.ifSpeed > best.ifSpeed ? cur : best)
}

/**
 * Fetch all SNMP interfaces for a node.
 */
export const fetchNodeSnmpIfaces = async (nodeId: number): Promise<SnmpInterface[]> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`snmpIfaces:${nodeId}`, ttl, async () => {
    try {
      // limit=100 is intentional: weathermap needs all interfaces up-front, not paginated
      const resp = await v2.get(`/nodes/${nodeId}/snmpinterfaces?limit=100`)
      if (resp.status === 204) return []
      const data: SnmpInterfaceApiResponse = resp.data
      return data.snmpInterface ?? []
    } catch {
      return []
    }
  })
}

/**
 * Fetch node type ('A' = active/up, else down).
 */
export const fetchNodeType = async (nodeId: number): Promise<string | null> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`nodeType:${nodeId}`, ttl, async () => {
    try {
      const resp = await v2.get(`/nodes/${nodeId}`)
      return resp.data?.type ?? null
    } catch {
      return null
    }
  })
}

/**
 * Query the measurements API for inbound and outbound octet rates on a specific interface.
 * Returns bits/sec for both directions, or null on failure.
 *
 * OpenNMS RRD stores COUNTER-type attributes as rates (bytes/sec after derivation).
 * We multiply by 8 to convert bytes/sec → bits/sec.
 */
export const fetchInterfaceUtilization = async (
  nodeId: number,
  iface: SnmpInterface
): Promise<InterfaceUtil | null> => {
  const intervals = await getIntervals()
  const CACHE_TTL   = intervals.collection.SNMP   // ms — how often to re-fetch
  const RRD_STEP_MS = intervals.rrdStep * 1000    // ms — RRD resolution (e.g. 300 * 1000 = 300000)
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const end   = _floor(Date.now(), RRD_STEP_MS)
  const start = end - (RRD_STEP_MS * 3)           // 3 RRD buckets

  return cached(`util:${resourceId}:${end}`, CACHE_TTL, async () => {
    const payload = {
      start, end, step: RRD_STEP_MS,
      source: [
        { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
        { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
      ]
    }
    try {
      const resp = await rest.post('/measurements', payload)
      const labels: string[]                = resp.data.labels  ?? []
      const columns: { values: number[] }[] = resp.data.columns ?? []
      const inIdx  = labels.indexOf('inOctets')
      const outIdx = labels.indexOf('outOctets')
      if (inIdx < 0 || outIdx < 0) return null
      const lastValid = (vals: number[]) => {
        for (let i = vals.length - 1; i >= 0; i--)
          if (!isNaN(vals[i]) && vals[i] >= 0) return vals[i]
        return 0
      }
      const inBytesPerSec  = lastValid(columns[inIdx]?.values  ?? [])
      const outBytesPerSec = lastValid(columns[outIdx]?.values ?? [])
      return {
        inBps:   inBytesPerSec  * 8,
        outBps:  outBytesPerSec * 8,
        ifSpeed: iface.ifSpeed
      }
    } catch {
      return null
    }
  })
}

/**
 * Fetch all IP interfaces for a node.
 * Used to find the primary management IP (snmpPrimary === 'P') for edge label display.
 */
export const fetchNodeIpInterfaces = async (nodeId: number): Promise<IpInterface[]> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`ipIfaces:${nodeId}`, ttl, async () => {
    try {
      const resp = await v2.get(`/nodes/${nodeId}/ipinterfaces?limit=100`)
      if (resp.status === 204) return []
      const data: IpInterfaceApiResponse = resp.data
      return data.ipInterface ?? []
    } catch {
      return []
    }
  })
}
