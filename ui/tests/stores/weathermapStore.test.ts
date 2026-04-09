import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { computeUtilPct, edgeKey, useWeathermapStore } from '@/stores/weathermapStore'
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

describe('computeUtilPct', () => {
  it('returns 0 when ifSpeed is 0', () => {
    expect(computeUtilPct(1_000_000, 1_000_000, 0)).toBe(0)
  })
  it('computes combined in+out utilization as fraction of duplex capacity', () => {
    // 500 Mbps in + 500 Mbps out on a 1 Gbps link = 50% utilization
    expect(computeUtilPct(500_000_000, 500_000_000, 1_000_000_000)).toBeCloseTo(50, 1)
  })
  it('caps at 100%', () => {
    // 1.1 Gbps in + 1.1 Gbps out on a 1 Gbps link → (2.2 Gbps)/(2 Gbps)*100 = 110% → capped to 100
    expect(computeUtilPct(1_100_000_000, 1_100_000_000, 1_000_000_000)).toBe(100)
  })
  it('rounds to one decimal', () => {
    // 123.456 Mbps in + 234.567 Mbps out on a 1 Gbps link = 17.9% (duplex formula: (in+out)/(2*speed)*100)
    expect(computeUtilPct(123_456_000, 234_567_000, 1_000_000_000)).toBeCloseTo(17.9, 0)
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
