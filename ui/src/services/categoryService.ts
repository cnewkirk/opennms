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

import { rest } from './axiosInstances'
import {
  CategoryApiResponse
} from '@/types'

const endpoint = '/categories'

const getCategories = async (): Promise<CategoryApiResponse | false> => {
  try {
    const resp = await rest.get(endpoint)

    // no content from server
    if (resp.status === 204) {
      return { category: [], totalCount: 0, count: 0, offset: 0 }
    }

    return resp.data
  } catch (err) {
    return false
  }
}

const createCategory = async (name: string): Promise<boolean> => {
  try {
    await rest.post(endpoint, `<category name="${name}"/>`, {
      headers: { 'Content-Type': 'application/xml' }
    })
    return true
  } catch { return false }
}

const updateCategory = async (id: number, name: string): Promise<boolean> => {
  try {
    await rest.put(`${endpoint}/${id}`, `<category name="${name}"/>`, {
      headers: { 'Content-Type': 'application/xml' }
    })
    return true
  } catch { return false }
}

const deleteCategory = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`${endpoint}/${id}`)
    return true
  } catch { return false }
}

export {
  getCategories, createCategory, updateCategory, deleteCategory
}
