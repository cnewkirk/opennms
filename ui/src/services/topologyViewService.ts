import { rest } from './axiosInstances'
import type { TopologyView, TopologyViewState } from '@/types/topology'

export const getViews = async (): Promise<TopologyView[]> => {
  try {
    const res = await rest.get<TopologyView[]>('/topology/views')
    return res.data ?? []
  } catch {
    return []
  }
}

export const getView = async (id: string): Promise<TopologyView | null> => {
  try {
    const res = await rest.get<TopologyView>(`/topology/views/${id}`)
    return res.data
  } catch {
    return null
  }
}

export const createView = async (
  view: Omit<TopologyView, 'id' | 'created' | 'updated'>
): Promise<TopologyView> => {
  const res = await rest.post<TopologyView>('/topology/views', view)
  return res.data
}

export const updateView = async (id: string, view: TopologyView): Promise<TopologyView> => {
  const res = await rest.put<TopologyView>(`/topology/views/${id}`, view)
  return res.data
}

export const deleteView = async (id: string): Promise<void> => {
  await rest.delete(`/topology/views/${id}`)
}
