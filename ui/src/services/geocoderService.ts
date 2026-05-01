import { v2 } from './axiosInstances'

export interface GeocoderError {
  context: string
  message: string
}

export interface Geocoder {
  id: string
  error?: GeocoderError
  config: Record<string, unknown>
}

export interface GeocoderServiceConfig {
  activeGeocoderId: string
}

const getServiceConfig = async (): Promise<GeocoderServiceConfig | null> => {
  try {
    const resp = await v2.get<GeocoderServiceConfig>('/geocoding/config')
    return resp.data
  } catch { return null }
}

const setActiveGeocoder = async (activeGeocoderId: string): Promise<boolean> => {
  try {
    await v2.post('/geocoding/config', { activeGeocoderId })
    return true
  } catch { return false }
}

const listGeocoders = async (): Promise<Geocoder[]> => {
  try {
    const resp = await v2.get<Geocoder[]>('/geocoding/geocoders')
    return resp.data ?? []
  } catch { return [] }
}

const updateGeocoderSettings = async (geocoderId: string, config: Record<string, unknown>): Promise<{ ok: boolean; error?: GeocoderError }> => {
  try {
    await v2.post(`/geocoding/geocoders/${geocoderId}`, { config })
    return { ok: true }
  } catch (err: any) {
    const data = err?.response?.data
    const error: GeocoderError = data
      ? { context: data.context ?? 'entity', message: data.message ?? 'Save failed.' }
      : { context: 'entity', message: 'Save failed.' }
    return { ok: false, error }
  }
}

export { getServiceConfig, setActiveGeocoder, listGeocoders, updateGeocoderSettings }
