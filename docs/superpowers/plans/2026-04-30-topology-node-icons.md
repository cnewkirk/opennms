# Topology Node Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render network device SVG icons on topology nodes with stroke color driven by alarm severity, using a three-tier resolution system (user patterns → OpenNMS categories → built-in name patterns → server fallback).

**Architecture:** A new `useNodeIconResolver` composable owns all icon resolution logic and node data caching. It is called from `useTopology.ts` during initial render and again after async node category data arrives. Cytoscape nodes store the resolved SVG data URI as element data and the stylesheet reads it via `data(iconDataUri)`.

**Tech Stack:** Vue 3 + TypeScript, Cytoscape.js, Pinia, Vite (`?raw` SVG imports), Vitest + happy-dom

---

## File Map

```
NEW     ui/src/assets/topology-icons/console.svg
NEW     ui/src/assets/topology-icons/pdu.svg
MODIFY  ui/src/components/Topology/iconRegistry.ts          add getColoredIconDataUri()
MODIFY  ui/src/stores/topologyViewStore.ts                  add namePatternRules
NEW     ui/src/composables/useNodeIconResolver.ts
NEW     ui/tests/composables/useNodeIconResolver.test.ts
MODIFY  ui/src/composables/useTopology.ts                   stylesheet + syncElements + applySeverityClasses
MODIFY  ui/src/components/Topology/TopologyIconSettings.vue add Name Patterns section
```

---

### Task 1: Add console.svg and pdu.svg

**Files:**
- Create: `ui/src/assets/topology-icons/console.svg`
- Create: `ui/src/assets/topology-icons/pdu.svg`

- [ ] **Step 1: Create console.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="6" width="28" height="20" rx="2"/>
  <polyline points="8,13 13,16 8,19"/>
  <line x1="15" y1="19" x2="22" y2="19"/>
</svg>
```

- [ ] **Step 2: Create pdu.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="2" width="22" height="28" rx="2"/>
  <polyline points="19,7 14,16 18,16 13,25"/>
  <line x1="10" y1="7" x2="10" y2="9"/>
  <line x1="22" y1="7" x2="22" y2="9"/>
</svg>
```

- [ ] **Step 3: Verify icons render sanely**

Open each SVG in a browser to confirm the shapes are recognizable at small sizes (32px).

- [ ] **Step 4: Commit**

```bash
git add ui/src/assets/topology-icons/console.svg ui/src/assets/topology-icons/pdu.svg
git commit -m "feat: add console and pdu topology icons"
```

---

### Task 2: Extend iconRegistry.ts

**Files:**
- Modify: `ui/src/components/Topology/iconRegistry.ts`

- [ ] **Step 1: Write the failing test**

Create `ui/tests/components/Topology/iconRegistry.test.ts`:

```ts
// Vitest runs through the full Vite pipeline, so ?raw imports work natively —
// no mocking needed as long as the SVG files exist (created in Task 1).
import { describe, test, expect } from 'vitest'
import { getColoredIconDataUri } from '@/components/Topology/iconRegistry'

describe('iconRegistry — getColoredIconDataUri', () => {
  test('substitutes currentColor with the provided hex color', () => {
    const uri = getColoredIconDataUri('router', '#ef4444')
    const svg = decodeURIComponent(uri.split(',')[1])
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
    expect(svg).toContain('#ef4444')
    expect(svg).not.toContain('currentColor')
  })

  test('falls back to server icon for an unknown key', () => {
    const uri = getColoredIconDataUri('does-not-exist', '#fff')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
  })

  test('produces a valid data URI for console', () => {
    const uri = getColoredIconDataUri('console', '#f59e0b')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
    const svg = decodeURIComponent(uri.split(',')[1])
    expect(svg).toContain('#f59e0b')
  })

  test('produces a valid data URI for pdu', () => {
    const uri = getColoredIconDataUri('pdu', '#f59e0b')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ui && yarn test tests/components/Topology/iconRegistry.test.ts
```

Expected: FAIL — `getColoredIconDataUri is not a function`

- [ ] **Step 3: Update iconRegistry.ts**

Replace the entire file content:

```ts
import routerSvg          from '@/assets/topology-icons/router.svg?raw'
import switchSvg          from '@/assets/topology-icons/switch.svg?raw'
import switchL3Svg        from '@/assets/topology-icons/switch-l3.svg?raw'
import firewallSvg        from '@/assets/topology-icons/firewall.svg?raw'
import serverSvg          from '@/assets/topology-icons/server.svg?raw'
import wirelessApSvg      from '@/assets/topology-icons/wireless-ap.svg?raw'
import wirelessCtrlSvg    from '@/assets/topology-icons/wireless-controller.svg?raw'
import upsSvg             from '@/assets/topology-icons/ups.svg?raw'
import loadBalancerSvg    from '@/assets/topology-icons/load-balancer.svg?raw'
import cloudSvg           from '@/assets/topology-icons/cloud.svg?raw'
import genericSvg         from '@/assets/topology-icons/generic.svg?raw'
import consoleSvg         from '@/assets/topology-icons/console.svg?raw'
import pduSvg             from '@/assets/topology-icons/pdu.svg?raw'

const SVG_MAP: Record<string, string> = {
  router:                routerSvg,
  switch:                switchSvg,
  'switch-l3':           switchL3Svg,
  firewall:              firewallSvg,
  server:                serverSvg,
  'wireless-ap':         wirelessApSvg,
  'wireless-controller': wirelessCtrlSvg,
  ups:                   upsSvg,
  'load-balancer':       loadBalancerSvg,
  cloud:                 cloudSvg,
  generic:               genericSvg,
  console:               consoleSvg,
  pdu:                   pduSvg,
}

export const ICON_KEYS = Object.keys(SVG_MAP)

const _cache = new Map<string, string>()

/** Returns a `data:image/svg+xml` URI for Cytoscape background-image. Falls back to generic. */
export const getIconDataUri = (iconKey: string): string => {
  const key = SVG_MAP[iconKey] ? iconKey : 'generic'
  if (_cache.has(key)) return _cache.get(key)!
  const uri = `data:image/svg+xml,${encodeURIComponent(SVG_MAP[key])}`
  _cache.set(key, uri)
  return uri
}

/** Returns a `data:image/svg+xml` URI with `currentColor` replaced by `color`. Falls back to server icon. */
export const getColoredIconDataUri = (iconKey: string, color: string): string => {
  const key = SVG_MAP[iconKey] ? iconKey : 'server'
  const cacheKey = `${key}:${color}`
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!
  const colored = SVG_MAP[key].replaceAll('currentColor', color)
  const uri = `data:image/svg+xml,${encodeURIComponent(colored)}`
  _cache.set(cacheKey, uri)
  return uri
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ui && yarn test tests/components/Topology/iconRegistry.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Topology/iconRegistry.ts ui/tests/components/Topology/iconRegistry.test.ts
git commit -m "feat: add console/pdu icons and getColoredIconDataUri to icon registry"
```

---

### Task 3: Add namePatternRules to topologyViewStore

**Files:**
- Modify: `ui/src/stores/topologyViewStore.ts`

- [ ] **Step 1: Add namePatternRules ref**

After line 32 (`const lagPrefixPatterns = ref...`), add:

```ts
const namePatternRules = ref<Array<{ pattern: string; iconKey: string }>>([])
```

- [ ] **Step 2: Add to the return object**

In the `return { ... }` block at the bottom, add `namePatternRules` alongside the other icon refs:

```ts
return {
  gridSnap, filters, categoryIconMap, oidIconMap, lagPrefixPatterns, namePatternRules,
  // ... rest unchanged
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

```bash
cd ui && yarn test tests/stores/
```

Expected: all existing store tests pass

- [ ] **Step 4: Commit**

```bash
git add ui/src/stores/topologyViewStore.ts
git commit -m "feat: add namePatternRules to topologyViewStore"
```

---

### Task 4: Create useNodeIconResolver composable

**Files:**
- Create: `ui/src/composables/useNodeIconResolver.ts`
- Create: `ui/tests/composables/useNodeIconResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/composables/useNodeIconResolver.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { useNodeIconResolver } from '@/composables/useNodeIconResolver'
import { useTopologyViewStore } from '@/stores/topologyViewStore'

// Stub iconRegistry so tests don't need actual SVG files and return inspectable strings
vi.mock('@/components/Topology/iconRegistry', () => ({
  getColoredIconDataUri: (key: string, color: string) => `data:uri:${key}:${color}`,
}))

const makeVertex = (label: string, nodeID?: string) => ({
  id: nodeID ?? '1', namespace: 'test', label, nodeID,
})

describe('useNodeIconResolver', () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false })
  })

  test('built-in pattern: spine label resolves to router', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'NORMAL')).toBe('data:uri:router:#f59e0b')
  })

  test('built-in pattern: leaf label resolves to switch', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('leaf-02'), 'CRITICAL')).toBe('data:uri:switch:#ef4444')
  })

  test('built-in pattern: host label resolves to server', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('host-03'), 'NORMAL')).toBe('data:uri:server:#f59e0b')
  })

  test('built-in pattern: IP prefix label resolves to cloud', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('10.88.0.0/16'), 'NORMAL')).toBe('data:uri:cloud:#f59e0b')
  })

  test('built-in pattern: oob label resolves to console', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('oob-mgmt'), 'NORMAL')).toBe('data:uri:console:#f59e0b')
  })

  test('built-in pattern: pdu label resolves to pdu', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('rack-pdu-01'), 'NORMAL')).toBe('data:uri:pdu:#f59e0b')
  })

  test('fallback: unknown label resolves to server', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('xyzzy-unknown-42'), 'NORMAL')).toBe('data:uri:server:#f59e0b')
  })

  test('category mapping overrides built-in pattern', () => {
    const store = useTopologyViewStore()
    store.categoryIconMap = [{ key: 'Routers', iconKey: 'router' }]
    const { resolveIconDataUri } = useNodeIconResolver()
    const uri = resolveIconDataUri(
      makeVertex('host-01', '10'),
      'NORMAL',
      [{ id: 1, name: 'Routers', authorizedGroups: [] }]
    )
    expect(uri).toBe('data:uri:router:#f59e0b')
  })

  test('user pattern overrides category mapping', () => {
    const store = useTopologyViewStore()
    store.categoryIconMap = [{ key: 'Routers', iconKey: 'router' }]
    store.namePatternRules = [{ pattern: 'host.*', iconKey: 'firewall' }]
    const { resolveIconDataUri } = useNodeIconResolver()
    const uri = resolveIconDataUri(
      makeVertex('host-01', '10'),
      'NORMAL',
      [{ id: 1, name: 'Routers', authorizedGroups: [] }]
    )
    expect(uri).toBe('data:uri:firewall:#f59e0b')
  })

  test('CRITICAL severity maps to red (#ef4444)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'CRITICAL')).toContain('#ef4444')
  })

  test('MAJOR severity maps to orange (#f97316)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'MAJOR')).toContain('#f97316')
  })

  test('null severity falls back to default cyan (#06b6d4)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('10.0.0.0/8'), null)).toContain('#06b6d4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ui && yarn test tests/composables/useNodeIconResolver.test.ts
```

Expected: FAIL — `Cannot find module '@/composables/useNodeIconResolver'`

- [ ] **Step 3: Create useNodeIconResolver.ts**

```ts
import { getColoredIconDataUri } from '@/components/Topology/iconRegistry'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import type { TopologyVertex } from '@/types/topology'
import type { Category } from '@/types/index'

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL:      '#ef4444',
  MAJOR:         '#f97316',
  MINOR:         '#eab308',
  WARNING:       '#f59e0b',
  NORMAL:        '#f59e0b',
  INDETERMINATE: '#6b7280',
}
const DEFAULT_COLOR = '#06b6d4'

const BUILTIN_PATTERNS: Array<{ pattern: RegExp; iconKey: string }> = [
  { pattern: /spine/i,              iconKey: 'router'        },
  { pattern: /leaf/i,               iconKey: 'switch'        },
  { pattern: /fw|fire(wall)?/i,     iconKey: 'firewall'      },
  { pattern: /lb|load.?bal/i,       iconKey: 'load-balancer' },
  { pattern: /console|oob/i,        iconKey: 'console'       },
  { pattern: /\bpdu\b/i,            iconKey: 'pdu'           },
  { pattern: /\bups\b/i,            iconKey: 'ups'           },
  { pattern: /host/i,               iconKey: 'server'        },
  { pattern: /\d+\.\d+\.\d+/,      iconKey: 'cloud'         },
]

export const useNodeIconResolver = () => {
  const viewStore = useTopologyViewStore()

  const resolveIconKey = (
    vertex: TopologyVertex,
    categories?: Category[]
  ): string => {
    const label = vertex.label ?? ''

    // Priority 1: user-defined name pattern rules
    for (const rule of viewStore.namePatternRules) {
      try {
        if (new RegExp(rule.pattern, 'i').test(label)) return rule.iconKey
      } catch {
        // invalid regex — skip
      }
    }

    // Priority 2: OpenNMS category mapping
    if (categories?.length) {
      for (const cat of categories) {
        const mapping = viewStore.categoryIconMap.find(m => m.key === cat.name)
        if (mapping?.iconKey) return mapping.iconKey
      }
    }

    // Priority 3: built-in name patterns
    for (const { pattern, iconKey } of BUILTIN_PATTERNS) {
      if (pattern.test(label)) return iconKey
    }

    // Priority 4: server as bare-metal-host fallback
    return 'server'
  }

  const resolveIconDataUri = (
    vertex: TopologyVertex,
    severity: string | null,
    categories?: Category[]
  ): string => {
    const color = severity ? (SEVERITY_COLORS[severity] ?? DEFAULT_COLOR) : DEFAULT_COLOR
    const iconKey = resolveIconKey(vertex, categories)
    return getColoredIconDataUri(iconKey, color)
  }

  return { resolveIconDataUri }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ui && yarn test tests/composables/useNodeIconResolver.test.ts
```

Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/useNodeIconResolver.ts ui/tests/composables/useNodeIconResolver.test.ts
git commit -m "feat: add useNodeIconResolver composable with three-tier icon resolution"
```

---

### Task 5: Update buildStylesheet() in useTopology.ts

**Files:**
- Modify: `ui/src/composables/useTopology.ts:83-105`

- [ ] **Step 1: Update the base `node` selector in buildStylesheet()**

Replace the existing `node` selector CSS block (lines 85–105) with:

```ts
{
  selector: 'node',
  css: {
    'background-color': '#1f2937',
    'background-image': 'data(iconDataUri)',
    'background-fit': 'contain',
    'background-clip': 'none' as unknown as undefined,
    'background-image-opacity': 1,
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
```

- [ ] **Step 2: Remove the severity background-color class overrides**

Find the block that maps severity classes to background-color (currently lines 114–117):

```ts
...Object.entries(SEVERITY_CSS_VARS).map(([sev, varName]) => ({
  selector: `node.severity-${sev.toLowerCase()}`,
  css: { 'background-color': cssVar(varName) || varName }
})),
```

Replace it with severity border-color overrides (so the ring around each icon changes color instead of the fill):

```ts
...Object.entries(SEVERITY_CSS_VARS).map(([sev, varName]) => ({
  selector: `node.severity-${sev.toLowerCase()}`,
  css: { 'border-color': cssVar(varName) || '#f59e0b', 'border-width': 2.5 }
})),
```

- [ ] **Step 3: Verify the app still builds**

```bash
cd ui && yarn build 2>&1 | tail -5
```

Expected: no TypeScript errors, build succeeds

- [ ] **Step 4: Commit**

```bash
git add ui/src/composables/useTopology.ts
git commit -m "feat: update topology node stylesheet for dark background + icon rendering"
```

---

### Task 6: Wire resolver into syncElements() and applySeverityClasses()

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

- [ ] **Step 1: Import useNodeIconResolver**

At the top of `useTopology.ts`, alongside other imports, add:

```ts
import { useNodeIconResolver } from '@/composables/useNodeIconResolver'
import { getNodeById } from '@/services/nodeService'
import type { Category } from '@/types/index'
```

(`getNodeById` is a named export from `nodeService` — confirmed from its `export { ... }` block.)

- [ ] **Step 2: Instantiate the resolver inside useTopology()**

Inside `const useTopology = (containerRef) => {` (after the existing store declarations at line ~220), add:

```ts
const { resolveIconDataUri } = useNodeIconResolver()
// Cache of node categories keyed by string nodeID
const nodeCategoryCache = new Map<string, Category[]>()
```

- [ ] **Step 3: Add a helper to get severity for a vertex**

After the cache declaration, add:

```ts
const getSeverityForVertex = (vertexId: string): string | null => {
  const numericId = parseInt(vertexId, 10)
  return (!isNaN(numericId) && store.alarmSeverity[numericId])
    ? store.alarmSeverity[numericId]
    : null
}
```

- [ ] **Step 4: Update syncElements() to populate iconDataUri**

Inside `syncElements()`, update the `nodeElements` mapping to include `iconDataUri`:

```ts
const nodeElements = store.vertices.map(v => {
  const severity = getSeverityForVertex(v.id)
  const categories = v.nodeID ? nodeCategoryCache.get(v.nodeID) : undefined
  return {
    data: {
      id: v.id,
      label: v.label ?? v.id,
      baseLabel: v.label ?? v.id,
      nodeID: v.nodeID ?? v.id,
      ipAddress: v.ipAddress,
      namespace: v.namespace,
      iconDataUri: resolveIconDataUri(v, severity, categories),
    }
  }
})
```

- [ ] **Step 5: Fetch node categories after initial render**

At the end of `syncElements()`, after the existing `runLayout()` call, add a fire-and-forget fetch that enriches icons once category data arrives:

```ts
// Async enrichment: fetch node categories and re-apply icons where a category
// mapping produces a better result than the name-pattern fallback.
const verticesWithNodeId = store.vertices.filter(v => v.nodeID)
Promise.all(
  verticesWithNodeId.map(async v => {
    if (!v.nodeID || nodeCategoryCache.has(v.nodeID)) return
    try {
      const node = await getNodeById(v.nodeID)
      if (node?.categories?.length) {
        nodeCategoryCache.set(v.nodeID, node.categories)
        const el = cy?.getElementById(v.id)
        if (el) {
          const severity = getSeverityForVertex(v.id)
          el.data('iconDataUri', resolveIconDataUri(v, severity, node.categories))
        }
      }
    } catch { /* non-critical — name-pattern icon already applied */ }
  })
)
```

- [ ] **Step 6: Update applySeverityClasses() to refresh icon colors**

Inside `applySeverityClasses()`, after the existing severity class logic, add icon color refresh:

```ts
const applySeverityClasses = () => {
  if (!cy) return
  cy.nodes().forEach(node => {
    const numericId = parseInt(node.id(), 10)
    Object.keys(SEVERITY_CSS_VARS).forEach(sev => node.removeClass(`severity-${sev.toLowerCase()}`))
    if (!isNaN(numericId) && store.alarmSeverity[numericId]) {
      node.addClass(`severity-${store.alarmSeverity[numericId].toLowerCase()}`)
    }
    // Re-color icon to match new severity
    const vertex = store.vertices.find(v => v.id === node.id())
    if (vertex) {
      const severity = getSeverityForVertex(node.id())
      const categories = vertex.nodeID ? nodeCategoryCache.get(vertex.nodeID) : undefined
      node.data('iconDataUri', resolveIconDataUri(vertex, severity, categories))
    }
  })
}
```

- [ ] **Step 7: Verify build and check the UI**

```bash
cd ui && yarn build 2>&1 | tail -5
```

Then open http://localhost:8980/opennms/ui/topology and verify:
- Nodes show icons on dark backgrounds
- spine-01/02 show router icon
- leaf-01/02/03 show switch icon
- host-02 shows server icon
- IP prefix nodes (10.88.0.0/16) show cloud icon
- Severity alarm changes recolor the icon stroke and border ring

- [ ] **Step 8: Commit**

```bash
git add ui/src/composables/useTopology.ts
git commit -m "feat: wire useNodeIconResolver into topology rendering pipeline"
```

---

### Task 7: Add Name Patterns section to TopologyIconSettings.vue

**Files:**
- Modify: `ui/src/components/Topology/TopologyIconSettings.vue`

- [ ] **Step 1: Add the Name Patterns section to the template**

After the closing `</div>` of the "sysOID Prefix → Icon" section and its divider, add a new divider and section:

```html
<div class="icon-settings__divider"></div>

<div class="icon-settings__section">
  <div class="icon-settings__heading">Name Pattern → Icon</div>
  <div class="icon-settings__hint">
    Regex matched against node label (case-insensitive). Evaluated top-to-bottom — first match wins.
    Takes priority over category and built-in patterns.
  </div>
  <div
    v-for="(row, i) in patternRows"
    :key="i"
    class="icon-settings__row"
    draggable="true"
    @dragstart="dragStart(i)"
    @dragover.prevent
    @drop="dragDrop(i)"
  >
    <span class="icon-settings__drag-handle">⠿</span>
    <input
      v-model="row.pattern"
      class="icon-settings__input"
      placeholder="Regex (e.g. opennms.*)"
      @change="emitPatternRules"
    />
    <select v-model="row.iconKey" class="icon-settings__select" @change="emitPatternRules">
      <option value="">— none —</option>
      <option v-for="k in ICON_KEYS" :key="k" :value="k">{{ k }}</option>
    </select>
    <button class="icon-settings__del" @click="removePattern(i)">✕</button>
  </div>
  <button class="icon-settings__add" @click="addPattern">+ Add pattern</button>
</div>
```

- [ ] **Step 2: Update the script block**

In the `<script setup lang="ts">` block, add pattern row state and handlers:

```ts
// After existing refs (categoryRows, oidRows, etc.)
const patternRows = ref<Array<{ pattern: string; iconKey: string }>>(
  viewStore.namePatternRules.map(r => ({ ...r }))
)

let dragIndex = -1
const dragStart = (i: number) => { dragIndex = i }
const dragDrop = (i: number) => {
  if (dragIndex < 0 || dragIndex === i) return
  const moved = patternRows.value.splice(dragIndex, 1)[0]
  patternRows.value.splice(i, 0, moved)
  dragIndex = -1
  emitPatternRules()
}

const emitPatternRules = () => {
  viewStore.namePatternRules = patternRows.value
    .filter(r => r.pattern.trim() && r.iconKey)
    .map(r => ({ pattern: r.pattern.trim(), iconKey: r.iconKey }))
  viewStore.markDirty()
}

const addPattern = () => {
  patternRows.value.unshift({ pattern: '', iconKey: '' })
}

const removePattern = (i: number) => {
  patternRows.value.splice(i, 1)
  emitPatternRules()
}
```

- [ ] **Step 3: Add drag handle styles**

In the `<style lang="scss">` block, add inside `.icon-settings`:

```scss
&__drag-handle {
  cursor: grab;
  color: var($secondary-text-on-surface);
  font-size: 0.8rem;
  padding: 0 2px;
  user-select: none;
}
```

- [ ] **Step 4: Verify in browser**

Open the topology icon settings panel. Confirm:
- The "Name Pattern → Icon" section appears below OID
- You can add a pattern rule (e.g. `opennms.*` → server)
- Deleting works
- Dragging rows reorders them
- Saving updates the view store and icons update in the graph

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Topology/TopologyIconSettings.vue
git commit -m "feat: add name pattern rules section to topology icon settings"
```

---

### Task 8: Contrast check (Priority 2 — usability)

Before closing, verify that all severity icon colors meet WCAG AA contrast against `#1f2937`.

- [ ] **Step 1: Check contrast ratios**

Minimum contrast for icons: 3:1 against background (WCAG AA for graphical objects).

Background: `#1f2937` (luminance ≈ 0.023)

| Severity | Color | Approx ratio | Pass? |
|---|---|---|---|
| NORMAL/WARNING | `#f59e0b` | ~7.8:1 | ✓ |
| MINOR | `#eab308` | ~7.4:1 | ✓ |
| MAJOR | `#f97316` | ~6.2:1 | ✓ |
| CRITICAL | `#ef4444` | ~4.6:1 | ✓ |
| INDETERMINATE | `#6b7280` | ~2.6:1 | ✗ |
| DEFAULT | `#06b6d4` | ~5.9:1 | ✓ |

- [ ] **Step 2: Fix INDETERMINATE**

`#6b7280` fails (2.6:1). Replace with `#9ca3af` (gray-400, ratio ~4.1:1):

In `ui/src/composables/useNodeIconResolver.ts`, update:

```ts
INDETERMINATE: '#9ca3af',
```

- [ ] **Step 3: Re-run tests**

```bash
cd ui && yarn test tests/composables/useNodeIconResolver.test.ts
```

Expected: PASS (tests don't check the exact indeterminate hex — if a test does, update it to `#9ca3af`)

- [ ] **Step 4: Commit**

```bash
git add ui/src/composables/useNodeIconResolver.ts
git commit -m "fix: raise indeterminate severity icon color contrast to pass WCAG AA"
```
