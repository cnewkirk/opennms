<template>
  <div ref="containerRef" class="perses-canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { createElement } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { PluginRegistry, dynamicImportPluginLoader } from '@perses-dev/plugin-system'
import { DashboardProvider, Dashboard } from '@perses-dev/dashboards'
import { TimeSeriesChart } from '@perses-dev/panels-plugin'
import { usePerses } from '@/composables/usePerses'
import { buildPersesTheme } from '@/theme/persesTheme'
import { OpenNMSPlugin } from '@/datasource/opennms'
import type { DashboardResource } from '@perses-dev/core'

// Build a PluginLoader that provides the TimeSeriesChart panel plugin
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
  dashboardResource: DashboardResource
  isEditMode?: boolean
  /**
   * Called when the user saves the dashboard.
   * NOTE: DashboardProvider (0.50.x) does not accept an onSave callback directly —
   * it manages saves internally. This prop is reserved for P3-T3 (DashboardViewer)
   * which will wire save via the REST API after Perses emits a save event.
   */
  onSave?: (resource: DashboardResource) => Promise<void>
}

const props = defineProps<Props>()
const containerRef = ref<HTMLElement | null>(null)

// toRef keeps canvasSpec reactive to prop changes
const canvasSpec = toRef(() => ({
  kind: 'PersesCanvas' as const,
  spec: {
    resource: props.dashboardResource,
    isEditMode: props.isEditMode ?? false
  }
}))

usePerses(containerRef, canvasSpec as any, (_spec) => {
  const theme = buildPersesTheme()
  return createElement(
    ThemeProvider,
    { theme },
    createElement(
      PluginRegistry,
      { pluginLoader },
      createElement(
        DashboardProvider,
        {
          initialState: {
            dashboardResource: props.dashboardResource,
            isEditMode: props.isEditMode ?? false
          }
        },
        createElement(Dashboard, null)
      )
    )
  )
})
</script>

<style scoped>
.perses-canvas-container {
  width: 100%;
  min-height: 500px;
}
</style>
