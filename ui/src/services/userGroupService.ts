import { rest } from './axiosInstances'
import { OnmsUser, OnmsUsersApiResponse, OnmsGroup, OnmsGroupsApiResponse } from '@/types'

const escXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Users

const listUsers = async (): Promise<OnmsUser[] | false> => {
  try {
    const resp = await rest.get<OnmsUsersApiResponse>('/users')
    return [].concat(resp.data.user as any) as OnmsUser[]
  } catch { return false }
}

const createUser = async (user: { userId: string; fullName: string; email: string; comments: string; password: string }): Promise<boolean> => {
  const xml = `<user>
  <user-id>${escXml(user.userId)}</user-id>
  <full-name>${escXml(user.fullName)}</full-name>
  <user-comments>${escXml(user.comments)}</user-comments>
  <email>${escXml(user.email)}</email>
  <password>${escXml(user.password)}</password>
</user>`
  try {
    await rest.post('/users?hashPassword=true', xml, { headers: { 'Content-Type': 'application/xml' } })
    return true
  } catch { return false }
}

const updateUser = async (username: string, fields: { fullName?: string; email?: string; userComments?: string }): Promise<boolean> => {
  const params = new URLSearchParams()
  if (fields.fullName !== undefined) params.append('fullName', fields.fullName)
  if (fields.email !== undefined) params.append('email', fields.email)
  if (fields.userComments !== undefined) params.append('userComments', fields.userComments)
  try {
    await rest.put(`/users/${encodeURIComponent(username)}`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return true
  } catch { return false }
}

const changePassword = async (username: string, password: string): Promise<boolean> => {
  const params = new URLSearchParams({ password, hashPassword: 'true' })
  try {
    await rest.put(`/users/${encodeURIComponent(username)}`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return true
  } catch { return false }
}

const addUserRole = async (username: string, role: string): Promise<boolean> => {
  try {
    await rest.put(`/users/${encodeURIComponent(username)}/roles/${encodeURIComponent(role)}`)
    return true
  } catch { return false }
}

const removeUserRole = async (username: string, role: string): Promise<boolean> => {
  try {
    await rest.delete(`/users/${encodeURIComponent(username)}/roles/${encodeURIComponent(role)}`)
    return true
  } catch { return false }
}

const deleteUser = async (username: string): Promise<boolean> => {
  try {
    await rest.delete(`/users/${encodeURIComponent(username)}`)
    return true
  } catch { return false }
}

// Groups

const listGroups = async (): Promise<OnmsGroup[] | false> => {
  try {
    const resp = await rest.get<OnmsGroupsApiResponse>('/groups')
    return [].concat(resp.data.group as any) as OnmsGroup[]
  } catch { return false }
}

const createGroup = async (name: string, comments: string): Promise<boolean> => {
  const xml = `<group>
  <name>${escXml(name)}</name>
  <comments>${escXml(comments)}</comments>
</group>`
  try {
    await rest.post('/groups', xml, { headers: { 'Content-Type': 'application/xml' } })
    return true
  } catch { return false }
}

const deleteGroup = async (name: string): Promise<boolean> => {
  try {
    await rest.delete(`/groups/${encodeURIComponent(name)}`)
    return true
  } catch { return false }
}

const addGroupUser = async (groupName: string, userName: string): Promise<boolean> => {
  try {
    await rest.put(`/groups/${encodeURIComponent(groupName)}/users/${encodeURIComponent(userName)}`)
    return true
  } catch { return false }
}

const removeGroupUser = async (groupName: string, userName: string): Promise<boolean> => {
  try {
    await rest.delete(`/groups/${encodeURIComponent(groupName)}/users/${encodeURIComponent(userName)}`)
    return true
  } catch { return false }
}

export {
  listUsers, createUser, updateUser, changePassword,
  addUserRole, removeUserRole, deleteUser,
  listGroups, createGroup, deleteGroup, addGroupUser, removeGroupUser
}
