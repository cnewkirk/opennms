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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import fcose from 'cytoscape-fcose'
import { Ref, nextTick } from 'vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { TopologyVertex } from '@/types/topology'
import { getProtocolColor, utilizationColor, throughputWidth, formatBitsPerSec, capacityColor } from '@/components/Topology/protocolColors'
import { useWeathermapStore, EdgeLabelData } from '@/stores/weathermapStore'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { useAppStore } from '@/stores/appStore'

cytoscape.use(cxtmenu)
cytoscape.use(fcose)

// Read a Feather DS CSS custom property value from the document at runtime.
// Cytoscape renders to canvas so CSS variables don't apply directly —
// we must resolve them at init time so light/dark mode is respected.
const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Feather DS themes are applied as a class on <html>: 'open-light' or 'open-dark'.
// Used to pick safe fallback colors for Cytoscape canvas elements.
const isLightMode = (): boolean =>
  document.documentElement.classList.contains('open-light') ||
  document.body.classList.contains('open-light')

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
const buildStylesheet = (canvasEl?: HTMLElement | null): any[] => {
  const defaultNodeColor = cssVar('--feather-primary')
  const selectedColor    = cssVar('--feather-primary-dark')
  const light = isLightMode()

  // In dark mode: light text + dark halo clears the edge line behind the label.
  // In light mode: read the canvas element's actual computed background so the
  // text outline blends perfectly instead of appearing as a colored pill.
  const labelTextColor    = light ? '#1a1a2e' : (cssVar('--feather-primary-text-on-surface') || '#e8eaed')
  const canvasBg = (canvasEl && light) ? getComputedStyle(canvasEl).backgroundColor : null
  const labelOutlineColor = light
    ? (canvasBg || cssVar('--feather-background') || '#dde4f0')
    : (cssVar('--feather-surface') || '#0d1117')

  return [
    {
      selector: 'node',
      css: {
        'background-color': defaultNodeColor || '#1f78c1',
        'label': 'data(label)',
        'color': labelTextColor,
        'font-size': 11,
        'font-weight': 500,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 6,
        'text-outline-width': 2,
        'text-outline-color': labelOutlineColor,
        'text-outline-opacity': 0.85,
        'text-background-opacity': 0,
        'text-border-opacity': 0,
        'width': 36,
        'height': 36,
        'border-width': 2,
        'border-color': light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'
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
        // Slightly lower opacity in light mode tones down the saturated protocol
        // colors which look harsh against a bright white canvas.
        'opacity': light ? 0.6 : 0.75
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
    // Weathermap: edge with three-slot labels (center, source-end, target-end).
    // Uses a text-outline halo matching the canvas background so labels read
    // cleanly without a visible rectangular box. The halo clears just enough
    // canvas around each glyph to hide the edge line behind the text.
    {
      selector: 'edge.weathermap',
      css: {
        // Center label — utilization, protocols, speed
        'label':                   'data(wmLabel)',
        'text-rotation':           'autorotate',
        'text-margin-y':           -8,

        // Endpoint labels — interface name / IP near each vertex
        'source-label':            'data(wmLabelSrc)',
        'target-label':            'data(wmLabelTgt)',
        'source-text-offset':      45,
        'target-text-offset':      45,
        'source-text-rotation':    'autorotate',
        'target-text-rotation':    'autorotate',
        'source-text-margin-y':    -6,
        'target-text-margin-y':    -6,

        // Shared text styling for all three slots.
        // Same light/dark inversion as node labels: dark text + white halo in
        // light mode, light text + dark halo in dark mode.
        'font-size':               9,
        'color':                   labelTextColor,
        'text-outline-width':      3,
        'text-outline-color':      labelOutlineColor,
        'text-outline-opacity':    1,
        'text-background-opacity': 0,
        'text-wrap':               'wrap',
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
  const elStore = useEdgeLabelStore()
  const viewStore = useTopologyViewStore()
  const appStore = useAppStore()
  let cy: Core | null = null

  interface EdgeTooltipState {
    x: number
    y: number
    protocols: string[]
    srcLabel: string
    tgtLabel: string
    /** Numeric OpenNMS node ID of the source vertex — used to build measurements resource ID. */
    srcNodeId: string | null
    /** Numeric OpenNMS node ID of the target vertex — used to build remote measurements resource ID. */
    tgtNodeId: string | null
    util?: { utilPct: number; inBps: number; outBps: number } | null
    labelData?: EdgeLabelData | null
  }
  const edgeTooltip = ref<EdgeTooltipState | null>(null)

  interface NodeTooltipState {
    x: number
    y: number
    label: string
    nodeId: string
    ip: string | null
  }
  const nodeTooltip = ref<NodeTooltipState | null>(null)
  let nodeHoverTimer: ReturnType<typeof setTimeout> | null = null

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
  //   3. Fallback                          → fcose (force-directed)
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
        cy.fit(undefined, 30)
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
        nodeDimensionsIncludeLabels: true
      } as cytoscape.LayoutOptions).run()
      return
    }

    cy.layout({
      name: 'fcose',
      quality: 'default',
      randomize: true,
      animate: false,
      nodeDimensionsIncludeLabels: true,
      idealEdgeLength: 120,
      nodeRepulsion: () => 450000,
      edgeElasticity: () => 0.45,
      numIter: 2500,
      gravity: 0.25,
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
      style: buildStylesheet(containerRef.value),
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

    cy.on('mouseover', 'node', (evt) => {
      if (store.linkMode) return
      const data = evt.target.data()
      const pos = evt.renderedPosition ?? { x: 0, y: 0 }
      if (nodeHoverTimer) clearTimeout(nodeHoverTimer)
      nodeHoverTimer = setTimeout(() => {
        nodeTooltip.value = {
          x: pos.x,
          y: pos.y,
          label: data.label as string ?? data.id,
          nodeId: String(data.id),
          ip: (data.ipAddress as string) || null
        }
      }, 350)
    })

    cy.on('mouseout', 'node', () => {
      if (nodeHoverTimer) { clearTimeout(nodeHoverTimer); nodeHoverTimer = null }
      nodeTooltip.value = null
    })

    cy.on('mouseover', 'edge', (evt) => {
      if (!cy) return
      const edgeKey = evt.target.data('edgeKey') as string
      const protocols = (evt.target.data('protocols') as string[]) ?? []

      const srcId = String(evt.target.data('source'))
      const tgtId = String(evt.target.data('target'))
      const srcLabel = cy.getElementById(srcId)?.data('label') as string ?? srcId
      const tgtLabel = cy.getElementById(tgtId)?.data('label') as string ?? tgtId

      const pos = evt.renderedPosition ?? { x: 0, y: 0 }
      const util = wmStore.edgeUtilMap[edgeKey] ?? null
      const labelData = wmStore.edgeLabelData[edgeKey] ?? null
      // nodeID is the OpenNMS numeric node ID; needed to build measurements resource IDs
      const srcNodeId = (cy.getElementById(srcId)?.data('nodeID') as string | undefined) ?? null
      const tgtNodeId = (cy.getElementById(tgtId)?.data('nodeID') as string | undefined) ?? null
      edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel, srcNodeId, tgtNodeId, util, labelData }
    })

    cy.on('mouseout', 'edge', () => {
      edgeTooltip.value = null
    })

    cy.on('viewport', () => {
      edgeTooltip.value = null
      if (nodeHoverTimer) { clearTimeout(nodeHoverTimer); nodeHoverTimer = null }
      nodeTooltip.value = null
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
    cy?.style(buildStylesheet(containerRef.value))
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

    // Collapse all protocol edges for a node pair into one Cytoscape edge.
    // All protocols between a pair are stored as an array on the edge data;
    // the primary protocol (first in list) drives the default edge color.
    const edgeMap = new Map<string, { src: string; tgt: string; protocols: string[]; userDefined: boolean }>()
    for (const e of store.edges) {
      const src = e.source.id
      const tgt = e.target.id
      const key = `${Math.min(src, tgt)}-${Math.max(src, tgt)}`
      const protocols = (e.protocols && e.protocols.length > 0) ? e.protocols : ['unknown']
      const existing = edgeMap.get(key)
      if (!existing) {
        edgeMap.set(key, { src: String(src), tgt: String(tgt), protocols: [...protocols], userDefined: e.userDefined ?? false })
      } else {
        for (const p of protocols) {
          if (!existing.protocols.includes(p)) existing.protocols.push(p)
        }
        if (e.userDefined) existing.userDefined = true
      }
    }

    const edgeElements = [...edgeMap.entries()].map(([key, { src, tgt, protocols, userDefined }]) => ({
      data: {
        id: `edge-${key}`,
        source: src,
        target: tgt,
        edgeKey: key,
        protocols,
        color: getProtocolColor(protocols[0]),
        userDefined
      }
    }))

    cy.add(nodeElements)
    cy.add(edgeElements)

    cy.edges().forEach(edge => {
      edge.style('curve-style', 'straight')
      if (edge.data('userDefined')) {
        edge.addClass('user-defined')
      }
    })

    applySeverityClasses()
    applyWeathermapStyles()
    applyNodeDownStyles()
    applyEdgeLabels()
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

        if (elStore.colorMode === 'protocol') {
          edge.style('line-color', edge.data('color'))
          edge.style('width', 3)
          return
        }

        if (elStore.colorMode === 'capacity') {
          const ifSpeed = wmStore.edgeLabelData[key]?.ifSpeed ?? 0
          edge.style('line-color', ifSpeed > 0 ? capacityColor(ifSpeed) : edge.data('color'))
          edge.style('width', 3)
          return
        }

        // utilization mode (default)
        const util = wmStore.edgeUtilMap[key]
        if (!util) {
          edge.style('line-color', edge.data('color'))
          edge.style('width', 3)
          return
        }
        edge.style('line-color', utilizationColor(util.utilPct))
        edge.style('width', throughputWidth(util.inBps + util.outBps))
      })
    })
  }

  /**
   * Build three-slot edge labels from enabled fields.
   * Returns object with center/sourceEnd/targetEnd slots.
   * - center: protocol list, utilization, speed (stays at edge midpoint)
   * - sourceEnd: local interface name, local IP, MAC (near source vertex)
   * - targetEnd: remote port string, remote IP (near target vertex)
   */
  const composeEdgeLabel = (
    key: string,
    protocols: string[]
  ): { center: string; sourceEnd: string; targetEnd: string } => {
    const centerParts: string[] = []
    const srcParts:    string[] = []
    const tgtParts:    string[] = []

    // Center: protocol list when multiple protocols share this edge
    if (protocols.length > 1) {
      centerParts.push(protocols.join(' · '))
    }

    // Center: utilization
    const util = wmStore.edgeUtilMap[key]
    if (elStore.showUtilization && util) {
      centerParts.push(`${Math.round(util.utilPct)}% · ↑${formatBitsPerSec(util.inBps)} ↓${formatBitsPerSec(util.outBps)}`)
    }

    const d = wmStore.edgeLabelData[key]
    if (d) {
      // Source-end: local interface name
      if (elStore.showLocalPort && d.localIfName) srcParts.push(d.localIfName)

      // Target-end: remote interface name (prefer symmetric LLDP result; fall back to raw remotePortId)
      if (elStore.showRemotePort) {
        const remotePort = d.remoteIfName ?? d.remotePortId
        if (remotePort) tgtParts.push(remotePort)
      }

      // Source-end: local IP address
      if (elStore.showIp && d.localIp) srcParts.push(d.localIp)

      // Target-end: remote IP address
      if (elStore.showIp && d.remoteIp) tgtParts.push(d.remoteIp)

      // Source-end: MAC address
      if (elStore.showMac && d.localMac) srcParts.push(d.localMac)

      // Center: link speed
      if (elStore.showSpeed && d.ifSpeed) centerParts.push(`${formatBitsPerSec(d.ifSpeed)}bps`)
    }

    return {
      center:    centerParts.join('\n'),
      sourceEnd: srcParts.join('\n'),
      targetEnd: tgtParts.join('\n'),
    }
  }

  /**
   * Stamp the composed three-slot labels onto every edge in a single cy.batch().
   * Adds the 'weathermap' CSS class (which enables the label stylesheet rule) when
   * any label slot has content; removes it when all slots are empty.
   */
  const applyEdgeLabels = () => {
    if (!cy) return
    cy.batch(() => {
      cy!.edges().forEach(edge => {
        const key = edge.data('edgeKey') as string
        const protocols = (edge.data('protocols') as string[]) ?? []
        const label = composeEdgeLabel(key, protocols)
        const hasAny = label.center || label.sourceEnd || label.targetEnd
        if (hasAny) {
          edge.data('wmLabel',    label.center)
          edge.data('wmLabelSrc', label.sourceEnd)
          edge.data('wmLabelTgt', label.targetEnd)
          edge.addClass('weathermap')
        } else {
          edge.data('wmLabel',    '')
          edge.data('wmLabelSrc', '')
          edge.data('wmLabelTgt', '')
          edge.removeClass('weathermap')
        }
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

  watch(() => wmStore.edgeUtilMap, () => { applyWeathermapStyles(); applyEdgeLabels() })
  watch(() => wmStore.edgeLabelData, applyEdgeLabels)
  watch(() => wmStore.nodeDownMap, applyNodeDownStyles)
  watch(() => elStore.colorMode, applyWeathermapStyles)
  watch(() => [
    elStore.showUtilization,
    elStore.showLocalPort,
    elStore.showRemotePort,
    elStore.showIp,
    elStore.showMac,
    elStore.showSpeed,
  ], applyEdgeLabels)

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

  // Rebuild stylesheet when the OS color scheme or app theme changes so dark/light mode is respected
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rebuildStylesheet)
  }
  // React to app-level theme toggle (stored in appStore.theme as 'open-dark'/'open-light')
  watch(() => appStore.theme, rebuildStylesheet)

  let resizeObserver: ResizeObserver | null = null

  onMounted(async () => {
    initCytoscape()
    // Defer stylesheet rebuild to the next tick so Menubar.vue's onMounted has
    // had a chance to apply the theme class to document.documentElement, ensuring
    // CSS vars resolve to the correct light/dark values.
    await nextTick()
    rebuildStylesheet()
    if (store.vertices.length > 0) syncElements()

    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!cy) return
        cy.resize()
        cy.fit(undefined, 30)
      })
      resizeObserver.observe(containerRef.value)
    }
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', rebuildStylesheet)
    }
    cy?.destroy()
    cy = null
  })

  const toggleGrid = () => {
    viewStore.gridSnap.enabled = !viewStore.gridSnap.enabled
  }

  const alignToGrid = () => {
    if (!cy) return
    const size = viewStore.gridSnap.size || 40
    cy.batch(() => {
      cy!.nodes().forEach(n => {
        const pos = n.position()
        n.position({
          x: Math.round(pos.x / size) * size,
          y: Math.round(pos.y / size) * size,
        })
      })
    })
    saveLayout()
  }

  return { getCy: () => cy, saveLayout, resetLayout, toggleGrid, alignToGrid, pendingLinkSource, pendingLinkTarget, edgeTooltip, nodeTooltip }
}

export default useTopology
