///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { v2 } from './axiosInstances'
import axios from 'axios'

// File upload needs multipart content type against the v2 endpoint
const v2File = axios.create({
  baseURL: import.meta.env.VITE_BASE_V2_URL?.toString() || '/opennms/api/v2',
  withCredentials: true,
  headers: { 'Content-Type': 'multipart/form-data' }
})

export interface MibListResponse {
  pending: string[]
  compiled: string[]
}

export interface MibContentResponse {
  filename: string
  content: string
}

export interface MibJobStatus {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR'
  jobType: 'COMPILE' | 'GENERATE_EVENTS' | 'GENERATE_DATACOLLECTION'
  mibName: string | null
  error: string | null
  missingDependencies: string[] | null
  eventsXml: string | null
  eventCount: number
  datacollectionXml: string | null
  groupCount: number
  graphTemplates: string | null
  suggestedFileName: string | null
}

export interface SaveResponse {
  savedPath: string
  graphPath?: string
}

const BASE = 'mib-compiler'

export const listMibs = async (): Promise<MibListResponse> => {
  const resp = await v2.get(`${BASE}/mibs`)
  return resp.data as MibListResponse
}

export const uploadMib = async (file: File): Promise<{ filename: string; folder: string }> => {
  const form = new FormData()
  form.append('file', file)
  const resp = await v2File.post(`${BASE}/upload`, form)
  return resp.data
}

export const getMibContent = async (folder: string, filename: string): Promise<MibContentResponse> => {
  const resp = await v2.get(`${BASE}/mibs/${folder}/${encodeURIComponent(filename)}`)
  return resp.data as MibContentResponse
}

export const saveMibContent = async (filename: string, content: string): Promise<void> => {
  await v2.put(`${BASE}/mibs/pending/${encodeURIComponent(filename)}`, { content })
}

export const deleteMib = async (folder: string, filename: string): Promise<void> => {
  await v2.delete(`${BASE}/mibs/${folder}/${encodeURIComponent(filename)}`)
}

export const startCompile = async (filename: string): Promise<string> => {
  const resp = await v2.post(`${BASE}/compile`, { filename })
  return resp.data.jobId as string
}

export const pollCompile = async (jobId: string): Promise<MibJobStatus> => {
  const resp = await v2.get(`${BASE}/compile/${jobId}`)
  return resp.data as MibJobStatus
}

export const startGenerateEvents = async (filename: string, ueiBase: string): Promise<string> => {
  const resp = await v2.post(`${BASE}/generate-events`, { filename, ueiBase })
  return resp.data.jobId as string
}

export const pollGenerateEvents = async (jobId: string): Promise<MibJobStatus> => {
  const resp = await v2.get(`${BASE}/generate-events/${jobId}`)
  return resp.data as MibJobStatus
}

export const saveEvents = async (fileName: string, eventsXml: string, overwrite: boolean): Promise<SaveResponse> => {
  const resp = await v2.post(`${BASE}/save-events`, { fileName, eventsXml, overwrite })
  return resp.data as SaveResponse
}

export const startGenerateDataCollection = async (filename: string): Promise<string> => {
  const resp = await v2.post(`${BASE}/generate-datacollection`, { filename })
  return resp.data.jobId as string
}

export const pollGenerateDataCollection = async (jobId: string): Promise<MibJobStatus> => {
  const resp = await v2.get(`${BASE}/generate-datacollection/${jobId}`)
  return resp.data as MibJobStatus
}

export const saveDataCollection = async (
  fileName: string,
  datacollectionXml: string,
  graphTemplates: string | null,
  overwrite: boolean
): Promise<SaveResponse> => {
  const resp = await v2.post(`${BASE}/save-datacollection`, {
    fileName,
    datacollectionXml,
    graphTemplates,
    overwrite
  })
  return resp.data as SaveResponse
}
