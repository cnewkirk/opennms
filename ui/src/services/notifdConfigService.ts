import { v2 } from './axiosInstances'

export interface NotifdStatus {
  status: 'on' | 'off'
}

const getStatus = async (): Promise<NotifdStatus | null> => {
  try {
    const resp = await v2.get<NotifdStatus>('/notifd/status')
    return resp.data
  } catch { return null }
}

const setStatus = async (status: 'on' | 'off'): Promise<boolean> => {
  try {
    await v2.post('/notifd/status', { status }, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

export default { getStatus, setStatus }
