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
import { OutagesApiResponse } from '@/types'

const endpoint = '/outages'

/**
 * Builds a FIQL search string for active outages, optionally filtered by node categories.
 * Active outages are those where ifRegainedService is null (service still down).
 * Multiple categories are OR'd together.
 */
const buildActiveOutageCriteria = (categories: string[]): string => {
  const parts = ['ifRegainedService==null']
  if (categories.length === 1) {
    parts.push(`node.categories.name==${categories[0]}`)
  } else if (categories.length > 1) {
    const catClause = categories.map(c => `node.categories.name==${c}`).join(',')
    parts.push(`(${catClause})`)
  }
  return parts.join(';')
}

const getOutages = async (params: Record<string, string | number>): Promise<OutagesApiResponse | false> => {
  try {
    const resp = await v2.get(endpoint, { params })
    if (resp.status === 204) {
      return { outage: [], totalCount: 0, count: 0, offset: 0 }
    }
    return resp.data
  } catch {
    return false
  }
}

const getActiveOutages = async (categories: string[], limit = 10, offset = 0): Promise<OutagesApiResponse | false> => {
  return getOutages({ _s: buildActiveOutageCriteria(categories), limit, offset })
}

const getActiveOutageCount = async (categories: string[]): Promise<number> => {
  const resp = await getOutages({ _s: buildActiveOutageCriteria(categories), limit: 0 })
  return resp ? resp.totalCount : 0
}

export { getOutages, getActiveOutages, getActiveOutageCount, buildActiveOutageCriteria }
