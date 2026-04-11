import { rest } from './axiosInstances'
import { SchedOutage, SchedOutagesApiResponse } from '@/types'

const endpoint = '/sched-outages'

const listSchedOutages = async (): Promise<SchedOutage[] | false> => {
  try {
    const resp = await rest.get<SchedOutagesApiResponse>(endpoint)
    return resp.data.outage ?? []
  } catch { return false }
}

const getSchedOutage = async (name: string): Promise<SchedOutage | false> => {
  try {
    const resp = await rest.get<SchedOutage>(`${endpoint}/${encodeURIComponent(name)}`)
    return resp.data
  } catch { return false }
}

const saveSchedOutage = async (outage: SchedOutage, isNew: boolean): Promise<boolean> => {
  const xml = buildOutageXml(outage)
  try {
    if (isNew) {
      await rest.post(endpoint, xml, { headers: { 'Content-Type': 'application/xml' } })
    } else {
      await rest.put(`${endpoint}/${encodeURIComponent(outage.name)}`, xml, {
        headers: { 'Content-Type': 'application/xml' }
      })
    }
    return true
  } catch { return false }
}

const deleteSchedOutage = async (name: string): Promise<boolean> => {
  try {
    await rest.delete(`${endpoint}/${encodeURIComponent(name)}`)
    return true
  } catch { return false }
}

const buildOutageXml = (outage: SchedOutage): string => {
  const times = outage.time.map(t => {
    const dayAttr = t.day ? ` day="${t.day}"` : ''
    return `  <time${dayAttr} begins="${t.begins}" ends="${t.ends}"/>`
  }).join('\n')

  const nodes = outage.node.map(n => `  <node id="${n.id}"/>`).join('\n')
  const ifaces = outage.interface.map(i => `  <interface address="${i.address}"/>`).join('\n')

  const inner = [times, nodes, ifaces].filter(Boolean).join('\n')
  return `<outage name="${escapeXml(outage.name)}" type="${outage.type}">\n${inner}\n</outage>`
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export { listSchedOutages, getSchedOutage, saveSchedOutage, deleteSchedOutage }
