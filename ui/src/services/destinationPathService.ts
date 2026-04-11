import { v2 } from './axiosInstances'

export interface TargetDTO {
  name: string
  interval?: string | null
  autoNotify?: string | null
  commands: string[]
}

export interface EscalateDTO {
  delay: string
  targets: TargetDTO[]
}

export interface DestinationPathDTO {
  name: string
  initialDelay?: string | null
  targets: TargetDTO[]
  escalates?: EscalateDTO[]
}

const normalizeArray = <T>(raw: T[] | T | undefined | null): T[] => {
  if (Array.isArray(raw)) return raw
  if (raw != null) return [raw]
  return []
}

const normalizeTarget = (t: TargetDTO): TargetDTO => ({
  ...t,
  commands: normalizeArray(t.commands)
})

const normalizeEscalate = (e: EscalateDTO): EscalateDTO => ({
  ...e,
  targets: normalizeArray(e.targets).map(normalizeTarget)
})

const normalizePath = (p: DestinationPathDTO): DestinationPathDTO => ({
  ...p,
  targets: normalizeArray(p.targets).map(normalizeTarget),
  escalates: normalizeArray(p.escalates).map(normalizeEscalate)
})

const getDestinationPaths = async (): Promise<DestinationPathDTO[]> => {
  try {
    const resp = await v2.get<{ paths: DestinationPathDTO[] | DestinationPathDTO }>('/destinationPaths')
    return normalizeArray(resp.data.paths).map(normalizePath)
  } catch { return [] }
}

const getDestinationPath = async (name: string): Promise<DestinationPathDTO | null> => {
  try {
    const resp = await v2.get<DestinationPathDTO>(`/destinationPaths/${encodeURIComponent(name)}`)
    return normalizePath(resp.data)
  } catch { return null }
}

const createDestinationPath = async (path: DestinationPathDTO): Promise<boolean> => {
  try {
    await v2.post('/destinationPaths', path, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

const saveDestinationPath = async (name: string, path: DestinationPathDTO): Promise<boolean> => {
  try {
    await v2.put(`/destinationPaths/${encodeURIComponent(name)}`, path, {
      headers: { 'Content-Type': 'application/json' }
    })
    return true
  } catch { return false }
}

const deleteDestinationPath = async (name: string): Promise<boolean> => {
  try {
    await v2.delete(`/destinationPaths/${encodeURIComponent(name)}`)
    return true
  } catch { return false }
}

export default {
  getDestinationPaths,
  getDestinationPath,
  createDestinationPath,
  saveDestinationPath,
  deleteDestinationPath
}
