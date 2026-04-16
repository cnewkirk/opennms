# Topology Weathermap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the topology graph with live interface utilization: color edges green→red by utilization %, scale width by throughput, show inline labels (% + raw values), and mark down nodes with red fill + DOWN label.

**Architecture:** A new `weathermapStore` polls `/rest/measurements` for SNMP interface utilization on all edge endpoints and tracks node up/down state from `node.type`. `useTopology.ts` watches the store and re-styles Cytoscape elements via `cy.batch()`. Controls (refresh button, interval picker, status) live in `TopologyToolbar.vue`.

**Tech Stack:** Vue 3 + Pinia, Cytoscape.js, OpenNMS REST `/rest/measurements` (POST), `/api/v2/nodes/{id}/snmpinterfaces`, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `ui/src/components/Topology/protocolColors.ts` | Modify | Add `utilizationColor`, `throughputWidth`, `formatBitsPerSec` |
| `ui/src/services/measurementsService.ts` | Create | Fetch SNMP interfaces + query measurements API |
| `ui/src/stores/weathermapStore.ts` | Create | Polling timer, edgeUtilMap, nodeDownMap |
| `ui/src/composables/useTopology.ts` | Modify | Watch weathermapStore, apply Cytoscape styles |
| `ui/src/components/Topology/TopologyToolbar.vue` | Modify | Refresh button, interval selector, status indicator |
| `ui/src/containers/Topology.vue` | Modify | Start/stop weathermapStore lifecycle |
| `ui/tests/components/Topology/protocolColors.test.ts` | Modify | Tests for new helper functions |
| `ui/tests/services/measurementsService.test.ts` | Create | Tests for pure utility functions |

---

## Task 1: Add color/width/format helpers to protocolColors.ts

**Files:**
- Modify: `ui/src/components/Topology/protocolColors.ts`
- Modify: `ui/tests/components/Topology/protocolColors.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `ui/tests/components/Topology/protocolColors.test.ts` (append after existing tests):

```typescript
import { utilizationColor, throughputWidth, formatBitsPerSec } from '@/components/Topology/protocolColors'

describe('utilizationColor', () => {
  it('returns green for low utilization (0-50%)', () => {
    expect(utilizationColor(0)).toBe('#48BB78')
    expect(utilizationColor(25)).toBe('#48BB78')
    expect(utilizationColor(49.9)).toBe('#48BB78')
  })
  it('returns yellow for medium utilization (50-75%)', () => {
    expect(utilizationColor(50)).toBe('#ECC94B')
    expect(utilizationColor(60)).toBe('#ECC94B')
    expect(utilizationColor(74.9)).toBe('#ECC94B')
  })
  it('returns orange for high utilization (75-90%)', () => {
    expect(utilizationColor(75)).toBe('#ED8936')
    expect(utilizationColor(80)).toBe('#ED8936')
    expect(utilizationColor(89.9)).toBe('#ED8936')
  })
  it('returns red for critical utilization (90-100%)', () => {
    expect(utilizationColor(90)).toBe('#FC8181')
    expect(utilizationColor(100)).toBe('#FC8181')
  })
})

describe('throughputWidth', () => {
  it('returns 2 for sub-1Mbps', () => {
    expect(throughputWidth(0)).toBe(2)
    expect(throughputWidth(500_000)).toBe(2)
    expect(throughputWidth(999_999)).toBe(2)
  })
  it('returns 3 for 1-10 Mbps', () => {
    expect(throughputWidth(1_000_000)).toBe(3)
    expect(throughputWidth(5_000_000)).toBe(3)
    expect(throughputWidth(9_999_999)).toBe(3)
  })
  it('returns 4 for 10-100 Mbps', () => {
    expect(throughputWidth(10_000_000)).toBe(4)
    expect(throughputWidth(50_000_000)).toBe(4)
  })
  it('returns 6 for 100 Mbps-1 Gbps', () => {
    expect(throughputWidth(100_000_000)).toBe(6)
    expect(throughputWidth(500_000_000)).toBe(6)
  })
  it('returns 8 for over 1 Gbps', () => {
    expect(throughputWidth(1_000_000_000)).toBe(8)
    expect(throughputWidth(10_000_000_000)).toBe(8)
  })
})

describe('formatBitsPerSec', () => {
  it('formats values under 1000 as whole number', () => {
    expect(formatBitsPerSec(500)).toBe('500')
  })
  it('formats kilobits with K suffix', () => {
    expect(formatBitsPerSec(1_500)).toBe('1.5K')
    expect(formatBitsPerSec(10_000)).toBe('10K')
  })
  it('formats megabits with M suffix', () => {
    expect(formatBitsPerSec(1_500_000)).toBe('1.5M')
    expect(formatBitsPerSec(230_000_000)).toBe('230M')
  })
  it('formats gigabits with G suffix', () => {
    expect(formatBitsPerSec(1_500_000_000)).toBe('1.5G')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/protocolColors.test.ts 2>&1 | tail -20
```

Expected: FAIL with `utilizationColor is not a function` (or similar import error)

- [ ] **Step 3: Add the helper functions to protocolColors.ts**

Append after the existing `parallelOffsets` function:

```typescript
/**
 * Maps a utilization percentage (0-100) to a traffic-light color.
 */
export const utilizationColor = (pct: number): string => {
  if (pct < 50) return '#48BB78'   // green
  if (pct < 75) return '#ECC94B'   // yellow
  if (pct < 90) return '#ED8936'   // orange
  return '#FC8181'                  // red
}

/**
 * Maps total throughput in bits/sec to a Cytoscape edge width in pixels.
 */
export const throughputWidth = (bitsPerSec: number): number => {
  if (bitsPerSec < 1_000_000)       return 2   // < 1 Mbps
  if (bitsPerSec < 10_000_000)      return 3   // 1–10 Mbps
  if (bitsPerSec < 100_000_000)     return 4   // 10–100 Mbps
  if (bitsPerSec < 1_000_000_000)   return 6   // 100 Mbps–1 Gbps
  return 8                                      // > 1 Gbps
}

/**
 * Formats a bits-per-second value as a short string: "230M", "1.5G", "45K", "500"
 */
export const formatBitsPerSec = (bps: number): string => {
  if (bps >= 1_000_000_000) return `${+(bps / 1_000_000_000).toPrecision(3)}G`
  if (bps >= 1_000_000)     return `${+(bps / 1_000_000).toPrecision(3)}M`
  if (bps >= 1_000)         return `${+(bps / 1_000).toPrecision(3)}K`
  return `${Math.round(bps)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/components/Topology/protocolColors.test.ts 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/components/Topology/protocolColors.ts tests/components/Topology/protocolColors.test.ts && git commit -m "feat(weathermap): add utilizationColor/throughputWidth/formatBitsPerSec helpers"
```

---

## Task 2: Create measurementsService.ts

**Files:**
- Create: `ui/src/services/measurementsService.ts`
- Create: `ui/tests/services/measurementsService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/services/measurementsService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSnmpResourceId, pickBestInterface } from '@/services/measurementsService'
import { SnmpInterface } from '@/types'

const makeIface = (overrides: Partial<SnmpInterface>): SnmpInterface => ({
  collect: true, collectFlag: 'C', collectionUserSpecified: false,
  hasEgressFlows: false, hasFlows: false, hasIngressFlows: false,
  id: 1, ifAdminStatus: 1, ifAlias: null, ifDescr: 'eth0', ifIndex: 1,
  ifName: 'eth0', ifOperStatus: 1, ifSpeed: 1_000_000_000,
  ifType: 6, lastCapsdPoll: 0, lastEgressFlow: null,
  lastIngressFlow: null, lastSnmpPoll: 0, physAddr: null, poll: true,
  ...overrides
})

describe('buildSnmpResourceId', () => {
  it('uses ifName-physAddr when physAddr is present', () => {
    const iface = makeIface({ ifName: 'eth0', physAddr: 'aabbccddeeff' })
    expect(buildSnmpResourceId(42, iface)).toBe('node[42].interfaceSnmp[eth0-aabbccddeeff]')
  })
  it('uses just ifName when physAddr is null', () => {
    const iface = makeIface({ ifName: 'eth0', physAddr: null })
    expect(buildSnmpResourceId(42, iface)).toBe('node[42].interfaceSnmp[eth0]')
  })
  it('falls back to ifDescr when ifName is null', () => {
    const iface = makeIface({ ifName: null, ifDescr: 'GigabitEthernet0', physAddr: null })
    expect(buildSnmpResourceId(42, iface)).toBe('node[42].interfaceSnmp[GigabitEthernet0]')
  })
})

describe('pickBestInterface', () => {
  it('returns null for empty list', () => {
    expect(pickBestInterface([])).toBeNull()
  })
  it('skips loopback interfaces (ifType 24)', () => {
    const loopback = makeIface({ ifType: 24, ifSpeed: 10_000_000_000 })
    const eth = makeIface({ ifType: 6, ifSpeed: 1_000_000_000 })
    expect(pickBestInterface([loopback, eth])).toBe(eth)
  })
  it('skips operationally down interfaces (ifOperStatus != 1)', () => {
    const down = makeIface({ ifOperStatus: 2, ifSpeed: 10_000_000_000 })
    const up = makeIface({ ifOperStatus: 1, ifSpeed: 1_000_000 })
    expect(pickBestInterface([down, up])).toBe(up)
  })
  it('returns the highest-speed interface', () => {
    const slow = makeIface({ ifSpeed: 100_000_000 })
    const fast = makeIface({ ifSpeed: 10_000_000_000 })
    expect(pickBestInterface([slow, fast])).toBe(fast)
  })
  it('returns null if all interfaces are loopback or down', () => {
    const loopback = makeIface({ ifType: 24 })
    const down = makeIface({ ifOperStatus: 2 })
    expect(pickBestInterface([loopback, down])).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/services/measurementsService.test.ts 2>&1 | tail -20
```

Expected: FAIL with module not found

- [ ] **Step 3: Create measurementsService.ts**

Create `ui/src/services/measurementsService.ts`:

```typescript
import { rest, v2 } from './axiosInstances'
import { SnmpInterface, SnmpInterfaceApiResponse } from '@/types'

export interface InterfaceUtil {
  inBps: number   // bits/sec inbound
  outBps: number  // bits/sec outbound
  ifSpeed: number // link capacity in bits/sec
}

/**
 * Build the OpenNMS measurements resource ID for an SNMP interface.
 * Format: node[<nodeId>].interfaceSnmp[<ifName>-<physAddr>] or node[<nodeId>].interfaceSnmp[<ifName>]
 */
export const buildSnmpResourceId = (nodeId: number, iface: SnmpInterface): string => {
  const name = iface.ifName ?? iface.ifDescr ?? String(iface.ifIndex)
  const suffix = iface.physAddr ? `${name}-${iface.physAddr}` : name
  return `node[${nodeId}].interfaceSnmp[${suffix}]`
}

/**
 * Pick the best interface for weathermap display: highest-speed, operationally up, non-loopback.
 * ifType 24 = softwareLoopback
 */
export const pickBestInterface = (ifaces: SnmpInterface[]): SnmpInterface | null => {
  const candidates = ifaces.filter(i => i.ifOperStatus === 1 && i.ifType !== 24)
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) => cur.ifSpeed > best.ifSpeed ? cur : best)
}

/**
 * Fetch all SNMP interfaces for a node.
 */
export const fetchNodeSnmpIfaces = async (nodeId: number): Promise<SnmpInterface[]> => {
  try {
    const resp = await v2.get(`/nodes/${nodeId}/snmpinterfaces?limit=100`)
    if (resp.status === 204) return []
    const data: SnmpInterfaceApiResponse = resp.data
    return data.snmpInterface ?? []
  } catch {
    return []
  }
}

/**
 * Fetch node type ('A' = active/up, else down).
 */
export const fetchNodeType = async (nodeId: number): Promise<string | null> => {
  try {
    const resp = await v2.get(`/nodes/${nodeId}`)
    return resp.data?.type ?? null
  } catch {
    return null
  }
}

/**
 * Query the measurements API for inbound and outbound octet rates on a specific interface.
 * Returns bits/sec for both directions, or null on failure.
 *
 * OpenNMS RRD stores COUNTER-type attributes as rates (bytes/sec after derivation).
 * We multiply by 8 to convert bytes/sec → bits/sec.
 */
export const fetchInterfaceUtilization = async (
  nodeId: number,
  iface: SnmpInterface
): Promise<InterfaceUtil | null> => {
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const now = Date.now()
  const payload = {
    start: now - 300_000,  // 5 minutes ago
    end: now,
    step: 300_000,
    source: [
      { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
      { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
    ]
  }

  try {
    const resp = await rest.post('/measurements', payload)
    const labels: string[] = resp.data.labels ?? []
    const columns: { values: number[] }[] = resp.data.columns ?? []

    const inIdx  = labels.indexOf('inOctets')
    const outIdx = labels.indexOf('outOctets')
    if (inIdx < 0 || outIdx < 0) return null

    const inValues  = columns[inIdx]?.values  ?? []
    const outValues = columns[outIdx]?.values ?? []

    // Take the last non-NaN value from each series
    const lastValid = (vals: number[]) => {
      for (let i = vals.length - 1; i >= 0; i--) {
        if (!isNaN(vals[i]) && vals[i] >= 0) return vals[i]
      }
      return 0
    }

    const inBytesPerSec  = lastValid(inValues)
    const outBytesPerSec = lastValid(outValues)

    return {
      inBps:   inBytesPerSec  * 8,
      outBps:  outBytesPerSec * 8,
      ifSpeed: iface.ifSpeed
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/services/measurementsService.test.ts 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/services/measurementsService.ts tests/services/measurementsService.test.ts && git commit -m "feat(weathermap): add measurementsService for interface utilization queries"
```

---

## Task 3: Create weathermapStore.ts

**Files:**
- Create: `ui/src/stores/weathermapStore.ts`
- Create: `ui/tests/stores/weathermapStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/stores/weathermapStore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeUtilPct, edgeKey } from '@/stores/weathermapStore'

describe('computeUtilPct', () => {
  it('returns 0 when ifSpeed is 0', () => {
    expect(computeUtilPct(1_000_000, 1_000_000, 0)).toBe(0)
  })
  it('computes combined in+out utilization as fraction of duplex capacity', () => {
    // 500 Mbps in + 500 Mbps out on a 1 Gbps link = 50% utilization
    expect(computeUtilPct(500_000_000, 500_000_000, 1_000_000_000)).toBeCloseTo(50, 1)
  })
  it('caps at 100%', () => {
    expect(computeUtilPct(800_000_000, 800_000_000, 1_000_000_000)).toBe(100)
  })
  it('rounds to one decimal', () => {
    // 123.456 Mbps in + 234.567 Mbps out on 1 Gbps = 35.8%
    expect(computeUtilPct(123_456_000, 234_567_000, 1_000_000_000)).toBeCloseTo(35.8, 0)
  })
})

describe('edgeKey', () => {
  it('produces a stable key regardless of source/target order', () => {
    expect(edgeKey(10, 20)).toBe(edgeKey(20, 10))
  })
  it('formats as min-max', () => {
    expect(edgeKey(10, 20)).toBe('10-20')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/weathermapStore.test.ts 2>&1 | tail -20
```

Expected: FAIL with module not found

- [ ] **Step 3: Create weathermapStore.ts**

Create `ui/src/stores/weathermapStore.ts`:

```typescript
import { defineStore } from 'pinia'
import { TopologyVertex, TopologyEdge } from '@/types/topology'
import {
  fetchNodeSnmpIfaces, fetchNodeType,
  fetchInterfaceUtilization, pickBestInterface,
  InterfaceUtil
} from '@/services/measurementsService'

export interface EdgeUtil {
  inBps: number
  outBps: number
  utilPct: number
  ifSpeed: number
}

/** Stable canonical key for an edge between two nodes. */
export const edgeKey = (srcId: number, tgtId: number): string =>
  `${Math.min(srcId, tgtId)}-${Math.max(srcId, tgtId)}`

/**
 * Compute utilization % for a full-duplex link.
 * utilPct = (inBps + outBps) / (2 * ifSpeed) * 100, capped at 100.
 */
export const computeUtilPct = (inBps: number, outBps: number, ifSpeed: number): number => {
  if (ifSpeed <= 0) return 0
  const raw = ((inBps + outBps) / (2 * ifSpeed)) * 100
  return Math.min(100, Math.round(raw * 10) / 10)
}

export const useWeathermapStore = defineStore('weathermapStore', () => {
  const edgeUtilMap  = ref<Record<string, EdgeUtil>>({})
  const nodeDownMap  = ref<Record<number, boolean>>({})
  const loading      = ref(false)
  const error        = ref<string | null>(null)
  const pollInterval = ref(60)   // seconds; 0 = disabled
  const lastUpdated  = ref<Date | null>(null)

  let _timer: ReturnType<typeof setTimeout> | null = null
  let _activeVertices: TopologyVertex[] = []
  let _activeEdges: TopologyEdge[] = []

  const _scheduleNext = () => {
    if (_timer) clearTimeout(_timer)
    if (pollInterval.value <= 0) return
    _timer = setTimeout(() => refresh(), pollInterval.value * 1000)
  }

  const _fetchAll = async () => {
    if (_activeEdges.length === 0) return

    // Collect unique node IDs from all edges
    const nodeIds = new Set<number>()
    for (const e of _activeEdges) {
      nodeIds.add(e.source.id)
      nodeIds.add(e.target.id)
    }

    // Fetch SNMP interfaces and node type for each node in parallel
    const nodeResults = await Promise.allSettled(
      Array.from(nodeIds).map(async (nodeId) => {
        const [ifaces, type] = await Promise.all([
          fetchNodeSnmpIfaces(nodeId),
          fetchNodeType(nodeId)
        ])
        return { nodeId, ifaces, type }
      })
    )

    // Build nodeSnmpMap and nodeDownMap from results
    const nodeSnmpMap: Record<number, ReturnType<typeof pickBestInterface>> = {}
    const downMap: Record<number, boolean> = {}

    for (const result of nodeResults) {
      if (result.status !== 'fulfilled') continue
      const { nodeId, ifaces, type } = result.value
      nodeSnmpMap[nodeId] = pickBestInterface(ifaces)
      downMap[nodeId] = type !== null && type !== 'A'
    }

    // Fetch utilization for each edge in parallel
    const edgeResults = await Promise.allSettled(
      _activeEdges.map(async (e) => {
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

    // Build new edgeUtilMap
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

    edgeUtilMap.value = utilMap
    nodeDownMap.value = downMap
    lastUpdated.value = new Date()
  }

  const refresh = async () => {
    loading.value = true
    error.value = null
    try {
      await _fetchAll()
    } catch (err) {
      error.value = 'Weathermap unavailable'
    } finally {
      loading.value = false
      _scheduleNext()
    }
  }

  const start = async (vertices: TopologyVertex[], edges: TopologyEdge[]) => {
    _activeVertices = vertices
    _activeEdges = edges
    if (_timer) clearTimeout(_timer)
    await refresh()
  }

  const stop = () => {
    if (_timer) { clearTimeout(_timer); _timer = null }
  }

  const setPollInterval = (seconds: number) => {
    pollInterval.value = seconds
    if (_timer) { clearTimeout(_timer); _timer = null }
    if (seconds > 0) _scheduleNext()
  }

  return {
    edgeUtilMap, nodeDownMap, loading, error, pollInterval, lastUpdated,
    start, stop, refresh, setPollInterval
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run tests/stores/weathermapStore.test.ts 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/stores/weathermapStore.ts tests/stores/weathermapStore.test.ts && git commit -m "feat(weathermap): add weathermapStore with polling and utilization tracking"
```

---

## Task 4: Modify useTopology.ts to apply weathermap styles

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

- [ ] **Step 1: Add imports and wmStore initialization to useTopology.ts**

After the existing imports (around line 29), add:

```typescript
import { useWeathermapStore } from '@/stores/weathermapStore'
import { utilizationColor, throughputWidth, formatBitsPerSec } from '@/components/Topology/protocolColors'
```

Inside the `useTopology` function body, directly after `const store = useTopologyStore()` (line 135), add:

```typescript
  const wmStore = useWeathermapStore()
```

- [ ] **Step 2: Add weathermap stylesheet rules to buildStylesheet()**

In `buildStylesheet()`, after the existing `edge.user-defined` block (after line 121), add:

```typescript
    // Weathermap: edge with live utilization label
    {
      selector: 'edge.weathermap',
      css: {
        'label': 'data(wmLabel)',
        'font-size': 9,
        'color': '#ffffff',
        'text-background-color': '#2d3748',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
        'text-background-shape': 'roundrectangle'
      }
    },
    // Weathermap: down node — red fill
    {
      selector: 'node.node-down',
      css: {
        'background-color': '#FC8181',
        'border-color': '#E53E3E',
        'border-width': 3
      }
    },
```

- [ ] **Step 3: Store baseLabel in node data inside syncElements()**

In `syncElements()`, in the `nodeElements` mapping (around line 346), add `baseLabel` to the data object:

```typescript
    const nodeElements = store.vertices.map(v => ({
      data: {
        id: v.id,
        label: v.label ?? v.id,
        baseLabel: v.label ?? v.id,   // preserved for down-node label mutation
        nodeID: v.nodeID ?? v.id,
        ipAddress: v.ipAddress,
        namespace: v.namespace
      }
    }))
```

- [ ] **Step 4: Add applyWeathermapStyles and applyNodeDownStyles functions**

Add these two functions after `applySeverityClasses()` (after line 413):

```typescript
  const applyWeathermapStyles = () => {
    if (!cy) return
    cy.batch(() => {
      cy!.edges().forEach(edge => {
        const key = edge.data('edgeKey') as string
        const util = wmStore.edgeUtilMap[key]
        if (!util) {
          // revert to protocol color if data disappears
          edge.removeClass('weathermap')
          edge.style('line-color', edge.data('color'))
          edge.style('width', 3)
          return
        }
        const color = utilizationColor(util.utilPct)
        const width = throughputWidth(util.inBps + util.outBps)
        const label = `${Math.round(util.utilPct)}% · ↑${formatBitsPerSec(util.inBps)} ↓${formatBitsPerSec(util.outBps)}`
        edge.data('wmLabel', label)
        edge.style('line-color', color)
        edge.style('width', width)
        edge.addClass('weathermap')
      })
    })
  }

  const applyNodeDownStyles = () => {
    if (!cy) return
    cy.batch(() => {
      cy!.nodes().forEach(node => {
        const numericId = parseInt(node.id(), 10)
        const isDown = !isNaN(numericId) && wmStore.nodeDownMap[numericId] === true
        const base = node.data('baseLabel') as string ?? node.id()
        if (isDown) {
          node.addClass('node-down')
          node.data('label', base + '\n▼ DOWN')
        } else {
          node.removeClass('node-down')
          node.data('label', base)
        }
      })
    })
  }
```

- [ ] **Step 5: Add watchers for weathermapStore maps**

After the existing `watch(() => store.alarmSeverity, ...)` (after line 417), add:

```typescript
  watch(() => wmStore.edgeUtilMap, applyWeathermapStyles, { deep: true })
  watch(() => wmStore.nodeDownMap, applyNodeDownStyles, { deep: true })
```

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run 2>&1 | tail -30
```

Expected: All existing tests still pass. Zero failures.

- [ ] **Step 7: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/composables/useTopology.ts && git commit -m "feat(weathermap): apply utilization colors/widths/labels in Cytoscape via weathermapStore"
```

---

## Task 5: Add weathermap controls to TopologyToolbar.vue

**Files:**
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`

- [ ] **Step 1: Add weathermapStore import and computed state to `<script setup>`**

In the `<script setup>` section, after the existing imports, add:

```typescript
import { useWeathermapStore } from '@/stores/weathermapStore'

const wmStore = useWeathermapStore()

const INTERVAL_OPTIONS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '5m',   value: 300 },
  { label: 'Off',  value: 0 },
]

const wmStatusText = computed(() => {
  if (wmStore.error) return 'Weathermap unavailable'
  if (!wmStore.lastUpdated) return ''
  const secs = Math.round((Date.now() - wmStore.lastUpdated.getTime()) / 1000)
  if (secs < 5) return 'Updated just now'
  if (secs < 120) return `Updated ${secs}s ago`
  return `Updated ${Math.round(secs / 60)}m ago`
})
```

- [ ] **Step 2: Add weathermap controls to the template**

In the template, after the `topology-toolbar__layout-actions` div (after the Reset Layout button), add:

```html
    <div class="topology-toolbar__weathermap">
      <button
        type="button"
        class="topology-toolbar__chip"
        :disabled="wmStore.loading"
        title="Refresh weathermap data"
        @click="wmStore.refresh()"
      >{{ wmStore.loading ? '…' : '↺' }} Weathermap</button>

      <select
        class="topology-toolbar__interval"
        :value="wmStore.pollInterval"
        @change="(e) => wmStore.setPollInterval(Number((e.target as HTMLSelectElement).value))"
        title="Auto-refresh interval"
      >
        <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <span v-if="wmStatusText" class="topology-toolbar__wm-status" :class="{ error: !!wmStore.error }">
        {{ wmStatusText }}
      </span>
    </div>
```

- [ ] **Step 3: Add styles for the new weathermap control elements**

In the `<style>` section, after `&__layout-actions`, add:

```scss
  &__weathermap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    margin-left: 8px;
  }

  &__interval {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var($border-on-surface);
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.8rem;
    cursor: pointer;
  }

  &__wm-status {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;

    &.error { color: var($error); }
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/components/Topology/TopologyToolbar.vue && git commit -m "feat(weathermap): add refresh/interval/status controls to topology toolbar"
```

---

## Task 6: Wire weathermapStore lifecycle in Topology.vue

**Files:**
- Modify: `ui/src/containers/Topology.vue`

- [ ] **Step 1: Add weathermapStore to Topology.vue and wire lifecycle**

In `Topology.vue`, the `<script setup>` section currently has:

```typescript
import { useTopologyStore } from '@/stores/topologyStore'
import { useMenuStore } from '@/stores/menuStore'
```

Replace the entire `<script setup>` section with:

```typescript
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import TopologyToolbar from '@/components/Topology/TopologyToolbar.vue'
import TopologyGraph from '@/components/Topology/TopologyGraph.vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const store = useTopologyStore()
const wmStore = useWeathermapStore()
const menuStore = useMenuStore()

const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl ?? '/opennms')
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Network Topology', to: '#', position: 'last' }
])

onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities(),
    store.loadUserDefinedLinks()
  ])
  // Start weathermap after topology has loaded vertices/edges
  await wmStore.start(store.vertices, store.edges)
})

// Re-start weathermap when topology layer selection changes
watch(() => store.edges, async (edges) => {
  await wmStore.start(store.vertices, edges)
}, { deep: false })

onBeforeUnmount(() => {
  wmStore.stop()
})
```

- [ ] **Step 2: Run the full test suite one more time**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vitest run 2>&1 | tail -30
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/containers/Topology.vue && git commit -m "feat(weathermap): start/stop weathermapStore in Topology.vue lifecycle"
```

---

## Task 7: Build, deploy, and verify

- [ ] **Step 1: Build the UI**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: Build succeeds with no errors. Output includes `src/main/dist/index.html`.

- [ ] **Step 2: Verify built CSS has no bare --feather-* values**

```bash
grep -c 'var(--feather' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | head -5
grep -c '[^r]--feather-' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | head -5
```

Expected: First command shows counts > 0. Second command shows 0 (no bare variables).

- [ ] **Step 3: Deploy to container**

```bash
./deploy-to-container.sh test-opennms
```

- [ ] **Step 4: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: Both lines show the same hash.

- [ ] **Step 5: Verify bundle is reachable**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```

Expected: `200`

- [ ] **Step 6: Tell user to hard-refresh and navigate to topology**

Tell user to hard-refresh (Cmd+Option+R in Safari, or Shift+click reload in Chrome/Firefox) and navigate to the Network Topology page. Verify:
- Weathermap toolbar shows: `↺ Weathermap` button, interval selector, status text
- After clicking Refresh: edge colors shift based on utilization (green/yellow/orange/red)
- Down nodes (if any) show red fill and `▼ DOWN` in their label
- Edge labels show `47% · ↑230M ↓180M` format (when data is available)
- If no measurements data exists: edges keep their protocol colors (graceful fallback)

- [ ] **Step 7: Final commit**

```bash
cd /Users/chance/git/opennms/ui && git add -p && git commit -m "feat(weathermap): topology weathermap — utilization colors, edge labels, down-node marking"
```
