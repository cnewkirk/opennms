import { rest } from './axiosInstances'

export interface KscGraph {
  title: string
  resourceId: string
  graphtype: string
  timespan: string
}

export interface KscReport {
  id: number
  label: string
  graphs_per_line: number
  kscGraph: KscGraph[]
}

export interface KscReportList {
  kscReport: KscReport[]
  totalCount: number
}

const getReports = async (): Promise<KscReport[]> => {
  try {
    const r = await rest.get('/ksc', { headers: { Accept: 'application/json' } })
    const raw = r.data.kscReport
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch {
    return []
  }
}

const getReport = async (id: number): Promise<KscReport | null> => {
  try {
    const r = await rest.get(`/ksc/${id}`, { headers: { Accept: 'application/json' } })
    return r.data
  } catch {
    return null
  }
}

const createReport = async (label: string): Promise<boolean> => {
  try {
    await rest.post('/ksc', { label, graphs_per_line: 1 }, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch {
    return false
  }
}

export { getReports, getReport, createReport }
