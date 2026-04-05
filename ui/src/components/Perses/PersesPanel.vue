<template>
  <div ref="containerRef" class="perses-panel-container"></div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createElement } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { PluginRegistry } from '@perses-dev/plugin-system'
import { dynamicImportPluginLoader } from '@perses-dev/plugin-system'
import { TimeSeriesChart } from '@perses-dev/panels-plugin'
import { usePerses } from '@/composables/usePerses'
import { buildPersesTheme } from '@/theme/persesTheme'
import { OpenNMSPlugin } from '@/datasource/opennms'
import type { OpenNMSQuerySpec, OpenNMSBatchQuerySpec } from '@/datasource/opennms'

// Build a PluginLoader that eagerly provides the TimeSeriesChart panel plugin
// and the OpenNMS time-series query plugin.
const pluginLoader = dynamicImportPluginLoader([
  {
    resource: {
      kind: 'PluginModule' as const,
      metadata: { name: 'panels-plugin' },
      spec: {
        plugins: [
          { pluginType: 'Panel' as const, kind: 'TimeSeriesChart', display: { name: 'Time Series Chart' } }
        ]
      }
    },
    importPlugin: () => Promise.resolve({ TimeSeriesChart })
  },
  {
    resource: {
      kind: 'PluginModule' as const,
      metadata: { name: 'opennms-datasource' },
      spec: {
        plugins: [
          { pluginType: 'TimeSeriesQuery' as const, kind: OpenNMSPlugin.kind, display: { name: 'OpenNMS' } }
        ]
      }
    },
    importPlugin: () => Promise.resolve({ [OpenNMSPlugin.kind]: OpenNMSPlugin.plugin })
  }
])

interface Props {
  title: string
  queries: Array<OpenNMSQuerySpec | OpenNMSBatchQuerySpec>
  yAxisLabel?: string
  seriesOverrides?: Array<{ name: string; color?: string; type?: 'line' | 'area' | 'stack' }>
}

const props = defineProps<Props>()
const containerRef = ref<HTMLElement | null>(null)

// TimeSeriesChart.PanelComponent is the actual React component
const PanelComponent = TimeSeriesChart.PanelComponent

const panelSpec = computed(() => ({
  kind: 'TimeSeriesChart' as const,
  spec: {
    queries: props.queries.map(q => ({
      kind: OpenNMSPlugin.kind,
      spec: q
    })),
    yAxis: props.yAxisLabel ? { label: props.yAxisLabel } : undefined,
    visual: props.seriesOverrides ? { seriesOverrides: props.seriesOverrides } : undefined
  }
}))

usePerses(containerRef, panelSpec, (spec) => {
  const theme = buildPersesTheme()
  return createElement(
    ThemeProvider,
    { theme },
    createElement(
      PluginRegistry,
      { pluginLoader },
      createElement(PanelComponent as any, { spec: spec.spec as any })
    )
  )
})
</script>

<style scoped>
.perses-panel-container {
  width: 100%;
  height: 300px;
}
</style>
