import { v2 } from './axiosInstances'
import { cached } from './cacheService'

export interface MeasurementIntervals {
  collection: Record<string, number>  // service name → interval in ms
  rrdStep: number                     // seconds (storage resolution, not a polling interval)
  enlinkd: Record<string, number>     // protocol → rescan interval in ms
}

/**
 * Fallback defaults used when the backend endpoint is unavailable (older OpenNMS
 * versions or OSGi service unavailable). Each value documents its source assumption.
 */
export const FALLBACK: MeasurementIntervals = {
  collection: {
    SNMP: 300_000,  // default from collectd-configuration.xml
    JMX:  300_000   // default from collectd-configuration.xml
  },
  rrdStep: 300,     // default from datacollection-config.xml
  enlinkd: {
    lldp:     7_200_000,  // default from enlinkd-configuration.xml
    ospf:     7_200_000,
    isis:     7_200_000,
    cdp:      7_200_000,
    bridge:   7_200_000,
    topology:    30_000
  }
}

/**
 * Fetch the configured measurement intervals from the backend.
 * Result is self-cached with a TTL of 2× the SNMP collection interval
 * (re-fetch config every 2 collection cycles). Falls back to FALLBACK
 * on any error.
 */
export async function getIntervals(): Promise<MeasurementIntervals> {
  // Self-cache TTL: 2× the SNMP collection interval. On the very first call
  // we don't know the interval yet, so use the fallback default (600s = 10 min).
  // Subsequent calls use the real value once it's cached.
  const selfTtl = FALLBACK.collection.SNMP * 2

  return cached<MeasurementIntervals>('measurementIntervals', selfTtl, async () => {
    try {
      const resp = await v2.get('/config/measurementIntervals')
      const data = resp.data as Partial<MeasurementIntervals>
      // Merge with fallback so missing sections don't break consumers
      return {
        collection: { ...FALLBACK.collection, ...data.collection },
        rrdStep: data.rrdStep ?? FALLBACK.rrdStep,
        enlinkd: { ...FALLBACK.enlinkd, ...data.enlinkd }
      }
    } catch {
      return FALLBACK
    }
  })
}

/** Convenience: get the SNMP collection interval in ms. */
export async function getSnmpInterval(): Promise<number> {
  const intervals = await getIntervals()
  return intervals.collection.SNMP ?? FALLBACK.collection.SNMP
}
