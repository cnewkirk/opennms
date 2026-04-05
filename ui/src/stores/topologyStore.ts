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

import { defineStore } from 'pinia'
import { getContainers, getGraph } from '@/services/topologyService'
import { getAlarms, getNodeAlarms } from '@/services/alarmService'
import { TopologyVertex, TopologyEdge, TopologyLayer, TopologyElement, AlarmSeverity } from '@/types/topology'
import { numericSeverityLevel } from '@/components/Map/utils'
import { Alarm } from '@/types'

const ENLINKD_CONTAINER_ID = 'enlinkd'

export const useTopologyStore = defineStore('topologyStore', () => {
  const availableLayers = ref<TopologyLayer[]>([])
  const activeLayer = ref<TopologyLayer | null>(null)
  const vertices = ref<TopologyVertex[]>([])
  const edges = ref<TopologyEdge[]>([])
  const alarmSeverity = ref<Record<number, AlarmSeverity>>({})
  const edgeProtocols = ref<Record<string, string[]>>({})
  const nodeAlarmDetails = ref<Record<number, Alarm[]>>({})
  const selectedElement = ref<TopologyElement | null>(null)
  const focusTarget = ref<string | null>(null)
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const loadContainers = async () => {
    const containers = await getContainers()
    const nodesContainer = containers.find(c => c.id === ENLINKD_CONTAINER_ID)
    if (!nodesContainer) return

    availableLayers.value = nodesContainer.graphs.map(g => ({
      containerId: ENLINKD_CONTAINER_ID,
      namespace: g.namespace,
      label: g.label ?? g.namespace
    }))

    if (availableLayers.value.length > 0 && !activeLayer.value) {
      const defaultLayer = availableLayers.value.find(l => l.namespace === 'nodes') ?? availableLayers.value[0]
      await loadGraph(defaultLayer)
    }

    // Build protocol map in the background; don't block initial render
    buildEdgeProtocolMap()
  }

  const loadGraph = async (layer: TopologyLayer) => {
    loading.value = true
    error.value = null
    activeLayer.value = layer
    selectedElement.value = null

    const graph = await getGraph(layer.containerId, layer.namespace)
    if (graph) {
      vertices.value = graph.vertices ?? []
      edges.value = graph.edges ?? []
    } else {
      error.value = `Failed to load ${layer.label} topology`
      vertices.value = []
      edges.value = []
    }
    loading.value = false
  }

  const loadAlarmSeverities = async () => {
    const resp = await getAlarms({ limit: 10000, offset: 0 })
    if (!resp) return

    const severityMap: Record<number, AlarmSeverity> = {}
    resp.alarm.forEach(alarm => {
      const sev = alarm.severity.toUpperCase() as AlarmSeverity
      const existing = severityMap[alarm.nodeId]
      if (!existing || numericSeverityLevel(sev) > numericSeverityLevel(existing)) {
        severityMap[alarm.nodeId] = sev
      }
    })
    alarmSeverity.value = severityMap
  }

  const buildEdgeProtocolMap = async () => {
    const protocolLayers = availableLayers.value.filter(l => l.namespace !== 'nodes')
    if (protocolLayers.length === 0) return

    const results = await Promise.all(
      protocolLayers.map(async l => ({ label: l.label, graph: await getGraph(l.containerId, l.namespace) }))
    )

    const map: Record<string, string[]> = {}
    for (const { label, graph } of results) {
      if (!graph) continue
      for (const e of graph.edges) {
        const key = `${Math.min(e.source.id, e.target.id)}-${Math.max(e.source.id, e.target.id)}`
        if (!map[key]) map[key] = []
        if (!map[key].includes(label)) map[key].push(label)
      }
    }
    edgeProtocols.value = map
  }

  const loadNodeAlarmDetails = async (nodeId: number) => {
    if (nodeAlarmDetails.value[nodeId]) return  // already loaded
    const alarms = await getNodeAlarms(nodeId, 10)
    const sorted = alarms.sort((a, b) => {
      const sevA = numericSeverityLevel(a.severity.toUpperCase() as AlarmSeverity)
      const sevB = numericSeverityLevel(b.severity.toUpperCase() as AlarmSeverity)
      return sevB - sevA
    })
    nodeAlarmDetails.value = { ...nodeAlarmDetails.value, [nodeId]: sorted.slice(0, 3) }
  }

  const selectElement = (el: TopologyElement | null) => {
    selectedElement.value = el
  }

  const focusNode = (nodeId: string) => {
    focusTarget.value = nodeId
  }

  const setSearchQuery = (q: string) => {
    searchQuery.value = q
    if (!q) return

    const lowerQ = q.toLowerCase()
    const match = vertices.value.find(v =>
      v.label?.toLowerCase().includes(lowerQ) ||
      v.ipAddress?.toLowerCase().includes(lowerQ)
    )
    if (match?.nodeID) {
      focusTarget.value = match.nodeID
    }
  }

  return {
    availableLayers,
    activeLayer,
    vertices,
    edges,
    alarmSeverity,
    edgeProtocols,
    nodeAlarmDetails,
    selectedElement,
    focusTarget,
    searchQuery,
    loading,
    error,
    loadContainers,
    loadGraph,
    loadAlarmSeverities,
    buildEdgeProtocolMap,
    loadNodeAlarmDetails,
    selectElement,
    focusNode,
    setSearchQuery
  }
})
