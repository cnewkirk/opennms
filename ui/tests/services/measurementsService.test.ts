import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSnmpResourceId, pickBestInterface, fetchInterfaceUtilization } from '@/services/measurementsService'
import { SnmpInterface } from '@/types'
import { rest } from '@/services/axiosInstances'

vi.mock('@/services/axiosInstances', () => ({
  rest: { post: vi.fn() },
  v2:   { get:  vi.fn() }
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
