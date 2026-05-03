import { rest } from './axiosInstances'

export interface Notification {
  notifyId: number
  textMsg: string
  numericMsg?: string | null
  answerTime?: number | null
  respondTime?: number | null
  pageTime: number
  nodeId?: number
  nodeLabel?: string
  ipAddress?: string
}

const getNotifications = async (
  params?: Record<string, unknown>
): Promise<{ notifications: Notification[]; totalCount: number }> => {
  try {
    const r = await rest.get('/notifications', {
      headers: { Accept: 'application/json' },
      params
    })
    const raw = r.data.notification
    return {
      notifications: Array.isArray(raw) ? raw : raw ? [raw] : [],
      totalCount: r.data.totalCount ?? 0
    }
  } catch {
    return { notifications: [], totalCount: 0 }
  }
}

const getNotification = async (id: number): Promise<Notification | null> => {
  try {
    const r = await rest.get(`/notifications/${id}`, {
      headers: { Accept: 'application/json' }
    })
    return r.data
  } catch {
    return null
  }
}

const acknowledgeNotifications = async (ids: number[]): Promise<boolean> => {
  try {
    await rest.post('/acks', { notifIds: ids, action: 'ack' })
    return true
  } catch {
    return false
  }
}

export { getNotifications, getNotification, acknowledgeNotifications }
