import { rest } from './axiosInstances'

export interface GrafanaEndpoint {
  id?: number
  uid: string
  url: string
  apiKey: string
  description?: string
  connectTimeout?: number
  readTimeout?: number
}

const endpoint = '/endpoints/grafana'

const listEndpoints = async (): Promise<GrafanaEndpoint[]> => {
  try {
    const resp = await rest.get<GrafanaEndpoint | GrafanaEndpoint[]>(endpoint)
    if (!resp.data) return []
    return Array.isArray(resp.data) ? resp.data : [resp.data]
  } catch { return [] }
}

const createEndpoint = async (e: GrafanaEndpoint): Promise<{ ok: boolean; error?: string }> => {
  try {
    await rest.post(endpoint, e)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.message ?? 'Failed to create endpoint.' }
  }
}

const updateEndpoint = async (e: GrafanaEndpoint): Promise<{ ok: boolean; error?: string }> => {
  try {
    await rest.put(`${endpoint}/${e.id}`, e)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.message ?? 'Failed to update endpoint.' }
  }
}

const deleteEndpoint = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`${endpoint}/${id}`)
    return true
  } catch { return false }
}

const verifyEndpoint = async (e: GrafanaEndpoint): Promise<{ ok: boolean; error?: string }> => {
  try {
    await rest.post(`${endpoint}/verify`, e)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.message ?? 'Could not connect to Grafana endpoint.' }
  }
}

export { listEndpoints, createEndpoint, updateEndpoint, deleteEndpoint, verifyEndpoint }
