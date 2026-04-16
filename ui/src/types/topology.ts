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

export type AlarmSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING' | 'NORMAL' | 'INDETERMINATE'

export interface TopologyVertex {
  id: string
  namespace: string
  label: string
  nodeID?: string
  ipAddress?: string
  tooltipText?: string
  iconKey?: string
  x?: string
  y?: string
}

export interface TopologyEdge {
  source: { namespace: string; id: number }
  target: { namespace: string; id: number }
  protocols?: string[]  // protocols that detected this edge (populated client-side on the All layer)
  userDefined?: boolean
  dbId?: number
  linkLabel?: string
  componentLabelA?: string
  componentLabelZ?: string
  owner?: string
}

export interface TopologyGraph {
  vertices: TopologyVertex[]
  edges: TopologyEdge[]
}

export interface GraphInfo {
  namespace: string
  label: string
  description?: string
}

export interface GraphContainerInfo {
  id: string
  label: string
  description?: string
  graphs: GraphInfo[]
}

export interface TopologyLayer {
  containerId: string
  namespace: string
  label: string
}

export type TopologyElement = TopologyVertex | TopologyEdge

export const isVertex = (el: TopologyElement): el is TopologyVertex =>
  'label' in el && 'id' in el

export interface TopologyEdgeLabels {
  showUtilization: boolean
  showLocalPort: boolean
  showRemotePort: boolean
  showIp: boolean
  showMac: boolean
  showSpeed: boolean
}

export interface TopologyFilter {
  surveillanceCategories: string[]
  cidrs: string[]
  namePattern: string
}

export interface TopologyViewState {
  activeLayers: string[]
  nodePositions: Record<string, { x: number; y: number }>
  filters: TopologyFilter
  edgeLabels: TopologyEdgeLabels
  viewport: { pan: { x: number; y: number }; zoom: number }
  gridSnap: { enabled: boolean; size: number }
}

export interface TopologyView {
  id: string
  name: string
  description?: string
  // 'global': admin-set default applied to all users
  // 'shared': visible and loadable by all authenticated users
  // 'user':   stored server-side, visible only to the owner (works across browsers)
  // 'private': stored in localStorage, visible only in this browser
  scope: 'global' | 'shared' | 'user' | 'private'
  // username (authStore.whoAmI.id); 'system' is a reserved sentinel for scope:'global'
  // the backend DAO must NOT attempt to resolve 'system' as a user record
  owner: string
  state: TopologyViewState
  createdAt: string
  updatedAt: string
}
