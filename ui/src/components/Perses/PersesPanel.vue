<template>
  <div class="perses-panel-wrapper">
    <div ref="containerRef" class="perses-panel-container"></div>
    <Transition name="pp-fade">
      <div v-if="loading" class="perses-panel-loader" aria-label="Loading">
        <svg class="perses-panel-loader__icon" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true">
          <defs>
            <linearGradient id="pp-g1" x1="38.51" y1="67.61" x2="-3.17" y2="25.53" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#0081ad" /><stop offset="1" stop-color="#14d1df" />
            </linearGradient>
            <linearGradient id="pp-g2" x1="38.62" y1="67.5" x2="-3.06" y2="25.41" xlink:href="#pp-g1" />
            <linearGradient id="pp-g3" x1="25.87" y1="-3" x2="65.55" y2="37.08" xlink:href="#pp-g1" />
            <linearGradient id="pp-g4" x1="25.98" y1="-3.12" x2="65.67" y2="36.97" xlink:href="#pp-g1" />
            <linearGradient id="pp-g5" x1="8.32" y1="8.72" x2="53.79" y2="53.6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#14d1df" /><stop offset="1" stop-color="#85d9a5" />
            </linearGradient>
            <linearGradient id="pp-g6" x1="8.33" y1="8.71" x2="53.81" y2="53.58" xlink:href="#pp-g5" />
          </defs>
          <path fill="url(#pp-g1)" d="M17.61,36a103.5,103.5,0,0,1-11-14,42.82,42.82,0,0,1-2.92-5.32A31.63,31.63,0,0,0,7.89,52.51C8.26,49.1,11.89,43,17.61,36Z" />
          <path fill="url(#pp-g2)" d="M27.2,45.61c-7,5.73-13.07,9.36-16.49,9.72a31.65,31.65,0,0,0,35.83,4.16A49.57,49.57,0,0,1,38.83,55,114.14,114.14,0,0,1,27.2,45.61Z" />
          <path fill="url(#pp-g3)" d="M36,17.61c7-5.72,13.08-9.35,16.49-9.72A31.63,31.63,0,0,0,16.68,3.74,49.16,49.16,0,0,1,24.4,8.23,111.51,111.51,0,0,1,36,17.61Z" />
          <path fill="url(#pp-g4)" d="M55.33,10.71c-.36,3.42-4,9.53-9.72,16.49a105.09,105.09,0,0,1,11,14,43.44,43.44,0,0,1,2.91,5.33A31.65,31.65,0,0,0,55.33,10.71Z" />
          <path fill="url(#pp-g5)" d="M31.61,21.42h0C20.75,11.6,10.93,6,8.44,8.44c-2.88,2.89,5.15,15.6,18,28.4,1.75,1.75,3.5,3.41,5.22,5Z" />
          <path fill="url(#pp-g6)" d="M41.81,31.61h0c-1.56,1.73-3.22,3.48-5,5.23s-3.5,3.41-5.23,5c10.87,9.82,20.68,15.46,23.17,13S51.63,42.48,41.81,31.61Z" />
        </svg>
        <div class="perses-panel-loader__dots">
          <span /><span /><span />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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

.perses-panel-loader {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: none;

  &__icon {
    width: 36px;
    height: 36px;
    animation: pp-pulse 1.6s ease-in-out infinite;
  }

  &__dots {
    display: flex;
    gap: 5px;

    span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #14d1df;
      animation: pp-bounce 1.2s ease-in-out infinite;
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }
}

@keyframes pp-pulse {
  0%, 100% { transform: scale(1);    opacity: 1;    }
  50%       { transform: scale(1.1); opacity: 0.85; }
}

@keyframes pp-bounce {
  0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
  40%           { transform: translateY(-4px); opacity: 1;   }
}

.pp-fade-leave-active { transition: opacity 0.3s ease; }
.pp-fade-leave-to     { opacity: 0; }
</style>
