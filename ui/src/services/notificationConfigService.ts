import { v2 } from './axiosInstances'

export interface VarbindDTO {
  vbname: string
  vbvalue: string
}

export interface ParameterDTO {
  name: string
  value: string
}

export interface NotificationConfigDTO {
  name: string
  status: 'on' | 'off'
  writeable?: boolean
  uei: string
  description?: string | null
  rule: string
  destinationPath: string
  textMessage: string
  subject?: string | null
  numericMessage?: string | null
  eventSeverity?: string | null
  noticeQueue?: string | null
  varbind?: VarbindDTO | null
  parameters?: ParameterDTO[]
}

const normalizeArray = <T>(raw: T[] | T | undefined | null): T[] => {
  if (Array.isArray(raw)) return raw
  if (raw != null) return [raw]
  return []
}

const getNotificationConfigs = async (): Promise<NotificationConfigDTO[]> => {
  try {
    const resp = await v2.get<{ notifications: NotificationConfigDTO[] | NotificationConfigDTO }>('/notificationConfig')
    return normalizeArray(resp.data.notifications)
  } catch { return [] }
}

const getNotificationConfig = async (name: string): Promise<NotificationConfigDTO | null> => {
  try {
    const resp = await v2.get<NotificationConfigDTO>(`/notificationConfig/${encodeURIComponent(name)}`)
    return resp.data
  } catch { return null }
}

const createNotificationConfig = async (config: NotificationConfigDTO): Promise<boolean> => {
  try {
    await v2.post('/notificationConfig', config, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

const saveNotificationConfig = async (name: string, config: NotificationConfigDTO): Promise<boolean> => {
  try {
    await v2.put(`/notificationConfig/${encodeURIComponent(name)}`, config, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

const deleteNotificationConfig = async (name: string): Promise<boolean> => {
  try {
    await v2.delete(`/notificationConfig/${encodeURIComponent(name)}`)
    return true
  } catch { return false }
}

const toggleNotificationConfig = async (name: string): Promise<boolean> => {
  try {
    await v2.post(`/notificationConfig/${encodeURIComponent(name)}/toggle`)
    return true
  } catch { return false }
}

const reloadNotifications = async (): Promise<boolean> => {
  try {
    await v2.post('/notificationConfig/reload')
    return true
  } catch { return false }
}

export default {
  getNotificationConfigs,
  getNotificationConfig,
  createNotificationConfig,
  saveNotificationConfig,
  deleteNotificationConfig,
  toggleNotificationConfig,
  reloadNotifications
}
