# Topology Edge Label Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable per-edge network field labels to the topology graph (local/remote port, IPs, MAC, speed, utilization) with a toolbar popover to toggle each field and a maximally-informative hover tooltip.

**Architecture:** Three new concerns, each in a dedicated owner: (1) `edgeLabelStore` holds 6 boolean visibility flags persisted to localStorage; (2) `weathermapStore._fetchAll` is extended to also fetch IP interfaces and LLDP enlinkd data per node and correlate them into an `edgeLabelData` map keyed by edgeKey; (3) `useTopology.composeEdgeLabel` assembles the final multi-line label string from enabled fields, `applyEdgeLabels` stamps it on Cytoscape edges, and `TopologyToolbar` exposes the toggle popover.

**Tech Stack:** Vue 3 + Pinia + Cytoscape.js + Vitest + happy-dom; existing `enlinkdService.ts`, `measurementsService.ts`, `weathermapStore.ts`, `useTopology.ts`, `TopologyEdgeTooltip.vue`, `TopologyToolbar.vue`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `ui/src/stores/edgeLabelStore.ts` | Create | 6 boolean visibility flags + localStorage persistence |
| `ui/tests/stores/edgeLabelStore.test.ts` | Create | Unit tests for store defaults and persistence |
| `ui/src/services/measurementsService.ts` | Modify | Add `fetchNodeIpInterfaces` helper |
| `ui/tests/services/fetchNodeIpInterfaces.test.ts` | Create | Unit tests for new service function |
| `ui/src/stores/weathermapStore.ts` | Modify | `EdgeLabelData` type, `edgeLabelData` ref, extend `_fetchAll` |
| `ui/tests/stores/weathermapStore.edgeLabelData.test.ts` | Create | Unit tests for `edgeLabelData` population |
| `ui/src/composables/useTopology.ts` | Modify | `composeEdgeLabel`, `applyEdgeLabels`, refactor `applyWeathermapStyles`, watchers, tooltip state |
| `ui/src/components/Topology/TopologyEdgeTooltip.vue` | Modify | `EdgeLabelData` fields section in tooltip |
| `ui/src/components/Topology/TopologyToolbar.vue` | Modify | "Edge Labels ▾" popover with 6 checkboxes |

---

## Context for Implementers

**Existing weathermapStore** (`ui/src/stores/weathermapStore.ts`): Pinia store that polls SNMP measurements. Has `edgeUtilMap` (utilization data per edge) and `nodeDownMap`. The `_fetchAll` private closure fetches SNMP interfaces + node type per node in parallel with `Promise.allSettled`. Currently imports `fetchNodeSnmpIfaces`, `fetchNodeType`, `fetchInterfaceUtilization`, `pickBestInterface` from `measurementsService.ts`.

**Existing enlinkdService** (`ui/src/services/enlinkdService.ts`): Already exports `getNodeEnlinkd(nodeId)`, `cleanName(s)`, and the `LldpLink` type. `LldpLink.lldpLocalPort` contains strings like `"eth0 (ifindex:1)(macAddress:001122334455)"`. `LldpLink.lldpRemInfo` is the remote sysname (matches target vertex label). `LldpLink.ldpRemPort` (note API typo: missing leading 'l') is the remote port string.

**LLDP correlation logic**: For edge `(srcId → tgtId)`, find the LLDP link in `srcId`'s enlinkd data where `cleanName(link.lldpRemInfo).toLowerCase() === targetLabel.toLowerCase()`. Then extract ifindex from `lldpLocalPort` via `/ifindex:(\d+)/i` to look up the SNMP interface by `ifIndex`. If no ifindex embedded, use `cleanName(lldpLocalPort)` directly as the port name.

**`TopologyVertex.id`** (string) equals `String(edge.source.id)` for the matching vertex. To look up a vertex label by numeric node ID: `_activeVertices.find(v => v.id === String(nodeId))?.label`.

**Test runner**: `cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run <test-file-path>`

**Build + deploy**: `cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build && ./deploy-to-container.sh test-opennms`

---

## Task 1: edgeLabelStore — field visibility + localStorage

**Files:**
- Create: `ui/src/stores/edgeLabelStore.ts`
- Create: `ui/tests/stores/edgeLabelStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/stores/edgeLabelStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'

describe('useEdgeLabelStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to showUtilization=true, all others false', () => {
    const store = useEdgeLabelStore()
    expect(store.showUtilization).toBe(true)
    expect(store.showLocalPort).toBe(false)
    expect(store.showRemotePort).toBe(false)
    expect(store.showIp).toBe(false)
    expect(store.showMac).toBe(false)
    expect(store.showSpeed).toBe(false)
  })

  it('persists changes to localStorage', async () => {
    const store = useEdgeLabelStore()
    store.showLocalPort = true
    await nextTick()
    const saved = JSON.parse(localStorage.getItem('opennms-edge-label-config') ?? '{}')
    expect(saved.showLocalPort).toBe(true)
    expect(saved.showUtilization).toBe(true)
  })

  it('restores all fields from localStorage on init', () => {
    localStorage.setItem('opennms-edge-label-config', JSON.stringify({
      showUtilization: false,
      showLocalPort: true,
      showRemotePort: false,
      showIp: true,
      showMac: false,
      showSpeed: true
    }))
    setActivePinia(createPinia())
    const store = useEdgeLabelStore()
    expect(store.showUtilization).toBe(false)
    expect(store.showLocalPort).toBe(true)
    expect(store.showIp).toBe(true)
    expect(store.showSpeed).toBe(true)
    expect(store.showRemotePort).toBe(false)
    expect(store.showMac).toBe(false)
  })

  it('handles corrupt localStorage gracefully (uses defaults)', () => {
    localStorage.setItem('opennms-edge-label-config', 'NOT_JSON')
    setActivePinia(createPinia())
    const store = useEdgeLabelStore()
    expect(store.showUtilization).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/edgeLabelStore.test.ts
```
Expected: FAIL with "Cannot find module '@/stores/edgeLabelStore'"

- [ ] **Step 3: Create `ui/src/stores/edgeLabelStore.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'opennms-edge-label-config'

export const useEdgeLabelStore = defineStore('edgeLabelStore', () => {
  const _load = (): Record<string, boolean> => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  const _saved = _load()

  const showUtilization = ref<boolean>(_saved.showUtilization ?? true)
  const showLocalPort   = ref<boolean>(_saved.showLocalPort   ?? false)
  const showRemotePort  = ref<boolean>(_saved.showRemotePort  ?? false)
  const showIp          = ref<boolean>(_saved.showIp          ?? false)
  const showMac         = ref<boolean>(_saved.showMac         ?? false)
  const showSpeed       = ref<boolean>(_saved.showSpeed       ?? false)

  watch([showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      showUtilization: showUtilization.value,
      showLocalPort:   showLocalPort.value,
      showRemotePort:  showRemotePort.value,
      showIp:          showIp.value,
      showMac:         showMac.value,
      showSpeed:       showSpeed.value
    }))
  })

  return { showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/edgeLabelStore.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/stores/edgeLabelStore.ts tests/stores/edgeLabelStore.test.ts
git commit -m "feat(topology): add edgeLabelStore for edge label field visibility config"
```

---

## Task 2: measurementsService — fetchNodeIpInterfaces

**Files:**
- Modify: `ui/src/services/measurementsService.ts`
- Create: `ui/tests/services/fetchNodeIpInterfaces.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/services/fetchNodeIpInterfaces.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchNodeIpInterfaces } from '@/services/measurementsService'

vi.mock('@/services/axiosInstances', () => ({
  rest: { post: vi.fn() },
  v2: { get: vi.fn() }
}))

import { v2 } from '@/services/axiosInstances'

describe('fetchNodeIpInterfaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns IP interfaces from the API response', async () => {
    vi.mocked(v2.get).mockResolvedValueOnce({
      status: 200,
      data: {
        ipInterface: [
          { id: '1', ipAddress: '10.0.0.1', snmpPrimary: 'P', nodeId: 42 },
          { id: '2', ipAddress: '10.0.0.10', snmpPrimary: 'S', nodeId: 42 }
        ]
      }
    })
    const result = await fetchNodeIpInterfaces(42)
    expect(result).toHaveLength(2)
    expect(result[0].ipAddress).toBe('10.0.0.1')
    expect(result[0].snmpPrimary).toBe('P')
    expect(v2.get).toHaveBeenCalledWith('/nodes/42/ipinterfaces?limit=100')
  })

  it('returns empty array on 204', async () => {
    vi.mocked(v2.get).mockResolvedValueOnce({ status: 204 })
    expect(await fetchNodeIpInterfaces(42)).toEqual([])
  })

  it('returns empty array on network error', async () => {
    vi.mocked(v2.get).mockRejectedValueOnce(new Error('timeout'))
    expect(await fetchNodeIpInterfaces(42)).toEqual([])
  })

  it('returns empty array when ipInterface field is missing', async () => {
    vi.mocked(v2.get).mockResolvedValueOnce({ status: 200, data: {} })
    expect(await fetchNodeIpInterfaces(42)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/services/fetchNodeIpInterfaces.test.ts
```
Expected: FAIL with "fetchNodeIpInterfaces is not a function" (not yet exported)

- [ ] **Step 3: Add `fetchNodeIpInterfaces` to `ui/src/services/measurementsService.ts`**

Add `IpInterface` to the existing import at line 2:

```typescript
import { SnmpInterface, SnmpInterfaceApiResponse, IpInterface } from '@/types'
```

Append this function at the end of the file (after the existing `fetchInterfaceUtilization`):

```typescript
/**
 * Fetch all IP interfaces for a node.
 * Used to find the primary management IP (snmpPrimary === 'P') for edge label display.
 */
export const fetchNodeIpInterfaces = async (nodeId: number): Promise<IpInterface[]> => {
  try {
    const resp = await v2.get(`/nodes/${nodeId}/ipinterfaces?limit=100`)
    if (resp.status === 204) return []
    return resp.data?.ipInterface ?? []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/services/fetchNodeIpInterfaces.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Run all tests to make sure nothing regressed**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/services/measurementsService.test.ts
```
Expected: PASS (all existing tests still pass)

- [ ] **Step 6: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/services/measurementsService.ts tests/services/fetchNodeIpInterfaces.test.ts
git commit -m "feat(topology): add fetchNodeIpInterfaces to measurementsService"
```

---

## Task 3: weathermapStore — EdgeLabelData type + edgeLabelData map + extended _fetchAll

**Files:**
- Modify: `ui/src/stores/weathermapStore.ts`
- Create: `ui/tests/stores/weathermapStore.edgeLabelData.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/stores/weathermapStore.edgeLabelData.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWeathermapStore, edgeKey } from '@/stores/weathermapStore'
import type { TopologyVertex, TopologyEdge } from '@/types/topology'
import * as measurementsService from '@/services/measurementsService'
import * as enlinkdService from '@/services/enlinkdService'

vi.mock('@/services/measurementsService', () => ({
  fetchNodeSnmpIfaces: vi.fn(),
  fetchNodeType: vi.fn(),
  fetchNodeIpInterfaces: vi.fn(),
  fetchInterfaceUtilization: vi.fn(),
  pickBestInterface: vi.fn()
}))

// Provide a real cleanName implementation so LLDP correlation logic is testable.
vi.mock('@/services/enlinkdService', () => ({
  getNodeEnlinkd: vi.fn(),
  cleanName: (s: string) => s.split('(')[0].trim() || s
}))

const EMPTY_ENLINKD = {
  lldpLinkNodes: [], ospfLinkNodes: [], isisLinkNodes: [],
  cdpLinkNodes: [], bridgeLinkNodes: [],
  lldpElementNode: null, ospfElementNode: null, isisElementNode: null
}

const makeSnmpIface = (overrides = {}) => ({
  ifName: 'eth0', ifDescr: 'eth0', ifIndex: 1,
  ifOperStatus: 1, ifType: 6, ifSpeed: 1_000_000_000,
  physAddr: null, collect: true, collectFlag: 'C', collectionUserSpecified: false,
  hasEgressFlows: false, hasFlows: false, hasIngressFlows: false,
  id: 1, ifAdminStatus: 1, ifAlias: null, lastCapsdPoll: 0,
  lastEgressFlow: null, lastIngressFlow: null, lastSnmpPoll: 0, poll: true,
  ...overrides
})

const VERTICES: TopologyVertex[] = [
  { id: '10', label: 'node-a', namespace: 'test' },
  { id: '20', label: 'node-b', namespace: 'test' }
]
const EDGES: TopologyEdge[] = [
  { source: { id: 10, namespace: 'test' }, target: { id: 20, namespace: 'test' } }
]

describe('weathermapStore — edgeLabelData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('exposes edgeLabelData as empty object initially', () => {
    const store = useWeathermapStore()
    expect(store.edgeLabelData).toEqual({})
  })

  it('populates localIp and remoteIp from primary IP interfaces', async () => {
    const iface = makeSnmpIface()
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue(EMPTY_ENLINKD)
    vi.mocked(measurementsService.fetchNodeIpInterfaces)
      .mockResolvedValueOnce([{ ipAddress: '10.0.0.1', snmpPrimary: 'P' } as any])
      .mockResolvedValueOnce([{ ipAddress: '10.0.0.2', snmpPrimary: 'P' } as any])

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    expect(store.edgeLabelData[key].localIp).toBe('10.0.0.1')
    expect(store.edgeLabelData[key].remoteIp).toBe('10.0.0.2')
  })

  it('uses non-primary IP when no primary IP is present', async () => {
    const iface = makeSnmpIface()
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue(EMPTY_ENLINKD)
    // No primary IP for node 10 — snmpPrimary is 'N'
    vi.mocked(measurementsService.fetchNodeIpInterfaces)
      .mockResolvedValueOnce([{ ipAddress: '10.0.0.5', snmpPrimary: 'N' } as any])
      .mockResolvedValueOnce([])

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    // No primary IP, so localIp should be undefined
    expect(store.edgeLabelData[key].localIp).toBeUndefined()
  })

  it('populates localIfName and remotePortId from LLDP correlation', async () => {
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
          lldpLocalPortUrl: '',
          lldpRemChassisId: '',
          lldpRemChassisIdUrl: '',
          lldpRemInfo: 'node-b',
          ldpRemPort: 'GigEth0/1',
          lldpCreateTime: '',
          lldpLastPollTime: ''
        }]
      }
    })

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    expect(store.edgeLabelData[key].localIfName).toBe('eth0')
    expect(store.edgeLabelData[key].remotePortId).toBe('GigEth0/1')
    expect(store.edgeLabelData[key].localMac).toBe('001122334455')
    expect(store.edgeLabelData[key].ifSpeed).toBe(1_000_000_000)
  })

  it('falls back to best interface when no LLDP match for the target node', async () => {
    const iface = makeSnmpIface({ ifIndex: 1, ifName: 'eth0', physAddr: 'aabbccddeeff' })
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchNodeIpInterfaces).mockResolvedValue([])
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue({
      ...EMPTY_ENLINKD,
      lldpLinkNodes: [{
        lldpLocalPort: 'eth0 (ifindex:1)',
        lldpLocalPortUrl: '',
        lldpRemChassisId: '',
        lldpRemChassisIdUrl: '',
        lldpRemInfo: 'some-other-node',  // doesn't match 'node-b'
        ldpRemPort: 'remote-port',
        lldpCreateTime: '',
        lldpLastPollTime: ''
      }]
    })

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    // No LLDP match, so falls back to best SNMP interface
    expect(store.edgeLabelData[key].localIfName).toBe('eth0')
    expect(store.edgeLabelData[key].localMac).toBe('aabbccddeeff')
    // remotePortId is undefined (no LLDP match)
    expect(store.edgeLabelData[key].remotePortId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/weathermapStore.edgeLabelData.test.ts
```
Expected: FAIL — `edgeLabelData` is not on the store yet.

- [ ] **Step 3: Update `ui/src/stores/weathermapStore.ts`**

**3a.** Add new imports at the top (alongside existing imports):

```typescript
import { fetchNodeSnmpIfaces, fetchNodeType, fetchInterfaceUtilization, pickBestInterface, fetchNodeIpInterfaces, InterfaceUtil } from '@/services/measurementsService'
import { getNodeEnlinkd, cleanName, NodeEnlinkdData } from '@/services/enlinkdService'
import { SnmpInterface } from '@/types'
```

(Replace the existing `import` from `measurementsService` with this expanded version.)

**3b.** Add the `EdgeLabelData` interface export after `EdgeUtil` (around line 15):

```typescript
export interface EdgeLabelData {
  localIfName?: string    // ifName/ifDescr of local connecting interface
  remotePortId?: string   // remote port from LLDP (ldpRemPort after cleanName)
  localIp?: string        // primary IP of source node (snmpPrimary === 'P')
  remoteIp?: string       // primary IP of target node
  localMac?: string       // physAddr of local interface
  ifSpeed?: number        // link speed in bits/sec
}
```

**3c.** Inside the store factory, add `edgeLabelData` alongside `edgeUtilMap` (around line 32):

```typescript
const edgeLabelData = ref<Record<string, EdgeLabelData>>({})
```

**3d.** Replace the entire `_fetchAll` function body with the following (same file, starting at line 49). This expands the node fetch to include IP interfaces and enlinkd data, and adds the `edgeLabelData` build:

```typescript
const _fetchAll = async () => {
  const edges = _activeEdges   // snapshot to prevent mid-flight mutation on rapid start() calls
  if (edges.length === 0) return

  // Collect unique node IDs from all edges
  const nodeIds = new Set<number>()
  for (const e of edges) {
    nodeIds.add(e.source.id)
    nodeIds.add(e.target.id)
  }

  // Fetch SNMP interfaces, node type, IP interfaces, and LLDP enlinkd data for each node
  const nodeResults = await Promise.allSettled(
    Array.from(nodeIds).map(async (nodeId) => {
      const [ifaces, type, ipIfaces, enlinkd] = await Promise.all([
        fetchNodeSnmpIfaces(nodeId),
        fetchNodeType(nodeId),
        fetchNodeIpInterfaces(nodeId),
        getNodeEnlinkd(nodeId)
      ])
      return { nodeId, ifaces, type, ipIfaces, enlinkd }
    })
  )

  const nodeSnmpMap: Record<number, ReturnType<typeof pickBestInterface>> = {}
  const nodeAllIfacesMap: Record<number, SnmpInterface[]> = {}
  const nodeIpMap: Record<number, string | undefined> = {}
  const nodeEnlinkdMap: Record<number, NodeEnlinkdData | null> = {}
  const downMap: Record<number, boolean> = {}

  for (const result of nodeResults) {
    if (result.status !== 'fulfilled') continue
    const { nodeId, ifaces, type, ipIfaces, enlinkd } = result.value
    nodeSnmpMap[nodeId] = pickBestInterface(ifaces)
    nodeAllIfacesMap[nodeId] = ifaces
    downMap[nodeId] = type !== null && type !== 'A'
    const primary = ipIfaces.find(ip => ip.snmpPrimary === 'P')
    nodeIpMap[nodeId] = primary?.ipAddress
    nodeEnlinkdMap[nodeId] = enlinkd
  }

  // Fetch utilization for each edge in parallel (unchanged logic)
  const edgeResults = await Promise.allSettled(
    edges.map(async (e) => {
      const key = edgeKey(e.source.id, e.target.id)
      const srcIface = nodeSnmpMap[e.source.id]
      const tgtIface = nodeSnmpMap[e.target.id]

      // Use the source endpoint's interface (prefer src; fall back to tgt)
      const iface = srcIface ?? tgtIface
      if (!iface) return { key, util: null }

      const nodeId = srcIface ? e.source.id : e.target.id
      const util: InterfaceUtil | null = await fetchInterfaceUtilization(nodeId, iface)
      return { key, util }
    })
  )

  const utilMap: Record<string, EdgeUtil> = {}
  for (const result of edgeResults) {
    if (result.status !== 'fulfilled') continue
    const { key, util } = result.value
    if (!util) continue
    utilMap[key] = {
      inBps:   util.inBps,
      outBps:  util.outBps,
      ifSpeed: util.ifSpeed,
      utilPct: computeUtilPct(util.inBps, util.outBps, util.ifSpeed)
    }
  }

  // Build edgeLabelData — IP + LLDP port correlation per edge
  const labelMap: Record<string, EdgeLabelData> = {}
  for (const e of edges) {
    const key = edgeKey(e.source.id, e.target.id)
    const srcId = e.source.id
    const tgtId = e.target.id
    const data: EdgeLabelData = {}

    // Primary IPs from IP interface list
    data.localIp  = nodeIpMap[srcId]
    data.remoteIp = nodeIpMap[tgtId]

    // LLDP correlation: find the link on srcId that connects to the target node
    const enlinkd = nodeEnlinkdMap[srcId]
    const targetLabel = _activeVertices.find(v => v.id === String(tgtId))?.label
    if (enlinkd && targetLabel) {
      const lldpLink = enlinkd.lldpLinkNodes.find(l =>
        cleanName(l.lldpRemInfo).toLowerCase() === targetLabel.toLowerCase()
      )
      if (lldpLink) {
        // Extract ifindex from the local port string to find the exact SNMP interface
        const ifIndexMatch = lldpLink.lldpLocalPort.match(/ifindex:(\d+)/i)
        if (ifIndexMatch) {
          const ifIdx = Number(ifIndexMatch[1])
          const localIface = nodeAllIfacesMap[srcId]?.find(i => i.ifIndex === ifIdx)
          if (localIface) {
            data.localIfName = localIface.ifName ?? localIface.ifDescr ?? undefined
            data.localMac    = localIface.physAddr ?? undefined
            data.ifSpeed     = localIface.ifSpeed > 0 ? localIface.ifSpeed : undefined
          }
        } else {
          // No ifindex embedded in port string — use cleaned name directly
          const cleaned = cleanName(lldpLink.lldpLocalPort)
          data.localIfName = cleaned || undefined
        }
        const remotePort = cleanName(lldpLink.ldpRemPort)
        data.remotePortId = remotePort || undefined
      }
    }

    // Fallback: if LLDP gave us no interface info, use the best SNMP interface for speed/MAC
    if (!data.localIfName) {
      const best = nodeSnmpMap[srcId]
      if (best) {
        data.localIfName = best.ifName ?? best.ifDescr ?? undefined
        data.localMac    = best.physAddr ?? undefined
        data.ifSpeed     = best.ifSpeed > 0 ? best.ifSpeed : undefined
      }
    }

    labelMap[key] = data
  }

  edgeUtilMap.value  = utilMap
  nodeDownMap.value  = downMap
  edgeLabelData.value = labelMap
  lastUpdated.value  = new Date()
}
```

**3e.** Add `edgeLabelData` to the return statement (around line 149):

```typescript
return {
  edgeUtilMap, nodeDownMap, edgeLabelData, loading, error, pollInterval, lastUpdated,
  start, stop, refresh, setPollInterval
}
```

- [ ] **Step 4: Run new tests to verify they pass**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/weathermapStore.edgeLabelData.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Run existing weathermapStore tests to verify no regression**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/weathermapStore.test.ts
```
Expected: PASS (all existing pure-function tests still pass)

- [ ] **Step 6: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/stores/weathermapStore.ts tests/stores/weathermapStore.edgeLabelData.test.ts
git commit -m "feat(topology): add EdgeLabelData type and edgeLabelData to weathermapStore"
```

---

## Task 4: useTopology — composeEdgeLabel, applyEdgeLabels, watchers, tooltip state

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

No unit tests for this task — Cytoscape requires a real DOM mount. Visual verification in the browser after Task 7.

- [ ] **Step 1: Update imports at the top of `ui/src/composables/useTopology.ts`**

Replace the existing weathermapStore import line (~line 29):
```typescript
import { useWeathermapStore } from '@/stores/weathermapStore'
```
with:
```typescript
import { useWeathermapStore, EdgeLabelData } from '@/stores/weathermapStore'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
```

- [ ] **Step 2: Add `elStore` inside the `useTopology` composable**

After the line `const wmStore = useWeathermapStore()` (~line 161), add:
```typescript
const elStore = useEdgeLabelStore()
```

- [ ] **Step 3: Update the local `EdgeTooltipState` interface (~line 164)**

Replace:
```typescript
interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  util?: { utilPct: number; inBps: number; outBps: number } | null
}
```
with:
```typescript
interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  util?: { utilPct: number; inBps: number; outBps: number } | null
  labelData?: EdgeLabelData | null
}
```

- [ ] **Step 4: Update the mouseover handler to populate `labelData`**

In the `cy.on('mouseover', 'edge', ...)` handler (~line 324), replace:
```typescript
edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel, util }
```
with:
```typescript
const labelData = wmStore.edgeLabelData[edgeKey] ?? null
edgeTooltip.value = { x: pos.x, y: pos.y, protocols, srcLabel, tgtLabel, util, labelData }
```

- [ ] **Step 5: Refactor `applyWeathermapStyles` to remove label/class logic (~line 446)**

Replace the entire `applyWeathermapStyles` function with:
```typescript
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

- [ ] **Step 6: Add `composeEdgeLabel` and `applyEdgeLabels` after `applyWeathermapStyles`**

Insert the following two functions immediately after `applyWeathermapStyles` (before `applyNodeDownStyles`):

```typescript
/**
 * Build the multi-line label string for a single edge from enabled fields.
 * Returns empty string if no fields are enabled or no data available.
 */
const composeEdgeLabel = (key: string): string => {
  const parts: string[] = []

  // Utilization line (from weathermap data)
  const util = wmStore.edgeUtilMap[key]
  if (elStore.showUtilization && util) {
    parts.push(`${Math.round(util.utilPct)}% · ↑${formatBitsPerSec(util.inBps)} ↓${formatBitsPerSec(util.outBps)}`)
  }

  // Port / IP / MAC / speed lines (from edgeLabelData)
  const d = wmStore.edgeLabelData[key]
  if (d) {
    // Port: combine local and remote if both enabled, otherwise show whichever is enabled
    if (elStore.showLocalPort || elStore.showRemotePort) {
      const local  = elStore.showLocalPort  ? d.localIfName  : undefined
      const remote = elStore.showRemotePort ? d.remotePortId : undefined
      if (local && remote) parts.push(`${local} ↔ ${remote}`)
      else if (local)  parts.push(local)
      else if (remote) parts.push(remote)
    }

    if (elStore.showIp && (d.localIp || d.remoteIp)) {
      if (d.localIp && d.remoteIp) parts.push(`${d.localIp} ↔ ${d.remoteIp}`)
      else parts.push(d.localIp ?? d.remoteIp ?? '')
    }

    if (elStore.showMac && d.localMac) parts.push(d.localMac)

    if (elStore.showSpeed && d.ifSpeed) parts.push(`${formatBitsPerSec(d.ifSpeed)}bps`)
  }

  return parts.join('\n')
}

/**
 * Stamp the composed label onto every edge in a single cy.batch().
 * Adds the 'weathermap' CSS class (which enables the label stylesheet rule) when
 * a label is present; removes it when empty so no blank label pill is shown.
 */
const applyEdgeLabels = () => {
  if (!cy) return
  cy.batch(() => {
    cy!.edges().forEach(edge => {
      const key = edge.data('edgeKey') as string
      const label = composeEdgeLabel(key)
      if (label) {
        edge.data('wmLabel', label)
        edge.addClass('weathermap')
      } else {
        edge.data('wmLabel', '')
        edge.removeClass('weathermap')
      }
    })
  })
}
```

- [ ] **Step 7: Add `applyEdgeLabels()` call in `syncElements` (~line 430)**

After `applyWeathermapStyles()` and before `runLayout()`, add:
```typescript
applyEdgeLabels()
```

So the sequence becomes:
```typescript
applySeverityClasses()
applyWeathermapStyles()
applyNodeDownStyles()
applyEdgeLabels()
runLayout()
```

- [ ] **Step 8: Update the watchers (~line 489)**

Replace:
```typescript
watch(() => wmStore.edgeUtilMap, applyWeathermapStyles)
watch(() => wmStore.nodeDownMap, applyNodeDownStyles)
```
with:
```typescript
watch(() => wmStore.edgeUtilMap, () => { applyWeathermapStyles(); applyEdgeLabels() })
watch(() => wmStore.edgeLabelData, applyEdgeLabels)
watch(() => wmStore.nodeDownMap, applyNodeDownStyles)
watch(() => [
  elStore.showUtilization,
  elStore.showLocalPort,
  elStore.showRemotePort,
  elStore.showIp,
  elStore.showMac,
  elStore.showSpeed,
], applyEdgeLabels)
```

- [ ] **Step 9: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/composables/useTopology.ts
git commit -m "feat(topology): add composeEdgeLabel and applyEdgeLabels to useTopology"
```

---

## Task 5: TopologyEdgeTooltip — EdgeLabelData fields section

**Files:**
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue`

- [ ] **Step 1: Update the `<script setup>` section**

Replace the entire `<script setup>` block:

```typescript
<script setup lang="ts">
import { EdgeLabelData } from '@/stores/weathermapStore'
import { getProtocolColor, utilizationColor, formatBitsPerSec } from './protocolColors'

export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
  util?: { utilPct: number; inBps: number; outBps: number } | null
  labelData?: EdgeLabelData | null
}

defineProps<{ tooltip: EdgeTooltipState | null }>()
</script>
```

- [ ] **Step 2: Add the label-data section to the template**

After the closing `</div>` of the `v-if="tooltip.util"` block (~line 51), insert:

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
      <div v-if="tooltip.labelData.ifSpeed" class="edge-tooltip__field">
        <span class="edge-tooltip__field-name">Speed</span>
        <span>{{ formatBitsPerSec(tooltip.labelData.ifSpeed) }}bps</span>
      </div>
    </div>
```

- [ ] **Step 3: Add SCSS for the new elements**

Inside `.edge-tooltip { ... }` in the `<style>` block, add after the existing `&__util-rates` rule:

```scss
  &__label-data {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var($border-on-surface);
  }

  &__field {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.72rem;
    padding: 1px 0;
    color: var($secondary-text-on-surface);

    &-name {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var($primary-text-on-surface);
      min-width: 40px;
      flex-shrink: 0;
    }
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/components/Topology/TopologyEdgeTooltip.vue
git commit -m "feat(topology): add EdgeLabelData fields section to edge hover tooltip"
```

---

## Task 6: TopologyToolbar — Edge Labels popover

**Files:**
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`

- [ ] **Step 1: Add imports and reactive state to the `<script setup>` section**

After the existing imports, add:
```typescript
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
import { onClickOutside } from '@vueuse/core'
```

After `const wmStore = useWeathermapStore()`, add:
```typescript
const elStore = useEdgeLabelStore()
const edgeLabelPanelOpen = ref(false)
const edgeLabelPanelRef = ref<HTMLElement | null>(null)
onClickOutside(edgeLabelPanelRef, () => { edgeLabelPanelOpen.value = false })
```

- [ ] **Step 2: Add the "Edge Labels ▾" section to the template**

After the closing `</div>` of `topology-toolbar__weathermap` (~line 71), insert:

```html
    <div class="topology-toolbar__edge-labels" ref="edgeLabelPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: edgeLabelPanelOpen }"
        @click="edgeLabelPanelOpen = !edgeLabelPanelOpen"
      >Edge Labels ▾</button>
      <div v-if="edgeLabelPanelOpen" class="topology-toolbar__edge-label-panel">
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showUtilization"> Utilization
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showLocalPort"> Local Port
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showRemotePort"> Remote Port
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showIp"> IP Addresses
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showMac"> MAC Address
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showSpeed"> Speed
        </label>
      </div>
    </div>
```

- [ ] **Step 3: Add SCSS for the popover**

Inside `.topology-toolbar { ... }` in the `<style>` block, after the `&__wm-status` rule (~line 232), add:

```scss
  &__edge-labels {
    position: relative;
    padding-top: 8px;
  }

  &__edge-label-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: 6px;
    padding: 8px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 150px;
  }

  &__edge-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    padding: 3px 0;
    cursor: pointer;
    white-space: nowrap;

    input[type='checkbox'] {
      cursor: pointer;
    }
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/components/Topology/TopologyToolbar.vue
git commit -m "feat(topology): add Edge Labels popover to topology toolbar"
```

---

## Task 7: Run all tests, build, deploy, verify

- [ ] **Step 1: Run full test suite**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test
```
Expected: All tests PASS (the new tests added in Tasks 1–3 pass; no regressions in existing tests).

- [ ] **Step 2: Build the UI**

```
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```
Expected: Build completes with no TypeScript errors. Check that `src/main/dist/index.html` has `src="/opennms/ui/assets/index-*.js"` paths.

- [ ] **Step 3: Verify no bare CSS variable references**

```bash
grep -c 'var(--feather' /Users/chance/git/opennms/ui/src/main/dist/assets/index-*.css || echo "0 bare vars found"
```
Expected: 0 (lightningcss wraps all `--feather-*` vars in `var()`).

- [ ] **Step 4: Deploy to test container**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```
Expected: Deploy completes successfully.

- [ ] **Step 5: Verify live bundle hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```
Expected: Both commands print the same hash.

- [ ] **Step 6: Verify the asset serves with HTTP 200**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```
Expected: 200

- [ ] **Step 7: Browser smoke test**

Navigate to the Topology page. Verify:
1. "Edge Labels ▾" button appears in the toolbar
2. Clicking it opens a panel with 6 checkboxes (Utilization checked by default)
3. Toggling checkboxes changes edge labels in real-time (no page reload needed)
4. Preferences survive a page refresh (localStorage persistence)
5. Hovering an edge shows the tooltip — if LLDP data is available, the Port/IP/MAC/Speed section appears below the utilization row
6. Disabling "Utilization" in the popover hides the `47% · ↑230M ↓180M` label text but edge color + width remain

- [ ] **Step 8: Squash iterative commits and final commit**

```bash
cd /Users/chance/git/opennms/ui
# Verify git log shows clean logical commits from Tasks 1-6
git log --oneline -8
```
