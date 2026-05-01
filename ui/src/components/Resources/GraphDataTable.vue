<template>
  <div id="wrap">
    <div class="data-controls">
      <label class="checkbox-label">
        <Checkbox v-model="hideNaNRows" binary />
        Hide empty rows
      </label>
      <label class="checkbox-label">
        <Checkbox v-model="displayRawValues" binary @change="valueDisplayHandler" />
        Raw values
      </label>
      <div class="export-buttons">
        <button class="export-btn" @click="exportCSV">CSV</button>
        <button class="export-btn" @click="exportJSON">JSON</button>
        <button class="export-btn" @click="exportXML">XML</button>
      </div>
    </div>
    <table
      summary="Graph values"
      :id="`${id}-table`"
      @dblclick="highlightTableText"
    >
      <thead>
        <tr>
          <th
            class="time-column"
            scope="col"
          >
            Date/Time
          </th>
          <th
            v-for="metric of visibleMetrics"
            :key="metric.name"
            scope="col"
          >
            {{ getHeaderFromMetricName(metric.name as string) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(timestamp, index) in graphData.timestamps"
          :key="timestamp"
          v-show="!hideNaNRows || hasDataAtIndex(index)"
        >
          <td>{{ !displayRawValues ? graphData.formattedTimestamps[index] : timestamp }}</td>
          <td
            v-for="metric of visibleMetrics"
            :key="metric.name"
          >
            {{
              !displayRawValues ?
                formatColumnValue(getColumnFromMetricName(metric.name as string)[index]) :
                getColumnFromMetricName(metric.name as string)[index]
            }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script
  setup
  lang="ts"
>
import { ConvertedGraphData, GraphMetricsResponse } from '@/types'
import Checkbox from 'primevue/checkbox'
import { format } from 'd3'
import { PropType } from 'vue'

const displayRawValues = ref(false)
const hideNaNRows = ref(true)
const d3format = format('.3s')
const formatColumnValue = (num: number) => {
  if (isNaN(num)) return 'N/A'
  return d3format(num)
}

const props = defineProps({
  graphData: {
    required: true,
    type: Object as PropType<GraphMetricsResponse>
  },
  convertedGraphData: {
    required: true,
    type: Object as PropType<ConvertedGraphData>
  },
  id: {
    required: true,
    type: String
  }
})

// Only show metrics that the API returned data for (excludes transient DEFs
// used only as inputs to CDEF expressions — they have no columns in the response)
const visibleMetrics = computed(() =>
  props.convertedGraphData.metrics.filter(
    (m) => !m.transient && props.graphData.labels.includes(m.name as string)
  )
)

const getHeaderFromMetricName = (metricName: string): string => {
  for (const statement of props.convertedGraphData.printStatements) {
    if (statement.metric === metricName) {
      return statement.header as string
    }
  }
  return ''
}

const hasDataAtIndex = (index: number): boolean => {
  return visibleMetrics.value.some((m) => {
    const val = getColumnFromMetricName(m.name as string)[index]
    return val !== undefined && val !== null && !isNaN(Number(val))
  })
}

const getColumnFromMetricName = (metricName: string): number[] => {
  for (const [index, label] of props.graphData.labels.entries()) {
    if (label === metricName) {
      return props.graphData.columns[index].values
    }
  }
  return []
}

const valueDisplayHandler = () => { /* toggled via v-model */ }

function getExportRows() {
  const headers = ['Date/Time', ...visibleMetrics.value.map(m => getHeaderFromMetricName(m.name as string) || m.name as string)]
  const rows: (string | number)[][] = []

  for (let i = 0; i < props.graphData.timestamps.length; i++) {
    if (hideNaNRows.value && !hasDataAtIndex(i)) continue
    const row: (string | number)[] = [props.graphData.formattedTimestamps[i] ?? props.graphData.timestamps[i]]
    for (const m of visibleMetrics.value) {
      const val = getColumnFromMetricName(m.name as string)[i]
      row.push(val !== undefined && val !== null && !isNaN(Number(val)) ? val : '')
    }
    rows.push(row)
  }
  return { headers, rows }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV() {
  const { headers, rows } = getExportRows()
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
  downloadFile(lines.join('\n'), `${props.id}.csv`, 'text/csv')
}

function exportJSON() {
  const { headers, rows } = getExportRows()
  const data = rows.map(row => {
    const obj: Record<string, string | number> = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  downloadFile(JSON.stringify(data, null, 2), `${props.id}.json`, 'application/json')
}

function exportXML() {
  const { headers, rows } = getExportRows()
  const escapeXml = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const tagName = (h: string) => h.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1')
  const xmlRows = rows.map(row => {
    const fields = headers.map((h, i) => `    <${tagName(h)}>${escapeXml(row[i])}</${tagName(h)}>`)
    return `  <row>\n${fields.join('\n')}\n  </row>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${xmlRows.join('\n')}\n</data>`
  downloadFile(xml, `${props.id}.xml`, 'application/xml')
}

function highlightTableText() {
  const table = document.getElementById(`${props.id}-table`)

  if (table) {
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(table)
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}
</script>

<style
  scoped
  lang="scss"
>
@use '@/styles/vars' as vars;
@use "@/styles/table" as *;
#wrap {
  height: calc(100% - 29px);
  overflow: auto;

  table {
    @include table();
    &.condensed {
      @include table-condensed();
    }
    margin-top: 0px;

    .time-column {
      width: 200px;
    }
  }

  .data-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 10px 0px -4px 18px;

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      user-select: none;
    }
  }

  .export-buttons {
    display: flex;
    gap: 4px;
    margin-left: auto;
    margin-right: 18px;
  }

  .export-btn {
    background: var(--feather-shade-4);
    color: var(--feather-primary-text-on-surface);
    border: 1px solid var(--feather-border-on-surface);
    border-radius: vars.$border-radius-surface;
    padding: 4px 10px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: 0.03em;

    &:hover {
      background: var(--feather-clickable-normal);
      color: var(--feather-primary-text-on-color);
    }
  }
}
</style>

