import { v2 } from './axiosInstances'

export interface ServiceCollectorEntry {
  serviceId: string
  parsedServiceId: string
  collectionCount: number
  successfulCollectionCount: number
  errorCollectionCount: number
  successPercentage: number
  errorPercentage: number
  avgCollectionTimeMs: number
  avgTimeBetweenCollectionsMs: number
  avgErrorCollectionTimeMs: number
  avgPersistTimeMs: number
  totalPersistTimeMs: number
}

export type SortColumn = 'TOTALCOLLECTS' | 'AVGCOLLECTTIME' | 'AVGTIMEBETWEENCOLLECTS'
  | 'TOTALSUCCESSCOLLECTS' | 'AVGSUCCESSCOLLECTTIME' | 'TOTALERRORS'
  | 'AVGERRORTIME' | 'AVGPERSISTTIME' | 'TOTALPERSISTTIME'

export type SortOrder = 'ASCENDING' | 'DESCENDING'

export const getInstrumentationLog = async (params?: {
  search?: string
  sortColumn?: SortColumn
  sortOrder?: SortOrder
}): Promise<ServiceCollectorEntry[]> => {
  const resp = await v2.get<ServiceCollectorEntry[]>('/instrumentation-log', { params })
  return resp.data
}
