# Dashboard Drag+Drop / Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 12-column CSS grid dashboard with a Grafana-style drag+drop, resizable widget grid using gridstack.js, with layout persisted via dual-write (localStorage + OpenNMS user properties API).

**Architecture:** gridstack.js owns all positioning; Vue owns widget content. A `useDashboardLayout` composable encapsulates the gridstack lifecycle and is the reusable unit for expanding this pattern to other surfaces. The Pinia store orchestrates dual-write persistence on every layout change.

**Tech Stack:** gridstack.js, Vue 3, Pinia, Vitest, existing `rest` axios instance

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `ui/src/services/dashboardConfigService.ts` | Add `x/y/w/h` to `WidgetConfig`, add `loadFromServer`/`saveToServer`, migration guard |
| Modify | `ui/src/stores/dashboardStore.ts` | Add `updateLayout` action, wire dual-write |
| **Create** | `ui/src/composables/useDashboardLayout.ts` | gridstack lifecycle, drag/resize events → callback |
| Rewrite | `ui/src/components/Dashboard/DashboardGrid.vue` | gridstack container, wire composable |
| Modify | `ui/src/components/Dashboard/WidgetFrame.vue` | Add `.widget-drag-handle` class to header |
| Modify | `ui/src/containers/Dashboard.vue` | Remove `colSpan` from `WIDGET_DEFAULTS` |
| **Create** | `ui/tests/stores/dashboardStore.test.ts` | Store unit tests |
| **Create** | `ui/tests/composables/useDashboardLayout.test.ts` | Composable unit tests |

---

## Task 1: Install gridstack.js

**Files:**
- Modify: `ui/package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn add gridstack
```

Expected output: `success Saved 1 new dependency` (or similar). gridstack has no peer deps.

- [ ] **Step 2: Verify import resolves**

```bash
ls node_modules/gridstack/dist/gridstack.js
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/package.json ui/yarn.lock && git commit -m "chore(dashboard): add gridstack.js dependency"
```

---

## Task 2: Extend WidgetConfig data model + migration

**Files:**
- Modify: `ui/src/services/dashboardConfigService.ts`

- [ ] **Step 1: Write failing test**

Create `ui/tests/stores/dashboardStore.test.ts`:

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] }
})

import { loadConfig, defaultConfig, saveConfig } from '@/services/dashboardConfigService'

describe('dashboardConfigService', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
  })

  test('default config widgets have x, y, w, h fields', () => {
    const config = defaultConfig()
    for (const w of config.widgets) {
      expect(typeof w.x).toBe('number')
      expect(typeof w.y).toBe('number')
      expect(typeof w.w).toBe('number')
      expect(typeof w.h).toBe('number')
    }
  })

  test('loadConfig discards old colSpan-only config and returns defaults', () => {
    // simulate old v1 config without x/y/h
    store['opennms.dashboard.config'] = JSON.stringify({
      version: 1,
      widgets: [{ id: 'w1', type: 'summary', title: 'S', colSpan: 12, categories: [], limit: 0, refreshInterval: 60, severities: [] }]
    })
    const config = loadConfig()
    // should fall back to defaults since no x/y/h fields
    expect(config.widgets[0].x).toBe(0)
    expect(config.widgets[0].y).toBe(0)
  })

  test('loadConfig restores valid config from localStorage', () => {
    const saved = defaultConfig()
    saveConfig(saved)
    const loaded = loadConfig()
    expect(loaded.widgets).toHaveLength(saved.widgets.length)
    expect(loaded.widgets[0].x).toBe(saved.widgets[0].x)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/stores/dashboardStore.test.ts 2>&1 | tail -20
```

Expected: FAIL — `w.x` is undefined because `WidgetConfig` has no `x` field yet.

- [ ] **Step 3: Rewrite dashboardConfigService.ts**

Replace `ui/src/services/dashboardConfigService.ts` entirely:

```typescript
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

import { rest } from './axiosInstances'

export type WidgetType = 'summary' | 'outages' | 'alarms' | 'nodes'

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  // gridstack layout
  x: number
  y: number
  w: number
  h: number
  // widget settings
  categories: string[]
  limit: number
  refreshInterval: number
  severities: string[]
}

export interface DashboardConfig {
  version: number
  widgets: WidgetConfig[]
}

const STORAGE_KEY = 'opennms.dashboard.config'
const CONFIG_VERSION = 2
const USER_PROP_KEY = 'ui.dashboard.layout'

const defaultConfig = (): DashboardConfig => ({
  version: CONFIG_VERSION,
  widgets: [
    { id: 'widget-summary', type: 'summary', title: 'Network Summary',  x: 0, y: 0, w: 12, h: 2, categories: [], limit: 0,  refreshInterval: 60,  severities: [] },
    { id: 'widget-outages', type: 'outages', title: 'Active Outages',   x: 0, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: [] },
    { id: 'widget-alarms',  type: 'alarms',  title: 'Active Alarms',    x: 6, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: ['CRITICAL', 'MAJOR', 'MINOR'] },
    { id: 'widget-nodes',   type: 'nodes',   title: 'Nodes',            x: 0, y: 5, w: 12, h: 3, categories: [], limit: 10, refreshInterval: 120, severities: [] }
  ]
})

/** Returns true if the parsed config has the new x/y/w/h layout fields */
const isValidV2Config = (config: DashboardConfig): boolean =>
  config.version === CONFIG_VERSION &&
  config.widgets.length > 0 &&
  typeof config.widgets[0].x === 'number' &&
  typeof config.widgets[0].y === 'number' &&
  typeof config.widgets[0].h === 'number'

const loadConfig = (): DashboardConfig => {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (json) {
      const parsed = JSON.parse(json) as DashboardConfig
      if (isValidV2Config(parsed)) return parsed
    }
  } catch {
    // corrupt storage — fall through to default
  }
  return defaultConfig()
}

const saveConfig = (config: DashboardConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

const resetConfig = (): DashboardConfig => {
  const config = defaultConfig()
  saveConfig(config)
  return config
}

const loadFromServer = async (username: string): Promise<DashboardConfig | null> => {
  try {
    const resp = await rest.get(`users/${username}/properties/${USER_PROP_KEY}`)
    const json = resp.data?.value as string | undefined
    if (!json) return null
    const parsed = JSON.parse(json) as DashboardConfig
    if (isValidV2Config(parsed)) return parsed
  } catch {
    // 404 or parse error — no server config yet
  }
  return null
}

const saveToServer = async (username: string, config: DashboardConfig): Promise<void> => {
  try {
    await rest.put(`users/${username}/properties/${USER_PROP_KEY}`, { value: JSON.stringify(config) })
  } catch {
    // non-fatal — localStorage is the fallback
  }
}

export { loadConfig, saveConfig, resetConfig, defaultConfig, loadFromServer, saveToServer }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/stores/dashboardStore.test.ts 2>&1 | tail -20
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/services/dashboardConfigService.ts ui/tests/stores/dashboardStore.test.ts && git commit -m "feat(dashboard): extend WidgetConfig with gridstack x/y/w/h, add server persistence helpers"
```

---

## Task 3: Extend dashboardStore with updateLayout + dual-write

**Files:**
- Modify: `ui/src/stores/dashboardStore.ts`
- Modify: `ui/tests/stores/dashboardStore.test.ts`

- [ ] **Step 1: Add store tests to the existing test file**

Append to `ui/tests/stores/dashboardStore.test.ts`:

```typescript
import { useDashboardStore } from '@/stores/dashboardStore'
import * as service from '@/services/dashboardConfigService'

describe('dashboardStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  test('updateLayout merges x/y/w/h onto matching widgets', () => {
    const dashStore = useDashboardStore()
    // simulate gridstack reporting new positions
    dashStore.updateLayout([
      { id: 'widget-summary', x: 0, y: 0, w: 12, h: 3 },
      { id: 'widget-outages', x: 0, y: 3, w: 4,  h: 2 }
    ])
    const summary = dashStore.widgets.find(w => w.id === 'widget-summary')
    expect(summary?.h).toBe(3)
    const outages = dashStore.widgets.find(w => w.id === 'widget-outages')
    expect(outages?.w).toBe(4)
    expect(outages?.y).toBe(3)
  })

  test('updateLayout ignores unknown ids', () => {
    const dashStore = useDashboardStore()
    const before = dashStore.widgets.length
    dashStore.updateLayout([{ id: 'nonexistent', x: 0, y: 0, w: 6, h: 2 }])
    expect(dashStore.widgets.length).toBe(before)
  })

  test('reset restores default widget count', () => {
    const dashStore = useDashboardStore()
    dashStore.removeWidget('widget-summary')
    dashStore.reset()
    expect(dashStore.widgets.length).toBe(4)
  })
})
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/stores/dashboardStore.test.ts 2>&1 | tail -20
```

Expected: FAIL — `dashStore.updateLayout is not a function`.

- [ ] **Step 3: Rewrite dashboardStore.ts**

Replace `ui/src/stores/dashboardStore.ts` entirely:

```typescript
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
import {
  type WidgetConfig,
  type DashboardConfig,
  loadConfig,
  saveConfig,
  resetConfig,
  loadFromServer,
  saveToServer
} from '@/services/dashboardConfigService'
import { useMenuStore } from '@/stores/menuStore'

interface GridStackNode {
  id?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

export const useDashboardStore = defineStore('dashboardStore', () => {
  const config = ref<DashboardConfig>(loadConfig())
  const menuStore = useMenuStore()

  const widgets = computed(() => config.value.widgets)

  // server-sync debounce handle
  let syncTimer: ReturnType<typeof setTimeout> | null = null

  const persist = () => {
    saveConfig(config.value)
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      const username = menuStore.mainMenu?.username
      if (username) saveToServer(username, config.value)
    }, 2000)
  }

  /** Called on mount — try server first, fall back to localStorage */
  const initialize = async () => {
    const username = menuStore.mainMenu?.username
    if (username) {
      const serverConfig = await loadFromServer(username)
      if (serverConfig) {
        config.value = serverConfig
        saveConfig(serverConfig) // hydrate localStorage cache
        return
      }
    }
    // localStorage already loaded at store init — push it to server if username available
    if (username) saveToServer(username, config.value)
  }

  /** Called by useDashboardLayout on every drag/resize event */
  const updateLayout = (items: GridStackNode[]) => {
    for (const item of items) {
      if (!item.id) continue
      const widget = config.value.widgets.find(w => w.id === item.id)
      if (!widget) continue
      if (item.x !== undefined) widget.x = item.x
      if (item.y !== undefined) widget.y = item.y
      if (item.w !== undefined) widget.w = item.w
      if (item.h !== undefined) widget.h = item.h
    }
    persist()
  }

  const updateWidget = (updated: WidgetConfig) => {
    const idx = config.value.widgets.findIndex(w => w.id === updated.id)
    if (idx !== -1) {
      config.value.widgets.splice(idx, 1, updated)
      persist()
    }
  }

  const addWidget = (widget: WidgetConfig) => {
    config.value.widgets.push(widget)
    persist()
  }

  const removeWidget = (widgetId: string) => {
    config.value.widgets = config.value.widgets.filter(w => w.id !== widgetId)
    persist()
  }

  const reset = () => {
    config.value = resetConfig()
    persist()
  }

  return {
    config,
    widgets,
    initialize,
    updateLayout,
    updateWidget,
    addWidget,
    removeWidget,
    reset
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/stores/dashboardStore.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/stores/dashboardStore.ts ui/tests/stores/dashboardStore.test.ts && git commit -m "feat(dashboard): add updateLayout action and dual-write persistence to store"
```

---

## Task 4: Create useDashboardLayout composable

**Files:**
- Create: `ui/src/composables/useDashboardLayout.ts`
- Create: `ui/tests/composables/useDashboardLayout.test.ts`

- [ ] **Step 1: Write failing test**

Create `ui/tests/composables/useDashboardLayout.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// gridstack is a DOM library — mock it entirely in unit tests
vi.mock('gridstack', () => {
  const mockGrid = {
    on: vi.fn(),
    destroy: vi.fn(),
    makeWidget: vi.fn(),
    removeWidget: vi.fn(),
    batchUpdate: vi.fn(),
    commit: vi.fn()
  }
  return {
    GridStack: {
      init: vi.fn(() => mockGrid)
    }
  }
})

import { GridStack } from 'gridstack'
import useDashboardLayout from '@/composables/useDashboardLayout'
import { defaultConfig } from '@/services/dashboardConfigService'

describe('useDashboardLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  test('initializes gridstack on mount', () => {
    const container = ref<HTMLElement | null>(document.createElement('div'))
    const widgets = ref(defaultConfig().widgets)
    const onLayoutChange = vi.fn()

    mount(defineComponent({
      setup() {
        useDashboardLayout(container, widgets, onLayoutChange)
        return {}
      },
      template: '<div />'
    }))

    expect(GridStack.init).toHaveBeenCalledOnce()
  })

  test('destroys gridstack on unmount', async () => {
    const { GridStack: GS } = await import('gridstack')
    const mockGrid = (GS.init as ReturnType<typeof vi.fn>).mock.results[0]?.value ?? { destroy: vi.fn(), on: vi.fn(), makeWidget: vi.fn(), batchUpdate: vi.fn(), commit: vi.fn() }

    const container = ref<HTMLElement | null>(document.createElement('div'))
    const widgets = ref(defaultConfig().widgets)

    const wrapper = mount(defineComponent({
      setup() {
        useDashboardLayout(container, widgets, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    wrapper.unmount()
    expect(mockGrid.destroy).toHaveBeenCalled()
  })

  test('registers change and resize handlers on init', () => {
    const { GridStack: GS } = require('gridstack')
    const mockGrid = (GS.init as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value

    const container = ref<HTMLElement | null>(document.createElement('div'))
    const widgets = ref(defaultConfig().widgets)

    mount(defineComponent({
      setup() {
        useDashboardLayout(container, widgets, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    const events = (mockGrid.on as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0])
    expect(events).toContain('change')
    expect(events).toContain('resizestop')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/composables/useDashboardLayout.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the composable**

Create `ui/src/composables/useDashboardLayout.ts`:

```typescript
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

import { GridStack, type GridStackNode, type GridStackOptions } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import { type Ref } from 'vue'
import { type WidgetConfig } from '@/services/dashboardConfigService'

const GRID_OPTIONS: GridStackOptions = {
  column: 12,
  cellHeight: 150,
  margin: 8,
  animate: true,
  handle: '.widget-drag-handle',
  resizable: { handles: 'se' }
}

/**
 * Reusable composable for gridstack drag+drop/resize grids.
 *
 * Usage:
 *   const { addItem, removeItem } = useDashboardLayout(containerRef, widgets, onLayoutChange)
 *
 * @param containerRef - ref to the gridstack container div
 * @param widgets      - reactive list of widget configs (read on mount; changes handled via addItem/removeItem)
 * @param onLayoutChange - called with updated GridStackNode[] on every drag/resize
 */
const useDashboardLayout = (
  containerRef: Ref<HTMLElement | null>,
  widgets: Ref<WidgetConfig[]>,
  onLayoutChange: (items: GridStackNode[]) => void
) => {
  let grid: ReturnType<typeof GridStack.init> | null = null

  onMounted(() => {
    if (!containerRef.value) return

    grid = GridStack.init(GRID_OPTIONS, containerRef.value)

    // Fired after drag ends — reports all moved items
    grid.on('change', (_event: Event, items: GridStackNode[]) => {
      onLayoutChange(items)
    })

    // Fired after resize handle released — reports the resized item
    grid.on('resizestop', (_event: Event, el: HTMLElement) => {
      const node = (el as any).gridstackNode as GridStackNode | undefined
      if (node) onLayoutChange([node])
    })
  })

  onUnmounted(() => {
    grid?.destroy(false) // false = keep DOM, Vue handles unmount
    grid = null
  })

  /**
   * Call after programmatically pushing a new widget into the reactive list.
   * Pass the container element for that widget so gridstack can track it.
   */
  const addItem = (el: HTMLElement) => {
    grid?.makeWidget(el)
  }

  /**
   * Call before removing a widget from the reactive list.
   */
  const removeItem = (el: HTMLElement) => {
    grid?.removeWidget(el, false) // false = don't remove DOM
  }

  return { addItem, removeItem }
}

export default useDashboardLayout
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/composables/useDashboardLayout.test.ts 2>&1 | tail -20
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/composables/useDashboardLayout.ts ui/tests/composables/useDashboardLayout.test.ts && git commit -m "feat(dashboard): add useDashboardLayout composable (gridstack lifecycle)"
```

---

## Task 5: Add drag handle to WidgetFrame

**Files:**
- Modify: `ui/src/components/Dashboard/WidgetFrame.vue`

No new tests needed — this is a CSS class addition on an existing element.

- [ ] **Step 1: Add `.widget-drag-handle` to the header div**

In `ui/src/components/Dashboard/WidgetFrame.vue`, find:

```html
    <div class="widget-header">
```

Replace with:

```html
    <div class="widget-header widget-drag-handle">
```

- [ ] **Step 2: Add cursor style for the handle in the scoped styles**

Find the `.widget-header` rule in the `<style scoped>` block and add `cursor: grab`:

```scss
.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var($border-light-on-surface);
  flex-shrink: 0;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/components/Dashboard/WidgetFrame.vue && git commit -m "feat(dashboard): add widget-drag-handle class to WidgetFrame header"
```

---

## Task 6: Rewrite DashboardGrid.vue

**Files:**
- Rewrite: `ui/src/components/Dashboard/DashboardGrid.vue`

This is the most significant change — replaces the CSS grid with gridstack markup.

- [ ] **Step 1: Rewrite DashboardGrid.vue**

Replace `ui/src/components/Dashboard/DashboardGrid.vue` entirely:

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
    ref="gridContainerRef"
    class="grid-stack"
  >
    <div
      v-for="widget in widgets"
      :key="widget.id"
      :ref="el => registerItemRef(widget.id, el as HTMLElement)"
      class="grid-stack-item"
      :gs-id="widget.id"
      :gs-x="widget.x"
      :gs-y="widget.y"
      :gs-w="widget.w"
      :gs-h="widget.h"
    >
      <div class="grid-stack-item-content">
        <WidgetFrame
          :title="widget.title"
          :loading="loadingMap[widget.id]"
          @refresh="refreshWidget(widget.id)"
          @configure="openConfig(widget)"
          @remove="onRemove(widget.id)"
        >
          <SummaryWidget
            v-if="widget.type === 'summary'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <OutagesWidget
            v-else-if="widget.type === 'outages'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <AlarmsWidget
            v-else-if="widget.type === 'alarms'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
          <NodesWidget
            v-else-if="widget.type === 'nodes'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget"
          />
        </WidgetFrame>
      </div>
    </div>
  </div>

  <WidgetConfigDialog
    v-if="configuringWidget"
    :visible="!!configuringWidget"
    :widget-config="configuringWidget"
    @close="configuringWidget = null"
    @save="onConfigSaved"
  />
</template>

<script setup lang="ts">
import { type GridStackNode } from 'gridstack'
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig } from '@/services/dashboardConfigService'
import useDashboardLayout from '@/composables/useDashboardLayout'
import WidgetFrame from './WidgetFrame.vue'
import WidgetConfigDialog from './WidgetConfigDialog.vue'
import SummaryWidget from './widgets/SummaryWidget.vue'
import OutagesWidget from './widgets/OutagesWidget.vue'
import AlarmsWidget from './widgets/AlarmsWidget.vue'
import NodesWidget from './widgets/NodesWidget.vue'

const dashboardStore = useDashboardStore()
const widgets = computed(() => dashboardStore.widgets)

const gridContainerRef = ref<HTMLElement | null>(null)
const itemRefs: Record<string, HTMLElement | null> = {}
const widgetRefs = ref<Record<string, { refresh: () => void } | null>>({})
const loadingMap = ref<Record<string, boolean>>({})
const configuringWidget = ref<WidgetConfig | null>(null)

const registerItemRef = (id: string, el: HTMLElement | null) => {
  itemRefs[id] = el
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerWidgetRef = (id: string, el: any) => {
  widgetRefs.value[id] = el as { refresh: () => void } | null
}

const onLayoutChange = (items: GridStackNode[]) => {
  dashboardStore.updateLayout(items)
}

const { addItem, removeItem } = useDashboardLayout(gridContainerRef, widgets, onLayoutChange)

const refreshWidget = async (widgetId: string) => {
  loadingMap.value[widgetId] = true
  await widgetRefs.value[widgetId]?.refresh()
  loadingMap.value[widgetId] = false
}

const openConfig = (widget: WidgetConfig) => {
  configuringWidget.value = { ...widget }
}

const onConfigSaved = (updated: WidgetConfig) => {
  dashboardStore.updateWidget(updated)
  configuringWidget.value = null
}

const onRemove = (widgetId: string) => {
  const el = itemRefs[widgetId]
  if (el) removeItem(el)
  dashboardStore.removeWidget(widgetId)
}

// When a widget is added programmatically (via Dashboard.vue toolbar),
// wait for Vue to render the new item then register it with gridstack
watch(
  () => widgets.value.map(w => w.id),
  (newIds, oldIds) => {
    const added = newIds.filter(id => !oldIds?.includes(id))
    nextTick(() => {
      for (const id of added) {
        const el = itemRefs[id]
        if (el) addItem(el)
      }
    })
  }
)

// auto-refresh timers
const refreshTimers: Record<string, ReturnType<typeof setInterval>> = {}

onMounted(() => {
  for (const widget of widgets.value) {
    if (widget.refreshInterval > 0) {
      refreshTimers[widget.id] = setInterval(
        () => refreshWidget(widget.id),
        widget.refreshInterval * 1000
      )
    }
  }
})

onUnmounted(() => {
  for (const timer of Object.values(refreshTimers)) clearInterval(timer)
})
</script>

<style scoped lang="scss">
// gridstack needs full height to lay out correctly
.grid-stack {
  width: 100%;
}

// ensure widget content fills the gridstack item
.grid-stack-item-content {
  height: 100%;
  overflow: hidden;
}
</style>
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error|Error|✓ built" | tail -10
```

Expected: `✓ built in Xs` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/components/Dashboard/DashboardGrid.vue && git commit -m "feat(dashboard): rewrite DashboardGrid with gridstack drag+resize"
```

---

## Task 7: Update Dashboard.vue and wire initialize()

**Files:**
- Modify: `ui/src/containers/Dashboard.vue`

- [ ] **Step 1: Update Dashboard.vue**

Replace the `<script setup>` section of `ui/src/containers/Dashboard.vue`:

```vue
<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import AddIcon from '@featherds/icon/action/Add'
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig, type WidgetType } from '@/services/dashboardConfigService'
import DashboardGrid from '@/components/Dashboard/DashboardGrid.vue'
import useSnackbar from '@/composables/useSnackbar'

const dashboardStore = useDashboardStore()
const { showSnackBar } = useSnackbar()

const addMenuOpen = ref(false)
const WIDGET_TYPES: WidgetType[] = ['summary', 'outages', 'alarms', 'nodes']

const WIDGET_DEFAULTS: Record<WidgetType, Partial<WidgetConfig>> = {
  summary: { title: 'Network Summary', w: 12, h: 2 },
  outages: { title: 'Active Outages',  w: 6,  h: 3, limit: 10 },
  alarms:  { title: 'Active Alarms',   w: 6,  h: 3, limit: 10, severities: ['CRITICAL', 'MAJOR', 'MINOR'] },
  nodes:   { title: 'Nodes',           w: 12, h: 3, limit: 10 }
}

const addWidget = (type: WidgetType) => {
  addMenuOpen.value = false
  // place new widget at bottom (y=999 lets gridstack find the next open row)
  const widget: WidgetConfig = {
    id: `widget-${type}-${Date.now()}`,
    type,
    categories: [],
    refreshInterval: 60,
    severities: [],
    limit: 10,
    x: 0,
    y: 999,
    w: 6,
    h: 3,
    title: '',
    ...WIDGET_DEFAULTS[type]
  }
  dashboardStore.addWidget(widget)
}

const confirmReset = () => {
  dashboardStore.reset()
  showSnackBar({ msg: 'Dashboard reset to defaults.' })
}

// server-first initialization
onMounted(() => {
  dashboardStore.initialize()
})
</script>
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error|Error|✓ built" | tail -10
```

Expected: `✓ built in Xs` with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/containers/Dashboard.vue && git commit -m "feat(dashboard): wire server-first initialize and remove colSpan from defaults"
```

---

## Task 8: Deploy and verify end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Full build**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 2: Verify CSS has no bare --feather-* values**

```bash
grep -r '\-\-feather-[a-z]' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | grep -v 'var(' | head -5
```

Expected: no output.

- [ ] **Step 3: Deploy to container**

```bash
cd /Users/chance/git/opennms && ./ui/deploy-to-container.sh test-opennms 2>&1 | tail -5
```

- [ ] **Step 4: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: both lines match.

- [ ] **Step 5: Smoke test in browser**

Hard refresh (`Cmd+Shift+R`), navigate to `/opennms/ui/index.html#/dashboard`.

Verify:
- [ ] Widgets render with content (no blank panels)
- [ ] Dragging a widget by its title bar repositions it
- [ ] Dragging the resize handle (bottom-right corner) resizes the widget
- [ ] Refreshing the page restores the custom layout
- [ ] "Add Widget" button adds a new widget at the bottom
- [ ] Remove (×) button removes the widget
- [ ] "Reset" restores the default 4-widget layout

- [ ] **Step 6: Final commit**

```bash
cd /Users/chance/git/opennms && git add -p && git commit -m "feat(dashboard): gridstack drag+resize — live verification complete"
```
