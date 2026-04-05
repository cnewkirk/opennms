import { QueryEditor } from './QueryEditor'
import { OpenNMSTimeSeriesQueryPlugin } from './plugin'

export const OPENNMS_DATASOURCE_KIND = 'OpenNMSTimeSeries' as const

/**
 * Perses plugin definition for OpenNMS time series queries.
 * Register this with the Perses PluginRegistry at app startup.
 */
export const OpenNMSPlugin = {
  kind: OPENNMS_DATASOURCE_KIND,
  plugin: OpenNMSTimeSeriesQueryPlugin,
  queryEditor: QueryEditor
}

export { OpenNMSTimeSeriesQueryPlugin } from './plugin'
export { QueryEditor } from './QueryEditor'
export type { OpenNMSQuerySpec } from './types'
