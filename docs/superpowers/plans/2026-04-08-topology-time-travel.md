# Topology Time Travel & Edge Tooltip Graphs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global time scrubber to the topology canvas and mini sparkline charts (utilization, errors, discards) to the edge hover tooltip, backed by the OpenNMS measurements API.

**Architecture:** `TopologyTimeControl.vue` emits a selected `Date | null` (null = live) to `Topology.vue`, which calls `weathermapStore.setTime()`. The store cancels auto-refresh in historical mode and fetches a 5-minute snapshot at the selected time. `TopologyEdgeGraphs.vue` reads `EdgeLabelData.srcIface`/`tgtIface` and calls two new `measurementsService` functions to render sparklines via Chart.js.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Chart.js 3 (direct dep `^3.9.1`), lodash `debounce`, Vitest/happy-dom, OpenNMS measurements REST API (`/rest/measurements` — step in **milliseconds**).

**Spec:** `docs/superpowers/specs/2026-04-08-topology-time-travel-design.md`

---

## Chunk 1: Data Layer

### Task 1: Add srcNodeId/srcIface/tgtNodeId/tgtIface to EdgeLabelData

**Files:**
- Modify: `ui/src/stores/weathermapStore.ts`
- Modify: `ui/tests/stores/weathermapStore.edgeLabelData.test.ts`

- [ ] **Step 1: Add fields to EdgeLabelData interface**

In `weathermapStore.ts`, extend `EdgeLabelData`:

```typescript
export interface EdgeLabelData {
  localIfName?: string
  remotePortId?: string
  localIp?: string
  remoteIp?: string
  localMac?: string
  remoteMac?: string
  ifSpeed?: number
  srcNodeId?: number       // ← new
  srcIface?: SnmpInterface // ← new: resolved local interface (from LLDP or SNMP fallback)
  tgtNodeId?: number       // ← new
  tgtIface?: SnmpInterface // ← new: resolved remote interface (from reverse LLDP)
}
```

- [ ] **Step 2: Populate srcNodeId/tgtNodeId unconditionally in _fetchAll edge loop**

Immediately after `const data: EdgeLabelData = {}` in the edge loop (just before the `data.localIp = ...` line):

```typescript
data.srcNodeId = srcId
data.tgtNodeId = tgtId
```

- [ ] **Step 3: Capture srcIface in the forward LLDP ifIndex branch**

In the block that resolves `localIface` from `nodeIfIndexMap[srcId]`, add one line:

```typescript
const localIface = nodeIfIndexMap[srcId].get(Number(ifIndexMatch[1]))
if (localIface) {
  data.localIfName = localIface.ifName ?? localIface.ifDescr ?? undefined
  data.localMac    = localIface.physAddr ?? undefined
  data.ifSpeed     = localIface.ifSpeed > 0 ? localIface.ifSpeed : undefined
  data.srcIface    = localIface  // ← add
}
```

- [ ] **Step 4: Capture tgtIface in the reverse LLDP ifIndex branch**

In the block that resolves `remoteIface` from `nodeIfIndexMap[tgtId]`, add one line:

```typescript
const remoteIface = nodeIfIndexMap[tgtId]?.get(Number(ifIndexMatch[1]))
if (remoteIface) {
  data.remotePortId = remoteIface.ifName ?? remoteIface.ifDescr ?? undefined
  data.remoteMac    = data.remoteMac ?? remoteIface.physAddr ?? undefined
  data.tgtIface     = remoteIface  // ← add
}
```

- [ ] **Step 5: Capture srcIface in the SNMP best-interface fallback**

At the bottom of the edge loop in the final fallback block:

```typescript
if (!data.localIfName) {
  const best = nodeSnmpMap[srcId]
  if (best) {
    data.localIfName = best.ifName ?? best.ifDescr ?? undefined
    data.localMac    = best.physAddr ?? undefined
    data.ifSpeed     = best.ifSpeed > 0 ? best.ifSpeed : undefined
    data.srcIface    = best  // ← add
  }
}
```

- [ ] **Step 6: Write test for new fields**

Add to `weathermapStore.edgeLabelData.test.ts`:

```typescript
it('populates srcNodeId, tgtNodeId, and srcIface via forward LLDP ifIndex', async () => {
  const iface = makeSnmpIface({ ifIndex: 1, ifName: 'eth0', physAddr: '001122334455' })
  vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
  vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
  vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
  vi.mocked(measurementsService.fetchNodeIpInterfaces).mockResolvedValue([])
  vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
  vi.mocked(enlinkdService.getNodeEnlinkd).mockImplementation(async (nodeId: number) => {
    if (nodeId !== 10) return EMPTY_ENLINKD
    return {
      ...EMPTY_ENLINKD,
      lldpLinkNodes: [{
        lldpLocalPort: 'eth0 (ifindex:1)(macAddress:001122334455)',
        lldpLocalPortUrl: '', lldpRemChassisId: '', lldpRemChassisIdUrl: '',
        lldpRemInfo: 'node-b', ldpRemPort: 'GigEth0/1',
        lldpCreateTime: '', lldpLastPollTime: ''
      }]
    }
  })

  const store = useWeathermapStore()
  await store.start(VERTICES, EDGES)

  const key = edgeKey(10, 20)
  expect(store.edgeLabelData[key].srcNodeId).toBe(10)
  expect(store.edgeLabelData[key].tgtNodeId).toBe(20)
  expect(store.edgeLabelData[key].srcIface?.ifName).toBe('eth0')
  expect(store.edgeLabelData[key].tgtIface).toBeUndefined() // no reverse LLDP in this scenario
})

it('sets srcIface from SNMP fallback when no LLDP match', async () => {
  const iface = makeSnmpIface({ ifName: 'eth0', physAddr: null })
  vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
  vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
  vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
  vi.mocked(measurementsService.fetchNodeIpInterfaces).mockResolvedValue([])
  vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
  vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue(EMPTY_ENLINKD)

  const store = useWeathermapStore()
  await store.start(VERTICES, EDGES)

  const key = edgeKey(10, 20)
  expect(store.edgeLabelData[key].srcNodeId).toBe(10)
  expect(store.edgeLabelData[key].srcIface?.ifName).toBe('eth0')
})
```

- [ ] **Step 7: Run tests**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/stores/weathermapStore.edgeLabelData.test.ts
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add ui/src/stores/weathermapStore.ts ui/tests/stores/weathermapStore.edgeLabelData.test.ts
git commit -m "feat(topology): add srcIface/tgtIface/srcNodeId/tgtNodeId to EdgeLabelData"
```

---

### Task 2: Add atTime parameter to fetchInterfaceUtilization

**Files:**
- Modify: `ui/src/services/measurementsService.ts`
- Modify: `ui/tests/services/measurementsService.test.ts`

- [ ] **Step 1: Add axios mock and failing tests**

`vi.mock` must be at **module scope** (not inside a `describe`). Vitest hoists it automatically. Add these lines to `measurementsService.test.ts` **after** the existing `import` statements at the top of the file:

```typescript
// Add to existing imports — extend the named import from 'vitest':
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rest } from '@/services/axiosInstances'
import { fetchInterfaceUtilization } from '@/services/measurementsService'

// At module scope — NOT inside any describe():
vi.mock('@/services/axiosInstances', () => ({
  rest: { post: vi.fn() },
  v2:   { get:  vi.fn() }
}))
```

Also update the existing `makeIface` helper's parameter to be optional (`overrides: Partial<SnmpInterface> = {}`) so it can be called with no arguments in the new tests.

Then add a new `describe` block at the bottom of the file:

```typescript
describe('fetchInterfaceUtilization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses 5-minute window ending at atTime when provided', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: { labels: ['inOctets', 'outOctets'], columns: [{ values: [125_000] }, { values: [62_500] }] }
    })
    const atTime = new Date(1_000_000_000_000)
    await fetchInterfaceUtilization(42, makeIface(), atTime)
    const payload = vi.mocked(rest.post).mock.calls[0][1] as any
    expect(payload.end).toBe(atTime.getTime())
    expect(payload.start).toBe(atTime.getTime() - 300_000)
  })

  it('uses current time as window end when atTime is omitted', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: { labels: ['inOctets', 'outOctets'], columns: [{ values: [125_000] }, { values: [62_500] }] }
    })
    const before = Date.now()
    await fetchInterfaceUtilization(42, makeIface())
    const after = Date.now()
    const payload = vi.mocked(rest.post).mock.calls[0][1] as any
    expect(payload.end).toBeGreaterThanOrEqual(before)
    expect(payload.end).toBeLessThanOrEqual(after)
    expect(payload.end - payload.start).toBe(300_000)
  })
})
```

Note: The `vi.mock` is hoisted and does not affect the existing pure-function tests (`buildSnmpResourceId`, `pickBestInterface`) since those functions never import from `axiosInstances`.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/services/measurementsService.test.ts
```

Expected: new `fetchInterfaceUtilization` tests fail (function signature doesn't accept `atTime` yet).

- [ ] **Step 3: Implement atTime parameter**

In `measurementsService.ts`, update `fetchInterfaceUtilization` signature and window computation:

```typescript
export const fetchInterfaceUtilization = async (
  nodeId: number,
  iface: SnmpInterface,
  atTime?: Date          // ← new: if provided, query 5-minute window ending at atTime
): Promise<InterfaceUtil | null> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const end   = atTime ? atTime.getTime() : Date.now()  // ← changed
  const start = end - 300_000                           // ← changed
  const payload = {
    start,
    end,
    step: 300_000,
    source: [
      { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
      { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
    ]
  }
  // ... rest of function unchanged
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/services/measurementsService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/measurementsService.ts ui/tests/services/measurementsService.test.ts
git commit -m "feat(measurements): add atTime parameter to fetchInterfaceUtilization"
```

---

### Task 3: Add fetchInterfaceTimeSeries and fetchInterfaceErrorsDiscards

**Files:**
- Modify: `ui/src/services/measurementsService.ts`
- Modify: `ui/tests/services/measurementsService.test.ts`

- [ ] **Step 1: Write failing tests for fetchInterfaceTimeSeries**

Extend the existing import of `measurementsService` at the top of the test file to include the two new functions (they don't exist yet — the test will fail at runtime with "not a function", which is the expected failing state):

```typescript
// Update existing import line:
import { buildSnmpResourceId, pickBestInterface, fetchInterfaceUtilization,
         fetchInterfaceTimeSeries, fetchInterfaceErrorsDiscards } from '@/services/measurementsService'
```

Add these describe blocks at the bottom of the file:

```typescript
describe('fetchInterfaceTimeSeries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns timestamps computed from start + i * step', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: {
        labels: ['inOctets', 'outOctets'],
        columns: [{ values: [100, 200, 300] }, { values: [50, 100, 150] }]
      }
    })
    const start = new Date(0)
    const end   = new Date(180_000) // 3 minutes
    const result = await fetchInterfaceTimeSeries(1, makeIface(), start, end, 60_000)
    expect(result.timestamps).toEqual([0, 60_000, 120_000])
  })

  it('converts bytes/sec to bits/sec (× 8)', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: {
        labels: ['inOctets', 'outOctets'],
        columns: [{ values: [125_000] }, { values: [62_500] }]
      }
    })
    const result = await fetchInterfaceTimeSeries(1, makeIface(), new Date(0), new Date(60_000))
    expect(result.inBps[0]).toBe(1_000_000)   // 125 000 * 8
    expect(result.outBps[0]).toBe(500_000)    // 62 500 * 8
  })

  it('replaces NaN and negative values with 0', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: {
        labels: ['inOctets', 'outOctets'],
        columns: [{ values: [NaN, -1, 100] }, { values: [0, NaN, 50] }]
      }
    })
    const result = await fetchInterfaceTimeSeries(1, makeIface(), new Date(0), new Date(180_000))
    expect(result.inBps).toEqual([0, 0, 800])
    expect(result.outBps).toEqual([0, 0, 400])
  })
})

describe('fetchInterfaceErrorsDiscards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for a series that is all-zero', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: {
        labels: ['ifInErrors', 'ifOutErrors', 'ifInDiscards', 'ifOutDiscards'],
        columns: [{ values: [0, 0] }, { values: [0, 1] }, { values: [0, 0] }, { values: [0, 0] }]
      }
    })
    const result = await fetchInterfaceErrorsDiscards(1, makeIface(), new Date(0), new Date(120_000))
    expect(result.ifInErrors).toBeNull()          // all zero
    expect(result.ifOutErrors).toEqual([0, 1])    // has non-zero value
    expect(result.ifInDiscards).toBeNull()
    expect(result.ifOutDiscards).toBeNull()
  })

  it('passes AbortSignal through to the HTTP request', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: {
        labels: ['ifInErrors', 'ifOutErrors', 'ifInDiscards', 'ifOutDiscards'],
        columns: [{ values: [1] }, { values: [0] }, { values: [0] }, { values: [0] }]
      }
    })
    const controller = new AbortController()
    await fetchInterfaceErrorsDiscards(1, makeIface(), new Date(0), new Date(60_000), 60_000, controller.signal)
    const callArgs = vi.mocked(rest.post).mock.calls[0]
    expect((callArgs[2] as any)?.signal).toBe(controller.signal)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/services/measurementsService.test.ts
```

- [ ] **Step 3: Implement fetchInterfaceTimeSeries**

Add to `measurementsService.ts`:

```typescript
/**
 * Fetch a time-series of inbound/outbound bit rates for a specific interface.
 * Returns arrays parallel to `timestamps` (ms epoch). NaN/negative API values → 0.
 * step is in MILLISECONDS (e.g. 60_000 = 1-minute resolution).
 */
export const fetchInterfaceTimeSeries = async (
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step = 60_000,
  signal?: AbortSignal
): Promise<{ timestamps: number[]; inBps: number[]; outBps: number[] }> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const payload = {
    start: start.getTime(),
    end:   end.getTime(),
    step,
    source: [
      { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
      { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
    ]
  }
  try {
    const resp  = await rest.post('/measurements', payload, { signal })
    const labels: string[]                = resp.data.labels  ?? []
    const columns: { values: number[] }[] = resp.data.columns ?? []
    const inIdx  = labels.indexOf('inOctets')
    const outIdx = labels.indexOf('outOctets')
    const n      = columns[inIdx]?.values.length ?? 0
    const toFinite = (v: number) => (isFinite(v) && v >= 0) ? v : 0
    const timestamps = Array.from({ length: n }, (_, i) => start.getTime() + i * step)
    const inBps  = (columns[inIdx]?.values  ?? []).map(v => toFinite(v) * 8)
    const outBps = (columns[outIdx]?.values ?? []).map(v => toFinite(v) * 8)
    return { timestamps, inBps, outBps }
  } catch {
    return { timestamps: [], inBps: [], outBps: [] }
  }
}
```

- [ ] **Step 4: Implement fetchInterfaceErrorsDiscards**

```typescript
/**
 * Fetch error and discard counts for a specific interface over a time window.
 * Returns null for any series that is entirely zero (not worth rendering).
 * step is in MILLISECONDS.
 */
export const fetchInterfaceErrorsDiscards = async (
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step = 60_000,
  signal?: AbortSignal
): Promise<{
  ifInErrors:    number[] | null
  ifOutErrors:   number[] | null
  ifInDiscards:  number[] | null
  ifOutDiscards: number[] | null
}> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const payload = {
    start: start.getTime(),
    end:   end.getTime(),
    step,
    source: [
      { attribute: 'ifInErrors',    label: 'ifInErrors',    resourceId, transient: false },
      { attribute: 'ifOutErrors',   label: 'ifOutErrors',   resourceId, transient: false },
      { attribute: 'ifInDiscards',  label: 'ifInDiscards',  resourceId, transient: false },
      { attribute: 'ifOutDiscards', label: 'ifOutDiscards', resourceId, transient: false }
    ]
  }
  try {
    const resp    = await rest.post('/measurements', payload, { signal })
    const labels: string[]                = resp.data.labels  ?? []
    const columns: { values: number[] }[] = resp.data.columns ?? []
    const toFinite = (v: number) => (isFinite(v) && v >= 0) ? v : 0
    const getOrNull = (label: string): number[] | null => {
      const idx  = labels.indexOf(label)
      if (idx < 0) return null
      const vals = (columns[idx]?.values ?? []).map(toFinite)
      return vals.some(v => v > 0) ? vals : null
    }
    return {
      ifInErrors:    getOrNull('ifInErrors'),
      ifOutErrors:   getOrNull('ifOutErrors'),
      ifInDiscards:  getOrNull('ifInDiscards'),
      ifOutDiscards: getOrNull('ifOutDiscards')
    }
  } catch {
    return { ifInErrors: null, ifOutErrors: null, ifInDiscards: null, ifOutDiscards: null }
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/services/measurementsService.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/services/measurementsService.ts ui/tests/services/measurementsService.test.ts
git commit -m "feat(measurements): add fetchInterfaceTimeSeries and fetchInterfaceErrorsDiscards"
```

---

### Task 4: Add selectedTime + setTime to weathermapStore

**Files:**
- Modify: `ui/src/stores/weathermapStore.ts`
- Modify: `ui/tests/stores/weathermapStore.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `weathermapStore.test.ts`:

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useWeathermapStore } from '@/stores/weathermapStore'
import * as measurementsService from '@/services/measurementsService'
import * as enlinkdService from '@/services/enlinkdService'

vi.mock('@/services/measurementsService', () => ({
  fetchNodeSnmpIfaces: vi.fn().mockResolvedValue([]),
  fetchNodeType: vi.fn().mockResolvedValue('A'),
  fetchNodeIpInterfaces: vi.fn().mockResolvedValue([]),
  fetchInterfaceUtilization: vi.fn().mockResolvedValue(null),
  pickBestInterface: vi.fn().mockReturnValue(null)
}))
vi.mock('@/services/enlinkdService', () => ({
  getNodeEnlinkd: vi.fn().mockResolvedValue({ lldpLinkNodes: [], ospfLinkNodes: [], isisLinkNodes: [], cdpLinkNodes: [], bridgeLinkNodes: [], lldpElementNode: null, ospfElementNode: null, isisElementNode: null }),
  cleanName: (s: string) => s
}))

describe('weathermapStore — selectedTime + setTime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('selectedTime is null initially', () => {
    const store = useWeathermapStore()
    expect(store.selectedTime).toBeNull()
  })

  it('setTime(date) sets selectedTime and sets loading', async () => {
    const store = useWeathermapStore()
    const t = new Date(1_000_000_000_000)
    await store.setTime(t)
    expect(store.selectedTime).toBe(t)
    expect(store.loading).toBe(false) // settled after fetch
  })

  it('setTime(null) resets selectedTime to null', async () => {
    const store = useWeathermapStore()
    // Put store in historical mode first using the public API
    await store.setTime(new Date(1_000_000_000_000))
    expect(store.selectedTime).not.toBeNull()
    await store.setTime(null)
    expect(store.selectedTime).toBeNull()
  })
})
```

Note: `setTime` is async (it triggers a fetch), so tests await it.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/stores/weathermapStore.test.ts
```

- [ ] **Step 3: Add selectedTime ref and setTime action**

In `weathermapStore.ts`, add state:

```typescript
const selectedTime = ref<Date | null>(null)  // null = live
```

Update `_fetchAll`'s call to `fetchInterfaceUtilization` to pass the current selectedTime:

```typescript
// In the edge util fetch loop — find this existing line:
const util: InterfaceUtil | null = await fetchInterfaceUtilization(nodeId, iface)
// Change to:
const util: InterfaceUtil | null = await fetchInterfaceUtilization(nodeId, iface, selectedTime.value ?? undefined)
```

Add `setTime` action after `setPollInterval`:

```typescript
const setTime = async (t: Date | null) => {
  selectedTime.value = t
  if (t === null) {
    // Resume auto-refresh via normal path (refresh() calls _scheduleNext in finally)
    await refresh()
  } else {
    // Historical mode: cancel timer, fetch snapshot without rescheduling
    if (_timer) { clearTimeout(_timer); _timer = null }
    loading.value = true
    error.value   = null
    try {
      await _fetchAll()
    } catch {
      error.value = 'Weathermap unavailable'
    } finally {
      loading.value = false
      // Do NOT call _scheduleNext() — historical mode has no auto-refresh
    }
  }
}
```

Export `selectedTime` and `setTime` from the store:

```typescript
return {
  edgeUtilMap, nodeDownMap, edgeLabelData, loading, error, pollInterval, lastUpdated,
  selectedTime,  // ← new
  start, stop, refresh, setPollInterval, setTime  // ← add setTime
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --reporter=verbose tests/stores/weathermapStore.test.ts
```

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test
```

- [ ] **Step 6: Commit**

```bash
git add ui/src/stores/weathermapStore.ts ui/tests/stores/weathermapStore.test.ts
git commit -m "feat(weathermap): add selectedTime + setTime for historical mode"
```

---

## Chunk 2: UI Components

### Task 5: Build TopologyTimeControl.vue

**Files:**
- Create: `ui/src/components/Topology/TopologyTimeControl.vue`

No unit test file — the component is pure UI with no extractable logic. Verified manually in Task 6.

- [ ] **Step 1: Create the component**

`ui/src/components/Topology/TopologyTimeControl.vue`:

```vue
<template>
  <div class="time-control">
    <div class="time-control__range">
      <button
        v-for="r in RANGES"
        :key="r.key"
        type="button"
        class="time-control__range-btn"
        :class="{ active: currentRange === r.key }"
        @click="selectRange(r.key)"
      >{{ r.label }}</button>
    </div>

    <input
      type="range"
      class="time-control__slider"
      :min="0"
      :max="currentRangeMs"
      :value="sliderPos"
      @input="onInput"
    />

    <span class="time-control__timestamp">
      {{ isLive ? '' : formatTimestamp(previewDate) }}
    </span>

    <button
      type="button"
      class="time-control__live-btn"
      :class="{ 'is-live': isLive }"
      @click="snapToLive"
    >
      <span v-if="isLive" class="time-control__live-dot"></span>
      LIVE
    </button>
  </div>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'

const RANGES: { key: '24h' | '7d' | '30d'; label: string; ms: number }[] = [
  { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1_000 },
  { key: '7d',  label: '7d',  ms: 7 * 24 * 60 * 60 * 1_000 },
  { key: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1_000 }
]

const props = defineProps<{ modelValue: Date | null }>()
const emit  = defineEmits<{ 'update:modelValue': [Date | null] }>()

const currentRange   = ref<'24h' | '7d' | '30d'>('24h')
const currentRangeMs = computed(() => RANGES.find(r => r.key === currentRange.value)!.ms)

// sliderPos: ms offset from range start. 0 = oldest, currentRangeMs = now (LIVE).
const sliderPos  = ref(currentRangeMs.value)
const previewDate = ref<Date>(new Date())
const isLive     = computed(() => sliderPos.value >= currentRangeMs.value)

const formatTimestamp = (d: Date): string =>
  d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const debouncedEmit = debounce((pos: number, rangeMs: number) => {
  if (pos >= rangeMs) {
    emit('update:modelValue', null)
  } else {
    emit('update:modelValue', new Date(Date.now() - (rangeMs - pos)))
  }
}, 400)

onBeforeUnmount(() => debouncedEmit.cancel())

const onInput = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value)
  sliderPos.value = val
  previewDate.value = val >= currentRangeMs.value
    ? new Date()
    : new Date(Date.now() - (currentRangeMs.value - val))
  debouncedEmit(val, currentRangeMs.value)
}

const snapToLive = () => {
  sliderPos.value = currentRangeMs.value
  debouncedEmit.cancel()
  emit('update:modelValue', null)
}

const selectRange = (key: '24h' | '7d' | '30d') => {
  currentRange.value = key
  sliderPos.value = currentRangeMs.value
  debouncedEmit.cancel()
  emit('update:modelValue', null)
}

// Sync slider to LIVE when parent sets modelValue to null externally
watch(() => props.modelValue, (val) => {
  if (val === null) sliderPos.value = currentRangeMs.value
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.time-control {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: var($surface);
  border-top: 1px solid var($border-on-surface);
  height: 40px;
  flex-shrink: 0;

  &__range {
    display: flex;
    gap: 4px;
  }

  &__range-btn {
    padding: 2px 8px;
    border-radius: vars.$border-radius-pill;
    border: 1px solid var($border-on-surface);
    background: transparent;
    color: var($secondary-text-on-surface);
    font-size: 0.72rem;
    cursor: pointer;

    &.active {
      background: var($primary);
      border-color: var($primary);
      color: #fff;
    }
  }

  &__slider {
    flex: 1;
    min-width: 0;
    accent-color: var($primary);
  }

  &__timestamp {
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    min-width: 120px;
    text-align: right;
  }

  &__live-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: vars.$border-radius-pill;
    border: 1px solid var($border-on-surface);
    background: transparent;
    color: var($secondary-text-on-surface);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;

    &.is-live {
      border-color: #48BB78;
      color: #48BB78;
    }
  }

  &__live-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #48BB78;
    animation: pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/Topology/TopologyTimeControl.vue
git commit -m "feat(topology): add TopologyTimeControl time-scrubber component"
```

---

### Task 6: Wire TopologyTimeControl into Topology.vue

**Files:**
- Modify: `ui/src/containers/Topology.vue`

- [ ] **Step 1: Add import and v-model wiring**

In `Topology.vue`, add the import after existing imports:

```typescript
import TopologyTimeControl from '@/components/Topology/TopologyTimeControl.vue'
```

Add a computed v-model that binds to the store:

```typescript
const selectedTimeModel = computed({
  get: () => wmStore.selectedTime,
  set: (t: Date | null) => wmStore.setTime(t)
})
```

- [ ] **Step 2: Insert the component between toolbar and graph**

In the template, change:

```html
<!-- BEFORE -->
<TopologyToolbar ... />
<TopologyGraph ref="graphRef" />

<!-- AFTER -->
<TopologyToolbar ... />
<TopologyTimeControl v-model="selectedTimeModel" />
<TopologyGraph ref="graphRef" />
```

- [ ] **Step 3: Adjust topology-page height**

In the `<style>` block, change:

```scss
// BEFORE
.topology-page {
  height: calc(100vh - 120px);
}

// AFTER
.topology-page {
  height: calc(100vh - 160px);
}
```

- [ ] **Step 4: Build and deploy**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Verify the time control bar appears below the toolbar and above the canvas. Verify:
- 24h / 7d / 30d range toggle works (LIVE snaps when changed)
- Dragging slider left shows a timestamp label
- Dragging to the rightmost position shows the pulsing LIVE badge
- Dragging the slider causes the weathermap edges to update (400ms debounce) with historical data

- [ ] **Step 5: Commit**

```bash
git add ui/src/containers/Topology.vue
git commit -m "feat(topology): wire TopologyTimeControl into Topology.vue"
```

---

### Task 7: Add canvas watermark for historical mode

**Files:**
- Modify: `ui/src/components/Topology/TopologyGraph.vue`

- [ ] **Step 1: Add watermark element to template**

In `TopologyGraph.vue`, import the weathermap store and add the watermark div. After existing imports in `<script setup>`:

```typescript
import { useWeathermapStore } from '@/stores/weathermapStore'
const wmStore = useWeathermapStore()

const formatWatermarkTime = (d: Date | null): string => {
  if (!d) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
```

In the template, add before `<TopologyDetailPanel />`:

```html
<div
  v-if="wmStore.selectedTime !== null"
  class="topology-graph__watermark"
>
  ⏱ Historical: {{ formatWatermarkTime(wmStore.selectedTime) }}
</div>
```

- [ ] **Step 2: Add watermark styles**

In the `<style>` scoped block:

```scss
&__watermark {
  position: absolute;
  top: 8px;
  left: 8px;
  pointer-events: none;
  z-index: 10;
  font-size: 0.75rem;
  font-weight: 600;
  color: var($primary-text-on-surface);
  background: rgba(0, 0, 0, 0.45);
  padding: 3px 10px;
  border-radius: vars.$border-radius-pill;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 3: Build, deploy, and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Verify: watermark appears when slider is not at LIVE position, and disappears when snapped to LIVE.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Topology/TopologyGraph.vue
git commit -m "feat(topology): add historical mode watermark to canvas"
```

---

### Task 8: Build TopologyEdgeGraphs.vue

**Files:**
- Create: `ui/src/components/Topology/TopologyEdgeGraphs.vue`

This component renders 2–4 sparklines inside the edge tooltip. It receives `edgeLabelData` as a prop and reads `selectedTime` from the weathermap store.

- [ ] **Step 1: Create the component**

`ui/src/components/Topology/TopologyEdgeGraphs.vue`:

```vue
<template>
  <div class="edge-graphs">
    <div class="edge-graphs__divider"></div>

    <!-- Loading shimmer -->
    <template v-if="loading">
      <div v-for="n in 2" :key="n" class="edge-graphs__shimmer"></div>
    </template>

    <!-- Data unavailable (no iface info) -->
    <div v-else-if="!hasSrcIface && !hasTgtIface" class="edge-graphs__unavailable">
      Interface data unavailable
    </div>

    <!-- Charts -->
    <template v-else>
      <div v-if="hasSrcIface" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">{{ srcIfaceLabel }} (source)</div>
        <canvas ref="srcUtilCanvas" class="edge-graphs__canvas"></canvas>
        <div class="edge-graphs__chart-legend">
          <span class="edge-graphs__legend-in">↑ {{ latestInBps(srcData) }}</span>
          <span class="edge-graphs__legend-out">↓ {{ latestOutBps(srcData) }}</span>
        </div>
      </div>

      <div v-if="hasTgtIface" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">{{ tgtIfaceLabel }} (target)</div>
        <canvas ref="tgtUtilCanvas" class="edge-graphs__canvas"></canvas>
        <div class="edge-graphs__chart-legend">
          <span class="edge-graphs__legend-in">↑ {{ latestInBps(tgtData) }}</span>
          <span class="edge-graphs__legend-out">↓ {{ latestOutBps(tgtData) }}</span>
        </div>
      </div>

      <div v-if="errorsData" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">Errors</div>
        <canvas ref="errCanvas" class="edge-graphs__canvas"></canvas>
      </div>

      <div v-if="discardsData" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">Discards</div>
        <canvas ref="discCanvas" class="edge-graphs__canvas"></canvas>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler
} from 'chart.js'
import { EdgeLabelData } from '@/stores/weathermapStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import {
  fetchInterfaceTimeSeries,
  fetchInterfaceErrorsDiscards
} from '@/services/measurementsService'
import { formatBitsPerSec } from './protocolColors'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler)

const props = defineProps<{ labelData: EdgeLabelData }>()

const wmStore = useWeathermapStore()

const loading   = ref(true)
const srcData   = ref<{ inBps: number[]; outBps: number[] } | null>(null)
const tgtData   = ref<{ inBps: number[]; outBps: number[] } | null>(null)
const errorsData   = ref<{ src: number[] | null; tgt: number[] | null } | null>(null)
const discardsData = ref<{ src: number[] | null; tgt: number[] | null } | null>(null)

const hasSrcIface = computed(() => !!props.labelData.srcIface && props.labelData.srcNodeId != null)
const hasTgtIface = computed(() => !!props.labelData.tgtIface && props.labelData.tgtNodeId != null)

const srcIfaceLabel = computed(() =>
  props.labelData.srcIface?.ifName ?? props.labelData.srcIface?.ifDescr ?? 'eth?'
)
const tgtIfaceLabel = computed(() =>
  props.labelData.tgtIface?.ifName ?? props.labelData.tgtIface?.ifDescr
  ?? props.labelData.remotePortId ?? 'eth?'
)

const LOOKBACK_MS = 2 * 60 * 60 * 1_000  // 2 hours

const latestInBps  = (d: { inBps: number[]; outBps: number[] } | null) =>
  d ? `${formatBitsPerSec(d.inBps[d.inBps.length - 1] ?? 0)}bps` : ''
const latestOutBps = (d: { inBps: number[]; outBps: number[] } | null) =>
  d ? `${formatBitsPerSec(d.outBps[d.outBps.length - 1] ?? 0)}bps` : ''

// Canvas refs and chart instances
const srcUtilCanvas = ref<HTMLCanvasElement | null>(null)
const tgtUtilCanvas = ref<HTMLCanvasElement | null>(null)
const errCanvas     = ref<HTMLCanvasElement | null>(null)
const discCanvas    = ref<HTMLCanvasElement | null>(null)
const charts: Chart[] = []

let controller: AbortController | null = null

const getWindow = (): { start: Date; end: Date } => {
  const endMs = wmStore.selectedTime ? wmStore.selectedTime.getTime() : Date.now()
  return { start: new Date(endMs - LOOKBACK_MS), end: new Date(endMs) }
}

const buildSparkline = (
  canvas: HTMLCanvasElement,
  datasets: { label: string; data: number[]; borderColor: string; backgroundColor?: string }[],
  labels: string[]
): Chart => {
  return new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: datasets.map(d => ({
      ...d,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false
    })) },
    options: {
      animation: false,
      responsive: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false, min: 0 }
      }
    }
  })
}

const fetchData = async () => {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  srcData.value = null
  tgtData.value = null
  errorsData.value   = null
  discardsData.value = null

  const { start, end } = getWindow()
  const { signal } = controller

  try {
    const [srcTs, tgtTs, srcErr, tgtErr] = await Promise.allSettled([
      hasSrcIface.value
        ? fetchInterfaceTimeSeries(props.labelData.srcNodeId!, props.labelData.srcIface!, start, end, 60_000, signal)
        : Promise.resolve(null),
      hasTgtIface.value
        ? fetchInterfaceTimeSeries(props.labelData.tgtNodeId!, props.labelData.tgtIface!, start, end, 60_000, signal)
        : Promise.resolve(null),
      hasSrcIface.value
        ? fetchInterfaceErrorsDiscards(props.labelData.srcNodeId!, props.labelData.srcIface!, start, end, 60_000, signal)
        : Promise.resolve(null),
      hasTgtIface.value
        ? fetchInterfaceErrorsDiscards(props.labelData.tgtNodeId!, props.labelData.tgtIface!, start, end, 60_000, signal)
        : Promise.resolve(null)
    ])

    if (srcTs.status === 'fulfilled' && srcTs.value) srcData.value = srcTs.value
    if (tgtTs.status === 'fulfilled' && tgtTs.value) tgtData.value = tgtTs.value

    const srcErrVal = srcErr.status === 'fulfilled' ? srcErr.value : null
    const tgtErrVal = tgtErr.status === 'fulfilled' ? tgtErr.value : null

    // Combine in+out into a single "total" series per endpoint for errors and discards.
    // Both directions ride the same physical interface; users care about the aggregate.
    const sumOrNull = (a: number[] | null, b: number[] | null): number[] | null => {
      if (!a && !b) return null
      const len = (a ?? b)!.length
      return Array.from({ length: len }, (_, i) => (a?.[i] ?? 0) + (b?.[i] ?? 0))
    }

    const srcErrors   = sumOrNull(srcErrVal?.ifInErrors ?? null,   srcErrVal?.ifOutErrors ?? null)
    const tgtErrors   = sumOrNull(tgtErrVal?.ifInErrors ?? null,   tgtErrVal?.ifOutErrors ?? null)
    const srcDiscards = sumOrNull(srcErrVal?.ifInDiscards ?? null, srcErrVal?.ifOutDiscards ?? null)
    const tgtDiscards = sumOrNull(tgtErrVal?.ifInDiscards ?? null, tgtErrVal?.ifOutDiscards ?? null)

    if (srcErrors || tgtErrors) {
      errorsData.value = { src: srcErrors, tgt: tgtErrors }
    }
    if (srcDiscards || tgtDiscards) {
      discardsData.value = { src: srcDiscards, tgt: tgtDiscards }
    }
  } catch {
    // Silently disappear on error — do not show error UI in tooltip
  } finally {
    loading.value = false
  }
}

// Build/rebuild charts after data is fetched and DOM is updated
watch(loading, async (isLoading) => {
  if (isLoading) return
  await nextTick()
  charts.forEach(c => c.destroy())
  charts.length = 0

  const n = srcData.value?.inBps.length ?? tgtData.value?.inBps.length ?? 0
  const labels = Array.from({ length: n }, (_, i) => String(i))

  if (srcData.value && srcUtilCanvas.value) {
    charts.push(buildSparkline(srcUtilCanvas.value, [
      { label: '↑ in',  data: srcData.value.inBps,  borderColor: '#48BB78' },
      { label: '↓ out', data: srcData.value.outBps, borderColor: '#4C9BE8' }
    ], labels))
  }
  if (tgtData.value && tgtUtilCanvas.value) {
    charts.push(buildSparkline(tgtUtilCanvas.value, [
      { label: '↑ in',  data: tgtData.value.inBps,  borderColor: '#48BB78' },
      { label: '↓ out', data: tgtData.value.outBps, borderColor: '#4C9BE8' }
    ], labels))
  }
  if (errorsData.value && errCanvas.value) {
    const errDs = []
    if (errorsData.value.src) errDs.push({ label: 'src', data: errorsData.value.src, borderColor: '#FC8181' })
    if (errorsData.value.tgt) errDs.push({ label: 'tgt', data: errorsData.value.tgt, borderColor: '#ED8936' })
    if (errDs.length) charts.push(buildSparkline(errCanvas.value, errDs, labels))
  }
  if (discardsData.value && discCanvas.value) {
    const discDs = []
    if (discardsData.value.src) discDs.push({ label: 'src', data: discardsData.value.src, borderColor: '#ECC94B' })
    if (discardsData.value.tgt) discDs.push({ label: 'tgt', data: discardsData.value.tgt, borderColor: '#F6AD55' })
    if (discDs.length) charts.push(buildSparkline(discCanvas.value, discDs, labels))
  }
})

// Re-fetch when weathermap refreshes (live mode only)
watch(() => wmStore.lastUpdated, () => {
  if (wmStore.selectedTime === null) fetchData()
})

onMounted(() => fetchData())
onUnmounted(() => {
  controller?.abort()
  charts.forEach(c => c.destroy())
  charts.length = 0
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.edge-graphs {
  margin-top: 4px;

  &__divider {
    height: 1px;
    background: var($border-on-surface);
    margin: 6px 0;
  }

  &__shimmer {
    height: 60px;
    border-radius: vars.$border-radius-sm;
    background: linear-gradient(90deg, var($shade-2, rgba(255,255,255,0.06)) 25%, var($shade-3, rgba(255,255,255,0.12)) 50%, var($shade-2, rgba(255,255,255,0.06)) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    margin-bottom: 8px;
  }

  &__unavailable {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    padding: 4px 0;
  }

  &__chart-block {
    margin-bottom: 8px;
  }

  &__chart-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
    margin-bottom: 2px;
  }

  &__canvas {
    display: block;
    width: 100% !important;
    height: 48px !important;
  }

  &__chart-legend {
    display: flex;
    gap: 10px;
    font-size: 0.68rem;
    margin-top: 2px;
  }

  &__legend-in  { color: #48BB78; }
  &__legend-out { color: #4C9BE8; }
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/Topology/TopologyEdgeGraphs.vue
git commit -m "feat(topology): add TopologyEdgeGraphs sparkline component"
```

---

### Task 9: Embed TopologyEdgeGraphs in TopologyEdgeTooltip

**Files:**
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue`

- [ ] **Step 1: Add import and conditional render**

In `TopologyEdgeTooltip.vue` `<script setup>`, add:

```typescript
import TopologyEdgeGraphs from './TopologyEdgeGraphs.vue'
```

In the template, insert `<TopologyEdgeGraphs>` **before the final `</div>`** that closes the outer `v-if="tooltip"` wrapper (line 80 in the current file — the second-to-last line in the template). It must be inside that `v-if` so `tooltip` is guaranteed non-null when the component mounts:

```html
    <!-- Insert here — inside v-if="tooltip", after edge-tooltip__label-data -->
    <TopologyEdgeGraphs
      v-if="tooltip.labelData"
      :labelData="tooltip.labelData"
    />
  </div>  <!-- this is the outer v-if="tooltip" closing div — do NOT insert after this -->
```

- [ ] **Step 2: Build and deploy**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 3: End-to-end verification checklist**

Manual verification steps:
1. **Live mode** — hover an edge with interface data → loading shimmer appears → sparkline charts appear with utilization data
2. **Live mode auto-refresh** — leave tooltip open for one full poll cycle → charts re-fetch and update
3. **No interface data** — hover an edge without LLDP data → "Interface data unavailable" shows in place of charts
4. **Historical scrub** — drag time slider to 2h ago → edge colors update → hover edge → graphs show data for that historical window
5. **Errors/discards** — if test environment has errors or discards, they should appear as separate sections only when non-zero
6. **LIVE badge** — slider at rightmost position shows pulsing green dot + "LIVE"; watermark is hidden
7. **Range toggle** — switching 24h→7d→30d snaps to LIVE each time
8. **Tooltip close** — verify no console errors about destroyed canvas after tooltip closes

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): embed TopologyEdgeGraphs sparklines in edge tooltip"
```

---

### Task 10: Build and push final state

- [ ] **Step 1: Run full test suite**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test
```

Expected: all tests pass.

- [ ] **Step 2: Final build + deploy**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 3: Push feature branch to fork**

```bash
git push fork feat/ui-refactor
```
