import { rest } from './axiosInstances'
import type { ClassificationGroup, ClassificationRule, Protocol } from '@/types'

const getGroups = async (): Promise<ClassificationGroup[] | false> => {
  try {
    const resp = await rest.get('/classifications/groups', { headers: { Accept: 'application/json' } })
    const raw = resp.data
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

const createGroup = async (g: Partial<ClassificationGroup>): Promise<boolean> => {
  try {
    await rest.post('/classifications/groups', g)
    return true
  } catch { return false }
}

const updateGroup = async (id: number, g: Partial<ClassificationGroup>): Promise<boolean> => {
  try {
    await rest.put(`/classifications/groups/${id}`, g)
    return true
  } catch { return false }
}

const deleteGroup = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`/classifications/groups/${id}`)
    return true
  } catch { return false }
}

const getRules = async (params: {
  groupId?: number
  limit?: number
  offset?: number
  query?: string
}): Promise<{ rules: ClassificationRule[]; total: number }> => {
  try {
    const p: Record<string, string | number> = {
      limit: params.limit ?? 25,
      offset: params.offset ?? 0,
    }
    if (params.groupId !== undefined) p['groupId'] = params.groupId
    if (params.query) p['query'] = params.query

    const resp = await rest.get('/classifications', { params: p, headers: { Accept: 'application/json' } })
    const range = resp.headers['content-range'] as string | undefined
    const total = range ? parseInt(range.split('/')[1] ?? '0', 10) : 0
    const raw = resp.data
    const rules: ClassificationRule[] = Array.isArray(raw) ? raw : raw ? [raw] : []
    return { rules, total }
  } catch { return { rules: [], total: 0 } }
}

const createRule = async (rule: Partial<ClassificationRule>): Promise<boolean> => {
  try {
    await rest.post('/classifications', rule)
    return true
  } catch { return false }
}

const updateRule = async (id: number, rule: Partial<ClassificationRule>): Promise<boolean> => {
  try {
    await rest.put(`/classifications/${id}`, rule)
    return true
  } catch { return false }
}

const deleteRule = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`/classifications/${id}`)
    return true
  } catch { return false }
}

const deleteAllRulesInGroup = async (groupId: number): Promise<boolean> => {
  try {
    await rest.delete('/classifications', { params: { groupId } })
    return true
  } catch { return false }
}

const getProtocols = async (): Promise<Protocol[] | false> => {
  try {
    const resp = await rest.get('/classifications/protocols', { headers: { Accept: 'application/json' } })
    const raw = resp.data
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

export {
  getGroups, createGroup, updateGroup, deleteGroup,
  getRules, createRule, updateRule, deleteRule, deleteAllRulesInGroup,
  getProtocols,
}
