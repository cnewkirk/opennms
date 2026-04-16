import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSnmpResourceId, pickBestInterface, fetchInterfaceUtilization,
         fetchInterfaceTimeSeries, fetchInterfaceErrorsDiscards } from '@/services/measurementsService'
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
