import { describe, test, expect, vi, beforeEach } from 'vitest'
import { OpenNMSTimeSeriesQueryPlugin } from '@/datasource/opennms/plugin'
import * as client from '@/datasource/opennms/client'
import type { MeasurementsResponse } from '@/datasource/opennms/types'

const mockMeasurements: MeasurementsResponse = {
  start: 1700000000000,
  end:   1700003600000,
  step:  300000,
  timestamps: [1700000000000, 1700000300000],
  labels: ['ifInOctets'],
  columns: [{ values: [100.0, 200.0] }]
}

describe('OpenNMSTimeSeriesQueryPlugin', () => {
  beforeEach(() => {
    vi.spyOn(client, 'fetchMeasurements').mockResolvedValue(mockMeasurements)
  })

  test('maps measurements response to time series format', async () => {
    const result = await OpenNMSTimeSeriesQueryPlugin.getTimeSeriesData(
      {
        resourceId: 'node[1].interfaceSnmp[eth0]',
        attribute: 'ifInOctets',
        aggregation: 'AVERAGE'
      },
      {
        timeRange: { start: new Date(1700000000000), end: new Date(1700003600000) },
        suggestedStepMs: 300000,
        datasource: undefined
      }
    )

    expect(result.series).toHaveLength(1)
    expect(result.series[0].name).toBe('ifInOctets')
    // Values should be [timestamp_seconds, value]
    expect(result.series[0].values[0]).toEqual([1700000000, 100.0])
    expect(result.series[0].values[1]).toEqual([1700000300, 200.0])
  })

  test('passes null values through as null', async () => {
    vi.spyOn(client, 'fetchMeasurements').mockResolvedValue({
      ...mockMeasurements,
      columns: [{ values: [null, 200.0] }]
    })

    const result = await OpenNMSTimeSeriesQueryPlugin.getTimeSeriesData(
      { resourceId: 'x', attribute: 'y', aggregation: 'AVERAGE' },
      { timeRange: { start: new Date(1700000000000), end: new Date(1700003600000) }, suggestedStepMs: 300000, datasource: undefined }
    )

    expect(result.series[0].values[0][1]).toBeNull()
  })
})
