import { rest } from './axiosInstances'

export interface NodeSummary {
  id: number
  label: string
  foreignSource?: string
  foreignId?: string
}

const searchNodes = async (query: string): Promise<NodeSummary[] | false> => {
  try {
    const params: Record<string, string | number> = { limit: 25, orderBy: 'label', comparator: 'label' }
    if (query) params['label'] = `%${query}%`
    const resp = await rest.get('/nodes', { params, headers: { Accept: 'application/json' } })
    const raw = resp.data.node
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

const deleteNode = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`/nodes/${id}`)
    return true
  } catch { return false }
}

export { searchNodes, deleteNode }
