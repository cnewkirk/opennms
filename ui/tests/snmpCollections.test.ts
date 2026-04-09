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

import { describe, it, expect } from 'vitest'
import {
  makeDefaultSnmpCollection,
  makeNewGroupXml,
  type GroupFileMeta,
  type SnmpCollectionEntry
} from '@/services/snmpCollectionsService'

describe('snmpCollectionsService', () => {
  describe('makeDefaultSnmpCollection', () => {
    it('returns an entry with sensible defaults', () => {
      const col = makeDefaultSnmpCollection()
      expect(col.name).toBe('')
      expect(col.snmpStorageFlag).toBe('select')
      expect(col.rrdStep).toBe(300)
      expect(col.rras).toHaveLength(5)
      expect(col.rras[0]).toMatch(/^RRA:AVERAGE/)
      expect(col.includeCollections).toEqual([])
    })
  })

  describe('makeNewGroupXml', () => {
    it('returns a valid datacollection-group XML template', () => {
      const xml = makeNewGroupXml('test-group')
      expect(xml).toContain('<datacollection-group')
      expect(xml).toContain('name="test-group"')
      expect(xml).toContain('xmlns="http://xmlns.opennms.org/xsd/config/datacollection"')
    })
  })

  describe('types', () => {
    it('GroupFileMeta has filename and groupName fields', () => {
      const meta: GroupFileMeta = { filename: 'cisco.xml', groupName: 'Cisco' }
      expect(meta.filename).toBe('cisco.xml')
      expect(meta.groupName).toBe('Cisco')
    })

    it('SnmpCollectionEntry has all required fields', () => {
      const entry: SnmpCollectionEntry = {
        name: 'default',
        snmpStorageFlag: 'select',
        rrdStep: 300,
        rras: [],
        includeCollections: []
      }
      expect(entry.name).toBe('default')
    })
  })
})
