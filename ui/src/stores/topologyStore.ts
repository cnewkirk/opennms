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
import { v2 } from '@/services/axiosInstances'
import { getContainers, getGraph } from '@/services/topologyService'
import { getUserDefinedLinks, createUserDefinedLink, deleteUserDefinedLink, UserDefinedLinkPayload } from '@/services/userDefinedLinkService'
import { useAuthStore } from '@/stores/authStore'
import { getAlarms, getNodeAlarms } from '@/services/alarmService'
import { getNodeEnlinkd, NodeEnlinkdData } from '@/services/enlinkdService'
import { getNodeById, getNodeIpInterfaces } from '@/services/nodeService'
import { TopologyVertex, TopologyEdge, TopologyLayer, TopologyElement, AlarmSeverity } from '@/types/topology'
import { numericSeverityLevel } from '@/components/Map/utils'
import { Alarm, Node, IpInterface } from '@/types'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { ipInCidr } from '@/components/Topology/cidrUtils'

export interface NodeDetail {
  node: Node
  ipInterfaces: IpInterface[]
  enlinkd: NodeEnlinkdData | null
}

export interface EdgeDetail {
  srcNodeId: number
  tgtNodeId: number
  src: NodeEnlinkdData | null
  tgt: NodeEnlinkdData | null
}

const ENLINKD_CONTAINER_ID = 'enlinkd'

export const useTopologyStore = defineStore('topologyStore', () => {
  const availableLayers = ref<TopologyLayer[]>([])
  // Per-layer graph cache; keyed by namespace
  const layerCache = ref<Record<string, { vertices: TopologyVertex[], edges: TopologyEdge[] }>>({})
  // Active protocol layer namespaces (user-selected multi-select)
  const activeLayers = ref<string[]>([])

  const alarmSeverity = ref<Record<number, AlarmSeverity>>({})
  const nodeAlarmDetails = ref<Record<number, Alarm[]>>({})
  const nodeDetails = ref<Record<number, NodeDetail>>({})
  const edgeLinkDetails = ref<Record<string, EdgeDetail>>({})
  const selectedElement = ref<TopologyElement | null>(null)
  const focusTarget = ref<string | null>(null)
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Link creation mode
  const linkMode = ref(false)
  const linkSourceVertex = ref<TopologyVertex | null>(null)

  // User-defined links (stored separately, merged into edges computed)
  const userDefinedEdges = ref<TopologyEdge[]>([])

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
  //
  // TODO: L2/L3 protocol correlation gap
  //
  // OpenNMS EnLinkd discovers links via multiple independent protocols, each with its own
  // namespace (nodes:Lldp, nodes:Isis, nodes:Ospf, nodes:Layer3, etc.). This deduplication
  // correctly collapses multiple protocols into one edge — BUT only when BOTH endpoints share
  // the same pair of node IDs.
  //
  // The problem: L3 routing protocols (IS-IS, OSPF) identify neighbors by router-ID / IP
  // address, while L2 protocols (LLDP, CDP) identify them by chassis MAC. If OpenNMS has
  // provisioned a device under two different node IDs (one discovered via LLDP, one via an
  // IS-IS router-ID IP), the edges appear as SEPARATE entries with different node ID pairs
  // and therefore do NOT collapse. This causes IS-IS/OSPF-only edges to appear in the
  // topology without a corresponding LLDP/L2 link — misleadingly implying the physical
  // layer is absent.
  //
  // The fix requires cross-protocol node ID correlation. Possible approaches:
  //   A) Backend: enhance EnLinkd to correlate router-IDs with LLDP chassis IDs and emit
  //      a single node ID for the same physical device.
  //   B) UI: after loading all layer graphs, build an IP→nodeId index from the
  //      vertices' ipAddress field, then re-key IS-IS/OSPF edges whose endpoint IP matches
  //      a known LLDP node, replacing the IS-IS node ID with the LLDP node ID before the
  //      deduplication map is built. This is a heuristic and may mis-correlate in networks
  //      with asymmetric IP assignments.
  //
  // Until this is resolved: "L3-only" edges (protocols: ['Isis'] with no 'Lldp' entry) are
  // expected to appear — they represent IS-IS/OSPF adjacencies whose physical layer OpenNMS
  // has not independently confirmed via LLDP/CDP. This is a data quality / discovery gap,
  // not a topology rendering bug.
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

    // Merge user-defined edges
    for (const ude of userDefinedEdges.value) {
      const key = `${Math.min(ude.source.id, ude.target.id)}-${Math.max(ude.source.id, ude.target.id)}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { ...ude, protocols: ['User Defined'] })
      } else if (!existing.protocols.includes('User Defined')) {
        existing.protocols.push('User Defined')
        existing.userDefined = true
        existing.dbId = ude.dbId
        existing.linkLabel = ude.linkLabel
        existing.componentLabelA = ude.componentLabelA
        existing.componentLabelZ = ude.componentLabelZ
        existing.owner = ude.owner
      }
    }

    return Array.from(map.values())
  })

  // localStorage key for layout persistence — stable across layer toggles when same set
  const layoutKey = computed<string>(() => {
    const sorted = [...activeLayers.value].sort()
    return sorted.length > 0 ? `enlinkd-${sorted.join('+')}` : ''
  })

  // Populated async by the filter panel when surveillanceCategories filter is active.
  // Stores string node IDs (String(node.id) from API response).
  const _categoryNodeIdSet = ref<Set<string>>(new Set())

  // Filtered vertices — applies active filters from topologyViewStore.
  // When no filters are active, returns the same array reference as vertices (identity)
  // so watchers are not triggered spuriously.
  const filteredVertices = computed<TopologyVertex[]>(() => {
    const viewStore = useTopologyViewStore()
    const f = viewStore.filters
    const hasCategory = f.surveillanceCategories.length > 0
    const hasCidr = f.cidrs.length > 0
    const hasName = f.namePattern.length > 0

    if (!hasCategory && !hasCidr && !hasName) return vertices.value

    // _categoryNodeIdSet lives in topologyStore (this store), not viewStore
    const categorySet = _categoryNodeIdSet.value  // populated async by fetchCategoryNodeIds()

    return vertices.value.filter(v => {
      if (hasCategory) {
        if (!v.nodeID || !categorySet.has(v.nodeID)) return false
      }
      if (hasCidr) {
        if (!v.ipAddress || !f.cidrs.some(cidr => ipInCidr(v.ipAddress!, cidr))) return false
      }
      if (hasName) {
        if (f.namePattern.startsWith('/')) {
          try {
            const rx = new RegExp(f.namePattern.slice(1), 'i')
            if (!rx.test(v.label)) return false
          } catch { return false }
        } else {
          if (!v.label.toLowerCase().includes(f.namePattern.toLowerCase())) return false
        }
      }
      return true
    })
  })

  // Filtered edges — an edge is shown only if both endpoints are in filteredVertices.
  // Returns same array reference as edges when no filters are active (identity guarantee
  // prevents spurious watcher triggers in useTopology.ts).
  const filteredEdges = computed(() => {
    const viewStore = useTopologyViewStore()
    const f = viewStore.filters
    const hasFilter = f.surveillanceCategories.length > 0 || f.cidrs.length > 0 || f.namePattern.length > 0
    if (!hasFilter) return edges.value

    // filteredVertices vertex IDs are strings; TopologyEdge source/target IDs are numbers
    // String(e.source.id) ensures consistent comparison
    const visibleIds = new Set(filteredVertices.value.map(v => v.id))
    return edges.value.filter(e =>
      visibleIds.has(String(e.source.id)) && visibleIds.has(String(e.target.id))
    )
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
    const toLoad = defaults.length > 0 ? defaults : availableLayers.value.slice(0, 1)

    loading.value = true
    error.value = null
    await Promise.all(toLoad.map(ensureLayerLoaded))
    activeLayers.value = toLoad.map(l => l.namespace)
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

  /**
   * Load a set of layer namespaces from a saved view.
   * Ensures containers are loaded first, resolves namespace strings to TopologyLayer
   * objects, loads any missing layers from the cache, then updates activeLayers.
   * Any namespace not found in availableLayers is dropped with a console.warn.
   */
  const setActiveLayers = async (namespaces: string[]) => {
    if (availableLayers.value.length === 0) {
      await loadContainers()
    }
    const resolved = namespaces
      .map(ns => availableLayers.value.find(l => l.namespace === ns))
      .filter((l): l is TopologyLayer => {
        if (!l) console.warn(`[topology] setActiveLayers: namespace not found in availableLayers, skipping`)
        return !!l
      })
    if (resolved.length === 0) { selectedElement.value = null; return }
    loading.value = true
    const toLoad = resolved.filter(l => !layerCache.value[l.namespace])
    await Promise.allSettled(toLoad.map(async (l) => {
      try { await ensureLayerLoaded(l) }
      catch (e) { console.warn(`[topology] setActiveLayers: failed to load layer ${l.namespace}`, e) }
    }))
    activeLayers.value = resolved.filter(l => !!layerCache.value[l.namespace]).map(l => l.namespace)
    loading.value = false
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

  const loadNodeDetail = async (nodeId: number) => {
    if (nodeDetails.value[nodeId]) return
    const [nodeResp, ifaceResp, enlinkdResp] = await Promise.all([
      getNodeById(String(nodeId)),
      getNodeIpInterfaces(String(nodeId), { limit: 25, offset: 0 }),
      getNodeEnlinkd(nodeId)
    ])
    if (!nodeResp) return
    nodeDetails.value = {
      ...nodeDetails.value,
      [nodeId]: {
        node: nodeResp as Node,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ipInterfaces: (ifaceResp && (ifaceResp as any) !== false) ? ifaceResp.ipInterface : [],
        enlinkd: enlinkdResp
      }
    }
  }

  const loadEdgeLinkDetail = async (edgeKey: string, srcNodeId: number, tgtNodeId: number) => {
    if (edgeLinkDetails.value[edgeKey]) return
    const [src, tgt] = await Promise.all([getNodeEnlinkd(srcNodeId), getNodeEnlinkd(tgtNodeId)])
    edgeLinkDetails.value = { ...edgeLinkDetails.value, [edgeKey]: { srcNodeId, tgtNodeId, src, tgt } }
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

  const startLinkMode = (sourceVertex: TopologyVertex) => {
    linkMode.value = true
    linkSourceVertex.value = sourceVertex
    selectedElement.value = null
  }

  const cancelLinkMode = () => {
    linkMode.value = false
    linkSourceVertex.value = null
  }

  const loadUserDefinedLinks = async () => {
    const links = await getUserDefinedLinks()
    userDefinedEdges.value = links.map(l => ({
      source: { namespace: 'nodes', id: l['node-id-a'] },
      target: { namespace: 'nodes', id: l['node-id-z'] },
      userDefined: true,
      dbId: l['db-id'],
      linkLabel: l['link-label'],
      componentLabelA: l['component-label-a'],
      componentLabelZ: l['component-label-z'],
      owner: l['owner']
    }))
  }

  const addUserDefinedLink = async (
    nodeIdA: number, componentLabelA: string,
    nodeIdZ: number, componentLabelZ: string,
    linkLabel: string
  ): Promise<boolean> => {
    const authStore = useAuthStore()
    const owner = authStore.whoAmI?.id ?? 'unknown'
    const linkId = `udl-${nodeIdA}-${nodeIdZ}-${Date.now()}`

    // Optimistic: add edge immediately
    const tempEdge: TopologyEdge = {
      source: { namespace: 'nodes', id: nodeIdA },
      target: { namespace: 'nodes', id: nodeIdZ },
      userDefined: true,
      linkLabel,
      componentLabelA,
      componentLabelZ,
      owner
    }
    userDefinedEdges.value = [...userDefinedEdges.value, tempEdge]

    const payload: UserDefinedLinkPayload = {
      'node-id-a': nodeIdA,
      'component-label-a': componentLabelA,
      'node-id-z': nodeIdZ,
      'component-label-z': componentLabelZ,
      'link-id': linkId,
      'link-label': linkLabel,
      'owner': owner
    }

    const dbId = await createUserDefinedLink(payload)
    if (dbId !== null) {
      const idx = userDefinedEdges.value.indexOf(tempEdge)
      if (idx >= 0) {
        const updated = { ...tempEdge, dbId }
        userDefinedEdges.value = [
          ...userDefinedEdges.value.slice(0, idx),
          updated,
          ...userDefinedEdges.value.slice(idx + 1)
        ]
      }
      return true
    } else {
      userDefinedEdges.value = userDefinedEdges.value.filter(e => e !== tempEdge)
      return false
    }
  }

  /** Encode a string value for use inside a FIQL expression. */
  const fiqlEncode = (val: string) =>
    encodeURIComponent(val).replace(/[!'();,]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

  /**
   * Fetch node IDs for selected surveillance categories and populate _categoryNodeIdSet.
   * Called by the filter panel whenever surveillanceCategories filter changes.
   * Stores IDs as strings (String(node.id)) for type-safe comparison with TopologyVertex.nodeID.
   */
  const fetchCategoryNodeIds = async (categories: string[]) => {
    if (categories.length === 0) {
      _categoryNodeIdSet.value = new Set()
      return
    }
    const idSets = await Promise.all(
      categories.map(async cat => {
        try {
          const resp = await v2.get(`/nodes?_s=categories.name==${fiqlEncode(cat)}&limit=1000`)
          // API returns id as string (Node type: id: string); String() coercion is safe but explicit
          const nodes: Array<{ id: string }> = resp.data?.node ?? []
          return nodes.map(n => String(n.id))
        } catch {
          console.warn(`[topology] Failed to fetch nodes for category: ${cat}`)
          return []
        }
      })
    )
    _categoryNodeIdSet.value = new Set(idSets.flat())
  }

  const removeUserDefinedLink = async (dbId: number): Promise<boolean> => {
    const edge = userDefinedEdges.value.find(e => e.dbId === dbId)
    if (!edge) return false

    userDefinedEdges.value = userDefinedEdges.value.filter(e => e.dbId !== dbId)
    selectedElement.value = null

    const ok = await deleteUserDefinedLink(dbId)
    if (!ok) {
      userDefinedEdges.value = [...userDefinedEdges.value, edge]
      return false
    }
    return true
  }

  return {
    availableLayers,
    layerCache,
    protocolLayers,
    activeLayers,
    vertices,
    edges,
    layoutKey,
    alarmSeverity,
    nodeAlarmDetails,
    nodeDetails,
    edgeLinkDetails,
    selectedElement,
    focusTarget,
    searchQuery,
    loading,
    error,
    linkMode,
    linkSourceVertex,
    userDefinedEdges,
    filteredVertices,
    filteredEdges,
    setActiveLayers,
    _categoryNodeIdSet,
    loadContainers,
    toggleLayer,
    setAllLayers,
    loadAlarmSeverities,
    loadNodeDetail,
    loadEdgeLinkDetail,
    loadNodeAlarmDetails,
    selectElement,
    focusNode,
    setSearchQuery,
    startLinkMode,
    cancelLinkMode,
    loadUserDefinedLinks,
    addUserDefinedLink,
    removeUserDefinedLink,
    fetchCategoryNodeIds
  }
})
