import { rest } from './axiosInstances'
import { SnmpInfo } from '@/types'

const getSnmpConfig = async (ipAddress: string, location?: string): Promise<SnmpInfo | null> => {
  try {
    const params: Record<string, string> = {}
    if (location && location !== 'Default') params.location = location
    const resp = await rest.get<SnmpInfo>(`/snmpConfig/${encodeURIComponent(ipAddress)}`, {
      params,
      headers: { Accept: 'application/json' }
    })
    return resp.data
  } catch { return null }
}

const saveSnmpConfig = async (
  firstIp: string,
  lastIp: string | null,
  info: SnmpInfo
): Promise<boolean> => {
  try {
    const ipKey = lastIp && lastIp.trim() ? `${firstIp}-${lastIp.trim()}` : firstIp
    await rest.put(`/snmpConfig/${encodeURIComponent(ipKey)}`, info, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

export { getSnmpConfig, saveSnmpConfig }
