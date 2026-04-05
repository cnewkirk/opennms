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
import { Ref } from 'vue'
import { useTopologyStore } from '@/stores/topologyStore'

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
  const edgeColor        = cssVar('--feather-border-on-surface')
  const multiEdgeColor   = cssVar('--feather-primary')
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
        'width': 2,
        'line-color': edgeColor || '#4a5568',
        'target-arrow-shape': 'none',
        'curve-style': 'bezier',
        'opacity': 0.65
      }
    },
    // Multi-protocol edges — thicker, colored to signal convergence of multiple layers
    {
      selector: 'edge.multi-protocol',
      css: {
        'width': 4,
        'line-color': multiEdgeColor || '#1f78c1',
        'opacity': 0.85
      }
    },
    {
      selector: 'edge:selected',
      css: {
        'line-color': selectedColor || '#005eb8',
        'width': 4,
        'opacity': 1
      }
    }
  ]
}

const useTopology = (containerRef: Ref<HTMLElement | null>) => {
  const store = useTopologyStore()
  let cy: Core | null = null

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
      if (evt.target === cy) store.selectElement(null)
    })

    // Auto-save whenever the user finishes dragging a node
    cy.on('dragfree', 'node', saveLayout)
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
        nodeID: v.nodeID ?? v.id,
        ipAddress: v.ipAddress,
        namespace: v.namespace
      }
    }))

    // store.edges are already deduplicated (one per physical pair) with protocols[] attached
    const edgeElements = store.edges.map(e => {
      const src = e.source.id
      const tgt = e.target.id
      const key = `${Math.min(src, tgt)}-${Math.max(src, tgt)}`
      return {
        data: {
          id: `edge-${key}`,
          source: String(src),
          target: String(tgt),
          edgeKey: key,
          protocolCount: e.protocols?.length ?? 1
        }
      }
    })

    cy.add(nodeElements)
    cy.add(edgeElements)

    // Apply multi-protocol class for visual distinction
    cy.edges().forEach(edge => {
      if ((edge.data('protocolCount') ?? 1) > 1) edge.addClass('multi-protocol')
    })

    applySeverityClasses()
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

  watch(() => [store.vertices, store.edges], syncElements, { deep: true })

  watch(() => store.alarmSeverity, applySeverityClasses, { deep: true })

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

  return { getCy: () => cy, saveLayout, resetLayout }
}

export default useTopology
