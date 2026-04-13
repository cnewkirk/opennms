import { rest } from './axiosInstances'

// ─── Time Range ───────────────────────────────────────────────────────────────

export type RelativeWindow = '1h' | '6h' | '24h' | '7d' | '30d'

export interface DashboardTimeRange {
  mode: 'relative' | 'absolute'
  relativeWindow: RelativeWindow
  from?: string  // ISO string, used when mode='absolute'
  to?: string
}

const RELATIVE_MS: Record<RelativeWindow, number> = {
  '1h':  3600 * 1000,
  '6h':  6 * 3600 * 1000,
  '24h': 24 * 3600 * 1000,
  '7d':  7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000
}

export const resolveTimeRange = (tr: DashboardTimeRange): { start: Date; end: Date } => {
  if (tr.mode === 'absolute' && tr.from && tr.to) {
    return { start: new Date(tr.from), end: new Date(tr.to) }
  }
  const end   = new Date()
  const start = new Date(end.getTime() - RELATIVE_MS[tr.relativeWindow])
  return { start, end }
}

// ─── Widget Config Types ──────────────────────────────────────────────────────

interface BaseWidgetConfig {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
  refreshInterval: number
}

export interface SummaryWidgetConfig extends BaseWidgetConfig {
  type: 'summary'
  categories: string[]
}

export interface TableWidgetConfig extends BaseWidgetConfig {
  type: 'outages' | 'alarms' | 'nodes'
  categories: string[]
  limit: number
  severities: string[]
  columns: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface GraphSeries {
  id: string
  nodeId: string
  resourceId: string
  attribute: string
  label: string
  color?: string
  expression?: string  // advanced mode override
}

export interface GraphWidgetConfig extends BaseWidgetConfig {
  type: 'graph'
  series: GraphSeries[]
  stack: boolean
  timeRange?: DashboardTimeRange
}

export interface NodeStatusWidgetConfig extends BaseWidgetConfig {
  type: 'node-status'
  categories: string[]
}

export interface AvailabilityWidgetConfig extends BaseWidgetConfig {
  type: 'availability'
  categories: string[]
  timeRange?: DashboardTimeRange
}

export type WidgetConfig =
  | SummaryWidgetConfig
  | TableWidgetConfig
  | GraphWidgetConfig
  | NodeStatusWidgetConfig
  | AvailabilityWidgetConfig

export type WidgetType = WidgetConfig['type']

// ─── Column Definitions (table widgets only) ──────────────────────────────────

export interface ColumnDef {
  key: string
  label: string
  sortField?: string
}

export const WIDGET_COLUMNS: Record<'alarms' | 'outages' | 'nodes', ColumnDef[]> = {
  alarms: [
    { key: 'severity', label: 'Severity',  sortField: 'severity' },
    { key: 'node',     label: 'Node',      sortField: 'nodeLabel' },
    { key: 'message',  label: 'Message' },
    { key: 'count',    label: 'Count',     sortField: 'count' },
    { key: 'time',     label: 'Time',      sortField: 'lastEventTime' }
  ],
  outages: [
    { key: 'node',    label: 'Node',       sortField: 'nodeLabel' },
    { key: 'service', label: 'Service',    sortField: 'serviceName' },
    { key: 'ip',      label: 'IP Address', sortField: 'ipAddress' },
    { key: 'since',   label: 'Since',      sortField: 'ifLostService' }
  ],
  nodes: [
    { key: 'node',       label: 'Node',       sortField: 'label' },
    { key: 'location',   label: 'Location',   sortField: 'location' },
    { key: 'categories', label: 'Categories' }
  ]
}

export const DEFAULT_COLUMNS: Record<'alarms' | 'outages' | 'nodes', string[]> = {
  alarms:  ['severity', 'node', 'message', 'count'],
  outages: ['node', 'service', 'ip'],
  nodes:   ['node', 'location', 'categories']
}

// ─── Dashboard Config ─────────────────────────────────────────────────────────

export interface DashboardConfig {
  version: 3
  timeRange: DashboardTimeRange
  widgets: WidgetConfig[]
}

const DEFAULT_TIME_RANGE: DashboardTimeRange = { mode: 'relative', relativeWindow: '24h' }

const STORAGE_KEY    = 'opennms.dashboard.config'
const CONFIG_VERSION = 3
const USER_PROP_KEY  = 'ui.dashboard.layout'

export const defaultConfig = (): DashboardConfig => ({
  version: CONFIG_VERSION,
  timeRange: { ...DEFAULT_TIME_RANGE },
  widgets: [
    { id: 'widget-summary', type: 'summary', title: 'Network Summary',  x: 0, y: 0, w: 12, h: 2, categories: [], refreshInterval: 60 },
    { id: 'widget-outages', type: 'outages', title: 'Active Outages',   x: 0, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: [], columns: DEFAULT_COLUMNS.outages },
    { id: 'widget-alarms',  type: 'alarms',  title: 'Active Alarms',    x: 6, y: 2, w: 6,  h: 3, categories: [], limit: 10, refreshInterval: 60,  severities: ['CRITICAL', 'MAJOR', 'MINOR'], columns: DEFAULT_COLUMNS.alarms },
    { id: 'widget-nodes',   type: 'nodes',   title: 'Nodes',            x: 0, y: 5, w: 12, h: 3, categories: [], limit: 10, refreshInterval: 120, severities: [], columns: DEFAULT_COLUMNS.nodes }
  ] as WidgetConfig[]
})

// ─── v2 → v3 Migration ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const migrateToV3 = (raw: any): DashboardConfig => ({
  version: 3,
  timeRange: raw.timeRange ?? { ...DEFAULT_TIME_RANGE },
  widgets: (raw.widgets ?? []) as WidgetConfig[]
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isValidV3 = (c: any): c is DashboardConfig =>
  c?.version === 3 &&
  Array.isArray(c.widgets) &&
  c.widgets.length > 0 &&
  c.widgets.every((w: any) =>
    typeof w.x === 'number' && typeof w.y === 'number' &&
    typeof w.w === 'number' && typeof w.h === 'number'
  )

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUpgradeable = (c: any): boolean =>
  c?.version >= 2 &&
  Array.isArray(c.widgets) &&
  c.widgets.length > 0 &&
  c.widgets.every((w: any) =>
    typeof w.x === 'number' && typeof w.y === 'number' &&
    typeof w.w === 'number' && typeof w.h === 'number'
  )

// ─── Persistence ──────────────────────────────────────────────────────────────

export const loadConfig = (): DashboardConfig => {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (json) {
      const parsed = JSON.parse(json)
      if (isValidV3(parsed)) return parsed
      if (isUpgradeable(parsed)) return migrateToV3(parsed)
    }
  } catch { /* corrupt storage */ }
  return defaultConfig()
}

export const saveConfig = (config: DashboardConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export const resetConfig = (): DashboardConfig => {
  const config = defaultConfig()
  saveConfig(config)
  return config
}

export const loadFromServer = async (username: string): Promise<DashboardConfig | null> => {
  try {
    const resp = await rest.get(`users/${username}/properties/${USER_PROP_KEY}`)
    const json = resp.data?.value as string | undefined
    if (!json) return null
    const parsed = JSON.parse(json)
    if (isValidV3(parsed)) return parsed
    if (isUpgradeable(parsed)) return migrateToV3(parsed)
  } catch { /* 404 or parse error */ }
  return null
}

export const saveToServer = async (username: string, config: DashboardConfig): Promise<void> => {
  try {
    await rest.put(`users/${username}/properties/${USER_PROP_KEY}`, { value: JSON.stringify(config) })
  } catch { /* non-fatal */ }
}
