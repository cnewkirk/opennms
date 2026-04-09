<template>
  <div class="edge-graphs">
    <div class="edge-graphs__divider"></div>

    <!-- Loading shimmer -->
    <template v-if="loading">
      <div v-for="n in 2" :key="n" class="edge-graphs__shimmer"></div>
    </template>

    <!-- Data unavailable (no iface info) -->
    <div v-else-if="!hasSrcIface && !hasTgtIface" class="edge-graphs__unavailable">
      Interface data unavailable
    </div>

    <!-- Charts -->
    <template v-else>
      <div v-if="hasSrcIface" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">{{ srcIfaceLabel }}</div>
        <canvas ref="srcUtilCanvas" class="edge-graphs__canvas"></canvas>
        <div class="edge-graphs__chart-legend">
          <span class="edge-graphs__legend-in">RX {{ latestInBps(srcData) }}</span>
          <span class="edge-graphs__legend-out">TX {{ latestOutBps(srcData) }}</span>
        </div>
      </div>

      <div v-if="hasTgtIface" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">{{ tgtIfaceLabel }}</div>
        <canvas ref="tgtUtilCanvas" class="edge-graphs__canvas"></canvas>
        <div class="edge-graphs__chart-legend">
          <span class="edge-graphs__legend-in">RX {{ latestInBps(tgtData) }}</span>
          <span class="edge-graphs__legend-out">TX {{ latestOutBps(tgtData) }}</span>
        </div>
      </div>

      <div v-if="errorsData" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">Errors</div>
        <canvas ref="errCanvas" class="edge-graphs__canvas"></canvas>
      </div>

      <div v-if="discardsData" class="edge-graphs__chart-block">
        <div class="edge-graphs__chart-label">Discards</div>
        <canvas ref="discCanvas" class="edge-graphs__canvas"></canvas>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  Chart, LineElement, PointElement, LineController,
  CategoryScale, LinearScale, Filler
} from 'chart.js'
import { EdgeLabelData } from '@/stores/weathermapStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import {
  fetchInterfaceTimeSeries,
  fetchInterfaceErrorsDiscards
} from '@/services/measurementsService'
import { formatBitsPerSec } from './protocolColors'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler)

const props = defineProps<{ labelData: EdgeLabelData; srcLabel?: string; tgtLabel?: string }>()

const wmStore = useWeathermapStore()

const loading   = ref(true)
const srcData   = ref<{ inBps: number[]; outBps: number[] } | null>(null)
const tgtData   = ref<{ inBps: number[]; outBps: number[] } | null>(null)
const errorsData   = ref<{ src: number[] | null; tgt: number[] | null } | null>(null)
const discardsData = ref<{ src: number[] | null; tgt: number[] | null } | null>(null)

const hasSrcIface = computed(() => !!props.labelData.srcIface && props.labelData.srcNodeId != null)
const hasTgtIface = computed(() => !!props.labelData.tgtIface && props.labelData.tgtNodeId != null)

const srcIfaceName = computed(() =>
  props.labelData.srcIface?.ifName ?? props.labelData.srcIface?.ifDescr ?? null
)
const tgtIfaceName = computed(() =>
  props.labelData.tgtIface?.ifName ?? props.labelData.tgtIface?.ifDescr
  ?? props.labelData.remotePortId ?? null
)
const srcIfaceLabel = computed(() => {
  const node  = props.srcLabel ?? 'source'
  const iface = srcIfaceName.value
  return iface ? `${node} — ${iface}` : node
})
const tgtIfaceLabel = computed(() => {
  const node  = props.tgtLabel ?? 'target'
  const iface = tgtIfaceName.value
  return iface ? `${node} — ${iface}` : node
})

const LOOKBACK_MS = 2 * 60 * 60 * 1_000  // 2 hours

const latestInBps  = (d: { inBps: number[]; outBps: number[] } | null) =>
  d ? `${formatBitsPerSec(d.inBps[d.inBps.length - 1] ?? 0)}bps` : ''
const latestOutBps = (d: { inBps: number[]; outBps: number[] } | null) =>
  d ? `${formatBitsPerSec(d.outBps[d.outBps.length - 1] ?? 0)}bps` : ''

// Canvas refs and chart instances
const srcUtilCanvas = ref<HTMLCanvasElement | null>(null)
const tgtUtilCanvas = ref<HTMLCanvasElement | null>(null)
const errCanvas     = ref<HTMLCanvasElement | null>(null)
const discCanvas    = ref<HTMLCanvasElement | null>(null)
const charts: Chart[] = []

let controller: AbortController | null = null

const getWindow = (): { start: Date; end: Date } => {
  const endMs = wmStore.selectedTime ? wmStore.selectedTime.getTime() : Date.now()
  return { start: new Date(endMs - LOOKBACK_MS), end: new Date(endMs) }
}

const buildSparkline = (
  canvas: HTMLCanvasElement,
  datasets: { label: string; data: number[]; borderColor: string; backgroundColor?: string }[],
  labels: string[]
): Chart => {
  return new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: datasets.map(d => ({
      ...d,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false
    })) },
    options: {
      animation: false as const,
      responsive: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false, min: 0 }
      }
    }
  })
}

const fetchData = async () => {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  srcData.value = null
  tgtData.value = null
  errorsData.value   = null
  discardsData.value = null

  const { start, end } = getWindow()
  const { signal } = controller

  try {
    const [srcTs, tgtTs, srcErr, tgtErr] = await Promise.allSettled([
      hasSrcIface.value
        ? fetchInterfaceTimeSeries(props.labelData.srcNodeId!, props.labelData.srcIface!, start, end, 60_000, signal)
        : Promise.resolve(null),
      hasTgtIface.value
        ? fetchInterfaceTimeSeries(props.labelData.tgtNodeId!, props.labelData.tgtIface!, start, end, 60_000, signal)
        : Promise.resolve(null),
      hasSrcIface.value
        ? fetchInterfaceErrorsDiscards(props.labelData.srcNodeId!, props.labelData.srcIface!, start, end, 60_000, signal)
        : Promise.resolve(null),
      hasTgtIface.value
        ? fetchInterfaceErrorsDiscards(props.labelData.tgtNodeId!, props.labelData.tgtIface!, start, end, 60_000, signal)
        : Promise.resolve(null)
    ])

    if (srcTs.status === 'fulfilled' && srcTs.value) srcData.value = srcTs.value
    if (tgtTs.status === 'fulfilled' && tgtTs.value) tgtData.value = tgtTs.value

    const srcErrVal = srcErr.status === 'fulfilled' ? srcErr.value : null
    const tgtErrVal = tgtErr.status === 'fulfilled' ? tgtErr.value : null

    // Combine in+out into a single "total" series per endpoint for errors and discards.
    // Both directions ride the same physical interface; users care about the aggregate.
    const sumOrNull = (a: number[] | null, b: number[] | null): number[] | null => {
      if (!a && !b) return null
      const len = (a ?? b)!.length
      return Array.from({ length: len }, (_, i) => (a?.[i] ?? 0) + (b?.[i] ?? 0))
    }

    const srcErrors   = sumOrNull(srcErrVal?.ifInErrors ?? null,   srcErrVal?.ifOutErrors ?? null)
    const tgtErrors   = sumOrNull(tgtErrVal?.ifInErrors ?? null,   tgtErrVal?.ifOutErrors ?? null)
    const srcDiscards = sumOrNull(srcErrVal?.ifInDiscards ?? null, srcErrVal?.ifOutDiscards ?? null)
    const tgtDiscards = sumOrNull(tgtErrVal?.ifInDiscards ?? null, tgtErrVal?.ifOutDiscards ?? null)

    if (srcErrors || tgtErrors) {
      errorsData.value = { src: srcErrors, tgt: tgtErrors }
    }
    if (srcDiscards || tgtDiscards) {
      discardsData.value = { src: srcDiscards, tgt: tgtDiscards }
    }
  } catch {
    // Silently disappear on error — do not show error UI in tooltip
  } finally {
    loading.value = false
  }
}

// Build/rebuild charts after data is fetched and DOM is updated
watch(loading, async (isLoading) => {
  if (isLoading) return
  await nextTick()
  charts.forEach(c => c.destroy())
  charts.length = 0

  const n = srcData.value?.inBps.length ?? tgtData.value?.inBps.length ?? 0
  const labels = Array.from({ length: n }, (_, i) => String(i))

  if (srcData.value && srcUtilCanvas.value) {
    charts.push(buildSparkline(srcUtilCanvas.value, [
      { label: '↑ in',  data: srcData.value.inBps,  borderColor: '#48BB78' },
      { label: '↓ out', data: srcData.value.outBps, borderColor: '#4C9BE8' }
    ], labels))
  }
  if (tgtData.value && tgtUtilCanvas.value) {
    charts.push(buildSparkline(tgtUtilCanvas.value, [
      { label: '↑ in',  data: tgtData.value.inBps,  borderColor: '#48BB78' },
      { label: '↓ out', data: tgtData.value.outBps, borderColor: '#4C9BE8' }
    ], labels))
  }
  if (errorsData.value && errCanvas.value) {
    const errDs = []
    if (errorsData.value.src) errDs.push({ label: 'src', data: errorsData.value.src, borderColor: '#FC8181' })
    if (errorsData.value.tgt) errDs.push({ label: 'tgt', data: errorsData.value.tgt, borderColor: '#ED8936' })
    if (errDs.length) charts.push(buildSparkline(errCanvas.value, errDs, labels))
  }
  if (discardsData.value && discCanvas.value) {
    const discDs = []
    if (discardsData.value.src) discDs.push({ label: 'src', data: discardsData.value.src, borderColor: '#ECC94B' })
    if (discardsData.value.tgt) discDs.push({ label: 'tgt', data: discardsData.value.tgt, borderColor: '#F6AD55' })
    if (discDs.length) charts.push(buildSparkline(discCanvas.value, discDs, labels))
  }
})

// Re-fetch when weathermap refreshes (live mode only)
watch(() => wmStore.lastUpdated, () => {
  if (wmStore.selectedTime === null) fetchData()
})

onMounted(() => fetchData())
onUnmounted(() => {
  controller?.abort()
  charts.forEach(c => c.destroy())
  charts.length = 0
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.edge-graphs {
  margin-top: 4px;

  &__divider {
    height: 1px;
    background: var($border-on-surface);
    margin: 6px 0;
  }

  &__shimmer {
    height: 60px;
    border-radius: vars.$border-radius-sm;
    background: linear-gradient(90deg, var($shade-2, rgba(255,255,255,0.06)) 25%, var($shade-3, rgba(255,255,255,0.12)) 50%, var($shade-2, rgba(255,255,255,0.06)) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    margin-bottom: 8px;
  }

  &__unavailable {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    padding: 4px 0;
  }

  &__chart-block {
    margin-bottom: 8px;
  }

  &__chart-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
    margin-bottom: 2px;
  }

  &__canvas {
    display: block;
    width: 100% !important;
    height: 48px !important;
  }

  &__chart-legend {
    display: flex;
    gap: 10px;
    font-size: 0.68rem;
    margin-top: 2px;
  }

  &__legend-in  { color: #48BB78; }
  &__legend-out { color: #4C9BE8; }
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
