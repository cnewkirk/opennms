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
  // Per-layer graph cache; keyed by namespace
  const layerCache = ref<Record<string, { vertices: TopologyVertex[], edges: TopologyEdge[] }>>({})
  // Active protocol layer namespaces (user-selected multi-select)
  const activeLayers = ref<string[]>([])

  const alarmSeverity = ref<Record<number, AlarmSeverity>>({})
  const nodeAlarmDetails = ref<Record<number, Alarm[]>>({})
  const selectedElement = ref<TopologyElement | null>(null)
  const focusTarget = ref<string | null>(null)
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Protocol layers are everything except the server-side "All" rollup (namespace 'nodes')
  const protocolLayers = computed<TopologyLayer[]>(() =>
    availableLayers.value.filter(l => l.namespace !== 'nodes')
  )

  // Merged, deduplicated vertices from all active layers
  const vertices = computed<TopologyVertex[]>(() => {
    const seen = new Set<string>()
    const result: TopologyVertex[] = []
    for (const ns of activeLayers.value) {
      const g = layerCache.value[ns]
      if (!g) continue
      for (const v of g.vertices) {
        if (!seen.has(v.id)) { seen.add(v.id); result.push(v) }
      }
    }
    return result
  })

  // Merged, deduplicated edges — one per physical pair, with protocols[] attached
  const edges = computed<TopologyEdge[]>(() => {
    const map = new Map<string, TopologyEdge & { protocols: string[] }>()
    for (const ns of activeLayers.value) {
      const g = layerCache.value[ns]
      if (!g) continue
      const label = availableLayers.value.find(l => l.namespace === ns)?.label ?? ns
      for (const e of g.edges) {
        const key = `${Math.min(e.source.id, e.target.id)}-${Math.max(e.source.id, e.target.id)}`
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { source: e.source, target: e.target, protocols: [label] })
        } else if (!existing.protocols.includes(label)) {
          existing.protocols.push(label)
        }
      }
    }
    return Array.from(map.values())
  })

  // localStorage key for layout persistence — stable across layer toggles when same set
  const layoutKey = computed<string>(() => {
    const sorted = [...activeLayers.value].sort()
    return sorted.length > 0 ? `enlinkd-${sorted.join('+')}` : ''
  })

  const ensureLayerLoaded = async (layer: TopologyLayer) => {
    if (layerCache.value[layer.namespace]) return
    const graph = await getGraph(layer.containerId, layer.namespace)
    layerCache.value = {
      ...layerCache.value,
      [layer.namespace]: {
        vertices: graph?.vertices ?? [],
        edges: graph?.edges ?? []
      }
    }
  }

  const loadContainers = async () => {
    const containers = await getContainers()
    const nodesContainer = containers.find(c => c.id === ENLINKD_CONTAINER_ID)
    if (!nodesContainer) return

    availableLayers.value = nodesContainer.graphs.map(g => ({
      containerId: ENLINKD_CONTAINER_ID,
      namespace: g.namespace,
      label: g.label ?? g.namespace
    }))

    // Default to all protocol layers; fall back to 'nodes' if none exist
    const defaults = availableLayers.value.filter(l => l.namespace !== 'nodes')
    const toLaod = defaults.length > 0 ? defaults : availableLayers.value.slice(0, 1)

    loading.value = true
    error.value = null
    await Promise.all(toLaod.map(ensureLayerLoaded))
    activeLayers.value = toLaod.map(l => l.namespace)
    loading.value = false
  }

  const toggleLayer = async (layer: TopologyLayer) => {
    const ns = layer.namespace
    const isActive = activeLayers.value.includes(ns)

    if (isActive) {
      // Don't allow removing the last active layer
      if (activeLayers.value.length <= 1) return
      activeLayers.value = activeLayers.value.filter(n => n !== ns)
    } else {
      if (!layerCache.value[ns]) {
        loading.value = true
        await ensureLayerLoaded(layer)
        loading.value = false
      }
      activeLayers.value = [...activeLayers.value, ns]
    }
    selectedElement.value = null
  }

  const setAllLayers = async (active: boolean) => {
    const targets = protocolLayers.value.length > 0 ? protocolLayers.value : availableLayers.value
    if (active) {
      loading.value = true
      await Promise.all(targets.filter(l => !layerCache.value[l.namespace]).map(ensureLayerLoaded))
      activeLayers.value = targets.map(l => l.namespace)
      loading.value = false
    } else {
      // Keep only the first layer active
      activeLayers.value = activeLayers.value.slice(0, 1)
    }
    selectedElement.value = null
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

  const loadNodeAlarmDetails = async (nodeId: number) => {
    if (nodeAlarmDetails.value[nodeId]) return
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
    protocolLayers,
    activeLayers,
    vertices,
    edges,
    layoutKey,
    alarmSeverity,
    nodeAlarmDetails,
    selectedElement,
    focusTarget,
    searchQuery,
    loading,
    error,
    loadContainers,
    toggleLayer,
    setAllLayers,
    loadAlarmSeverities,
    loadNodeAlarmDetails,
    selectElement,
    focusNode,
    setSearchQuery
  }
})
