import { rest } from './axiosInstances'

export interface SnmpInterface {
  id: number
  ifIndex: number
  ifName: string | null
  ifDescr: string | null
  ifAlias: string | null
  ifSpeed: number | null
  ifType: number | null
  ifAdminStatus: number | null
  ifOperStatus: number | null
  physAddr: string | null
  collect: boolean
  collectFlag: 'C' | 'N' | 'U'
  poll: boolean
  pollFlag: 'P' | 'N' | 'U'
  nodeId: number
  hasFlows: boolean
  collectionUserSpecified: boolean
  collectionPolicySpecified: boolean
}

export interface SnmpInterfaceListResponse {
  snmpInterface: SnmpInterface | SnmpInterface[]
  count: number
  totalCount: number
  offset: number
}

export const getSnmpInterfaces = async (nodeId: string | number): Promise<SnmpInterface[]> => {
  const resp = await rest.get<SnmpInterfaceListResponse>(`/nodes/${nodeId}/snmpinterfaces`, {
    params: { limit: 0 }
  })
  const raw = resp.data.snmpInterface
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const setSnmpCollect = async (
  nodeId: string | number,
  ifIndex: number,
  collect: boolean
): Promise<void> => {
  const params = new URLSearchParams({ collect: collect ? 'C' : 'N' })
  await rest.put(`/nodes/${nodeId}/snmpinterfaces/${ifIndex}`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}
