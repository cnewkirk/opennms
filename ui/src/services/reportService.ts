import { rest } from './axiosInstances'

export interface ReportDefinition {
  id: string
  name: string
  description: string
  online: boolean
  allowAccess: boolean
}

const getReportDefinitions = async (): Promise<ReportDefinition[]> => {
  try {
    const r = await rest.get('/reports', { headers: { Accept: 'application/json' } })
    return Array.isArray(r.data) ? r.data : []
  } catch {
    return []
  }
}

export { getReportDefinitions }
