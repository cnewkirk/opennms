import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetForTesting } from '@/services/cacheService'

// Mock axiosInstances before importing intervalService
vi.mock('@/services/axiosInstances', () => ({
  v2: { get: vi.fn() },
  rest: { get: vi.fn() }
}))

import { getIntervals, FALLBACK } from '@/services/intervalService'
import { v2 } from '@/services/axiosInstances'

beforeEach(() => {
  vi.clearAllMocks()
  _resetForTesting()
})

describe('getIntervals()', () => {
  it('fetches from the API and returns parsed intervals', async () => {
    const apiResponse = {
      collection: { SNMP: 300_000, JMX: 60_000 },
      rrdStep: 300,
      enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
    }
    vi.mocked(v2.get).mockResolvedValue({ data: apiResponse })

    const result = await getIntervals()
    expect(result).toEqual(apiResponse)
    expect(v2.get).toHaveBeenCalledWith('/config/measurementIntervals')
  })

  it('caches the result and does not re-fetch on second call', async () => {
    vi.mocked(v2.get).mockResolvedValue({
      data: { collection: { SNMP: 300_000 }, rrdStep: 300, enlinkd: {} }
    })
    await getIntervals()
    await getIntervals()
    expect(v2.get).toHaveBeenCalledTimes(1)
  })

  it('returns fallback defaults when API returns 404', async () => {
    vi.mocked(v2.get).mockRejectedValue({ response: { status: 404 } })

    const result = await getIntervals()
    expect(result).toEqual(FALLBACK)
  })

  it('returns fallback defaults on network error', async () => {
    vi.mocked(v2.get).mockRejectedValue(new Error('Network Error'))

    const result = await getIntervals()
    expect(result).toEqual(FALLBACK)
  })

  it('fallback has expected default SNMP interval', () => {
    expect(FALLBACK.collection.SNMP).toBe(300_000)
  })
})
