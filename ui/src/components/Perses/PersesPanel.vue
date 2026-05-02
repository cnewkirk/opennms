<template>
  <div class="perses-panel-wrapper">
    <div ref="containerRef" class="perses-panel-container"></div>
    <Transition name="pp-fade">
      <PanelLoader v-if="loading" :size="36" overlay />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import { useAppStore } from '@/stores/appStore'
import { createElement, useRef, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import {
  PluginRegistry,
  TimeRangeProvider,
  dynamicImportPluginLoader,
  VariableContext,
  BuiltinVariableContext,
  DatasourceStoreContext
} from '@perses-dev/plugin-system'
import { ChartsProvider, generateChartsTheme } from '@perses-dev/components'
import { OpenNMSDataQueriesProvider } from '@/datasource/opennms/OpenNMSDataQueriesProvider'
import { TimeSeriesChart } from '@perses-dev/panels-plugin'
import { usePerses } from '@/composables/usePerses'
import { buildPersesTheme } from '@/theme/persesTheme'
import { OpenNMSPlugin } from '@/datasource/opennms'
import type { OpenNMSQuerySpec, OpenNMSBatchQuerySpec } from '@/datasource/opennms'
import type { AbsoluteTimeRange } from '@perses-dev/core'

// Stable QueryClient — not recreated on re-renders
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
})

// Pre-seed the plugin cache so usePlugin/usePlugins never needs to run async
// queries to discover our plugins. Bypasses the dynamicImportPluginLoader
// async-loading path which can race against Vue re-renders.
queryClient.setQueryData(['getPlugin', 'Panel', 'TimeSeriesChart'], TimeSeriesChart)
queryClient.setQueryData(['getPlugin', 'TimeSeriesQuery', OpenNMSPlugin.kind], OpenNMSPlugin.plugin)

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
  /** Absolute time range for the query (unix ms). Required for data fetching. */
  timeRange: AbsoluteTimeRange
  yAxisLabel?: string
  seriesOverrides?: Array<{ name: string; color?: string; type?: 'line' | 'area' | 'stack' }>
}

const props = defineProps<Props>()
const containerRef = ref<HTMLElement | null>(null)

const loading = ref(true)
let loaderObserver: MutationObserver | null = null
let loaderFallback: ReturnType<typeof setTimeout> | null = null

const stopLoader = () => {
  loading.value = false
  loaderObserver?.disconnect()
  loaderObserver = null
  if (loaderFallback !== null) { clearTimeout(loaderFallback); loaderFallback = null }
}

onMounted(() => {
  const container = containerRef.value
  if (!container) { loading.value = false; return }
  loaderObserver = new MutationObserver(() => {
    if (container.querySelector('canvas')) stopLoader()
  })
  loaderObserver.observe(container, { childList: true, subtree: true })
  loaderFallback = setTimeout(stopLoader, 15000)
})

onUnmounted(() => stopLoader())

// TimeSeriesChart.PanelComponent requires contentDimensions. This wrapper
// measures its own size via ResizeObserver and injects it into the panel.
function AutoSizedPanel(panelProps: {
  spec: Record<string, unknown>
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null)
  const PanelComponent = TimeSeriesChart.PanelComponent

  useEffect(() => {
    const el = divRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setDims({ width: rect.width, height: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return createElement(
    'div',
    { ref: divRef, style: { width: '100%', height: '100%' } },
    dims
      ? createElement(PanelComponent as any, {
          spec: panelProps.spec,
          contentDimensions: dims
        })
      : null
  )
}

const appStore = useAppStore()

const panelSpec = computed(() => ({
  kind: 'TimeSeriesChart' as const,
  spec: {
    queries: props.queries.map(q => ({ kind: OpenNMSPlugin.kind, spec: q })),
    yAxis: props.yAxisLabel ? { label: props.yAxisLabel } : undefined,
    visual: props.seriesOverrides ? { seriesOverrides: props.seriesOverrides } : undefined,
  }
}))

const { rerender } = usePerses(containerRef, panelSpec, (spec) => {
  const muiTheme = buildPersesTheme()
  const chartsTheme = generateChartsTheme(muiTheme, {})
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      ThemeProvider,
      { theme: muiTheme },
      createElement(
        ChartsProvider,
        { chartsTheme },
        createElement(
          PluginRegistry,
          { pluginLoader },
          createElement(
            TimeRangeProvider,
            { timeRange: props.timeRange },
            // Stub contexts: our plugin fetches data directly and never uses
          // datasource/variable lookups, but the hooks are called unconditionally.
          createElement(VariableContext.Provider, { value: { state: {} } as any },
            createElement(BuiltinVariableContext.Provider, { value: { variables: [] } as any },
              createElement(DatasourceStoreContext.Provider, { value: {
                getDatasource: () => Promise.reject(new Error('no datasource store')),
                getDatasourceClient: () => Promise.reject(new Error('no datasource store')),
                listDatasourceSelectItems: () => Promise.resolve([]),
                getLocalDatasources: () => ({}),
                setLocalDatasources: () => {},
                getSavedDatasources: () => ({}),
                setSavedDatasources: () => {}
              } as any },
                createElement(
                  OpenNMSDataQueriesProvider,
                  { queries: props.queries },
                  createElement(AutoSizedPanel, { spec: spec.spec as Record<string, unknown> })
                )
              )
            )
          )
          )
        )
      )
    )
  )
})

// Rebuild MUI/ECharts theme when dark/light mode changes
watch(() => appStore.theme, rerender)
</script>

<style scoped>
/*
 * Let the parent control height. The AutoSizedPanel ResizeObserver reads
 * this element's actual size and passes it as contentDimensions to the
 * Perses PanelComponent. A fixed pixel height here would override any
 * parent constraint and cause the React tree to overflow its container.
 */
.perses-panel-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 80px;
}

.perses-panel-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.pp-fade-leave-active { transition: opacity 0.3s ease; }
.pp-fade-leave-to     { opacity: 0; }
</style>
