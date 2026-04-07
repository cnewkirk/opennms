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

import cytoscape, { Core } from 'cytoscape'
import cxtmenu from 'cytoscape-cxtmenu'
import { Ref } from 'vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { TopologyVertex } from '@/types/topology'
import { getProtocolColor, parallelOffsets, utilizationColor, throughputWidth, formatBitsPerSec } from '@/components/Topology/protocolColors'
import { useWeathermapStore } from '@/stores/weathermapStore'

cytoscape.use(cxtmenu)

// Read a Feather DS CSS custom property value from the document at runtime.
// Cytoscape renders to canvas so CSS variables don't apply directly —
// we must resolve them at init time so light/dark mode is respected.
const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Map severity names to their Feather DS CSS variable names
const SEVERITY_CSS_VARS: Record<string, string> = {
  CRITICAL:      '--feather-error',
  MAJOR:         '--feather-major',
  MINOR:         '--feather-minor',
  WARNING:       '--feather-warning',
  NORMAL:        '--feather-success',
  INDETERMINATE: '--feather-indeterminate'
}

// Cytoscape selector that matches spine/core/distribution tier nodes by label prefix.
// Used to choose roots for the breadthfirst hierarchical layout.
const SPINE_TIER_SELECTOR =
  '[label ^= "spine-"],[label ^= "spine_"],[label ^= "core-"],[label ^= "core_"],' +
  '[label ^= "distribution-"],[label ^= "dist-"],[label ^= "agg-"],[label ^= "aggregate-"]'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildStylesheet = (): any[] => {
  const defaultNodeColor = cssVar('--feather-primary')
  const selectedColor    = cssVar('--feather-primary-dark')
  const labelBg          = cssVar('--feather-surface') || '#0d1117'

  return [
    {
      selector: 'node',
      css: {
        'background-color': defaultNodeColor || '#1f78c1',
        'label': 'data(label)',
        'color': '#ffffff',
        'font-size': 11,
        'font-weight': 600,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 6,
        'text-outline-width': 0,
        'text-background-color': labelBg || '#0d1117',
        'text-background-opacity': 0.75,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        'width': 36,
        'height': 36,
        'border-width': 2,
        'border-color': 'rgba(255,255,255,0.25)'
      }
    },
    {
      selector: 'node:selected',
      css: {
        'border-width': 3,
        'border-color': selectedColor || '#005eb8',
        'background-color': selectedColor || '#005eb8'
      }
    },
    ...Object.entries(SEVERITY_CSS_VARS).map(([sev, varName]) => ({
      selector: `node.severity-${sev.toLowerCase()}`,
      css: { 'background-color': cssVar(varName) || varName }
    })),
    {
      selector: 'edge',
      css: {
        'width': 3,
        'line-color': 'data(color)',
        'target-arrow-shape': 'none',
        'curve-style': 'bezier',
        'opacity': 0.75
      }
    },
    {
      selector: 'edge:selected',
      css: {
        'line-color': selectedColor || '#005eb8',
        'width': 4,
        'opacity': 1
      }
    },
    // User-defined edges — dashed
    {
      selector: 'edge.user-defined',
      css: {
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4] as unknown as undefined,
        'opacity': 0.8
      }
    },
    // Linking mode — highlight candidate target nodes
    {
      selector: 'node.link-target-candidate',
      css: {
        'border-width': 3,
        'border-color': selectedColor || '#005eb8',
        'border-style': 'dashed'
      }
    },
    // Weathermap: edge with live utilization label
    {
      selector: 'edge.weathermap',
      css: {
        'label': 'data(wmLabel)',
        'font-size': 9,
        'color': '#ffffff',
        'text-background-color': '#2d3748',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
        'text-background-shape': 'roundrectangle'
      }
    },
    // Weathermap: down node — red fill
    {
      selector: 'node.node-down',
      css: {
        'background-color': '#FC8181',
        'border-color': '#E53E3E',
        'border-width': 3
      }
    },
  ]
}

const useTopology = (containerRef: Ref<HTMLElement | null>) => {
  const store = useTopologyStore()
  const wmStore = useWeathermapStore()
  let cy: Core | null = null

  interface EdgeTooltipState {
    x: number
    y: number
    protocols: string[]
    srcLabel: string
    tgtLabel: string
    util?: { utilPct: number; inBps: number; outBps: number } | null
  }
  const edgeTooltip = ref<EdgeTooltipState | null>(null)

  // --- Layout persistence (localStorage) ---

  const localStorageKey = (): string => {
    const k = store.layoutKey
    return k ? `opennms-topo-layout-${k}` : ''
  }

  const savedPositions = (): Record<string, { x: number; y: number }> | null => {
    const key = localStorageKey()
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  const saveLayout = () => {
    if (!cy) return
    const key = localStorageKey()
    if (!key) return
    const positions: Record<string, { x: number; y: number }> = {}
    cy.nodes().forEach(n => { positions[n.id()] = { ...n.position() } })
    localStorage.setItem(key, JSON.stringify(positions))
  }

  const resetLayout = () => {
    const key = localStorageKey()
    if (key) localStorage.removeItem(key)
    runLayout(true)
  }

  // --- Layout selection ---

  // Run the best layout for the current graph:
  //   1. Saved positions from localStorage → preset
  //   2. Spine/leaf naming detected        → breadthfirst (hierarchical)
  //   3. Fallback                          → cose (force-directed)
  const runLayout = (forceAuto = false) => {
    if (!cy || cy.nodes().length === 0) return

    if (!forceAuto) {
      const saved = savedPositions()
      if (saved) {
        cy.layout({
          name: 'preset',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          positions: (node: any) => saved[node.id()] ?? node.position(),
          animate: false,
          padding: 30
        }).run()
        return
      }
    }

    const spineNodes = cy.nodes(SPINE_TIER_SELECTOR)
    if (spineNodes.length > 0) {
      cy.layout({
        name: 'breadthfirst',
        directed: false,
        roots: spineNodes,
        animate: false,
        padding: 40,
        spacingFactor: 1.75,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: false
      } as cytoscape.LayoutOptions).run()
      return
    }

    cy.layout({
      name: 'cose',
      animate: false,
      randomize: true,
      nodeRepulsion: () => 400000,
      idealEdgeLength: () => 100,
      edgeElasticity: () => 100,
      numIter: 1000,
      gravity: 80,
      padding: 30
    } as cytoscape.LayoutOptions).run()
  }

  const pendingLinkSource = ref<TopologyVertex | null>(null)
  const pendingLinkTarget = ref<TopologyVertex | null>(null)

  // --- Cytoscape setup ---

  const initCytoscape = () => {
    if (!containerRef.value) return
    cy = cytoscape({
      container: containerRef.value,
      elements: [],
      style: buildStylesheet(),
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      autounselectify: false
    })

    cy.on('tap', 'node', (evt) => {
      if (store.linkMode) {
        const targetId = evt.target.id()
        const sourceId = store.linkSourceVertex?.id
        if (targetId && sourceId && targetId !== sourceId) {
          const targetVertex = store.vertices.find(v => v.id === targetId)
          if (targetVertex) {
            pendingLinkSource.value = store.linkSourceVertex
            store.cancelLinkMode()
            pendingLinkTarget.value = targetVertex
          }
        }
        return
      }
      const nodeData = evt.target.data()
      const vertex = store.vertices.find(v => v.id === nodeData.id)
      if (vertex) store.selectElement(vertex)
    })

    cy.on('tap', 'edge', (evt) => {
      const { edgeKey } = evt.target.data()
      // store.edges are already deduplicated with protocols[] attached
      const edge = store.edges.find(e => {
        const s = e.source.id; const t = e.target.id
        return `${Math.min(s, t)}-${Math.max(s, t)}` === edgeKey
      })
      if (edge) store.selectElement(edge)
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        if (store.linkMode) {
          store.cancelLinkMode()
          return
        }
        store.selectElement(null)
      }
    })

    cy.on('mouseover', 'edge', (evt) => {
      if (!cy) return
      const edgeKey = evt.target.data('edgeKey') as string
      const parallelEdges = cy.edges(`[edgeKey = "${edgeKey}"]`)
      const protocols = [...new Set(parallelEdges.map(e => e.data('protocol') as string))]

      const srcId = String(evt.target.data('source'))
      const tgtId = String(evt.target.data('target'))
      const srcLabel = cy.getElementById(srcId)?.data('label') as string ?? srcId
      const tgtLabel = cy.getElementById(tgtId)?.data('label') as string ?? tgtId

      const pos = evt.renderedPosition ?? { x: 0, y: 0 }
      const util = wmStore.edgeUtilMap[edgeKey] ?? null
      edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel, util }
    })

    cy.on('mouseout', 'edge', () => {
      edgeTooltip.value = null
    })

    cy.on('viewport', () => {
      edgeTooltip.value = null
    })

    // Auto-save whenever the user finishes dragging a node
    cy.on('dragfree', 'node', saveLayout)

    // Context menu for nodes (right-click)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cy as any).cxtmenu({
      selector: 'node',
      commands: [
        {
          content: 'Create Link',
          select: (ele: cytoscape.SingularElementReturnValue) => {
            const vertex = store.vertices.find(v => v.id === ele.id())
            if (vertex) store.startLinkMode(vertex)
          }
        }
      ],
      fillColor: cssVar('--feather-surface') || '#1e1e2e',
      activeFillColor: cssVar('--feather-primary') || '#1f78c1',
      activePadding: 10,
      indicatorSize: 14,
      separatorWidth: 3,
      spotlightPadding: 4,
      adaptativeNodeSpotlightRadius: true,
      minSpotlightRadius: 20,
      maxSpotlightRadius: 38,
      itemTextShadowColor: 'transparent'
    })
  }

  const rebuildStylesheet = () => {
    cy?.style(buildStylesheet())
  }

  const syncElements = () => {
    if (!cy) return

    cy.elements().remove()

    const nodeElements = store.vertices.map(v => ({
      data: {
        id: v.id,
        label: v.label ?? v.id,
        baseLabel: v.label ?? v.id,   // preserved for down-node label mutation
        nodeID: v.nodeID ?? v.id,
        ipAddress: v.ipAddress,
        namespace: v.namespace
      }
    }))

    // Expand each store edge into N parallel Cytoscape edges, one per protocol.
    // All parallel edges for a pair share the same edgeKey for tap/tooltip grouping.
    const edgeElements: { data: Record<string, unknown> }[] = []
    for (const e of store.edges) {
      const src = e.source.id
      const tgt = e.target.id
      const key = `${Math.min(src, tgt)}-${Math.max(src, tgt)}`
      const protocols = (e.protocols && e.protocols.length > 0) ? e.protocols : ['unknown']
      const offsets = parallelOffsets(protocols.length)

      protocols.forEach((protocol, i) => {
        const safeId = protocol.toLowerCase().replace(/[\s/]+/g, '-')
        edgeElements.push({
          data: {
            id: `edge-${key}-${safeId}`,
            source: String(src),
            target: String(tgt),
            edgeKey: key,
            protocol,
            color: getProtocolColor(protocol),
            offset: offsets[i],
            userDefined: e.userDefined ?? false
          }
        })
      })
    }

    cy.add(nodeElements)
    cy.add(edgeElements)

    // Apply per-edge curve offsets and user-defined dashed style programmatically
    cy.edges().forEach(edge => {
      const offset = edge.data('offset') as number
      if (offset === 0) {
        edge.style('curve-style', 'straight')
      } else {
        edge.style('curve-style', 'bezier')
        edge.style('control-point-distances', offset)
      }
      if (edge.data('userDefined')) {
        edge.addClass('user-defined')
      }
    })

    applySeverityClasses()
    applyWeathermapStyles()
    applyNodeDownStyles()
    runLayout()
  }

  const applySeverityClasses = () => {
    if (!cy) return
    cy.nodes().forEach(node => {
      const numericId = parseInt(node.id(), 10)
      Object.keys(SEVERITY_CSS_VARS).forEach(sev => node.removeClass(`severity-${sev.toLowerCase()}`))
      if (!isNaN(numericId) && store.alarmSeverity[numericId]) {
        node.addClass(`severity-${store.alarmSeverity[numericId].toLowerCase()}`)
      }
    })
  }

  const applyWeathermapStyles = () => {
    if (!cy) return
    cy.batch(() => {
      cy!.edges().forEach(edge => {
        const key = edge.data('edgeKey') as string
        const util = wmStore.edgeUtilMap[key]
        if (!util) {
          // revert to protocol color if data disappears
          edge.removeClass('weathermap')
          edge.data('wmLabel', '')
          edge.style('line-color', edge.data('color'))
          edge.style('width', 3)
          return
        }
        const color = utilizationColor(util.utilPct)
        const width = throughputWidth(util.inBps + util.outBps)
        const label = `${Math.round(util.utilPct)}% · ↑${formatBitsPerSec(util.inBps)} ↓${formatBitsPerSec(util.outBps)}`
        edge.data('wmLabel', label)
        edge.style('line-color', color)
        edge.style('width', width)
        edge.addClass('weathermap')
      })
    })
  }

  const applyNodeDownStyles = () => {
    if (!cy) return
    cy.batch(() => {
      cy!.nodes().forEach(node => {
        const numericId = parseInt(node.id(), 10)
        const isDown = !isNaN(numericId) && wmStore.nodeDownMap[numericId] === true
        const base = node.data('baseLabel') as string ?? node.id()
        if (isDown) {
          node.addClass('node-down')
          node.data('label', base + '\n▼ DOWN')
        } else {
          node.removeClass('node-down')
          node.data('label', base)
        }
      })
    })
  }

  watch(() => [store.vertices, store.edges], syncElements, { deep: true })

  watch(() => store.alarmSeverity, applySeverityClasses, { deep: true })

  watch(() => wmStore.edgeUtilMap, applyWeathermapStyles)
  watch(() => wmStore.nodeDownMap, applyNodeDownStyles)

  watch(() => store.focusTarget, (nodeID) => {
    if (!cy || !nodeID) return
    const node = cy.getElementById(nodeID)
    if (node.length > 0) {
      cy.animate({
        center: { eles: node },
        zoom: 1.5,
        duration: 400,
        easing: 'ease-in-out-quad'
      })
      node.select()
      store.selectElement(store.vertices.find(v => v.id === nodeID) ?? null)
    }
  })

  // When link mode activates/deactivates, update node styling
  watch(() => store.linkMode, (active) => {
    if (!cy) return
    if (active) {
      const sourceId = store.linkSourceVertex?.id
      cy.nodes().forEach(n => {
        if (n.id() !== sourceId) n.addClass('link-target-candidate')
      })
    } else {
      cy.nodes().removeClass('link-target-candidate')
    }
  })

  // Rebuild stylesheet when the OS/app color scheme changes so dark mode is respected
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rebuildStylesheet)
  }

  onMounted(() => {
    initCytoscape()
    if (store.vertices.length > 0) syncElements()
  })

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', rebuildStylesheet)
    }
    cy?.destroy()
    cy = null
  })

  return { getCy: () => cy, saveLayout, resetLayout, pendingLinkSource, pendingLinkTarget, edgeTooltip }
}

export default useTopology
