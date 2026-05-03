import { rest, v2 } from './axiosInstances'

export interface AssetRecord {
  id?: number
  category?: string
  manufacturer?: string
  modelNumber?: string
  serialNumber?: string
  description?: string
  operatingSystem?: string
  building?: string
  floor?: string
  room?: string
  rack?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  lastModifiedDate?: number
  lastModifiedBy?: string
}

const getAssetRecord = async (nodeId: number | string): Promise<AssetRecord | null> => {
  try {
    return (
      await rest.get(`/nodes/${nodeId}/assetRecord`, {
        headers: { Accept: 'application/json' }
      })
    ).data
  } catch {
    return null
  }
}

const updateAssetRecord = async (
  nodeId: number | string,
  record: Partial<AssetRecord>
): Promise<boolean> => {
  try {
    await rest.put(`/nodes/${nodeId}/assetRecord`, record)
    return true
  } catch {
    return false
  }
}

const getHardwareInventory = async (nodeId: number | string): Promise<any | null> => {
  try {
    return (
      await rest.get(`/nodes/${nodeId}/hardwareInventory`, {
        headers: { Accept: 'application/json' }
      })
    ).data
  } catch {
    return null
  }
}

export { getAssetRecord, updateAssetRecord, getHardwareInventory }
