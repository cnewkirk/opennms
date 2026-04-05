// ui/src/types/resourceGraphs.ts

export const SERIES_PALETTE = [
  '#1976d2', '#2e7d32', '#f57c00', '#c62828',
  '#6a1b9a', '#00838f', '#558b2f', '#4527a0'
]

export interface ChartSeries {
  resourceId: string
  resourceLabel: string
  attribute: string
  aggregation: 'AVERAGE' | 'MIN' | 'MAX'
  label: string
  color: string
}

export interface SavedChart {
  id: string                                   // uuid v4
  nodeId: string
  title: string
  series: ChartSeries[]
  timeRange?: { start: number; end: number }   // undefined = inherit global (ms epoch)
  createdAt: number                            // ms epoch
}

export interface HighlightItem {
  resourceId: string
  definition: string   // pre-fab graph name, e.g. "nodeSnmp.cpuPercentage"
  label: string        // resource label for display
}
