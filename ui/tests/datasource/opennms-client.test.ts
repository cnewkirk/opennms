import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchMeasurements } from '@/datasource/opennms/client'
import type { MeasurementsPayload, MeasurementsResponse } from '@/datasource/opennms/types'

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

    expect(fetch).toHaveBeenCalledWith('/rest/measurements', {
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
