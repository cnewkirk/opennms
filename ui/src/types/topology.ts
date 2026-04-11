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

// REST API type asymmetry: vertex IDs are strings (from graph response),
// but edge source/target IDs are numbers (from edge references).
// Use String(edge.source.id) when looking up vertices by edge endpoint.
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

// Discriminates by checking for 'id' — works because TopologyEdge has no 'id' field.
// If 'id' is ever added to TopologyEdge, this guard will silently break.
export const isVertex = (el: TopologyElement): el is TopologyVertex =>
  'label' in el && 'id' in el

export interface IconMapping {
  key: string
  iconKey: string
}

export interface TopologyView {
  id: string
  name: string
  description?: string
  scope: 'private' | 'user' | 'shared' | 'global'
  owner?: string
  data: string  // JSON-serialized view state
}
