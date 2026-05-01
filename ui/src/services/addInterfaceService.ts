import { rest } from './axiosInstances'

const addInterface = async (nodeId: number, ipAddress: string, isManaged: 'M' | 'U'): Promise<boolean> => {
  try {
    await rest.post(
      `/nodes/${nodeId}/ipinterfaces`,
      `<ipInterface isManaged="${isManaged}"><ipAddress>${ipAddress}</ipAddress></ipInterface>`,
      { headers: { 'Content-Type': 'application/xml' } }
    )
    return true
  } catch { return false }
}

export { addInterface }
