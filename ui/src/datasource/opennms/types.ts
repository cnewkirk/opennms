/** A single metric query sent to /rest/measurements */
export interface OpenNMSQuerySpec {
  /** e.g. "node[1].interfaceSnmp[eth0-000000000000]" */
  resourceId: string
  /** RRD attribute name, e.g. "ifInOctets" */
  attribute: string
  /** Aggregation function */
  aggregation: 'AVERAGE' | 'MIN' | 'MAX' | 'LAST'
  /** Optional label override (defaults to attribute) */
  label?: string
  /** JEXL expression — present on CDEF metrics, absent on DEF metrics */
  expression?: string
  /** If true, fetch but don't render (used in CDEF chains) */
  transient?: boolean
}

/** Shape of a single source entry in the /rest/measurements request body */
export interface MeasurementsSource {
  aggregation: string
  attribute: string
  label: string
  resourceId: string
  transient: boolean
}

/** Shape of a JEXL expression entry in the /rest/measurements request body */
export interface MeasurementsExpression {
  value: string
  label: string
  transient: boolean
}

/** POST body for /rest/measurements */
export interface MeasurementsPayload {
  start: number
  end: number
  step: number
  source: MeasurementsSource[]
  expression?: MeasurementsExpression[]
}

/** Column of values in the /rest/measurements response */
export interface MeasurementsColumn {
  values: (number | null)[]
}

/** Response from /rest/measurements */
export interface MeasurementsResponse {
  start: number
  end: number
  step: number
  timestamps: number[]
  labels: string[]
  columns: MeasurementsColumn[]
}
