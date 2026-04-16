import { createElement, useMemo, useCallback, type ReactNode } from 'react'
import {
  useTimeSeriesQueries,
  DataQueriesContext,
  transformQueryResults
} from '@perses-dev/plugin-system'
import type { TimeSeriesQueryDefinition } from '@perses-dev/core'
import type { OpenNMSQuerySpec, OpenNMSBatchQuerySpec } from './types'

interface Props {
  queries: Array<OpenNMSQuerySpec | OpenNMSBatchQuerySpec>
  children?: ReactNode
}

/**
 * Replacement for Perses DataQueriesProvider that bypasses the hardcoded
 * getQueryType() switch in Perses 0.50.3, which only handles Prometheus/Tempo.
 *
 * We pre-shape definitions as TimeSeriesQueryDefinition and call
 * useTimeSeriesQueries directly, then provide DataQueriesContext manually.
 */
export function OpenNMSDataQueriesProvider({ queries, children }: Props) {
  const definitions = useMemo<TimeSeriesQueryDefinition[]>(
    () =>
      queries.map((q) => ({
        kind: 'TimeSeriesQuery' as const,
        spec: { plugin: { kind: 'OpenNMSTimeSeries', spec: q as unknown as Record<string, unknown> } }
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queries)]
  )

  const results = useTimeSeriesQueries(definitions)

  const refetchAll = useCallback(() => {
    results.forEach((r) => r.refetch?.())
  }, [results])

  const queryResults = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => transformQueryResults(results as any, definitions as any),
    [results, definitions]
  )

  const ctx = useMemo(
    () => ({
      queryResults,
      isFetching: queryResults.some((r) => r.isFetching),
      isLoading: queryResults.some((r) => r.isLoading),
      refetchAll,
      errors: queryResults.map((r) => r.error)
    }),
    [queryResults, refetchAll]
  )

  return createElement(DataQueriesContext.Provider, { value: ctx }, children)
}
