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

export interface GroupFileMeta {
  filename: string
  groupName: string | null
}

export interface SnmpCollectionEntry {
  name: string
  snmpStorageFlag: string
  rrdStep: number
  rras: string[]
  includeCollections: string[]
}

export interface SnmpCollectionsConfig {
  snmpCollections: SnmpCollectionEntry[]
}

const BASE_GROUPS = 'datacollection-groups'
const BASE_CONFIG = 'datacollection-config'

export const listGroupFiles = async (): Promise<GroupFileMeta[]> => {
  const resp = await v2.get<GroupFileMeta[]>(BASE_GROUPS)
  return resp.data
}

// CXF strips .xml extensions for content-type negotiation, so we omit .xml in the URL path.
// The server re-appends .xml when resolving the file.
const stripXml = (filename: string) => filename.endsWith('.xml') ? filename.slice(0, -4) : filename

export const getGroupFileXml = async (filename: string): Promise<string> => {
  const resp = await v2.get<{ filename: string; content: string }>(`${BASE_GROUPS}/${encodeURIComponent(stripXml(filename))}`)
  return resp.data.content
}

export const saveGroupFileXml = async (filename: string, xml: string): Promise<void> => {
  await v2.put(`${BASE_GROUPS}/${encodeURIComponent(stripXml(filename))}`, xml, {
    headers: { 'Content-Type': 'text/plain' }
  })
}

export const deleteGroupFile = async (filename: string): Promise<void> => {
  await v2.delete(`${BASE_GROUPS}/${encodeURIComponent(stripXml(filename))}`)
}

export const getSnmpCollections = async (): Promise<SnmpCollectionsConfig> => {
  const resp = await v2.get<SnmpCollectionsConfig>(BASE_CONFIG)
  return resp.data
}

export const saveSnmpCollections = async (collections: SnmpCollectionEntry[]): Promise<void> => {
  await v2.put(BASE_CONFIG, { snmpCollections: collections })
}

export const makeDefaultSnmpCollection = (): SnmpCollectionEntry => ({
  name: '',
  snmpStorageFlag: 'select',
  rrdStep: 300,
  rras: [
    'RRA:AVERAGE:0.5:1:2016',
    'RRA:AVERAGE:0.5:12:1488',
    'RRA:AVERAGE:0.5:288:366',
    'RRA:MAX:0.5:288:366',
    'RRA:MIN:0.5:288:366'
  ],
  includeCollections: []
})

export const makeNewGroupXml = (groupName = ''): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<datacollection-group xmlns="http://xmlns.opennms.org/xsd/config/datacollection"
                      name="${groupName}">
  <!-- Add resourceType, group, and systemDef elements here -->
</datacollection-group>`
