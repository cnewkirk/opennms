import { rest, v2 } from './axiosInstances'
import { SnmpInterface, SnmpInterfaceApiResponse, IpInterface, IpInterfaceApiResponse } from '@/types'

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
  try {
    // limit=100 is intentional: weathermap needs all interfaces up-front, not paginated
    const resp = await v2.get(`/nodes/${nodeId}/snmpinterfaces?limit=100`)
    if (resp.status === 204) return []
    const data: SnmpInterfaceApiResponse = resp.data
    return data.snmpInterface ?? []
  } catch {
    return []
  }
}

/**
 * Fetch node type ('A' = active/up, else down).
 */
export const fetchNodeType = async (nodeId: number): Promise<string | null> => {
  try {
    const resp = await v2.get(`/nodes/${nodeId}`)
    return resp.data?.type ?? null
  } catch {
    return null
  }
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
  iface: SnmpInterface,
  atTime?: Date          // if provided, query 5-minute window ending at atTime
): Promise<InterfaceUtil | null> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const end   = atTime ? atTime.getTime() : Date.now()
  const start = end - 300_000
  const payload = {
    start,
    end,
    step: 300_000,
    source: [
      { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
      { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
    ]
  }

  try {
    const resp = await rest.post('/measurements', payload)
    const labels: string[] = resp.data.labels ?? []
    const columns: { values: number[] }[] = resp.data.columns ?? []

    const inIdx  = labels.indexOf('inOctets')
    const outIdx = labels.indexOf('outOctets')
    if (inIdx < 0 || outIdx < 0) return null

    const inValues  = columns[inIdx]?.values  ?? []
    const outValues = columns[outIdx]?.values ?? []

    // Take the last non-NaN value from each series
    const lastValid = (vals: number[]) => {
      for (let i = vals.length - 1; i >= 0; i--) {
        if (!isNaN(vals[i]) && vals[i] >= 0) return vals[i]
      }
      return 0
    }

    const inBytesPerSec  = lastValid(inValues)
    const outBytesPerSec = lastValid(outValues)

    return {
      inBps:   inBytesPerSec  * 8,
      outBps:  outBytesPerSec * 8,
      ifSpeed: iface.ifSpeed
    }
  } catch {
    return null
  }
}

/**
 * Fetch a time-series of inbound/outbound bit rates for a specific interface.
 * Returns arrays parallel to `timestamps` (ms epoch). NaN/negative API values → 0.
 * step is in MILLISECONDS (e.g. 60_000 = 1-minute resolution).
 */
export const fetchInterfaceTimeSeries = async (
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step = 60_000,
  signal?: AbortSignal
): Promise<{ timestamps: number[]; inBps: number[]; outBps: number[] }> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const payload = {
    start: start.getTime(),
    end:   end.getTime(),
    step,
    source: [
      { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
      { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
    ]
  }
  try {
    const resp  = await rest.post('/measurements', payload, { signal })
    const labels: string[]                = resp.data.labels  ?? []
    const columns: { values: number[] }[] = resp.data.columns ?? []
    const inIdx  = labels.indexOf('inOctets')
    const outIdx = labels.indexOf('outOctets')
    const n      = columns[inIdx]?.values.length ?? 0
    const toFinite = (v: number) => (isFinite(v) && v >= 0) ? v : 0
    const timestamps = Array.from({ length: n }, (_, i) => start.getTime() + i * step)
    const inBps  = (columns[inIdx]?.values  ?? []).map(v => toFinite(v) * 8)
    const outBps = (columns[outIdx]?.values ?? []).map(v => toFinite(v) * 8)
    return { timestamps, inBps, outBps }
  } catch {
    return { timestamps: [], inBps: [], outBps: [] }
  }
}

/**
 * Fetch error and discard counts for a specific interface over a time window.
 * Returns null for any series that is entirely zero (not worth rendering).
 * step is in MILLISECONDS.
 */
export const fetchInterfaceErrorsDiscards = async (
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step = 60_000,
  signal?: AbortSignal
): Promise<{
  ifInErrors:    number[] | null
  ifOutErrors:   number[] | null
  ifInDiscards:  number[] | null
  ifOutDiscards: number[] | null
}> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const payload = {
    start: start.getTime(),
    end:   end.getTime(),
    step,
    source: [
      { attribute: 'ifInErrors',    label: 'ifInErrors',    resourceId, transient: false },
      { attribute: 'ifOutErrors',   label: 'ifOutErrors',   resourceId, transient: false },
      { attribute: 'ifInDiscards',  label: 'ifInDiscards',  resourceId, transient: false },
      { attribute: 'ifOutDiscards', label: 'ifOutDiscards', resourceId, transient: false }
    ]
  }
  try {
    const resp    = await rest.post('/measurements', payload, { signal })
    const labels: string[]                = resp.data.labels  ?? []
    const columns: { values: number[] }[] = resp.data.columns ?? []
    const toFinite = (v: number) => (isFinite(v) && v >= 0) ? v : 0
    const getOrNull = (label: string): number[] | null => {
      const idx  = labels.indexOf(label)
      if (idx < 0) return null
      const vals = (columns[idx]?.values ?? []).map(toFinite)
      return vals.some(v => v > 0) ? vals : null
    }
    return {
      ifInErrors:    getOrNull('ifInErrors'),
      ifOutErrors:   getOrNull('ifOutErrors'),
      ifInDiscards:  getOrNull('ifInDiscards'),
      ifOutDiscards: getOrNull('ifOutDiscards')
    }
  } catch {
    return { ifInErrors: null, ifOutErrors: null, ifInDiscards: null, ifOutDiscards: null }
  }
}

/**
 * Fetch all IP interfaces for a node.
 * Used to find the primary management IP (snmpPrimary === 'P') for edge label display.
 */
export const fetchNodeIpInterfaces = async (nodeId: number): Promise<IpInterface[]> => {
  try {
    const resp = await v2.get(`/nodes/${nodeId}/ipinterfaces?limit=100`)
    if (resp.status === 204) return []
    const data: IpInterfaceApiResponse = resp.data
    return data.ipInterface ?? []
  } catch {
    return []
  }
}
