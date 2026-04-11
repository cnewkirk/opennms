import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetForTesting } from '@/services/cacheService'
import { buildSnmpResourceId, pickBestInterface, fetchInterfaceUtilization } from '@/services/measurementsService'
import { SnmpInterface } from '@/types'

const { rest } = await import('@/services/axiosInstances')

vi.mock('@/services/axiosInstances', () => ({
  rest: { post: vi.fn() },
  v2:   { get:  vi.fn() }
}))

vi.mock('@/services/intervalService', () => ({
  getIntervals: vi.fn().mockResolvedValue({
    collection: { SNMP: 30_000 },
    rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }),
  getSnmpInterval: vi.fn().mockResolvedValue(30_000),
  FALLBACK: {
    collection: { SNMP: 300_000, JMX: 300_000 },
    rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }
}))

const makeIface = (overrides: Partial<SnmpInterface> = {}): SnmpInterface => ({
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

describe('fetchInterfaceUtilization', () => {
  beforeEach(() => { vi.clearAllMocks(); _resetForTesting() })

  it('floors current time to STEP boundary and uses 3-STEP window', async () => {
    vi.mocked(rest.post).mockResolvedValue({
      data: { labels: ['inOctets', 'outOctets'], columns: [{ values: [125_000] }, { values: [62_500] }] }
    })
    const before = Date.now()
    await fetchInterfaceUtilization(42, makeIface())
    const payload = vi.mocked(rest.post).mock.calls[0][1] as any
    // _floor rounds down, so end ≤ before
    expect(payload.end).toBeLessThanOrEqual(before)
    expect(before - payload.end).toBeLessThan(30_000) // at most one STEP behind
    expect(payload.end - payload.start).toBe(90_000) // STEP(30_000) * 3
  })
})
