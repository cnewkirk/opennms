import { fetchMeasurements } from './client'
import type { OpenNMSQuerySpec, OpenNMSBatchQuerySpec, MeasurementsPayload, MeasurementsSource } from './types'
import type { AbsoluteTimeRange } from '@perses-dev/core'

/** Context passed to getTimeSeriesData — mirrors Perses TimeSeriesQueryContext */
export interface OpenNMSQueryContext {
  timeRange: AbsoluteTimeRange
  suggestedStepMs?: number
  datasource?: unknown
}

/** A single data point: [timestamp_ms, value | null] */
export type TimeSeriesValuePair = [number, number | null]

/** One time series returned by the plugin */
export interface OpenNMSTimeSeries {
  name: string
  values: TimeSeriesValuePair[]
}

/** Return value of getTimeSeriesData */
export interface OpenNMSTimeSeriesData {
  timeRange: AbsoluteTimeRange
  series: OpenNMSTimeSeries[]
}

/**
 * OpenNMS measurements datasource plugin for Perses.
 *
 * Accepts an OpenNMSQuerySpec and a time range context, fetches data from
 * /rest/measurements, and returns series with timestamps in milliseconds.
 *
 * This intentionally uses a plain-object pattern rather than directly
 * implementing a Perses plugin interface because Perses 0.50.3 does not
 * export a TimeSeriesQueryPlugin generic interface. Type annotations can be
 * tightened once Perses stabilises its plugin API.
 */
export const OpenNMSTimeSeriesQueryPlugin = {
  async getTimeSeriesData(
    spec: OpenNMSQuerySpec | OpenNMSBatchQuerySpec,
    context: OpenNMSQueryContext
  ): Promise<OpenNMSTimeSeriesData> {
    const { timeRange, suggestedStepMs } = context
    const start = timeRange.start.getTime()
    const end = timeRange.end.getTime()
    const step = Math.max(suggestedStepMs ?? 300_000, 60_000)

    let payload: MeasurementsPayload

    if ('batch' in spec && spec.batch) {
      // Batch mode: all DEF sources + CDEF expressions in one call.
      // Required when CDEF expressions reference DEF variable names.
      payload = {
        start, end, step,
        source: spec.sources.map(s => ({
          aggregation: s.aggregation,
          attribute: s.attribute,
          label: s.label,
          resourceId: s.resourceId,
          transient: s.transient ?? false
        }))
      }
      if (spec.expressions.length > 0) {
        payload.expression = spec.expressions.map(e => ({
          value: e.value,
          label: e.label,
          transient: e.transient ?? false
        }))
      }
    } else {
      // Single-query mode (original behavior)
      const singleSpec = spec as OpenNMSQuerySpec
      payload = { start, end, step, source: [] }

      if (singleSpec.expression) {
        payload.expression = [
          {
            value: singleSpec.expression,
            label: singleSpec.label ?? singleSpec.attribute,
            transient: singleSpec.transient ?? false
          }
        ]
      } else {
        const source: MeasurementsSource = {
          aggregation: singleSpec.aggregation,
          attribute: singleSpec.attribute,
          label: singleSpec.label ?? singleSpec.attribute,
          resourceId: singleSpec.resourceId,
          transient: singleSpec.transient ?? false
        }
        payload.source = [source]
      }
    }

    const response = await fetchMeasurements(payload)

    const series: OpenNMSTimeSeries[] = response.labels.map((label, colIdx) => ({
      name: label,
      values: response.timestamps.map((ts, rowIdx): TimeSeriesValuePair => [
        ts,
        response.columns[colIdx]?.values[rowIdx] ?? null
      ])
    }))

    return {
      timeRange: { start: timeRange.start, end: timeRange.end },
      stepMs: step,
      series
    }
  }
}
