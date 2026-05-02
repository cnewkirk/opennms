import { v2 } from '@/services/axiosInstances'

export interface OnCallRole {
  name: string
  'membership-group': string
  supervisor: string
  description?: string
  schedule?: unknown[]
}

const normalizeRoles = (raw: unknown): OnCallRole[] => {
  const data = (raw as Record<string, unknown>)?.role ?? raw
  if (Array.isArray(data)) return data
  if (data) return [data as OnCallRole]
  return []
}

export const getRoles = async (): Promise<OnCallRole[]> => {
  const resp = await v2.get('/on-call-roles')
  return normalizeRoles(resp.data)
}

export const getRole = async (name: string): Promise<OnCallRole> => {
  const resp = await v2.get(`/on-call-roles/${encodeURIComponent(name)}`)
  return resp.data
}

export const createRole = async (role: OnCallRole): Promise<OnCallRole> => {
  const resp = await v2.post('/on-call-roles', role)
  return resp.data
}

export const updateRole = async (name: string, role: OnCallRole): Promise<OnCallRole> => {
  const resp = await v2.put(`/on-call-roles/${encodeURIComponent(name)}`, role)
  return resp.data
}

export const deleteRole = async (name: string): Promise<void> => {
  await v2.delete(`/on-call-roles/${encodeURIComponent(name)}`)
}
