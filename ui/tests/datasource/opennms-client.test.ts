import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchMeasurements } from '@/datasource/opennms/client'
import type { MeasurementsPayload, MeasurementsResponse } from '@/datasource/opennms/types'
import { getOutage } from '@/services/outageService'

vi.mock('@/services/axiosInstances', () => ({
  v2: { get: vi.fn() }
}))

const mockResponse: MeasurementsResponse = {
  start: 1000000,
  end: 2000000,
  step: 300000,
  timestamps: [1000000, 1300000, 1600000, 1900000],
  labels: ['ifInOctets'],
  columns: [{ values: [10.0, 20.0, 15.0, 25.0] }]
}

describe('fetchMeasurements', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    }))
  })

  test('POSTs to /rest/measurements with correct body', async () => {
    const payload: MeasurementsPayload = {
      start: 1000000,
      end: 2000000,
      step: 300000,
      source: [{ aggregation: 'AVERAGE', attribute: 'ifInOctets', label: 'ifInOctets', resourceId: 'node[1].interfaceSnmp[eth0]', transient: false }]
    }

    const result = await fetchMeasurements(payload)

    expect(fetch).toHaveBeenCalledWith('/opennms/rest/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
    expect(result.labels).toEqual(['ifInOctets'])
    expect(result.columns[0].values).toHaveLength(4)
  })

  test('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(fetchMeasurements({ start: 0, end: 1, step: 300000, source: [] }))
      .rejects.toThrow('Measurements request failed: 500')
  })
})

describe('outageService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetAllMocks()
    const { v2 } = await import('@/services/axiosInstances')
    mockGet = vi.mocked(v2.get)
  })

  describe('getOutage', () => {
    test('fetches a single outage by ID', async () => {
      const mockOutage = {
        id: 42,
        nodeId: 1,
        ipAddress: '192.168.1.1',
        serviceId: 1,
        nodeLabel: 'test-node',
        location: 'Default',
        hostname: 'test-node',
        ifLostService: 1700000000000,
        ifRegainedService: null,
        lostServiceEventId: 100,
        regainedServiceEventId: null,
        perspectiveLocation: null,
        foreignSource: 'Test'
      }

      mockGet.mockResolvedValue({ status: 200, data: mockOutage })

      const result = await getOutage(42)
      expect(result).toMatchObject({ id: 42, nodeLabel: 'test-node' })
    })

    test('returns false on API error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))

      const result = await getOutage(99)
      expect(result).toBe(false)
    })
  })
})
