import { v2 } from './axiosInstances'

export interface Application {
  id: number
  name: string
  perspectiveLocations: string[]
}

const endpoint = '/applications'

const getApplications = async (): Promise<Application[] | false> => {
  try {
    const resp = await v2.get(endpoint, { params: { limit: 0 } })
    if (resp.status === 204) return []
    const raw = resp.data.application
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

const createApplication = async (name: string): Promise<boolean> => {
  try {
    await v2.post(endpoint, { name }, { headers: { 'Content-Type': 'application/json' } })
    return true
  } catch { return false }
}

const deleteApplication = async (id: number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${id}`)
    return true
  } catch { return false }
}

export { getApplications, createApplication, deleteApplication }
