<template>
  <div class="topology-toolbar">
    <div class="topology-toolbar__layers" ref="layersPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: layersPanelOpen }"
        :disabled="store.loading"
        @click="layersPanelOpen = !layersPanelOpen"
      >{{ layersButtonLabel }}</button>
      <div v-if="layersPanelOpen" class="topology-toolbar__layers-panel">
        <label class="topology-toolbar__layer-row">
          <input type="checkbox" :checked="allActive" :disabled="store.loading" @change="toggleAll"> All
        </label>
        <hr class="topology-toolbar__layer-divider">
        <label
          v-for="layer in store.protocolLayers"
          :key="layer.namespace"
          class="topology-toolbar__layer-row"
        >
          <input
            type="checkbox"
            :checked="store.activeLayers.includes(layer.namespace)"
            :disabled="store.loading || (store.activeLayers.includes(layer.namespace) && store.activeLayers.length === 1)"
            @change="store.toggleLayer(layer)"
          >
          <span class="topology-toolbar__layer-dot" :style="{ backgroundColor: getProtocolColor(layer.label) }"></span>
          {{ layer.label }}
        </label>
      </div>
    </div>

    <FeatherInput
      v-model="searchText"
      label="Search nodes"
      class="topology-toolbar__search"
      @update:modelValue="onSearch"
    />

    <div class="topology-toolbar__layout-actions">
      <FeatherButton text @click="emit('save-layout')" title="Save current node positions to this browser">
        Save Layout
      </FeatherButton>
      <FeatherButton text @click="emit('reset-layout')" title="Clear saved positions and re-run auto-layout">
        Reset Layout
      </FeatherButton>
    </div>

    <div class="topology-toolbar__weathermap">
      <button
        type="button"
        class="topology-toolbar__chip"
        :disabled="wmStore.loading"
        title="Refresh weathermap data"
        @click="wmStore.refresh()"
      >{{ wmStore.loading ? '…' : '↺' }} Weathermap</button>

      <select
        class="topology-toolbar__interval"
        v-model.number="intervalModel"
        title="Auto-refresh interval"
      >
        <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <span v-if="wmStatusText" class="topology-toolbar__wm-status" :class="{ error: !!wmStore.error }">
        {{ wmStatusText }}
      </span>
    </div>

    <div class="topology-toolbar__edge-labels" ref="edgeLabelPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: edgeLabelPanelOpen }"
        @click="edgeLabelPanelOpen = !edgeLabelPanelOpen"
      >Edge Labels ▾</button>
      <div v-if="edgeLabelPanelOpen" class="topology-toolbar__edge-label-panel">
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showUtilization"> Utilization
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showLocalPort"> Local Port
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showRemotePort"> Remote Port
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showIp"> IP Addresses
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showMac"> MAC Address
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showSpeed"> Speed
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useDebounceFn, useNow, onClickOutside } from '@vueuse/core'
import { getProtocolColor } from './protocolColors'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'

const emit = defineEmits<{
  'save-layout': []
  'reset-layout': []
}>()

const store = useTopologyStore()
const wmStore = useWeathermapStore()
const elStore = useEdgeLabelStore()
const now = useNow({ interval: 5000 })

// Layers dropdown
const layersPanelOpen = ref(false)
const layersPanelRef = ref<HTMLElement | null>(null)
onClickOutside(layersPanelRef, () => { layersPanelOpen.value = false })

// Edge Labels dropdown
const edgeLabelPanelOpen = ref(false)
const edgeLabelPanelRef = ref<HTMLElement | null>(null)
onClickOutside(edgeLabelPanelRef, () => { edgeLabelPanelOpen.value = false })

const INTERVAL_OPTIONS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '5m',   value: 300 },
  { label: 'Off',  value: 0 },
]

const wmStatusText = computed(() => {
  if (wmStore.error) return 'Weathermap unavailable'
  if (!wmStore.lastUpdated) return ''
  const secs = Math.round((now.value.getTime() - wmStore.lastUpdated.getTime()) / 1000)
  if (secs < 5) return 'Updated just now'
  if (secs < 120) return `Updated ${secs}s ago`
  return `Updated ${Math.round(secs / 60)}m ago`
})

const intervalModel = computed({
  get: () => wmStore.pollInterval,
  set: (v: number) => wmStore.setPollInterval(v)
})

const allActive = computed(() =>
  store.protocolLayers.length > 0 &&
  store.protocolLayers.every(l => store.activeLayers.includes(l.namespace))
)

const layersButtonLabel = computed(() => {
  if (allActive.value) return 'All Layers ▾'
  const n = store.activeLayers.length
  return `${n} Layer${n !== 1 ? 's' : ''} ▾`
})

const toggleAll = () => store.setAllLayers(!allActive.value)

const searchText = ref('')

const onSearch = useDebounceFn((val: string | number | undefined) => {
  store.setSearchQuery(String(val ?? ''))
}, 300)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.topology-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 16px;
  flex-shrink: 0;

  &__layers {
    position: relative;
    padding-top: 8px;
  }

  &__layers-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    padding: 8px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 160px;
  }

  &__layer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    padding: 3px 0;
    cursor: pointer;
    white-space: nowrap;

    input[type='checkbox'] {
      cursor: pointer;
      &:disabled { cursor: not-allowed; opacity: 0.4; }
    }
  }

  &__layer-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__layer-divider {
    border: none;
    border-top: 1px solid var($border-on-surface);
    margin: 4px 0;
  }

  &__chip {
    padding: 4px 14px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 2px solid var($primary);
    background: transparent;
    color: var($primary);
    transition: background 0.15s, color 0.15s;
    line-height: 1.4;

    &.active {
      background: var($primary);
      color: #fff;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.8;
    }
  }

  &__search {
    width: 220px;
  }

  &__layout-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding-top: 8px;
  }

  &__weathermap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    margin-left: 8px;
  }

  &__interval {
    padding: 4px 8px;
    border-radius: vars.$border-radius-surface;
    border: 1px solid var($border-on-surface);
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.8rem;
    cursor: pointer;
  }

  &__wm-status {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;

    &.error { color: var($error); }
  }

  &__edge-labels {
    position: relative;
    padding-top: 8px;
  }

  &__edge-label-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    padding: 8px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 150px;
  }

  &__edge-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    padding: 3px 0;
    cursor: pointer;
    white-space: nowrap;

    input[type='checkbox'] {
      cursor: pointer;
    }
  }
}
</style>
