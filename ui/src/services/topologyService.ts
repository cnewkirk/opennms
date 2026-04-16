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
/// software distributed under the LICENSE is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { v2 } from './axiosInstances'
import { GraphContainerInfo, TopologyGraph } from '@/types/topology'

const getContainers = async (): Promise<GraphContainerInfo[]> => {
  try {
    const resp = await v2.get('/graphs')
    if (resp.status === 204) return []
    return resp.data
  } catch {
    return []
  }
}

const getGraph = async (containerId: string, namespace: string): Promise<TopologyGraph | null> => {
  try {
    const resp = await v2.get(`/graphs/${containerId}/${namespace}`)
    if (resp.status === 204) return { vertices: [], edges: [] }
    return resp.data
  } catch {
    return null
  }
}

export { getContainers, getGraph }
