import { rest, v2 } from './axiosInstances'

export interface ManagedNode {
  id: string
  label: string
}

export interface ManagedInterface {
  id: string
  ipAddress: string
  isManaged: 'M' | 'U' | 'D'
  nodeId: number
}

export interface ManagedService {
  id: number
  status: 'A' | 'F' | 'N'
  serviceType: { name: string }
}

export const searchNodes = async (label: string): Promise<ManagedNode[]> => {
  const resp = await v2.get('/nodes', { params: { _s: `label==*${label}*`, limit: 10 } })
  const raw = resp.data.node
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const getInterfacesForNode = async (nodeId: string): Promise<ManagedInterface[]> => {
  const resp = await rest.get(`/nodes/${nodeId}/ipinterfaces`, { params: { limit: 0 } })
  const raw = resp.data.ipInterface
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const getServicesForInterface = async (nodeId: string, ip: string): Promise<ManagedService[]> => {
  const resp = await rest.get(`/nodes/${nodeId}/ipinterfaces/${ip}/services`, { params: { limit: 0 } })
  const raw = resp.data.service
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const setInterfaceManaged = async (nodeId: string, ip: string, managed: boolean): Promise<void> => {
  const params = new URLSearchParams({ isManaged: managed ? 'M' : 'U' })
  await rest.put(`/nodes/${nodeId}/ipinterfaces/${ip}`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}

export const setServiceManaged = async (ip: string, serviceName: string, managed: boolean): Promise<void> => {
  const params = new URLSearchParams({ status: managed ? 'A' : 'F', services: serviceName })
  await rest.put(
    `/ifservices?ipInterface.ipAddress=${encodeURIComponent(ip)}`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
}
