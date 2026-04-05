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
import { isVertex } from '@/types/topology'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildStylesheet = (): any[] => {
  const defaultNodeColor  = cssVar('--feather-primary')
  const selectedColor     = cssVar('--feather-primary-dark')
  const textColor         = cssVar('--feather-primary-text-on-color')
  const edgeColor         = cssVar('--feather-border-on-surface')
  const labelOutlineColor = cssVar('--feather-surface')

  return [
    {
      selector: 'node',
      css: {
        'background-color': defaultNodeColor || '#1f78c1',
        'label': 'data(label)',
        'color': textColor || '#ffffff',
        'font-size': 11,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 4,
        'text-outline-width': 2,
        'text-outline-color': labelOutlineColor || '#ffffff',
        'width': 36,
        'height': 36,
        'border-width': 2,
        'border-color': labelOutlineColor || '#ffffff'
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
        'line-color': edgeColor || '#888888',
        'target-arrow-shape': 'none',
        'curve-style': 'bezier',
        'font-size': 9,
        'color': edgeColor || '#555555',
        'text-outline-width': 1,
        'text-outline-color': labelOutlineColor || '#ffffff'
      }
    },
    {
      selector: 'edge:selected',
      css: {
        'line-color': selectedColor || '#005eb8',
        'width': 3
      }
    }
  ]
}

const useTopology = (containerRef: Ref<HTMLElement | null>) => {
  const store = useTopologyStore()
  let cy: Core | null = null

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
      const edgeData = evt.target.data()
      const edge = store.edges.find(e =>
        String(e.source.id) === edgeData.source && String(e.target.id) === edgeData.target
      )
      if (edge) store.selectElement(edge)
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) store.selectElement(null)
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
        nodeID: v.nodeID ?? v.id,
        ipAddress: v.ipAddress,
        namespace: v.namespace
      }
    }))

    const edgeElements = store.edges.map((e, i) => ({
      data: {
        id: `edge-${i}`,
        source: String(e.source.id),
        target: String(e.target.id)
      }
    }))

    cy.add(nodeElements)
    cy.add(edgeElements)

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

  const runLayout = () => {
    if (!cy || cy.nodes().length === 0) return
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

  return { getCy: () => cy }
}

export default useTopology
