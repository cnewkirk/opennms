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

export interface DetectRequest {
  serviceName: string
  connection: string
  authenticate: boolean
  user: string | null
  password: string | null
  skipDefaultVM: boolean
  skipNonNumber: boolean
}

export interface MBeanAttributeDto {
  name: string
  alias: string
  type: string
  include: boolean
}

export interface MBeanDto {
  objectName: string
  name: string
  include: boolean
  attributes: MBeanAttributeDto[]
}

export interface DetectJobStatus {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR'
  mbeans: MBeanDto[]
  error: string | null
}

export interface GenerateRequest {
  serviceName: string
  outputFileName: string
  saveToServer: boolean
  overwrite: boolean
  mbeans: MBeanDto[]
}

export interface GenerateResponse {
  xml: string
  savedPath: string | null
}

const BASE = 'jmx-config'

export const startDetect = async (request: DetectRequest): Promise<string> => {
  const resp = await v2.post(`${BASE}/detect`, request)
  return resp.data.jobId as string
}

export const pollDetect = async (jobId: string): Promise<DetectJobStatus> => {
  const resp = await v2.get(`${BASE}/detect/${jobId}`)
  return resp.data as DetectJobStatus
}

export const generate = async (request: GenerateRequest): Promise<GenerateResponse> => {
  const resp = await v2.post(`${BASE}/generate`, request)
  return resp.data as GenerateResponse
}
