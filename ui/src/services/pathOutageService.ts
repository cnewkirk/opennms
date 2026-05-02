import { v2 } from '@/services/axiosInstances'

export interface PathOutage {
  nodeId: number
  nodeLabel?: string
  criticalPathIp: string
  criticalPathServiceName: string
}

const normalize = (raw: unknown): PathOutage[] => {
  if (Array.isArray(raw)) return raw
  if (raw) return [raw as PathOutage]
  return []
}

export const getPathOutages = async (): Promise<PathOutage[]> => {
  const resp = await v2.get('/path-outages')
  return normalize(resp.data)
}

export const getPathOutage = async (nodeId: number): Promise<PathOutage> => {
  const resp = await v2.get(`/path-outages/${nodeId}`)
  return resp.data
}

export const getPathOutageDependents = async (nodeId: number): Promise<number[]> => {
  const resp = await v2.get(`/path-outages/${nodeId}/dependents`)
  const raw = resp.data
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const savePathOutage = async (outage: PathOutage): Promise<PathOutage> => {
  const resp = await v2.post('/path-outages', outage)
  return resp.data
}

export const deletePathOutage = async (nodeId: number): Promise<void> => {
  await v2.delete(`/path-outages/${nodeId}`)
}
