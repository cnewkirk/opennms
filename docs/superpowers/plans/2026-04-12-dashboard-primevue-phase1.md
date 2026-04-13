# Dashboard Enhancement + PrimeVue Migration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add graph/donut/availability widgets to the Vue dashboard, fix widget spacing, add a global time range control, migrate dashboard shell components from Feather DS to PrimeVue, and introduce PrimeVue as the long-term Feather DS replacement.

**Architecture:** PrimeVue (Aura preset) is installed alongside Feather DS with a CSS bridge that maps PrimeVue tokens to existing `--feather-*` variables for automatic dark/light mode. The dashboard config schema is bumped to v3 as a discriminated union; a migration shim upgrades v2 configs on load. New widget types (`graph`, `node-status`, `availability`) are added to `DashboardGrid`. The graph widget wraps the existing `PersesPanel` (Measurements API, TSS-agnostic). Donut charts use PrimeVue's `Chart` component (Chart.js).

**Tech Stack:** Vue 3, PrimeVue 4, Vitest, GridStack, PersesPanel (React bridge), Chart.js via PrimeVue

**Spec:** `docs/superpowers/specs/2026-04-12-dashboard-primevue-migration-design.md`

---

## File Map

**Modified:**
- `ui/src/main/main.ts` — add PrimeVue registration
- `ui/src/styles/opennms-feather-styles.scss` — import primevue bridge (or import in main.ts)
- `ui/src/composables/useDashboardLayout.ts` — margin 8 → 16
- `ui/src/services/dashboardConfigService.ts` — v3 discriminated union types + migration shim + `resolveTimeRange`
- `ui/src/stores/dashboardStore.ts` — `timeRange` field + `updateTimeRange` action
- `ui/src/components/Dashboard/WidgetFrame.vue` — Feather → PrimeVue
- `ui/src/components/Dashboard/WidgetConfigDialog.vue` — thin shell dispatching to per-type forms
- `ui/src/components/Dashboard/DashboardGrid.vue` — new widget types
- `ui/src/containers/Dashboard.vue` — PrimeVue toolbar, add-widget menu, time range picker

**Created:**
- `ui/src/styles/primevue-theme-bridge.scss` — maps PrimeVue tokens → `--feather-*` CSS vars
- `ui/src/components/Dashboard/DashboardTimeRangePicker.vue` — global time range control
- `ui/src/components/Dashboard/config/SummaryWidgetConfigForm.vue`
- `ui/src/components/Dashboard/config/TableWidgetConfigForm.vue`
- `ui/src/components/Dashboard/config/GraphWidgetConfigForm.vue`
- `ui/src/components/Dashboard/config/NodeStatusWidgetConfigForm.vue`
- `ui/src/components/Dashboard/config/AvailabilityWidgetConfigForm.vue`
- `ui/src/components/Dashboard/GraphSeriesBuilder.vue`
- `ui/src/components/Dashboard/widgets/GraphWidget.vue`
- `ui/src/components/Dashboard/widgets/NodeStatusWidget.vue`
- `ui/src/components/Dashboard/widgets/AvailabilityWidget.vue`

**Tests (created/updated):**
- `ui/tests/services/dashboardConfigService.test.ts` — new file covering v3 migration
- `ui/tests/stores/dashboardStore.test.ts` — extend existing file with timeRange tests

---

## Task 1: PrimeVue Install + CSS Bridge

**Files:**
- Modify: `ui/package.json`
- Create: `ui/src/styles/primevue-theme-bridge.scss`
- Modify: `ui/src/main/main.ts`

- [ ] **Step 1: Install PrimeVue**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn add primevue @primevue/themes primeicons chart.js
```

Expected: packages added to `ui/package.json`, no peer dep errors.

- [ ] **Step 2: Create CSS bridge**

Create `ui/src/styles/primevue-theme-bridge.scss`:

```scss
// Maps PrimeVue 4 (Aura preset) design tokens to Feather DS CSS variables.
// This file is imported once in main.ts and ensures PrimeVue components
// automatically respond to the app's dark/light mode toggle.
:root {
  // Surfaces
  --p-surface-0: var(--feather-surface);
  --p-surface-ground: var(--feather-background);
  --p-surface-section: var(--feather-surface);
  --p-surface-card: var(--feather-surface);
  --p-surface-overlay: var(--feather-surface);
  --p-surface-border: var(--feather-border-light-on-surface);

  // Text
  --p-text-color: var(--feather-primary-text-on-surface);
  --p-text-muted-color: var(--feather-secondary-text-on-surface);
  --p-text-hover-color: var(--feather-primary-text-on-surface);

  // Primary (accent)
  --p-primary-color: var(--feather-primary);
  --p-primary-contrast-color: #ffffff;

  // Content
  --p-content-background: var(--feather-surface);
  --p-content-hover-background: var(--feather-background);
  --p-content-border-color: var(--feather-border-light-on-surface);
  --p-content-color: var(--feather-primary-text-on-surface);
  --p-content-hover-color: var(--feather-primary-text-on-surface);

  // Overlays (dialogs, dropdowns)
  --p-overlay-modal-background: var(--feather-surface);
  --p-overlay-popover-background: var(--feather-surface);
  --p-overlay-select-background: var(--feather-surface);
  --p-overlay-modal-border-color: var(--feather-border-light-on-surface);
  --p-overlay-popover-border-color: var(--feather-border-light-on-surface);
  --p-overlay-select-border-color: var(--feather-border-light-on-surface);
  --p-overlay-modal-color: var(--feather-primary-text-on-surface);

  // Form inputs
  --p-form-field-background: var(--feather-surface);
  --p-form-field-border-color: var(--feather-border-light-on-surface);
  --p-form-field-color: var(--feather-primary-text-on-surface);
  --p-form-field-placeholder-color: var(--feather-secondary-text-on-surface);
  --p-form-field-focus-border-color: var(--feather-primary);
}
```

- [ ] **Step 3: Register PrimeVue in main.ts**

In `ui/src/main/main.ts`, add after the existing Feather imports (around line 40):

```ts
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import 'primeicons/primeicons.css'
import '@/styles/primevue-theme-bridge.scss'
```

And chain `.use(PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.open-dark' } } })` onto the app before `.mount('#app')`:

```ts
createApp({
  render: () => h(App)
})
  .use(VueDiff)
  .use(router)
  .use(createPinia())
  .use(PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.open-dark' } } })
  .directive('date', dateFormatDirective)
  .mount('#app')
```

Note: `.open-dark` is the class the app toggles on `<html>` for dark mode (see `applyTheme` in main.ts).

- [ ] **Step 4: Verify build passes**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: build succeeds, no TS errors about missing modules. Check `ui/src/main/dist/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add ui/package.json ui/yarn.lock ui/src/styles/primevue-theme-bridge.scss ui/src/main/main.ts
git commit -m "feat(dashboard): install PrimeVue 4 with Aura preset and feather CSS bridge"
```

---

## Task 2: Spacing Fix

**Files:**
- Modify: `ui/src/composables/useDashboardLayout.ts:27`
- Modify: `ui/tests/composables/useDashboardLayout.test.ts`

- [ ] **Step 1: Write the failing test**

In `ui/tests/composables/useDashboardLayout.test.ts`, add to the end of the `describe` block:

```ts
test('initializes gridstack with margin 16', () => {
  const container = ref<HTMLElement | null>(document.createElement('div'))
  mount(defineComponent({
    setup() {
      useDashboardLayout(container, vi.fn())
      return {}
    },
    template: '<div />'
  }))
  expect(GridStack.init).toHaveBeenCalledWith(
    expect.objectContaining({ margin: 16 }),
    expect.any(HTMLElement)
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test tests/composables/useDashboardLayout.test.ts
```

Expected: FAIL — `margin: 8` does not match `margin: 16`.

- [ ] **Step 3: Apply the fix**

In `ui/src/composables/useDashboardLayout.ts`, change line 30:

```ts
const GRID_OPTIONS: GridStackOptions = {
  column: 12,
  cellHeight: 150,
  margin: 16,        // was 8
  animate: true,
  handle: '.widget-drag-handle',
  resizable: { handles: 'se' }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test tests/composables/useDashboardLayout.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/useDashboardLayout.ts ui/tests/composables/useDashboardLayout.test.ts
git commit -m "fix(dashboard): increase gridstack margin from 8px to 16px for consistent spacing"
```

---

## Task 3: Config Schema v3 + Migration Shim

**Files:**
- Modify: `ui/src/services/dashboardConfigService.ts`
- Create: `ui/tests/services/dashboardConfigService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `ui/tests/services/dashboardConfigService.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] }
})

import {
  loadConfig,
  defaultConfig,
  saveConfig,
  resolveTimeRange
} from '@/services/dashboardConfigService'

describe('dashboardConfigService v3', () => {
  beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

  test('defaultConfig has version 3', () => {
    expect(defaultConfig().version).toBe(3)
  })

  test('defaultConfig has timeRange with relative 24h', () => {
    const cfg = defaultConfig()
    expect(cfg.timeRange.mode).toBe('relative')
    expect(cfg.timeRange.relativeWindow).toBe('24h')
  })

  test('v2 config is migrated to v3 on load', () => {
    const v2: any = {
      version: 2,
      widgets: [
        { id: 'w1', type: 'summary', title: 'S', x: 0, y: 0, w: 12, h: 2,
          categories: [], limit: 0, refreshInterval: 60, severities: [] }
      ]
    }
    store['opennms.dashboard.config'] = JSON.stringify(v2)
    const loaded = loadConfig()
    expect(loaded.version).toBe(3)
    expect(loaded.timeRange).toBeDefined()
    expect(loaded.timeRange.relativeWindow).toBe('24h')
    expect(loaded.widgets[0].type).toBe('summary')
  })

  test('v3 config round-trips through save/load', () => {
    const cfg = defaultConfig()
    saveConfig(cfg)
    const loaded = loadConfig()
    expect(loaded.version).toBe(3)
    expect(loaded.widgets).toHaveLength(cfg.widgets.length)
  })
})

describe('resolveTimeRange', () => {
  test('relative 1h returns ~1h window', () => {
    const now = Date.now()
    const { start, end } = resolveTimeRange({ mode: 'relative', relativeWindow: '1h' })
    expect(end.getTime()).toBeGreaterThanOrEqual(now - 100)
    expect(now - start.getTime()).toBeCloseTo(3600 * 1000, -3)
  })

  test('relative 24h returns ~24h window', () => {
    const { start, end } = resolveTimeRange({ mode: 'relative', relativeWindow: '24h' })
    expect(end.getTime() - start.getTime()).toBeCloseTo(86400 * 1000, -3)
  })

  test('relative 7d returns ~7d window', () => {
    const { start, end } = resolveTimeRange({ mode: 'relative', relativeWindow: '7d' })
    expect(end.getTime() - start.getTime()).toBeCloseTo(7 * 86400 * 1000, -3)
  })

  test('absolute mode uses from/to directly', () => {
    const from = '2026-01-01T00:00:00.000Z'
    const to   = '2026-01-02T00:00:00.000Z'
    const { start, end } = resolveTimeRange({ mode: 'absolute', relativeWindow: '1h', from, to })
    expect(start.toISOString()).toBe(from)
    expect(end.toISOString()).toBe(to)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test tests/services/dashboardConfigService.test.ts
```

Expected: multiple FAILs — v3 types and `resolveTimeRange` don't exist yet.

- [ ] **Step 3: Replace dashboardConfigService.ts**

Replace the full contents of `ui/src/services/dashboardConfigService.ts`:

```ts
import { rest } from './axiosInstances'

// ─── Time Range ─────────────────────────────────────────���──────────────────────

export type RelativeWindow = '1h' | '6h' | '24h' | '7d' | '30d'

export interface DashboardTimeRange {
  mode: 'relative' | 'absolute'
  relativeWindow: RelativeWindow
  from?: string  // ISO string, used when mode='absolute'
  to?: string
}

const RELATIVE_MS: Record<RelativeWindow, number> = {
  '1h':  3600 * 1000,
  '6h':  6 * 3600 * 1000,
  '24h': 24 * 3600 * 1000,
  '7d':  7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000
}

export const resolveTimeRange = (tr: DashboardTimeRange): { start: Date; end: Date } => {
  if (tr.mode === 'absolute' && tr.from && tr.to) {
    return { start: new Date(tr.from), end: new Date(tr.to) }
  }
  const end   = new Date()
  const start = new Date(end.getTime() - RELATIVE_MS[tr.relativeWindow])
  return { start, end }
}

// ─── Widget Config Types ──────────────────────────��─────────────────────────────

interface BaseWidgetConfig {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
  refreshInterval: number
}

export interface SummaryWidgetConfig extends BaseWidgetConfig {
  type: 'summary'
  categories: string[]
}

export interface TableWidgetConfig extends BaseWidgetConfig {
  type: 'outages' | 'alarms' | 'nodes'
  categories: string[]
  limit: number
  severities: string[]
  columns: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface GraphSeries {
  id: string
  nodeId: string
  resourceId: string
  attribute: string
  label: string
  color?: string
  expression?: string  // advanced mode override
}

export interface GraphWidgetConfig extends BaseWidgetConfig {
  type: 'graph'
  series: GraphSeries[]
  stack: boolean
  timeRange?: DashboardTimeRange
}

export interface NodeStatusWidgetConfig extends BaseWidgetConfig {
  type: 'node-status'
  categories: string[]
}

export interface AvailabilityWidgetConfig extends BaseWidgetConfig {
  type: 'availability'
  categories: string[]
  timeRange?: DashboardTimeRange
}

export type WidgetConfig =
  | SummaryWidgetConfig
  | TableWidgetConfig
  | GraphWidgetConfig
  | NodeStatusWidgetConfig
  | AvailabilityWidgetConfig

export type WidgetType = WidgetConfig['type']

// ─── Column Definitions (table widgets only) ────────────��─────────────────────

export interface ColumnDef {
  key: string
  label: string
  sortField?: string
}

export const WIDGET_COLUMNS: Record<'alarms' | 'outages' | 'nodes', ColumnDef[]> = {
  alarms: [
    { key: 'severity', label: 'Severity',  sortField: 'severity' },
    { key: 'node',     label: 'Node',      sortField: 'nodeLabel' },
    { key: 'message',  label: 'Message' },
    { key: 'count',    label: 'Count',     sortField: 'count' },
    { key: 'time',     label: 'Time',      sortField: 'lastEventTime' }
  ],
  outages: [
    { key: 'node',    label: 'Node',       sortField: 'nodeLabel' },
    { key: 'service', label: 'Service',    sortField: 'serviceName' },
    { key: 'ip',      label: 'IP Address', sortField: 'ipAddress' },
    { key: 'since',   label: 'Since',      sortField: 'ifLostService' }
  ],
  nodes: [
    { key: 'node',       label: 'Node',       sortField: 'label' },
    { key: 'location',   label: 'Location',   sortField: 'location' },
    { key: 'categories', label: 'Categories' }
  ]
}

const DEFAULT_COLUMNS: Record<'alarms' | 'outages' | 'nodes', string[]> = {
  alarms:  ['severity', 'node', 'message', 'count'],
  outages: ['node', 'service', 'ip'],
  nodes:   ['node', 'location', 'categories']
}

// ─── Dashboard Config ───────────────────────────────��──────────────────────────

export interface DashboardConfig {
  version: 3
  timeRange: DashboardTimeRange
  widgets: WidgetConfig[]
}

const DEFAULT_TIME_RANGE: DashboardTimeRange = { mode: 'relative', relativeWindow: '24h' }

const STORAGE_KEY    = 'opennms.dashboard.config'
const CONFIG_VERSION = 3
const USER_PROP_KEY  = 'ui.dashboard.layout'

export const defaultConfig = (): DashboardConfig => ({
  version: CONFIG_VERSION,
  timeRange: { ...DEFAULT_TIME_RANGE },
  widgets: [
    { id: 'widget-summary', type: 'summary', title: 'Network Summary',  x: 0, y: 0, w: 12, h: 2, categories: [], refreshInterval: 60 },
    { id: 'widget-outages', type: 'outages', title: 'Active Outages',   x: 0, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: [], columns: DEFAULT_COLUMNS.outages },
    { id: 'widget-alarms',  type: 'alarms',  title: 'Active Alarms',    x: 6, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: ['CRITICAL', 'MAJOR', 'MINOR'], columns: DEFAULT_COLUMNS.alarms },
    { id: 'widget-nodes',   type: 'nodes',   title: 'Nodes',            x: 0, y: 5, w: 12, h: 3, categories: [], limit: 10, refreshInterval: 120, severities: [], columns: DEFAULT_COLUMNS.nodes }
  ] as WidgetConfig[]
})

// ─── v2 → v3 Migration ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const migrateToV3 = (raw: any): DashboardConfig => ({
  version: 3,
  timeRange: raw.timeRange ?? { ...DEFAULT_TIME_RANGE },
  widgets: (raw.widgets ?? []) as WidgetConfig[]
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isValidV3 = (c: any): c is DashboardConfig =>
  c?.version === 3 &&
  Array.isArray(c.widgets) &&
  c.widgets.length > 0 &&
  c.widgets.every((w: any) =>
    typeof w.x === 'number' && typeof w.y === 'number' &&
    typeof w.w === 'number' && typeof w.h === 'number'
  )

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUpgradeable = (c: any): boolean =>
  c?.version >= 2 &&
  Array.isArray(c.widgets) &&
  c.widgets.length > 0 &&
  c.widgets.every((w: any) =>
    typeof w.x === 'number' && typeof w.y === 'number' &&
    typeof w.w === 'number' && typeof w.h === 'number'
  )

// ─── Persistence ──────────────────────────────────────────────────────────────

export const loadConfig = (): DashboardConfig => {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (json) {
      const parsed = JSON.parse(json)
      if (isValidV3(parsed)) return parsed
      if (isUpgradeable(parsed)) return migrateToV3(parsed)
    }
  } catch { /* corrupt storage */ }
  return defaultConfig()
}

export const saveConfig = (config: DashboardConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export const resetConfig = (): DashboardConfig => {
  const config = defaultConfig()
  saveConfig(config)
  return config
}

export const loadFromServer = async (username: string): Promise<DashboardConfig | null> => {
  try {
    const resp = await rest.get(`users/${username}/properties/${USER_PROP_KEY}`)
    const json = resp.data?.value as string | undefined
    if (!json) return null
    const parsed = JSON.parse(json)
    if (isValidV3(parsed)) return parsed
    if (isUpgradeable(parsed)) return migrateToV3(parsed)
  } catch { /* 404 or parse error */ }
  return null
}

export const saveToServer = async (username: string, config: DashboardConfig): Promise<void> => {
  try {
    await rest.put(`users/${username}/properties/${USER_PROP_KEY}`, { value: JSON.stringify(config) })
  } catch { /* non-fatal */ }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test tests/services/dashboardConfigService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test
```

Expected: all tests pass. The existing `tests/stores/dashboardStore.test.ts` may fail if it imports removed exports — fix any TS import errors (e.g. `colSpan` is gone).

- [ ] **Step 6: Commit**

```bash
git add ui/src/services/dashboardConfigService.ts ui/tests/services/dashboardConfigService.test.ts
git commit -m "feat(dashboard): v3 config schema with discriminated union types and migration shim"
```

---

## Task 4: dashboardStore — timeRange Field

**Files:**
- Modify: `ui/src/stores/dashboardStore.ts`
- Modify: `ui/tests/stores/dashboardStore.test.ts`

- [ ] **Step 1: Write failing tests**

In `ui/tests/stores/dashboardStore.test.ts`, add a new `describe` block after the existing ones:

```ts
describe('dashboardStore timeRange', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  test('initial timeRange is relative 24h', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const s = useDashboardStore()
    expect(s.timeRange.mode).toBe('relative')
    expect(s.timeRange.relativeWindow).toBe('24h')
  })

  test('updateTimeRange persists change', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const s = useDashboardStore()
    s.updateTimeRange({ mode: 'relative', relativeWindow: '7d' })
    expect(s.timeRange.relativeWindow).toBe('7d')
    // localStorage should be updated
    const saved = JSON.parse(store['opennms.dashboard.config'] ?? '{}')
    expect(saved.timeRange?.relativeWindow).toBe('7d')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test tests/stores/dashboardStore.test.ts
```

Expected: FAIL — `timeRange` and `updateTimeRange` don't exist on the store yet.

- [ ] **Step 3: Update dashboardStore.ts**

Replace `ui/src/stores/dashboardStore.ts` with:

```ts
import { defineStore } from 'pinia'
import type { GridStackNode } from 'gridstack'
import {
  type WidgetConfig,
  type DashboardConfig,
  type DashboardTimeRange,
  loadConfig,
  saveConfig,
  resetConfig,
  loadFromServer,
  saveToServer
} from '@/services/dashboardConfigService'
import { useMenuStore } from '@/stores/menuStore'

export const useDashboardStore = defineStore('dashboardStore', () => {
  const config = ref<DashboardConfig>(loadConfig())
  const menuStore = useMenuStore()

  const widgets  = computed(() => config.value.widgets)
  const timeRange = computed(() => config.value.timeRange)

  let syncTimer: ReturnType<typeof setTimeout> | null = null

  const persist = () => {
    saveConfig(config.value)
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      const username = menuStore.mainMenu?.username
      if (username) saveToServer(username, config.value)
    }, 2000)
  }

  onScopeDispose(() => { if (syncTimer) clearTimeout(syncTimer) })

  const initialize = async () => {
    const username = menuStore.mainMenu?.username
    if (username) {
      const serverConfig = await loadFromServer(username)
      if (serverConfig) {
        config.value = serverConfig
        saveConfig(serverConfig)
        return
      }
    }
    if (username) saveToServer(username, config.value)
  }

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

  const updateTimeRange = (tr: DashboardTimeRange) => {
    config.value.timeRange = tr
    persist()
  }

  const reset = () => {
    config.value = resetConfig()
    persist()
  }

  return {
    config,
    widgets,
    timeRange,
    initialize,
    updateLayout,
    updateWidget,
    addWidget,
    removeWidget,
    updateTimeRange,
    reset
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test tests/stores/dashboardStore.test.ts
```

Expected: all tests PASS, including existing layout/remove/reset tests.

- [ ] **Step 5: Commit**

```bash
git add ui/src/stores/dashboardStore.ts ui/tests/stores/dashboardStore.test.ts
git commit -m "feat(dashboard): add timeRange field and updateTimeRange action to dashboardStore"
```

---

## Task 5: WidgetFrame — Feather → PrimeVue

**Files:**
- Modify: `ui/src/components/Dashboard/WidgetFrame.vue`

- [ ] **Step 1: Replace WidgetFrame.vue**

Replace the full file at `ui/src/components/Dashboard/WidgetFrame.vue`:

```vue
<template>
  <div class="widget-frame">
    <div class="widget-header widget-drag-handle">
      <span class="widget-title">{{ title }}</span>
      <div class="widget-actions">
        <Button
          text
          rounded
          severity="secondary"
          size="small"
          :disabled="loading"
          title="Refresh"
          @click="$emit('refresh')"
        >
          <i class="pi pi-refresh" />
        </Button>
        <Button
          text
          rounded
          severity="secondary"
          size="small"
          title="Configure"
          @click="$emit('configure')"
        >
          <i class="pi pi-cog" />
        </Button>
        <Button
          text
          rounded
          severity="danger"
          size="small"
          title="Remove widget"
          @click="$emit('remove')"
        >
          <i class="pi pi-times" />
        </Button>
      </div>
    </div>
    <div class="widget-body">
      <div
        v-if="loading"
        class="widget-loading"
      >
        <ProgressSpinner style="width:32px;height:32px" />
      </div>
      <div
        v-else-if="error"
        class="widget-error"
      >
        {{ error }}
      </div>
      <slot v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

defineProps<{
  title: string
  loading?: boolean
  error?: string
}>()

defineEmits<{
  (e: 'refresh'): void
  (e: 'configure'): void
  (e: 'remove'): void
}>()
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.widget-frame {
  background: var($surface);
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-surface;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 220px;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var($border-light-on-surface);
  flex-shrink: 0;
  cursor: grab;

  &:active { cursor: grabbing; }
}

.widget-title {
  @include subtitle1;
  font-weight: 600;
  color: var($primary-text-on-surface);
}

.widget-actions {
  display: flex;
  gap: 2px;
}

.widget-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.widget-loading,
.widget-error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
}

.widget-error {
  color: var($error);
  @include body-large;
  padding: 16px;
}
</style>
```

- [ ] **Step 2: Verify build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: no TS errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Dashboard/WidgetFrame.vue
git commit -m "refactor(dashboard): migrate WidgetFrame from Feather DS to PrimeVue"
```

---

## Task 6: Per-Type Config Forms + WidgetConfigDialog Shell

**Files:**
- Create: `ui/src/components/Dashboard/config/SummaryWidgetConfigForm.vue`
- Create: `ui/src/components/Dashboard/config/TableWidgetConfigForm.vue`
- Create: `ui/src/components/Dashboard/config/NodeStatusWidgetConfigForm.vue`
- Create: `ui/src/components/Dashboard/config/AvailabilityWidgetConfigForm.vue`
- Create: `ui/src/components/Dashboard/config/GraphWidgetConfigForm.vue` (stub — graph series builder is Task 8)
- Modify: `ui/src/components/Dashboard/WidgetConfigDialog.vue`

- [ ] **Step 1: Create SummaryWidgetConfigForm.vue**

Create `ui/src/components/Dashboard/config/SummaryWidgetConfigForm.vue`:

```vue
<template>
  <div class="config-form">
    <div class="field">
      <label for="sum-title">Widget Title</label>
      <InputText id="sum-title" v-model="draft.title" class="w-full" />
    </div>

    <div class="field">
      <label>Filter by Categories <span class="hint">(leave empty for all)</span></label>
      <MultiSelect
        v-model="draft.categories"
        :options="allCategories"
        option-label="name"
        option-value="name"
        placeholder="All categories"
        class="w-full"
        filter
      />
    </div>

    <div class="field">
      <label>Refresh Interval</label>
      <Select
        v-model="draft.refreshInterval"
        :options="refreshOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import API from '@/services'
import type { Category } from '@/types'
import type { SummaryWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: SummaryWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: SummaryWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
watch(draft, v => emit('update:modelValue', { ...v }), { deep: true })

const allCategories = ref<Category[]>([])
const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute',   value: 60 },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 }
]

onMounted(async () => {
  const resp = await API.getCategories()
  if (resp) allCategories.value = [...resp.category].sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.w-full { width: 100%; }
</style>
```

- [ ] **Step 2: Create TableWidgetConfigForm.vue**

Create `ui/src/components/Dashboard/config/TableWidgetConfigForm.vue`:

```vue
<template>
  <div class="config-form">
    <div class="field">
      <label>Widget Title</label>
      <InputText v-model="draft.title" class="w-full" />
    </div>

    <div class="field">
      <label>Filter by Categories <span class="hint">(leave empty for all)</span></label>
      <MultiSelect
        v-model="draft.categories"
        :options="allCategories"
        option-label="name"
        option-value="name"
        placeholder="All categories"
        class="w-full"
        filter
      />
    </div>

    <div v-if="draft.type === 'alarms'" class="field">
      <label>Severities <span class="hint">(leave empty for all)</span></label>
      <MultiSelect
        v-model="draft.severities"
        :options="SEVERITIES"
        placeholder="All severities"
        class="w-full"
      />
    </div>

    <div class="field">
      <label>Max Rows</label>
      <InputNumber v-model="draft.limit" :min="1" :max="500" class="w-full" />
    </div>

    <div class="field">
      <label>Visible Columns</label>
      <MultiSelect
        v-model="draft.columns"
        :options="availableColumns"
        option-label="label"
        option-value="key"
        class="w-full"
      />
    </div>

    <div class="field">
      <label>Refresh Interval</label>
      <Select
        v-model="draft.refreshInterval"
        :options="refreshOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import API from '@/services'
import type { Category } from '@/types'
import { WIDGET_COLUMNS, type TableWidgetConfig } from '@/services/dashboardConfigService'

const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'NORMAL', 'INDETERMINATE']
const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute',   value: 60 },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 }
]

const props = defineProps<{ modelValue: TableWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: TableWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
watch(draft, v => emit('update:modelValue', { ...v }), { deep: true })

const availableColumns = computed(() =>
  draft.value.type !== 'summary' ? (WIDGET_COLUMNS[draft.value.type as 'alarms' | 'outages' | 'nodes'] ?? []) : []
)

const allCategories = ref<Category[]>([])
onMounted(async () => {
  const resp = await API.getCategories()
  if (resp) allCategories.value = [...resp.category].sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.w-full { width: 100%; }
</style>
```

- [ ] **Step 3: Create NodeStatusWidgetConfigForm.vue**

Create `ui/src/components/Dashboard/config/NodeStatusWidgetConfigForm.vue`:

```vue
<template>
  <div class="config-form">
    <div class="field">
      <label>Widget Title</label>
      <InputText v-model="draft.title" class="w-full" />
    </div>

    <div class="field">
      <label>Filter by Categories <span class="hint">(leave empty for all)</span></label>
      <MultiSelect
        v-model="draft.categories"
        :options="allCategories"
        option-label="name"
        option-value="name"
        placeholder="All categories"
        class="w-full"
        filter
      />
    </div>

    <div class="field">
      <label>Refresh Interval</label>
      <Select
        v-model="draft.refreshInterval"
        :options="refreshOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import API from '@/services'
import type { Category } from '@/types'
import type { NodeStatusWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: NodeStatusWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: NodeStatusWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
watch(draft, v => emit('update:modelValue', { ...v }), { deep: true })

const allCategories = ref<Category[]>([])
const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute',   value: 60 },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 }
]

onMounted(async () => {
  const resp = await API.getCategories()
  if (resp) allCategories.value = [...resp.category].sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.w-full { width: 100%; }
</style>
```

- [ ] **Step 4: Create AvailabilityWidgetConfigForm.vue**

Create `ui/src/components/Dashboard/config/AvailabilityWidgetConfigForm.vue`:

```vue
<template>
  <div class="config-form">
    <div class="field">
      <label>Widget Title</label>
      <InputText v-model="draft.title" class="w-full" />
    </div>

    <div class="field">
      <label>Filter by Categories <span class="hint">(leave empty for all)</span></label>
      <MultiSelect
        v-model="draft.categories"
        :options="allCategories"
        option-label="name"
        option-value="name"
        placeholder="All categories"
        class="w-full"
        filter
      />
    </div>

    <div class="field">
      <div class="field-row">
        <Checkbox v-model="useCustomTimeRange" binary input-id="avail-tr" />
        <label for="avail-tr" class="checkbox-label">Use custom time range</label>
      </div>
    </div>

    <template v-if="useCustomTimeRange">
      <div class="field">
        <label>Window</label>
        <Select
          v-model="localTimeRangeWindow"
          :options="windowOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
    </template>

    <div class="field">
      <label>Refresh Interval</label>
      <Select
        v-model="draft.refreshInterval"
        :options="refreshOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import API from '@/services'
import type { Category } from '@/types'
import type { AvailabilityWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: AvailabilityWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: AvailabilityWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
const useCustomTimeRange = ref(!!draft.value.timeRange)
const localTimeRangeWindow = ref(draft.value.timeRange?.relativeWindow ?? '24h')

watch([draft, useCustomTimeRange, localTimeRangeWindow], () => {
  const out: AvailabilityWidgetConfig = {
    ...draft.value,
    timeRange: useCustomTimeRange.value
      ? { mode: 'relative', relativeWindow: localTimeRangeWindow.value as any }
      : undefined
  }
  emit('update:modelValue', out)
}, { deep: true })

const allCategories = ref<Category[]>([])
const windowOptions = [
  { label: 'Last 1 hour',  value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours',value: '24h' },
  { label: 'Last 7 days',  value: '7d' },
  { label: 'Last 30 days', value: '30d' }
]
const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute',   value: 60 },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 }
]

onMounted(async () => {
  const resp = await API.getCategories()
  if (resp) allCategories.value = [...resp.category].sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-row { display: flex; align-items: center; gap: 8px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.checkbox-label { @include body-large; color: var($primary-text-on-surface); cursor: pointer; }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.w-full { width: 100%; }
</style>
```

- [ ] **Step 5: Create GraphWidgetConfigForm.vue (stub)**

Create `ui/src/components/Dashboard/config/GraphWidgetConfigForm.vue`:

```vue
<template>
  <div class="config-form">
    <div class="field">
      <label>Widget Title</label>
      <InputText v-model="draft.title" class="w-full" />
    </div>

    <!-- GraphSeriesBuilder is added in Task 8 -->
    <div class="field placeholder-note">
      Series builder will be rendered here (Task 8).
    </div>

    <div class="field">
      <div class="field-row">
        <Checkbox v-model="draft.stack" binary input-id="graph-stack" />
        <label for="graph-stack" class="checkbox-label">Stack series</label>
      </div>
    </div>

    <div class="field">
      <div class="field-row">
        <Checkbox v-model="useCustomTimeRange" binary input-id="graph-tr" />
        <label for="graph-tr" class="checkbox-label">Use custom time range</label>
      </div>
    </div>

    <template v-if="useCustomTimeRange">
      <div class="field">
        <label>Window</label>
        <Select
          v-model="localTimeRangeWindow"
          :options="windowOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>
    </template>

    <div class="field">
      <label>Refresh Interval</label>
      <Select
        v-model="draft.refreshInterval"
        :options="refreshOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import type { GraphWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: GraphWidgetConfig }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: GraphWidgetConfig): void }>()

const draft = ref({ ...props.modelValue })
const useCustomTimeRange = ref(!!draft.value.timeRange)
const localTimeRangeWindow = ref(draft.value.timeRange?.relativeWindow ?? '24h')

watch([draft, useCustomTimeRange, localTimeRangeWindow], () => {
  emit('update:modelValue', {
    ...draft.value,
    timeRange: useCustomTimeRange.value
      ? { mode: 'relative', relativeWindow: localTimeRangeWindow.value as any }
      : undefined
  })
}, { deep: true })

const windowOptions = [
  { label: 'Last 1 hour',  value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours',value: '24h' },
  { label: 'Last 7 days',  value: '7d' },
  { label: 'Last 30 days', value: '30d' }
]
const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute',   value: 60 },
  { label: '2 minutes',  value: 120 },
  { label: '5 minutes',  value: 300 },
  { label: '10 minutes', value: 600 }
]
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-row { display: flex; align-items: center; gap: 8px; }
label { @include subtitle2; color: var($primary-text-on-surface); }
.checkbox-label { @include body-large; color: var($primary-text-on-surface); cursor: pointer; }
.hint { @include body-small; color: var($secondary-text-on-surface); font-weight: normal; }
.placeholder-note { @include body-small; color: var($secondary-text-on-surface); font-style: italic; }
.w-full { width: 100%; }
</style>
```

- [ ] **Step 6: Replace WidgetConfigDialog.vue with thin shell**

Replace `ui/src/components/Dashboard/WidgetConfigDialog.vue`:

```vue
<template>
  <Dialog
    :visible="visible"
    :header="`Configure Widget`"
    modal
    :style="{ minWidth: '420px', maxWidth: '560px' }"
    @update:visible="$emit('close')"
  >
    <SummaryWidgetConfigForm
      v-if="draft.type === 'summary'"
      v-model="draft"
    />
    <TableWidgetConfigForm
      v-else-if="draft.type === 'outages' || draft.type === 'alarms' || draft.type === 'nodes'"
      v-model="draft as TableWidgetConfig"
    />
    <GraphWidgetConfigForm
      v-else-if="draft.type === 'graph'"
      v-model="draft as GraphWidgetConfig"
    />
    <NodeStatusWidgetConfigForm
      v-else-if="draft.type === 'node-status'"
      v-model="draft as NodeStatusWidgetConfig"
    />
    <AvailabilityWidgetConfigForm
      v-else-if="draft.type === 'availability'"
      v-model="draft as AvailabilityWidgetConfig"
    />

    <template #footer>
      <Button label="Cancel" text @click="$emit('close')" />
      <Button label="Save" @click="save" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import {
  type WidgetConfig,
  type TableWidgetConfig,
  type GraphWidgetConfig,
  type NodeStatusWidgetConfig,
  type AvailabilityWidgetConfig
} from '@/services/dashboardConfigService'
import SummaryWidgetConfigForm     from './config/SummaryWidgetConfigForm.vue'
import TableWidgetConfigForm       from './config/TableWidgetConfigForm.vue'
import GraphWidgetConfigForm       from './config/GraphWidgetConfigForm.vue'
import NodeStatusWidgetConfigForm  from './config/NodeStatusWidgetConfigForm.vue'
import AvailabilityWidgetConfigForm from './config/AvailabilityWidgetConfigForm.vue'

const props = defineProps<{
  visible: boolean
  widgetConfig: WidgetConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', config: WidgetConfig): void
}>()

const draft = ref<WidgetConfig>({ ...props.widgetConfig })

watch(() => props.widgetConfig, cfg => { draft.value = { ...cfg } })

const save = () => emit('save', { ...draft.value })
</script>
```

- [ ] **Step 7: Verify build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: no TS errors.

- [ ] **Step 8: Commit**

```bash
git add ui/src/components/Dashboard/WidgetConfigDialog.vue ui/src/components/Dashboard/config/
git commit -m "feat(dashboard): replace WidgetConfigDialog with per-type PrimeVue config forms"
```

---

## Task 7: Dashboard.vue Toolbar + DashboardTimeRangePicker

**Files:**
- Create: `ui/src/components/Dashboard/DashboardTimeRangePicker.vue`
- Modify: `ui/src/containers/Dashboard.vue`

- [ ] **Step 1: Create DashboardTimeRangePicker.vue**

Create `ui/src/components/Dashboard/DashboardTimeRangePicker.vue`:

```vue
<template>
  <div class="time-range-picker">
    <Select
      v-model="selectedPreset"
      :options="presetOptions"
      option-label="label"
      option-value="value"
      class="preset-select"
      @change="onPresetChange"
    />
    <template v-if="selectedPreset === 'custom'">
      <DatePicker
        v-model="absoluteFrom"
        show-time
        hour-format="24"
        date-format="yy-mm-dd"
        placeholder="From"
        class="date-input"
        @date-select="onAbsoluteChange"
      />
      <span class="separator">→</span>
      <DatePicker
        v-model="absoluteTo"
        show-time
        hour-format="24"
        date-format="yy-mm-dd"
        placeholder="To"
        class="date-input"
        @date-select="onAbsoluteChange"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import { useDashboardStore } from '@/stores/dashboardStore'
import type { DashboardTimeRange } from '@/services/dashboardConfigService'

const dashboardStore = useDashboardStore()

const presetOptions = [
  { label: 'Last 1 hour',  value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours',value: '24h' },
  { label: 'Last 7 days',  value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom range…',value: 'custom' }
]

const currentTr = dashboardStore.timeRange
const selectedPreset = ref<string>(
  currentTr.mode === 'absolute' ? 'custom' : currentTr.relativeWindow
)
const absoluteFrom = ref<Date | null>(currentTr.from ? new Date(currentTr.from) : null)
const absoluteTo   = ref<Date | null>(currentTr.to   ? new Date(currentTr.to)   : null)

const onPresetChange = () => {
  if (selectedPreset.value === 'custom') return
  dashboardStore.updateTimeRange({
    mode: 'relative',
    relativeWindow: selectedPreset.value as DashboardTimeRange['relativeWindow']
  })
}

const onAbsoluteChange = () => {
  if (!absoluteFrom.value || !absoluteTo.value) return
  dashboardStore.updateTimeRange({
    mode: 'absolute',
    relativeWindow: '24h',
    from: absoluteFrom.value.toISOString(),
    to: absoluteTo.value.toISOString()
  })
}
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";

.time-range-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-select { min-width: 160px; }
.date-input    { width: 160px; }
.separator     { color: var($secondary-text-on-surface); }
</style>
```

- [ ] **Step 2: Replace Dashboard.vue**

Replace `ui/src/containers/Dashboard.vue`:

```vue
<template>
  <div class="dashboard-container">
    <div class="dashboard-toolbar">
      <h1 class="headline4">Dashboard</h1>
      <div class="toolbar-actions">
        <DashboardTimeRangePicker v-if="hasTimeAwareWidgets" />

        <SplitButton
          label="Add Widget"
          :model="addWidgetItems"
          text
        />
        <Button
          text
          label="Reset"
          title="Reset to default layout"
          @click="confirmReset"
        />
      </div>
    </div>

    <div class="dashboard-grid-wrapper">
      <DashboardGrid />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import Button from 'primevue/button'
import SplitButton from 'primevue/splitbutton'
import { useDashboardStore } from '@/stores/dashboardStore'
import { type WidgetConfig, type WidgetType } from '@/services/dashboardConfigService'
import DashboardGrid from '@/components/Dashboard/DashboardGrid.vue'
import DashboardTimeRangePicker from '@/components/Dashboard/DashboardTimeRangePicker.vue'
import useSnackbar from '@/composables/useSnackbar'

const dashboardStore = useDashboardStore()
const { showSnackBar } = useSnackbar()

const hasTimeAwareWidgets = computed(() =>
  dashboardStore.widgets.some(w => w.type === 'graph' || w.type === 'availability')
)

const WIDGET_DEFAULTS: Record<WidgetType, Partial<WidgetConfig>> = {
  summary:      { title: 'Network Summary',   w: 12, h: 2 },
  outages:      { title: 'Active Outages',    w: 6,  h: 3, limit: 10 },
  alarms:       { title: 'Active Alarms',     w: 6,  h: 3, limit: 10, severities: ['CRITICAL', 'MAJOR', 'MINOR'] },
  nodes:        { title: 'Nodes',             w: 12, h: 3, limit: 10 },
  graph:        { title: 'Graph',             w: 6,  h: 4, series: [], stack: false },
  'node-status':{ title: 'Node Status',       w: 4,  h: 3 },
  availability: { title: 'Availability',      w: 4,  h: 3 }
}

const addWidget = (type: WidgetType) => {
  const widget = {
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
  } as WidgetConfig
  dashboardStore.addWidget(widget)
}

const WIDGET_TYPES: WidgetType[] = ['summary', 'outages', 'alarms', 'nodes', 'graph', 'node-status', 'availability']
const WIDGET_LABELS: Record<WidgetType, string> = {
  summary:      'Network Summary',
  outages:      'Active Outages',
  alarms:       'Active Alarms',
  nodes:        'Nodes',
  graph:        'Graph',
  'node-status':'Node Status',
  availability: 'Availability'
}

const addWidgetItems = WIDGET_TYPES.map(type => ({
  label: WIDGET_LABELS[type],
  command: () => addWidget(type)
}))

const confirmReset = () => {
  dashboardStore.reset()
  showSnackBar({ msg: 'Dashboard reset to defaults.' })
}

onMounted(() => { dashboardStore.initialize() })
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px 8px;
  flex-shrink: 0;
  gap: 16px;
}

.dashboard-grid-wrapper {
  flex: 1;
  padding: 0 24px 16px;
  overflow: auto;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

h1 {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}
</style>
```

- [ ] **Step 3: Verify build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: no TS errors.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Dashboard/DashboardTimeRangePicker.vue ui/src/containers/Dashboard.vue
git commit -m "feat(dashboard): add PrimeVue toolbar with SplitButton add-widget menu and time range picker"
```

---

## Task 8: GraphWidget + GraphSeriesBuilder

**Files:**
- Create: `ui/src/components/Dashboard/GraphSeriesBuilder.vue`
- Create: `ui/src/components/Dashboard/widgets/GraphWidget.vue`
- Modify: `ui/src/components/Dashboard/config/GraphWidgetConfigForm.vue` (replace stub with real series builder)
- Modify: `ui/src/components/Dashboard/DashboardGrid.vue`

- [ ] **Step 1: Create GraphSeriesBuilder.vue**

Create `ui/src/components/Dashboard/GraphSeriesBuilder.vue`:

```vue
<template>
  <div class="series-builder">
    <div
      v-for="(series, idx) in localSeries"
      :key="series.id"
      class="series-row"
    >
      <div class="series-row-top">
        <span class="series-num">{{ idx + 1 }}</span>

        <!-- Node picker -->
        <Select
          v-model="series.nodeId"
          :options="nodes"
          option-label="label"
          option-value="id"
          placeholder="Node…"
          filter
          class="series-select"
          @change="() => onNodeChange(series)"
        />

        <!-- Resource picker -->
        <Select
          v-model="series.resourceId"
          :options="resourcesFor[series.nodeId] ?? []"
          option-label="label"
          option-value="id"
          placeholder="Resource…"
          :disabled="!series.nodeId"
          filter
          class="series-select"
          @change="() => onResourceChange(series)"
        />

        <!-- Attribute picker -->
        <Select
          v-model="series.attribute"
          :options="attrsFor[series.resourceId] ?? []"
          placeholder="Attribute…"
          :disabled="!series.resourceId"
          class="series-select"
          @change="() => onAttrChange(series)"
        />

        <!-- Color -->
        <ColorPicker v-model="series.color" />

        <!-- Remove -->
        <Button
          text
          rounded
          severity="danger"
          size="small"
          @click="removeSeries(idx)"
        >
          <i class="pi pi-times" />
        </Button>
      </div>

      <!-- Label -->
      <InputText
        v-model="series.label"
        placeholder="Series label"
        class="series-label-input"
      />

      <!-- Advanced toggle -->
      <div class="advanced-toggle">
        <Button
          text
          size="small"
          @click="toggleAdvanced(series.id)"
        >
          <i :class="advancedOpen[series.id] ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
          Advanced
        </Button>
      </div>

      <Textarea
        v-if="advancedOpen[series.id]"
        v-model="series.expression"
        placeholder="CDEF/JEXL expression override (clears to use dropdowns)"
        class="expression-input"
        rows="2"
        auto-resize
      />
    </div>

    <Button
      text
      label="+ Add Series"
      @click="addSeries"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import API from '@/services'
import { useResourceStore } from '@/stores/resourceStore'
import type { GraphSeries } from '@/services/dashboardConfigService'

const props = defineProps<{ modelValue: GraphSeries[] }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: GraphSeries[]): void }>()

const resourceStore = useResourceStore()

// Deep copy so we can mutate locally
const localSeries = ref<GraphSeries[]>(props.modelValue.map(s => ({ ...s })))
const advancedOpen = ref<Record<string, boolean>>({})

// Cache node list, resources per nodeId, attributes per resourceId
const nodes = ref<{ id: string; label: string }[]>([])
const resourcesFor = ref<Record<string, { id: string; label: string }[]>>({})
const attrsFor     = ref<Record<string, string[]>>({})

onMounted(async () => {
  const resp = await API.getNodes({ limit: 1000 } as any)
  if (resp) {
    nodes.value = resp.node.map((n: any) => ({
      id: String(n.id),
      label: n.label ?? String(n.id)
    }))
  }
  // Pre-populate resource/attr caches for existing series
  for (const s of localSeries.value) {
    if (s.nodeId) await loadResources(s.nodeId)
    if (s.resourceId) await loadAttributes(s.resourceId)
  }
})

const loadResources = async (nodeId: string) => {
  if (resourcesFor.value[nodeId]) return
  const resources = await resourceStore.getResourcesForNode(nodeId)
  resourcesFor.value[nodeId] = (resources ?? []).map((r: any) => ({
    id: r.id,
    label: r.label ?? r.id
  }))
}

const loadAttributes = async (resourceId: string) => {
  if (attrsFor.value[resourceId]) return
  const resource = await API.getResourceById(resourceId)
  if (resource) {
    attrsFor.value[resourceId] = Object.keys((resource as any).rrdGraphAttributes ?? {})
  }
}

const onNodeChange = async (series: GraphSeries) => {
  series.resourceId = ''
  series.attribute = ''
  await loadResources(series.nodeId)
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}

const onResourceChange = async (series: GraphSeries) => {
  series.attribute = ''
  await loadAttributes(series.resourceId)
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}

const onAttrChange = (series: GraphSeries) => {
  if (!series.label || series.label === '') series.label = series.attribute
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}

const toggleAdvanced = (id: string) => {
  advancedOpen.value[id] = !advancedOpen.value[id]
}

const addSeries = () => {
  const id = `series-${Date.now()}`
  localSeries.value.push({
    id,
    nodeId: '',
    resourceId: '',
    attribute: '',
    label: '',
    color: undefined,
    expression: undefined
  })
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}

const removeSeries = (idx: number) => {
  localSeries.value.splice(idx, 1)
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}

// Emit on every local change (watcher for color/label edits)
watch(localSeries, () => {
  emit('update:modelValue', localSeries.value.map(s => ({ ...s })))
}, { deep: true })
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.series-builder { display: flex; flex-direction: column; gap: 12px; }

.series-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var($border-light-on-surface);
  border-radius: 6px;
}

.series-row-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.series-num {
  @include body-small;
  color: var($secondary-text-on-surface);
  min-width: 16px;
}

.series-select { min-width: 140px; flex: 1; }

.series-label-input { width: 100%; }

.advanced-toggle { align-self: flex-start; }

.expression-input { width: 100%; font-family: monospace; }
</style>
```

- [ ] **Step 2: Create GraphWidget.vue**

Create `ui/src/components/Dashboard/widgets/GraphWidget.vue`:

```vue
<template>
  <div class="graph-widget">
    <PersesPanel
      v-if="validSeries.length > 0"
      :queries="queries"
      :time-range="effectiveTimeRange"
      :stack="config.stack"
    />
    <div v-else class="empty-state">
      No series configured. Click the settings icon to add data series.
    </div>
  </div>
</template>

<script setup lang="ts">
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { useDashboardStore } from '@/stores/dashboardStore'
import { resolveTimeRange, type GraphWidgetConfig } from '@/services/dashboardConfigService'
import type { OpenNMSBatchQuerySpec } from '@/datasource/opennms'

const props = defineProps<{ config: GraphWidgetConfig }>()

const dashboardStore = useDashboardStore()

const validSeries = computed(() =>
  props.config.series.filter(s => s.nodeId && s.resourceId && s.attribute)
)

const effectiveTimeRange = computed(() => {
  const tr = props.config.timeRange ?? dashboardStore.timeRange
  return resolveTimeRange(tr)
})

// Build OpenNMS batch query spec from series array
const queries = computed((): OpenNMSBatchQuerySpec => ({
  start: effectiveTimeRange.value.start.getTime(),
  end:   effectiveTimeRange.value.end.getTime(),
  step:  300000, // 5 min default
  source: validSeries.value.map(s => ({
    resourceId: s.resourceId,
    attribute:  s.attribute,
    label:      s.label || s.attribute,
    transient:  false,
    ...(s.expression ? { expression: s.expression } : {})
  }))
}))

// Expose refresh for parent WidgetFrame
const refresh = () => { /* PersesPanel re-fetches on prop change — update time range to trigger */ }
defineExpose({ refresh })
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.graph-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  @include body-large;
  color: var($secondary-text-on-surface);
  padding: 24px;
  text-align: center;
}
</style>
```

- [ ] **Step 3: Update GraphWidgetConfigForm.vue — replace stub with real series builder**

Replace the placeholder section in `ui/src/components/Dashboard/config/GraphWidgetConfigForm.vue`. Replace the `<div class="field placeholder-note">` block with:

```vue
    <div class="field">
      <label>Series</label>
      <GraphSeriesBuilder v-model="draft.series" />
    </div>
```

And add the import to the `<script setup>` block:

```ts
import GraphSeriesBuilder from '@/components/Dashboard/GraphSeriesBuilder.vue'
```

- [ ] **Step 4: Update DashboardGrid.vue — add graph type**

In `ui/src/components/Dashboard/DashboardGrid.vue`, add after the `NodesWidget` block in the template:

```vue
          <GraphWidget
            v-else-if="widget.type === 'graph'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget as GraphWidgetConfig"
          />
```

And add to the imports:

```ts
import GraphWidget from './widgets/GraphWidget.vue'
import type { GraphWidgetConfig } from '@/services/dashboardConfigService'
```

- [ ] **Step 5: Verify build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error|warning" | head -30
```

Expected: no type errors. If `OpenNMSBatchQuerySpec` import path is wrong, check `ui/src/datasource/opennms/index.ts` for the correct export.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Dashboard/GraphSeriesBuilder.vue \
        ui/src/components/Dashboard/widgets/GraphWidget.vue \
        ui/src/components/Dashboard/config/GraphWidgetConfigForm.vue \
        ui/src/components/Dashboard/DashboardGrid.vue
git commit -m "feat(dashboard): add graph widget with PersesPanel and cascading series builder"
```

---

## Task 9: NodeStatusWidget

**Files:**
- Create: `ui/src/components/Dashboard/widgets/NodeStatusWidget.vue`
- Modify: `ui/src/components/Dashboard/DashboardGrid.vue`

- [ ] **Step 1: Create NodeStatusWidget.vue**

Create `ui/src/components/Dashboard/widgets/NodeStatusWidget.vue`:

```vue
<template>
  <div class="node-status-widget">
    <div class="chart-wrapper">
      <Chart
        type="doughnut"
        :data="chartData"
        :options="chartOptions"
        class="chart"
      />
      <!-- CSS overlay for center text — avoids Chart.js plugin scoping issues -->
      <div class="center-text">{{ totalCount }}</div>
    </div>
    <div class="legend">
      <span class="legend-item up">
        <span class="legend-dot" />
        {{ upCount }} up
      </span>
      <span class="legend-item down">
        <span class="legend-dot" />
        {{ downCount }} down
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Chart from 'primevue/chart'
import API from '@/services'
import { getActiveOutageCount } from '@/services/outageService'
import type { NodeStatusWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ config: NodeStatusWidgetConfig }>()

const totalCount = ref(0)
const downCount  = ref(0)
const upCount    = computed(() => Math.max(0, totalCount.value - downCount.value))

const load = async () => {
  const [nodeResp, outageDown] = await Promise.all([
    API.getNodes({ limit: 0, ...(props.config.categories.length ? { category: props.config.categories.join(',') } : {}) } as any),
    getActiveOutageCount(props.config.categories)
  ])
  totalCount.value = nodeResp?.totalCount ?? 0
  downCount.value  = outageDown
}

// Read CSS vars at runtime so colors respect dark/light mode
const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || varName

const chartData = computed(() => ({
  labels: ['Up', 'Down'],
  datasets: [{
    data: [upCount.value, downCount.value],
    backgroundColor: [
      getColor('--feather-success'),
      getColor('--feather-error')
    ],
    borderWidth: 0,
    hoverOffset: 4
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true }
  }
}

onMounted(load)
defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.node-status-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  gap: 12px;
}

.chart-wrapper {
  position: relative;
  width: 160px;
  height: 160px;
}

.chart {
  width: 160px !important;
  height: 160px !important;
}

.center-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.6rem;
  font-weight: 700;
  color: var($primary-text-on-surface);
  pointer-events: none;
}

.legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  @include body-small;
  color: var($primary-text-on-surface);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.up   .legend-dot { background: var(--feather-success, #4caf50); }
.down .legend-dot { background: var(--feather-error, #f44336); }
</style>
```

- [ ] **Step 2: Update DashboardGrid.vue — add node-status type**

In `ui/src/components/Dashboard/DashboardGrid.vue`, after the `GraphWidget` block:

```vue
          <NodeStatusWidget
            v-else-if="widget.type === 'node-status'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget as NodeStatusWidgetConfig"
          />
```

Add to imports:

```ts
import NodeStatusWidget from './widgets/NodeStatusWidget.vue'
import type { NodeStatusWidgetConfig } from '@/services/dashboardConfigService'
```

- [ ] **Step 3: Verify build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "^.*(error|Error)" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Dashboard/widgets/NodeStatusWidget.vue \
        ui/src/components/Dashboard/DashboardGrid.vue
git commit -m "feat(dashboard): add node status donut widget using PrimeVue Chart"
```

---

## Task 10: AvailabilityWidget

**Files:**
- Create: `ui/src/components/Dashboard/widgets/AvailabilityWidget.vue`
- Modify: `ui/src/components/Dashboard/DashboardGrid.vue`

- [ ] **Step 1: Create AvailabilityWidget.vue**

Create `ui/src/components/Dashboard/widgets/AvailabilityWidget.vue`:

```vue
<template>
  <div class="availability-widget">
    <Chart
      type="doughnut"
      :data="chartData"
      :options="chartOptions"
      class="chart"
    />
    <div class="availability-label" :class="severityClass">
      {{ displayPercent }}%
    </div>
    <div class="availability-sub">
      availability
    </div>
  </div>
</template>

<script setup lang="ts">
import Chart from 'primevue/chart'
import { rest } from '@/services/axiosInstances'
import { useDashboardStore } from '@/stores/dashboardStore'
import { resolveTimeRange, type AvailabilityWidgetConfig } from '@/services/dashboardConfigService'

const props = defineProps<{ config: AvailabilityWidgetConfig }>()
const dashboardStore = useDashboardStore()

const availability = ref<number>(100)
const displayPercent = computed(() => availability.value.toFixed(2))

const severityClass = computed(() => {
  if (availability.value >= 99) return 'sev-ok'
  if (availability.value >= 95) return 'sev-warn'
  return 'sev-crit'
})

const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#888'

const fillColor = computed(() => {
  if (availability.value >= 99) return getColor('--feather-success')
  if (availability.value >= 95) return getColor('--feather-warning')
  return getColor('--feather-error')
})

const chartData = computed(() => ({
  labels: ['Available', 'Unavailable'],
  datasets: [{
    data: [availability.value, Math.max(0, 100 - availability.value)],
    backgroundColor: [fillColor.value, getColor('--feather-border-light-on-surface')],
    borderWidth: 0,
    hoverOffset: 4
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false }
  }
}

const load = async () => {
  try {
    const tr = props.config.timeRange ?? dashboardStore.timeRange
    const { start, end } = resolveTimeRange(tr)
    const params: Record<string, string> = {
      start: start.toISOString(),
      end:   end.toISOString()
    }
    if (props.config.categories.length) {
      params['category'] = props.config.categories[0]
    }
    const resp = await rest.get('availability/categories', { params })
    // Response shape: { availability: number (0-100) } or array of category objects
    // Extract aggregate availability — handle both shapes
    const data = resp.data
    if (typeof data?.availability === 'number') {
      availability.value = data.availability
    } else if (Array.isArray(data)) {
      const values: number[] = data.map((c: any) => c.availability ?? 100)
      availability.value = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 100
    }
  } catch {
    availability.value = 0
  }
}

onMounted(load)
defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.availability-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  gap: 8px;
}

.chart {
  width: 160px !important;
  height: 160px !important;
}

.availability-label {
  @include headline3;
  font-weight: 700;

  &.sev-ok   { color: var(--feather-success, #4caf50); }
  &.sev-warn { color: var(--feather-warning, #ff9800); }
  &.sev-crit { color: var(--feather-error,   #f44336); }
}

.availability-sub {
  @include body-small;
  color: var($secondary-text-on-surface);
}
</style>
```

- [ ] **Step 2: Update DashboardGrid.vue — add availability type**

After the `NodeStatusWidget` block in the template:

```vue
          <AvailabilityWidget
            v-else-if="widget.type === 'availability'"
            :ref="el => registerWidgetRef(widget.id, el)"
            :config="widget as AvailabilityWidgetConfig"
          />
```

Add to imports:

```ts
import AvailabilityWidget from './widgets/AvailabilityWidget.vue'
import type { AvailabilityWidgetConfig } from '@/services/dashboardConfigService'
```

- [ ] **Step 3: Verify full build and tests**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build && ./target/node/yarn/dist/bin/yarn test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 4: Deploy and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
# Verify bundle hash updated
grep -o 'assets/index-[^"]*\.js' src/main/dist/index.html
./deploy-to-container.sh test-opennms
# Confirm live hash matches
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
```

Navigate to `http://localhost:8980/opennms/ui/#/dashboard`. Verify:
- Widget gaps are visibly consistent (16px) both horizontally and vertically
- "Add Widget" SplitButton dropdown shows all 7 types
- Adding a node-status widget shows a donut with node up/down counts
- Adding an availability widget shows a percentage ring
- Time range picker appears when graph/availability widgets are on the board
- Graph widget shows "No series configured" until a series is added via settings

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Dashboard/widgets/AvailabilityWidget.vue \
        ui/src/components/Dashboard/DashboardGrid.vue
git commit -m "feat(dashboard): add availability ring widget using PrimeVue Chart"
```

---

## Notes for Implementer

- **`getResourceById`**: Exists as `API.getResourceById(resourceId)` in `ui/src/services/index.ts`. Confirm the method name before using; if absent, use `rest.get(`resources/${encodeURIComponent(resourceId)}`)`.
- **`OpenNMSBatchQuerySpec`**: Check the actual export path in `ui/src/datasource/opennms/`. If the type isn't exported from the index, import from `ui/src/datasource/opennms/types.ts` or equivalent.
- **`useResourceStore`**: Verify `getResourcesForNode` returns the resource array directly or as `.value`. Check `ui/src/stores/resourceStore.ts`.
- **`--feather-success` / `--feather-warning` / `--feather-error`**: Confirm these variable names in `ui/src/styles/opennms-feather-styles.scss`. If they differ, use the correct names.
- **PrimeVue `DatePicker`**: In PrimeVue 4.x the `Calendar` component was renamed to `DatePicker`. Use `primevue/datepicker`.
- **Chart.js peer dep**: `chart.js` must be installed explicitly (`yarn add chart.js`) since PrimeVue's Chart component requires it as a peer dep.
