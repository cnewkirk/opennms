# Topology Edge Color Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a segmented control to the topology toolbar that lets users switch edge coloring between protocol-based and utilization-based, with the control itself serving as the persistent mode indicator.

**Architecture:** A new `colorMode` field in `edgeLabelStore` drives behavior in `applyWeathermapStyles` (useTopology.ts). The toolbar renders a two-segment button group that reads and writes `colorMode` directly. No new components — three existing files touched.

**Tech Stack:** Vue 3, Pinia, TypeScript, Cytoscape.js, SCSS (Feather DS variables)

---

## File Map

| File | Change |
|------|--------|
| `ui/src/stores/edgeLabelStore.ts` | Add `colorMode` ref, persist to localStorage |
| `ui/src/composables/useTopology.ts` | Mode-aware `applyWeathermapStyles`, new colorMode watcher |
| `ui/src/components/Topology/TopologyToolbar.vue` | Segmented control HTML + SCSS |

---

### Task 1: Add `colorMode` to `edgeLabelStore`

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
  const colorMode       = ref<'protocol' | 'utilization'>(
    _saved.colorMode === 'protocol' ? 'protocol' : 'utilization'
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
- `colorMode` defaults to `'utilization'` if absent from storage (preserves existing behavior on first load)
- `colorMode` added to the watch array and the serialized object

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: clean build, no errors. If there are TypeScript errors on the boolean casts, check that the `as boolean` pattern matches how Pinia's ref typing works — the `?? true` fallback guarantees a boolean at runtime.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/stores/edgeLabelStore.ts
git commit -m "feat(topology): add colorMode to edgeLabelStore"
```

---

### Task 2: Make `applyWeathermapStyles` mode-aware

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

- [ ] **Step 1: Update `applyWeathermapStyles` to check `colorMode`**

Find the existing function (around line 497 in the current file):

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
      const util = wmStore.edgeUtilMap[key]
      if (!util || elStore.colorMode === 'protocol') {
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

The only change is `if (!util)` → `if (!util || elStore.colorMode === 'protocol')`. When in protocol mode, every edge always gets its protocol color at fixed width 3, regardless of whether utilization data exists.

- [ ] **Step 2: Add a watcher for `colorMode`**

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

This re-applies edge colors immediately when the user toggles the segmented control, without waiting for the next weathermap poll.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useTopology.ts
git commit -m "feat(topology): mode-aware edge color — protocol vs utilization"
```

---

### Task 3: Add segmented control to the toolbar

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
        >Utilization</button>
      </div>
    </div>
```

> **Important:** The two `<button>` elements must have no whitespace between them (the `</button><button>` on adjacent lines with no gap). Whitespace between inline-block elements creates a 1px visual gap in the border between segments. The template above is written correctly — preserve it exactly.

The `elStore` ref is already imported and instantiated in the `<script setup>` section (`const elStore = useEdgeLabelStore()`). No new imports needed.

- [ ] **Step 2: Add the SCSS**

In the `<style>` block, find the `&__weathermap` rule (around line 580). Add the following rules after the `&__wm-status` rule and before `&__section` (or anywhere in the `.topology-toolbar` block — order doesn't matter for SCSS):

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

### Task 4: Deploy and verify

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
cd /Users/chance/git/opennms
./ui/deploy-to-container.sh test-opennms
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
2. Confirm the toolbar shows: `Colors  [ Protocol | Utilization ]` between the Weathermap group and the Filter button. "Utilization" should be filled (active) by default.
3. Click **Protocol** — the segment fills, "Utilization" goes to bordered-only. All edges immediately switch to protocol colors (blue/green/etc.) at uniform width.
4. Click **Utilization** — segment switches back. If weathermap data is loaded, edges return to utilization gradient colors with variable widths.
5. Reload the page — the selected mode should persist (localStorage).
6. Confirm that with weathermap data absent (e.g., refresh interval set to Off and no data loaded), both modes show protocol colors — no difference. This is expected.
