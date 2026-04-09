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
