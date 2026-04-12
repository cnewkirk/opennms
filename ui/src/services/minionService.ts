import { v2 } from './axiosInstances'
import type { Minion, MinionApiResponse } from '@/types'

const endpoint = '/minions'

export const getMinions = async (params?: { limit?: number; offset?: number; orderBy?: string; order?: string }): Promise<MinionApiResponse | false> => {
  try {
    const resp = await v2.get(endpoint, { params: { limit: 0, ...params } })
    if (resp.status === 204) return { count: 0, offset: 0, totalCount: 0, minion: [] }
    const data = resp.data as MinionApiResponse
    const raw = data.minion
    data.minion = Array.isArray(raw) ? raw : raw ? [raw] : []
    return data
  } catch (err) {
    return false
  }
}

export const updateMinion = async (id: string, patch: { label?: string; location?: string }): Promise<boolean> => {
  try {
    await v2.put(`${endpoint}/${encodeURIComponent(id)}`, patch)
    return true
  } catch (err) {
    return false
  }
}

export const deleteMinion = async (id: string): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${encodeURIComponent(id)}`)
    return true
  } catch (err) {
    return false
  }
}

export const getMinionNodes = async (minionIds: string[]): Promise<Record<string, number>> => {
  if (!minionIds.length) return {}
  try {
    const q = minionIds.map(id => `foreignId==${id}`).join(',')
    const resp = await v2.get('/nodes', { params: { _s: q, limit: minionIds.length } })
    const nodes: Array<{ id: number; foreignId: string; location: string }> = resp.data?.node ?? []
    const map: Record<string, number> = {}
    for (const n of (Array.isArray(nodes) ? nodes : [nodes])) {
      map[`${n.foreignId}\0${n.location}`] = n.id
    }
    return map
  } catch {
    return {}
  }
}
