# Topology Protocol Layer Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render topology edges as parallel colored lines ("subway map") — one line per protocol — with a hover tooltip listing all protocols and a legend in the toolbar.

**Architecture:** A new `protocolColors.ts` constant file defines the palette and helpers. `useTopology.ts` expands multi-protocol store edges into N parallel Cytoscape edge elements, each colored and offset independently. A new `TopologyEdgeTooltip.vue` component is mounted in `TopologyGraph.vue` and positioned via reactive state returned from the composable. `TopologyToolbar.vue` gains a legend row derived from `store.edges`.

**Tech Stack:** Vue 3 Composition API, Cytoscape.js (bezier curve-style, programmatic element styles), TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `ui/src/components/Topology/protocolColors.ts` | **Create** | Protocol→hex map, `getProtocolColor()`, `parallelOffsets()` |
| `ui/src/composables/useTopology.ts` | **Modify** | Expand edges into parallel Cytoscape elements; add hover events; expose `edgeTooltip` ref |
| `ui/src/components/Topology/TopologyEdgeTooltip.vue` | **Create** | Floating tooltip component |
| `ui/src/components/Topology/TopologyGraph.vue` | **Modify** | Mount tooltip, wire `edgeTooltip` ref |
| `ui/src/components/Topology/TopologyToolbar.vue` | **Modify** | Add protocol legend row below layer chips |
| `ui/tests/components/Topology/protocolColors.test.ts` | **Create** | Unit tests for palette helpers |

---

### Task 1: Protocol color palette helpers

**Files:**
- Create: `ui/src/components/Topology/protocolColors.ts`
- Create: `ui/tests/components/Topology/protocolColors.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// ui/tests/components/Topology/protocolColors.test.ts
import { describe, it, expect } from 'vitest'
import { getProtocolColor, parallelOffsets, PROTOCOL_COLORS } from '@/components/Topology/protocolColors'

describe('getProtocolColor', () => {
  it('returns the correct hex for known protocols (case-insensitive)', () => {
    expect(getProtocolColor('LLDP')).toBe(PROTOCOL_COLORS['lldp'])
    expect(getProtocolColor('lldp')).toBe(PROTOCOL_COLORS['lldp'])
    expect(getProtocolColor('OSPF')).toBe(PROTOCOL_COLORS['ospf'])
    expect(getProtocolColor('BGP')).toBe(PROTOCOL_COLORS['bgp'])
    expect(getProtocolColor('IS-IS')).toBe(PROTOCOL_COLORS['is-is'])
  })

  it('returns fallback color for unknown protocols', () => {
    expect(getProtocolColor('unknown-protocol')).toBe('#718096')
  })

  it('handles "User Defined" as a known protocol', () => {
    expect(getProtocolColor('User Defined')).toBe(PROTOCOL_COLORS['user-defined'])
  })
})

describe('parallelOffsets', () => {
  it('returns [0] for a single protocol', () => {
    expect(parallelOffsets(1)).toEqual([0])
  })

  it('returns symmetric offsets for 2 protocols', () => {
    const offsets = parallelOffsets(2)
    expect(offsets).toHaveLength(2)
    expect(offsets[0]).toBeLessThan(0)
    expect(offsets[1]).toBeGreaterThan(0)
    expect(offsets[0]).toBe(-offsets[1])
  })

  it('returns symmetric offsets centered on 0 for 3 protocols', () => {
    const offsets = parallelOffsets(3)
    expect(offsets).toHaveLength(3)
    expect(offsets[1]).toBe(0)
    expect(offsets[0]).toBe(-offsets[2])
  })

  it('always returns n offsets for n protocols', () => {
    for (let n = 1; n <= 7; n++) {
      expect(parallelOffsets(n)).toHaveLength(n)
    }
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/chance/git/opennms/ui
./target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/protocolColors.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `protocolColors.ts`**

```ts
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

/**
 * Fixed protocol → color palette for topology edge rendering.
 * Keys are lowercase, hyphenated protocol names.
 */
export const PROTOCOL_COLORS: Record<string, string> = {
  'lldp':         '#4C9BE8',
  'ospf':         '#48BB78',
  'is-is':        '#ED8936',
  'isis':         '#ED8936',
  'bgp':          '#9F7AEA',
  'mpls':         '#F6AD55',
  'arp':          '#68D391',
  'mac':          '#68D391',
  'cdp':          '#FC8181',
  'cdpd':         '#FC8181',
  'user-defined': '#A0AEC0',
}

const FALLBACK_COLOR = '#718096'

/**
 * Returns the hex color for a given protocol name.
 * Case-insensitive. Falls back to neutral gray for unknown protocols.
 */
export const getProtocolColor = (protocol: string): string => {
  const key = protocol.toLowerCase().replace(/\s+/g, '-')
  return PROTOCOL_COLORS[key] ?? FALLBACK_COLOR
}

/**
 * Returns evenly-spaced, symmetric offsets for N parallel bezier edges.
 * n=1 → [0]  (straight)
 * n=2 → [-8, 8]
 * n=3 → [-8, 0, 8]
 */
export const parallelOffsets = (n: number): number[] => {
  if (n === 1) return [0]
  const spacing = 8
  return Array.from({ length: n }, (_, i) => Math.round((i - (n - 1) / 2) * spacing))
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd /Users/chance/git/opennms/ui
./target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/protocolColors.test.ts
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Topology/protocolColors.ts ui/tests/components/Topology/protocolColors.test.ts
git commit -m "feat(topology): add protocol color palette and parallel offset helpers"
```

---

### Task 2: Expand edges into parallel Cytoscape elements

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

**Context:** `syncElements()` (line ~320) currently creates one Cytoscape edge per `store.edges` entry, tagged with `multi-protocol` class when `protocolCount > 1`. We replace this with N parallel edges per edge, each carrying `data.protocol`, `data.color`, and `data.offset`. The `tap` edge handler at line ~267 already groups by `edgeKey` and still works unchanged. The `buildStylesheet()` function (line ~54) has an `edge.multi-protocol` rule that should be removed.

- [ ] **Step 1: Update imports at top of `useTopology.ts`**

Add this import after the existing imports (around line 27):
```ts
import { getProtocolColor, parallelOffsets } from '@/components/Topology/protocolColors'
```

- [ ] **Step 2: Remove `edge.multi-protocol` from `buildStylesheet()`**

Remove these lines from `buildStylesheet()` (currently lines 106–114):
```ts
    // Multi-protocol edges — thicker, colored to signal convergence of multiple layers
    {
      selector: 'edge.multi-protocol',
      css: {
        'width': 4,
        'line-color': multiEdgeColor || '#1f78c1',
        'opacity': 0.85
      }
    },
```

Also, in the base `edge` selector (around line 98), change `line-color` from `edgeColor` to `data(color)` and set width to 3:

Old:
```ts
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
```

New:
```ts
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
```

Also update the `edge.user-defined` selector — remove its `line-color` override (the base `edge` rule's `data(color)` already handles coloring; user-defined edges have `color: '#A0AEC0'` set in their data). The rule becomes:

```ts
    // User-defined edges — dashed, distinct color
    {
      selector: 'edge.user-defined',
      css: {
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4] as unknown as undefined,
        'opacity': 0.8
      }
    },
```

With `line-color` removed from `user-defined`, `multiEdgeColor` is now unused. Remove it from the top of `buildStylesheet()`:
```ts
    const multiEdgeColor   = cssVar('--feather-primary')   // remove this line
```

- [ ] **Step 3: Replace edge element creation in `syncElements()`**

Find `syncElements()` (around line 320). Replace the `edgeElements` block — from `const edgeElements = store.edges.map(...)` through the two `cy.edges().forEach(...)` calls that apply `multi-protocol` and `user-defined` classes — with:

```ts
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
            offset: offsets[i]
          }
        })
      })
    }

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
      if ((edge.data('protocol') as string) === 'User Defined') {
        edge.addClass('user-defined')
      }
    })
```

- [ ] **Step 4: Build and visually verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```
Expected: build succeeds, `src/main/dist/index.html` exists.

Load the topology map in a browser with multiple protocol layers active (LLDP + OSPF). Links shared between layers should now render as two thin parallel colored lines instead of one thick blue line.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useTopology.ts
git commit -m "feat(topology): expand multi-protocol edges into parallel colored Cytoscape elements"
```

---

### Task 3: Edge hover tooltip component

**Files:**
- Create: `ui/src/components/Topology/TopologyEdgeTooltip.vue`

- [ ] **Step 1: Create the tooltip component**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div
    v-if="tooltip"
    class="edge-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="edge-tooltip__endpoints">
      {{ tooltip.srcLabel }} ↔ {{ tooltip.tgtLabel }}
    </div>
    <div
      v-for="p in tooltip.protocols"
      :key="p"
      class="edge-tooltip__protocol"
    >
      <span
        class="edge-tooltip__chip"
        :style="{ backgroundColor: getProtocolColor(p) }"
      ></span>
      {{ p }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { getProtocolColor } from './protocolColors'

export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
}

defineProps<{ tooltip: EdgeTooltipState | null }>()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.edge-tooltip {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  min-width: 160px;
  transform: translate(12px, -50%);

  &__endpoints {
    font-size: 0.75rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
  }

  &__protocol {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    padding: 2px 0;
  }

  &__chip {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): add edge hover tooltip component"
```

---

### Task 4: Wire tooltip into TopologyGraph and useTopology

**Files:**
- Modify: `ui/src/composables/useTopology.ts`
- Modify: `ui/src/components/Topology/TopologyGraph.vue`

**Context:** `useTopology.ts` needs to expose an `edgeTooltip` ref and fire `mouseover`/`mouseout` events on Cytoscape edges. `TopologyGraph.vue` consumes it and mounts `<TopologyEdgeTooltip>`. The tooltip position uses `evt.renderedPosition` which is canvas-relative — `.topology-graph__canvas` is `top:0; left:0` inside `position: relative` `.topology-graph`, so rendered positions map directly.

- [ ] **Step 1: Add `EdgeTooltipState` type and `edgeTooltip` ref to `useTopology.ts`**

Add at the top of the `useTopology` function body (after `const store = useTopologyStore()`):

```ts
  interface EdgeTooltipState {
    x: number
    y: number
    protocols: string[]
    srcLabel: string
    tgtLabel: string
  }
  const edgeTooltip = ref<EdgeTooltipState | null>(null)
```

- [ ] **Step 2: Add mouseover/mouseout event handlers in `initCytoscape()`**

Add these two event bindings inside `initCytoscape()`, after the existing `cy.on('tap', ...)` blocks (before the `cy.on('dragfree', ...)` line):

```ts
    cy.on('mouseover', 'edge', (evt) => {
      if (!cy) return
      const edgeKey = evt.target.data('edgeKey') as string
      const parallelEdges = cy.edges(`[edgeKey = "${edgeKey}"]`)
      const protocols = parallelEdges.map(e => e.data('protocol') as string)

      const srcId = String(evt.target.data('source'))
      const tgtId = String(evt.target.data('target'))
      const srcLabel = cy.getElementById(srcId)?.data('label') as string ?? srcId
      const tgtLabel = cy.getElementById(tgtId)?.data('label') as string ?? tgtId

      const pos = evt.renderedPosition ?? { x: 0, y: 0 }
      edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel }
    })

    cy.on('mouseout', 'edge', () => {
      edgeTooltip.value = null
    })
```

- [ ] **Step 3: Export `edgeTooltip` from `useTopology`**

At the end of `useTopology`, change the return statement to include `edgeTooltip`:

```ts
  return { getCy: () => cy, saveLayout, resetLayout, pendingLinkSource, pendingLinkTarget, edgeTooltip }
```

- [ ] **Step 4: Update `TopologyGraph.vue`**

Add the import and template element. Full updated file:

In the `<template>`, add `<TopologyEdgeTooltip :tooltip="edgeTooltip" />` after `<TopologyDetailPanel />`:

```html
    <div ref="graphContainer" class="topology-graph__canvas" />
    <TopologyDetailPanel />
    <TopologyEdgeTooltip :tooltip="edgeTooltip" />
```

In `<script setup>`, add the import and destructure `edgeTooltip`:

```ts
import TopologyEdgeTooltip from './TopologyEdgeTooltip.vue'
import type { EdgeTooltipState } from './TopologyEdgeTooltip.vue'

const { saveLayout, resetLayout, pendingLinkSource, pendingLinkTarget, edgeTooltip } = useTopology(graphContainer)
```

(Replace the existing destructure line.)

- [ ] **Step 5: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```
Expected: build succeeds. In browser, hover over a topology edge — a tooltip should appear showing node labels and protocol chips.

- [ ] **Step 6: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useTopology.ts ui/src/components/Topology/TopologyGraph.vue
git commit -m "feat(topology): wire edge hover tooltip into composable and graph component"
```

---

### Task 5: Protocol legend in toolbar

**Files:**
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`

**Context:** `store.edges` is a computed array of `TopologyEdge & { protocols: string[] }`. We derive the set of protocols present in the loaded graph from it. The legend row sits below the existing chip buttons and shows a colored line segment + label per protocol. Only protocols actually present in `store.edges` are rendered.

- [ ] **Step 1: Add the legend row to the template**

Below the `<div class="topology-toolbar__layers">` block and before the `<FeatherInput>`, add:

```html
    <div v-if="presentProtocols.length" class="topology-toolbar__legend">
      <div
        v-for="p in presentProtocols"
        :key="p"
        class="topology-toolbar__legend-item"
      >
        <svg width="18" height="4" class="topology-toolbar__legend-line">
          <line x1="0" y1="2" x2="18" y2="2" :stroke="getProtocolColor(p)" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <span>{{ p }}</span>
      </div>
    </div>
```

- [ ] **Step 2: Add imports and computed to `<script setup>`**

Add after the existing imports:
```ts
import { getProtocolColor } from './protocolColors'
```

Add after `const store = useTopologyStore()`:
```ts
const presentProtocols = computed<string[]>(() => {
  const seen = new Set<string>()
  for (const e of store.edges) {
    for (const p of (e.protocols ?? [])) seen.add(p)
  }
  return Array.from(seen).sort()
})
```

- [ ] **Step 3: Add legend styles to `<style>`**

Inside the `.topology-toolbar` block, add:

```scss
  &__legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 10px;
  }

  &__legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
  }

  &__legend-line {
    flex-shrink: 0;
  }
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```
Expected: build succeeds. In the topology toolbar, a legend row appears below the layer chips showing colored lines with protocol names.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Topology/TopologyToolbar.vue
git commit -m "feat(topology): add protocol color legend to toolbar"
```

---

### Task 6: Deploy and end-to-end verify

- [ ] **Step 1: Deploy to container**

```bash
cd /Users/chance/git/opennms/ui
./deploy-to-container.sh test-opennms
```

- [ ] **Step 2: Verify live bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```
Both must match.

- [ ] **Step 3: Verify asset loads**

```bash
HASH=$(grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html)
curl -s -o /dev/null -w "%{http_code}" -L "http://localhost:8980/opennms/ui/$HASH"
```
Expected: `200`

- [ ] **Step 4: Manual verification checklist**

Hard-refresh (`Cmd+Shift+R`), navigate to Network Topology, enable multiple protocol layers (LLDP + OSPF minimum). Verify:

1. Links shared across layers render as 2+ thin parallel colored lines
2. Single-protocol links render as a single straight line (no curve offset)
3. Hovering a link shows tooltip: node A ↔ node B + protocol chips with correct colors
4. Legend row in toolbar shows the protocols present in the graph
5. Layer filter chips still work — deactivating OSPF hides orange lines, leaving LLDP blue lines
6. User-defined links still render dashed

- [ ] **Step 5: Run existing test suite**

```bash
cd /Users/chance/git/opennms/ui
./target/node/yarn/dist/bin/yarn vitest run
```
Expected: all existing tests pass; new `protocolColors.test.ts` passes.
