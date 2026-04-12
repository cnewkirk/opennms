# Topology Edge Color Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-segment toolbar control (`Protocol | Utilization | Capacity`) that lets users switch edge coloring, with the active segment always visible as the mode indicator.

**Architecture:** `capacityColor()` added to `protocolColors.ts`; `edgeLabelStore` gains a `colorMode` field; `applyWeathermapStyles` in `useTopology.ts` branches on the mode; `TopologyToolbar.vue` renders the segmented control. Four files, no new components.

**Tech Stack:** Vue 3, Pinia, TypeScript, Cytoscape.js, SCSS (Feather DS variables)

---

## File Map

| File | Change |
|------|--------|
| `ui/src/components/Topology/protocolColors.ts` | Add `capacityColor` function |
| `ui/src/stores/edgeLabelStore.ts` | Add `colorMode` ref, persist to localStorage |
| `ui/src/composables/useTopology.ts` | Mode-aware `applyWeathermapStyles` + watcher |
| `ui/src/components/Topology/TopologyToolbar.vue` | 3-segment control HTML + SCSS |

---

### Task 1: Add `capacityColor` to `protocolColors.ts`

**Files:**
- Modify: `ui/src/components/Topology/protocolColors.ts`

- [ ] **Step 1: Append `capacityColor` to the file**

Add this function at the end of `ui/src/components/Topology/protocolColors.ts`, after `formatBitsPerSec`:

```ts
/**
 * Maps link capacity (ifSpeed in bits/sec) to a distinct tier color.
 * Uses categorical tiers — not a gradient — so each speed class is visually
 * identifiable at a glance (all 10G links are cyan, all 1G links are green, etc.).
 * Falls back to the neutral gray fallback color when ifSpeed is 0 or unknown.
 */
export const capacityColor = (ifSpeed: number): string => {
  if (ifSpeed >= 100_000_000_000) return '#a855f7'  // 100G+ — purple
  if (ifSpeed >= 40_000_000_000)  return '#3b82f6'  // 40G   — bright blue
  if (ifSpeed >= 10_000_000_000)  return '#06b6d4'  // 10G   — cyan
  if (ifSpeed >= 1_000_000_000)   return '#22c55e'  // 1G    — green
  if (ifSpeed >= 100_000_000)     return '#eab308'  // 100M  — yellow
  return FALLBACK_COLOR                              // <100M — gray
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Topology/protocolColors.ts
git commit -m "feat(topology): add capacityColor tier function to protocolColors"
```

---

### Task 2: Add `colorMode` to `edgeLabelStore`

**Files:**
- Modify: `ui/src/stores/edgeLabelStore.ts`

- [ ] **Step 1: Replace the store with a version that includes `colorMode`**

The current file is 32 lines. Replace it entirely with:

```ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'opennms-edge-label-config'

export const useEdgeLabelStore = defineStore('edgeLabelStore', () => {
  const _load = (): Record<string, unknown> => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  const _saved = _load()

  const showUtilization = ref<boolean>((_saved.showUtilization as boolean) ?? true)
  const showLocalPort   = ref<boolean>((_saved.showLocalPort   as boolean) ?? false)
  const showRemotePort  = ref<boolean>((_saved.showRemotePort  as boolean) ?? false)
  const showIp          = ref<boolean>((_saved.showIp          as boolean) ?? false)
  const showMac         = ref<boolean>((_saved.showMac         as boolean) ?? false)
  const showSpeed       = ref<boolean>((_saved.showSpeed       as boolean) ?? false)
  const colorMode       = ref<'protocol' | 'utilization' | 'capacity'>(
    _saved.colorMode === 'protocol' ? 'protocol'
    : _saved.colorMode === 'capacity' ? 'capacity'
    : 'utilization'
  )

  watch([showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed, colorMode], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      showUtilization: showUtilization.value,
      showLocalPort:   showLocalPort.value,
      showRemotePort:  showRemotePort.value,
      showIp:          showIp.value,
      showMac:         showMac.value,
      showSpeed:       showSpeed.value,
      colorMode:       colorMode.value
    }))
  })

  return { showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed, colorMode }
})
```

Key changes from the original:
- `_load` return type widened to `Record<string, unknown>` to accommodate the string `colorMode`
- Each boolean field cast with `as boolean` to satisfy TypeScript with the widened type
- `colorMode` is a 3-way union; defaults to `'utilization'` for any unrecognized/absent value
- `colorMode` included in the watch array and the serialized object

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/stores/edgeLabelStore.ts
git commit -m "feat(topology): add colorMode to edgeLabelStore"
```

---

### Task 3: Make `applyWeathermapStyles` mode-aware

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

- [ ] **Step 1: Add `capacityColor` to the import from protocolColors**

Find the existing import at the top of the file (around line 28):

```ts
import { getProtocolColor, utilizationColor, throughputWidth, formatBitsPerSec } from '@/components/Topology/protocolColors'
```

Replace with:

```ts
import { getProtocolColor, utilizationColor, throughputWidth, formatBitsPerSec, capacityColor } from '@/components/Topology/protocolColors'
```

- [ ] **Step 2: Update `applyWeathermapStyles` to branch on `colorMode`**

Find the existing function (around line 497):

```ts
const applyWeathermapStyles = () => {
  if (!cy) return
  cy.batch(() => {
    cy!.edges().forEach(edge => {
      const key = edge.data('edgeKey') as string
      const util = wmStore.edgeUtilMap[key]
      if (!util) {
        // revert to protocol color if data disappears
        edge.style('line-color', edge.data('color'))
        edge.style('width', 3)
        return
      }
      edge.style('line-color', utilizationColor(util.utilPct))
      edge.style('width', throughputWidth(util.inBps + util.outBps))
    })
  })
}
```

Replace with:

```ts
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
```

- [ ] **Step 3: Add a watcher for `colorMode`**

Find the block of existing weathermap watchers (around line 603):

```ts
watch(() => wmStore.edgeUtilMap, () => { applyWeathermapStyles(); applyEdgeLabels() })
watch(() => wmStore.edgeLabelData, applyEdgeLabels)
watch(() => wmStore.nodeDownMap, applyNodeDownStyles)
```

Add one line immediately after that block:

```ts
watch(() => elStore.colorMode, applyWeathermapStyles)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useTopology.ts
git commit -m "feat(topology): mode-aware edge color — protocol, utilization, capacity"
```

---

### Task 4: Add segmented control to the toolbar

**Files:**
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`

- [ ] **Step 1: Add the segmented control HTML**

In the template, find the comment `<!-- Filter -->` (around line 93). Insert the following block **immediately before** that comment, after the closing `</div>` of the `topology-toolbar__weathermap` group:

```html
    <!-- Edge Color Mode -->
    <div class="topology-toolbar__color-mode">
      <span class="topology-toolbar__color-label">Colors</span>
      <div class="topology-toolbar__seg">
        <button
          type="button"
          class="topology-toolbar__seg-btn"
          :class="{ active: elStore.colorMode === 'protocol' }"
          @click="elStore.colorMode = 'protocol'"
        >Protocol</button><button
          type="button"
          class="topology-toolbar__seg-btn"
          :class="{ active: elStore.colorMode === 'utilization' }"
          @click="elStore.colorMode = 'utilization'"
        >Utilization</button><button
          type="button"
          class="topology-toolbar__seg-btn"
          :class="{ active: elStore.colorMode === 'capacity' }"
          @click="elStore.colorMode = 'capacity'"
        >Capacity</button>
      </div>
    </div>
```

> **Important:** The three `<button>` elements must be adjacent with no whitespace between closing and opening tags (`</button><button>`). Whitespace between inline elements creates a 1px visual gap in the border between segments. The template above is correct — preserve it exactly.

The `elStore` ref is already imported and instantiated in the `<script setup>` section (`const elStore = useEdgeLabelStore()`). No new imports needed.

- [ ] **Step 2: Add the SCSS**

In the `<style lang="scss" scoped>` block, add the following rules inside the `.topology-toolbar { }` block, after the `&__wm-status` rule:

```scss
  &__color-mode {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__color-label {
    font-size: 0.73rem;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
  }

  &__seg {
    display: inline-flex;
    border-radius: vars.$border-radius-pill;
    overflow: hidden;
    border: 1px solid var($primary);
  }

  &__seg-btn {
    padding: 4px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var($primary);
    line-height: 1.5;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;

    &:not(:last-child) {
      border-right: 1px solid var($primary);
    }

    &.active {
      background: var($primary);
      color: #fff;
    }

    &:not(.active):hover {
      opacity: 0.8;
    }
  }
```

- [ ] **Step 3: Verify TypeScript and SCSS compile**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: clean build. If there are SCSS errors, confirm the new rules are nested inside `.topology-toolbar { }` (the existing scoped block), not at the top level.

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Topology/TopologyToolbar.vue
git commit -m "feat(topology): edge color mode segmented control in toolbar"
```

---

### Task 5: Deploy and verify

**Files:** None — verification only

- [ ] **Step 1: Confirm container is running**

```bash
podman ps --filter name=test-opennms --format '{{.Status}}'
```

If not running: `podman start test-opennms`, wait ~15s, then confirm:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/info
```

Expected: `200`

- [ ] **Step 2: Deploy**

```bash
cd /Users/chance/git/opennms && ./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 3: Verify bundle hashes match**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Both lines must be identical.

- [ ] **Step 4: Verify asset HTTP 200**

```bash
HASH=$(grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html)
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8980/opennms/ui/$HASH"
```

Expected: `200`

- [ ] **Step 5: Manual visual verification**

Hard-refresh: `Cmd+Option+R` (Safari) or Shift+Reload (Chrome).

1. Navigate to the Topology view.
2. Confirm the toolbar shows `Colors  [ Protocol | Utilization | Capacity ]` between the Weathermap group and the Filter button. **Utilization** should be filled (active) by default.
3. Click **Protocol** — edges switch to protocol colors (blue/green/orange per protocol type) at uniform width 3. "Protocol" segment fills.
4. Click **Utilization** — if weathermap data is loaded, edges switch to traffic-light gradient with variable widths. If no data, edges stay protocol-colored (correct fallback).
5. Click **Capacity** — edges switch to tier colors by link speed: cyan for 10G, green for 1G, yellow for 100M, etc. If no `ifSpeed` data, falls back to protocol color.
6. Reload the page — the selected mode persists (localStorage).
7. Confirm that toggling between modes is immediate (no page reload required).
