import { v2 } from '@/services/axiosInstances'
import { TopologyView } from '@/types/topology'

/** Wire format from/to the Java REST backend — stateJson is a serialized string, not an object */
interface TopologyViewWire {
  id: string
  name: string
  description?: string
  scope: 'global' | 'shared' | 'user' | 'private'
  owner: string
  stateJson: string
  createdAt: string
  updatedAt: string
}

function toWire(view: Omit<TopologyView, 'id' | 'createdAt' | 'updatedAt'> | TopologyView): TopologyViewWire {
  const { state, ...rest } = view as TopologyView
  return { ...rest, stateJson: JSON.stringify(state) } as TopologyViewWire
}

function fromWire(wire: TopologyViewWire): TopologyView {
  const { stateJson, ...rest } = wire
  return { ...rest, state: JSON.parse(stateJson) } as TopologyView
}

export const getSharedViews = async (): Promise<TopologyView[]> => {
  const resp = await v2.get<TopologyViewWire[]>('/topology/views')
  return (resp.data ?? []).map(fromWire)
}

export const getGlobalView = async (): Promise<TopologyView | null> => {
  try {
    const resp = await v2.get<TopologyViewWire>('/topology/views?scope=global')
    return resp.data ? fromWire(resp.data) : null
  } catch (e: unknown) {
    if ((e as { response?: { status: number } })?.response?.status === 404) return null
    throw e
  }
}

export const createView = async (view: Omit<TopologyView, 'id' | 'createdAt' | 'updatedAt'>): Promise<TopologyView> => {
  const resp = await v2.post<TopologyViewWire>('/topology/views', toWire(view as TopologyView))
  return fromWire(resp.data)
}

export const updateView = async (view: TopologyView): Promise<TopologyView> => {
  const resp = await v2.put<TopologyViewWire>(`/topology/views/${view.id}`, toWire(view))
  return fromWire(resp.data)
}

export const deleteView = async (id: string): Promise<void> => {
  await v2.delete(`/topology/views/${id}`)
}
