# Topology Quick Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the edge-label halo color in light mode, and make the edge tooltip symmetric — showing A-side and Z-side interface data separately, with a four-series bandwidth chart.

**Architecture:** Pure frontend changes across three files. The halo fix passes the canvas DOM element to `buildStylesheet()` so it reads the actual rendered background color. The tooltip changes extend `EdgeLabelData` with Z-side fields (already fetchable from existing SNMP data, no new API calls), restructure the template into A/Z columns, and extend the bandwidth query to four series.

**Tech Stack:** TypeScript, Vue 3 composition API, Pinia, Cytoscape.js, Perses (for bandwidth chart). Build with `yarn build`, deploy with `./ui/deploy-to-container.sh`.

---

## File Map

| File | Change |
|------|--------|
| `ui/src/composables/useTopology.ts` | `buildStylesheet()` accepts canvas element; `tgtNodeId` in edge tooltip state |
| `ui/src/stores/weathermapStore.ts` | Add `remoteMac`, `remoteIfSpeed` to `EdgeLabelData`; populate from existing SNMP data |
| `ui/src/components/Topology/TopologyEdgeTooltip.vue` | A/Z column layout; `tgtNodeId` in interface; four-series bandwidth chart |

---

## Task 1: Fix edge label halo color in light mode

**Files:**
- Modify: `ui/src/composables/useTopology.ts` (lines ~69 and ~327 and ~451)

The canvas background is `var(--feather-background)`, but `cssVar('--feather-background')` may not resolve identically to the painted value at the time `buildStylesheet()` runs (timing, antialiasing). Reading the computed style directly from the DOM element guarantees an exact match.

- [ ] **Step 1: Update `buildStylesheet` signature to accept an optional canvas element**

In `useTopology.ts`, change line ~69 from:
```typescript
const buildStylesheet = (): any[] => {
  const defaultNodeColor = cssVar('--feather-primary')
  const selectedColor    = cssVar('--feather-primary-dark')
  const light = isLightMode()
  const labelTextColor    = light ? '#1a1a2e' : (cssVar('--feather-primary-text-on-surface') || '#e8eaed')
  const labelOutlineColor = light
    ? (cssVar('--feather-background') || '#b8c5d8')
    : (cssVar('--feather-surface') || '#0d1117')
```
to:
```typescript
const buildStylesheet = (canvasEl?: HTMLElement | null): any[] => {
  const defaultNodeColor = cssVar('--feather-primary')
  const selectedColor    = cssVar('--feather-primary-dark')
  const light = isLightMode()
  const labelTextColor    = light ? '#1a1a2e' : (cssVar('--feather-primary-text-on-surface') || '#e8eaed')
  const canvasBg = (canvasEl && light) ? getComputedStyle(canvasEl).backgroundColor : null
  const labelOutlineColor = light
    ? (canvasBg || cssVar('--feather-background') || '#dde4f0')
    : (cssVar('--feather-surface') || '#0d1117')
```

- [ ] **Step 2: Update `initCytoscape` to pass the container element**

Find the line inside `initCytoscape` (around line 327):
```typescript
    style: buildStylesheet(),
```
Change to:
```typescript
    style: buildStylesheet(containerRef.value),
```

- [ ] **Step 3: Update `rebuildStylesheet` to pass the container element**

Find `rebuildStylesheet` (around line 451):
```typescript
  const rebuildStylesheet = () => {
    cy?.style(buildStylesheet())
  }
```
Change to:
```typescript
  const rebuildStylesheet = () => {
    cy?.style(buildStylesheet(containerRef.value))
  }
```

- [ ] **Step 4: Build and verify — no halo pill visible on edge labels in light mode**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```
Expected: build succeeds, no TypeScript errors.

```bash
./ui/deploy-to-container.sh test-opennms
```
Switch to light mode, open topology. Edge labels (port, IP, utilization) should have no visible colored background bubble — text outline blends into canvas. Dark mode unchanged.

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/useTopology.ts
git commit -m "fix(topology): read canvas computed bg for edge label halo in light mode"
```

---

## Task 2: Add Z-side fields to EdgeLabelData

**Files:**
- Modify: `ui/src/stores/weathermapStore.ts`

The symmetric LLDP block already resolves `remoteIface` from `nodeIfIndexMap[tgtId]` (the target node's interface record, fetched in the same `_fetchAll` pass). We just need to read `physAddr` and `ifSpeed` from it — zero additional API calls.

- [ ] **Step 1: Extend the `EdgeLabelData` interface**

In `weathermapStore.ts`, change the interface (around line 20):
```typescript
export interface EdgeLabelData {
  localIfName?: string
  remotePortId?: string
  remoteIfName?: string
  localIp?: string
  remoteIp?: string
  localMac?: string
  ifSpeed?: number
}
```
to:
```typescript
export interface EdgeLabelData {
  localIfName?: string
  remotePortId?: string
  remoteIfName?: string
  localIp?: string
  remoteIp?: string
  localMac?: string
  ifSpeed?: number
  remoteMac?: string      // physAddr of target node's connecting interface
  remoteIfSpeed?: number  // ifSpeed of target node's connecting interface
}
```

- [ ] **Step 2: Populate `remoteMac` and `remoteIfSpeed` in the symmetric LLDP block**

Find the symmetric LLDP block (around line 189–197):
```typescript
          if (ifIndexMatch) {
            const remoteIface = nodeIfIndexMap[tgtId]?.get(Number(ifIndexMatch[1]))
            if (remoteIface) {
              data.remoteIfName = remoteIface.ifName ?? remoteIface.ifDescr ?? undefined
            }
          } else {
```
Change to:
```typescript
          if (ifIndexMatch) {
            const remoteIface = nodeIfIndexMap[tgtId]?.get(Number(ifIndexMatch[1]))
            if (remoteIface) {
              data.remoteIfName  = remoteIface.ifName ?? remoteIface.ifDescr ?? undefined
              data.remoteMac     = remoteIface.physAddr ?? undefined
              data.remoteIfSpeed = remoteIface.ifSpeed > 0 ? remoteIface.ifSpeed : undefined
            }
          } else {
```

- [ ] **Step 3: Populate Z-side fields in the fallback block too**

Find the fallback after the symmetric LLDP block (around line 202–204):
```typescript
      if (!data.remoteIfName) {
        const best = nodeSnmpMap[tgtId]
        if (best) data.remoteIfName = best.ifName ?? best.ifDescr ?? undefined
      }
```
Change to:
```typescript
      if (!data.remoteIfName) {
        const best = nodeSnmpMap[tgtId]
        if (best) {
          data.remoteIfName  = best.ifName ?? best.ifDescr ?? undefined
          data.remoteMac     = best.physAddr ?? undefined
          data.remoteIfSpeed = best.ifSpeed > 0 ? best.ifSpeed : undefined
        }
      }
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/stores/weathermapStore.ts
git commit -m "feat(topology): add remoteMac + remoteIfSpeed to EdgeLabelData"
```

---

## Task 3: Add `tgtNodeId` to edge tooltip state

**Files:**
- Modify: `ui/src/composables/useTopology.ts`
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue`

- [ ] **Step 1: Add `tgtNodeId` to the local `EdgeTooltipState` interface in `useTopology.ts`**

Find the interface definition (around line 209):
```typescript
  interface EdgeTooltipState {
    x: number
    y: number
    protocols: string[]
    srcLabel: string
    tgtLabel: string
    /** Numeric OpenNMS node ID of the source vertex — used to build measurements resource ID. */
    srcNodeId: string | null
    util?: { utilPct: number; inBps: number; outBps: number } | null
    labelData?: EdgeLabelData | null
  }
```
Change to:
```typescript
  interface EdgeTooltipState {
    x: number
    y: number
    protocols: string[]
    srcLabel: string
    tgtLabel: string
    srcNodeId: string | null
    tgtNodeId: string | null
    util?: { utilPct: number; inBps: number; outBps: number } | null
    labelData?: EdgeLabelData | null
  }
```

- [ ] **Step 2: Populate `tgtNodeId` in the `mouseover` edge handler**

Find the mouseover handler assignment (around line 409):
```typescript
      edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel, srcNodeId, util, labelData }
```
Change to:
```typescript
      const tgtNodeId = (cy.getElementById(tgtId)?.data('nodeID') as string | undefined) ?? null
      edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel, srcNodeId, tgtNodeId, util, labelData }
```

- [ ] **Step 3: Add `tgtNodeId` to the exported `EdgeTooltipState` interface in `TopologyEdgeTooltip.vue`**

Find the interface (around line 108):
```typescript
export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  /** Numeric OpenNMS node ID of the source vertex — used to build measurements resource ID. */
  srcNodeId: string | null
  util?: { utilPct: number; inBps: number; outBps: number } | null
  labelData?: EdgeLabelData | null
}
```
Change to:
```typescript
export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  srcNodeId: string | null
  tgtNodeId: string | null
  util?: { utilPct: number; inBps: number; outBps: number } | null
  labelData?: EdgeLabelData | null
}
```

- [ ] **Step 4: Build to confirm no type errors**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/useTopology.ts ui/src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): add tgtNodeId to edge tooltip state"
```

---

## Task 4: Restructure tooltip template into A/Z columns

**Files:**
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue` (template + script + style)

Replace the existing mixed `↔` label-data section with explicit A-side / Z-side columns. The existing `__label-data` block (lines ~52–79) is replaced entirely.

- [ ] **Step 1: Replace the label-data template block**

Find and replace this block in the template (lines ~52–79):
```html
    <div
      v-if="tooltip.labelData && (tooltip.labelData.localIfName || tooltip.labelData.remotePortId || tooltip.labelData.localIp || tooltip.labelData.remoteIp || tooltip.labelData.localMac || tooltip.labelData.ifSpeed)"
      class="edge-tooltip__label-data"
    >
      <div
        v-if="tooltip.labelData.localIfName || tooltip.labelData.remotePortId"
        class="edge-tooltip__field"
      >
        <span class="edge-tooltip__field-name">Port</span>
        <span>{{ tooltip.labelData.localIfName && tooltip.labelData.remotePortId
          ? `${tooltip.labelData.localIfName} ↔ ${tooltip.labelData.remotePortId}`
          : (tooltip.labelData.localIfName ?? tooltip.labelData.remotePortId) }}</span>
      </div>
      <div
        v-if="tooltip.labelData.localIp || tooltip.labelData.remoteIp"
        class="edge-tooltip__field"
      >
        <span class="edge-tooltip__field-name">IP</span>
        <span>{{ [tooltip.labelData.localIp, tooltip.labelData.remoteIp].filter(Boolean).join(' ↔ ') }}</span>
      </div>
      <div v-if="tooltip.labelData.localMac" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">MAC</span>
        <span>{{ tooltip.labelData.localMac }}</span>
      </div>
      <div v-if="tooltip.labelData.ifSpeed != null && tooltip.labelData.ifSpeed > 0" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">Speed</span>
        <span>{{ formatBitsPerSec(tooltip.labelData.ifSpeed) }}bps</span>
      </div>
    </div>
```
With:
```html
    <div v-if="tooltip.labelData && hasSideData" class="edge-tooltip__sides">
      <!-- A-side -->
      <div class="edge-tooltip__side">
        <div class="edge-tooltip__side-label">A</div>
        <div v-if="tooltip.labelData.localIfName" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">Port</span>
          <span>{{ tooltip.labelData.localIfName }}</span>
        </div>
        <div v-if="tooltip.labelData.localIp" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">IP</span>
          <span>{{ tooltip.labelData.localIp }}</span>
        </div>
        <div v-if="tooltip.labelData.localMac" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">MAC</span>
          <span>{{ tooltip.labelData.localMac }}</span>
        </div>
        <div v-if="tooltip.labelData.ifSpeed && tooltip.labelData.ifSpeed > 0" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">Speed</span>
          <span>{{ formatBitsPerSec(tooltip.labelData.ifSpeed) }}bps</span>
        </div>
      </div>
      <!-- Z-side -->
      <div class="edge-tooltip__side">
        <div class="edge-tooltip__side-label">Z</div>
        <div v-if="remotePort" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">Port</span>
          <span>{{ remotePort }}</span>
        </div>
        <div v-if="tooltip.labelData.remoteIp" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">IP</span>
          <span>{{ tooltip.labelData.remoteIp }}</span>
        </div>
        <div v-if="tooltip.labelData.remoteMac" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">MAC</span>
          <span>{{ tooltip.labelData.remoteMac }}</span>
        </div>
        <div v-if="tooltip.labelData.remoteIfSpeed && tooltip.labelData.remoteIfSpeed > 0" class="edge-tooltip__field">
          <span class="edge-tooltip__field-name">Speed</span>
          <span>{{ formatBitsPerSec(tooltip.labelData.remoteIfSpeed) }}bps</span>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Add `hasSideData` and `remotePort` computed properties to the script**

In the `<script setup>` section, after `const props = defineProps<...>()`, add:

```typescript
const remotePort = computed(() =>
  props.tooltip?.labelData?.remoteIfName ?? props.tooltip?.labelData?.remotePortId ?? null
)

const hasSideData = computed(() => {
  const d = props.tooltip?.labelData
  if (!d) return false
  return !!(d.localIfName || d.localIp || d.localMac || d.ifSpeed ||
            remotePort.value || d.remoteIp || d.remoteMac || d.remoteIfSpeed)
})
```

- [ ] **Step 3: Add SCSS for the A/Z sides layout**

In the `<style>` block, add after the `&__label-data` block:

```scss
  &__sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var($border-on-surface);
  }

  &__side {
    min-width: 0;
  }

  &__side-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($primary);
    margin-bottom: 4px;
  }
```

Also remove the old `&__label-data` SCSS block (it's no longer used):
```scss
  &__label-data {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var($border-on-surface);
  }
```

- [ ] **Step 4: Build and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error|Error" | head -20
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): A/Z side-by-side layout for edge tooltip interface data"
```

---

## Task 5: Extend bandwidth chart to four series

**Files:**
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue` (script section only)

- [ ] **Step 1: Add `remoteResourceId` computed**

In the script, after the existing `localResourceId` computed (around line 125), add:

```typescript
// Build the SNMP interface resource ID for the remote (target) side.
// Format: node[{tgtNodeId}].interfaceSnmp[{remoteIfName}-{remoteMac}]
const remoteResourceId = computed<string | null>(() => {
  const t = props.tooltip
  if (!t?.tgtNodeId || !t.labelData?.remoteIfName) return null
  const name = t.labelData.remoteIfName
  const suffix = t.labelData.remoteMac ? `${name}-${t.labelData.remoteMac}` : name
  return `node[${t.tgtNodeId}].interfaceSnmp[${suffix}]`
})
```

- [ ] **Step 2: Replace `bwQuery` computed with four-series version**

Replace the existing `bwQuery` computed (lines ~133–147):
```typescript
const bwQuery = computed<OpenNMSBatchQuerySpec | null>(() => {
  const rid = localResourceId.value
  if (!rid) return null
  return {
    batch: true,
    sources: [
      { resourceId: rid, attribute: 'ifHCInOctets',  aggregation: 'AVERAGE', label: 'inOctets',  transient: true },
      { resourceId: rid, attribute: 'ifHCOutOctets', aggregation: 'AVERAGE', label: 'outOctets', transient: true }
    ],
    expressions: [
      { value: 'inOctets * 8',  label: 'In (bps)'  },
      { value: 'outOctets * 8', label: 'Out (bps)' }
    ]
  }
})
```
With:
```typescript
const bwQuery = computed<OpenNMSBatchQuerySpec | null>(() => {
  const rid = localResourceId.value
  if (!rid) return null
  const remRid = remoteResourceId.value
  if (!remRid) {
    // Z-side resource unavailable — fall back to two-series (A-side only)
    return {
      batch: true,
      sources: [
        { resourceId: rid, attribute: 'ifHCInOctets',  aggregation: 'AVERAGE', label: 'inOctets',  transient: true },
        { resourceId: rid, attribute: 'ifHCOutOctets', aggregation: 'AVERAGE', label: 'outOctets', transient: true }
      ],
      expressions: [
        { value: 'inOctets * 8',  label: 'In (bps)'  },
        { value: 'outOctets * 8', label: 'Out (bps)' }
      ]
    }
  }
  return {
    batch: true,
    sources: [
      { resourceId: rid,    attribute: 'ifHCInOctets',  aggregation: 'AVERAGE', label: 'aInOctets',  transient: true },
      { resourceId: rid,    attribute: 'ifHCOutOctets', aggregation: 'AVERAGE', label: 'aOutOctets', transient: true },
      { resourceId: remRid, attribute: 'ifHCInOctets',  aggregation: 'AVERAGE', label: 'zInOctets',  transient: true },
      { resourceId: remRid, attribute: 'ifHCOutOctets', aggregation: 'AVERAGE', label: 'zOutOctets', transient: true },
    ],
    expressions: [
      { value: 'aInOctets * 8',  label: 'A In (bps)'  },
      { value: 'aOutOctets * 8', label: 'A Out (bps)' },
      { value: 'zInOctets * 8',  label: 'Z In (bps)'  },
      { value: 'zOutOctets * 8', label: 'Z Out (bps)' },
    ]
  }
})
```

- [ ] **Step 3: Build, deploy, verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Verify bundle hash matches:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Open topology in browser, hover over an edge with LLDP data. Confirm:
- A and Z side labels are visible with separate rows for Port / IP / MAC / Speed
- Bandwidth chart title shows "Bandwidth · last 2h" and has up to 4 series (A In, A Out, Z In, Z Out)
- On an edge with only A-side data, chart falls back to two-series gracefully

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): four-series bandwidth chart + A/Z sides complete"
```
