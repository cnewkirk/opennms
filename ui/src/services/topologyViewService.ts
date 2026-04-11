/**
 * Topology view persistence service.
 * Currently returns empty stubs — the REST endpoint does not yet exist.
 * When the server-side API is ready, replace these with real REST calls.
 */
import type { TopologyView } from '@/types/topology'

export const getSharedViews = async (): Promise<TopologyView[]> => {
  return []
}

export const getGlobalView = async (): Promise<TopologyView | null> => {
  return null
}

export const saveView = async (_view: Omit<TopologyView, 'id'>): Promise<TopologyView> => {
  throw new Error('Server-side view persistence not yet implemented')
}

export const deleteView = async (_id: string): Promise<void> => {
  // no-op until REST endpoint exists
}
