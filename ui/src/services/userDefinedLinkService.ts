import { v2 } from './axiosInstances'

export interface UserDefinedLinkPayload {
  'node-id-a': number
  'component-label-a': string
  'node-id-z': number
  'component-label-z': string
  'link-id': string
  'link-label': string
  'owner': string
}

export interface UserDefinedLinkResponse extends UserDefinedLinkPayload {
  'db-id': number
}

const endpoint = '/userdefinedlinks'

const getUserDefinedLinks = async (): Promise<UserDefinedLinkResponse[]> => {
  try {
    const resp = await v2.get(endpoint)
    if (resp.status === 204) return []
    return resp.data?.['user_defined_link'] ?? []
  } catch {
    return []
  }
}

const createUserDefinedLink = async (link: UserDefinedLinkPayload): Promise<number | null> => {
  try {
    const resp = await v2.post(endpoint, link)
    // Location header: .../userdefinedlinks/{id}
    const loc = resp.headers?.location ?? ''
    const id = parseInt(loc.substring(loc.lastIndexOf('/') + 1), 10)
    return isNaN(id) ? null : id
  } catch {
    return null
  }
}

const deleteUserDefinedLink = async (dbId: number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${dbId}`)
    return true
  } catch {
    return false
  }
}

export { getUserDefinedLinks, createUserDefinedLink, deleteUserDefinedLink }
