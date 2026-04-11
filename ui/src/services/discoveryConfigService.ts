import { v2, rest } from './axiosInstances'
import { DiscoveryConfig } from '@/types'

const configEndpoint = '/discovery/config'

const getDiscoveryConfig = async (): Promise<DiscoveryConfig | null> => {
  try {
    const resp = await v2.get<DiscoveryConfig>(configEndpoint)
    const d = resp.data
    // JAXB may collapse single-element arrays to objects — normalize all list fields
    d.specifics = normalizeList(d.specifics)
    d.includeRanges = normalizeList(d.includeRanges)
    d.excludeRanges = normalizeList(d.excludeRanges)
    d.includeUrls = normalizeList(d.includeUrls)
    d.excludeUrls = normalizeList(d.excludeUrls)
    return d
  } catch { return null }
}

const saveDiscoveryConfig = async (config: DiscoveryConfig): Promise<boolean> => {
  try {
    await v2.put(configEndpoint, config, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

const getLocations = async (): Promise<string[]> => {
  try {
    const resp = await v2.get<{ location: { 'location-name': string }[] }>('/monitoringLocations?limit=1000')
    const locs = resp.data.location ?? []
    return locs.map(l => l['location-name']).filter(Boolean)
  } catch { return ['Default'] }
}

const getForeignSources = async (): Promise<string[]> => {
  try {
    const resp = await rest.get<string>('/requisitionNames', {
      headers: { Accept: 'application/xml' },
      responseType: 'text'
    })
    const parser = new DOMParser()
    const doc = parser.parseFromString(resp.data as string, 'application/xml')
    return Array.from(doc.querySelectorAll('foreign-source')).map(el => el.textContent ?? '').filter(Boolean)
  } catch { return [] }
}

function normalizeList<T>(val: T[] | T | undefined | null): T[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  return [val]
}

export { getDiscoveryConfig, saveDiscoveryConfig, getLocations, getForeignSources }
