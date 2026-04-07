<template>
  <div class="topology-toolbar">
    <div class="topology-toolbar__layers">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: allActive }"
        :disabled="store.loading"
        @click="toggleAll"
      >All</button>
      <button
        v-for="layer in store.protocolLayers"
        :key="layer.namespace"
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: store.activeLayers.includes(layer.namespace) }"
        :disabled="store.loading || (store.activeLayers.includes(layer.namespace) && store.activeLayers.length === 1)"
        @click="store.toggleLayer(layer)"
      >{{ layer.label }}</button>
    </div>

    <div v-if="presentProtocols.length" class="topology-toolbar__legend">
      <div
        v-for="p in presentProtocols"
        :key="p"
        class="topology-toolbar__legend-item"
      >
        <svg width="18" height="6" class="topology-toolbar__legend-line">
          <line x1="0" y1="3" x2="18" y2="3" :stroke="getProtocolColor(p)" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <span>{{ p }}</span>
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
        :value="wmStore.pollInterval"
        @change="(e) => wmStore.setPollInterval(Number((e.target as HTMLSelectElement).value))"
        title="Auto-refresh interval"
      >
        <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <span v-if="wmStatusText" class="topology-toolbar__wm-status" :class="{ error: !!wmStore.error }">
        {{ wmStatusText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useDebounceFn } from '@vueuse/core'
import { getProtocolColor } from './protocolColors'

const emit = defineEmits<{
  'save-layout': []
  'reset-layout': []
}>()

const wmStore = useWeathermapStore()

const INTERVAL_OPTIONS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '5m',   value: 300 },
  { label: 'Off',  value: 0 },
]

const wmStatusText = computed(() => {
  if (wmStore.error) return 'Weathermap unavailable'
  if (!wmStore.lastUpdated) return ''
  const secs = Math.round((Date.now() - wmStore.lastUpdated.getTime()) / 1000)
  if (secs < 5) return 'Updated just now'
  if (secs < 120) return `Updated ${secs}s ago`
  return `Updated ${Math.round(secs / 60)}m ago`
})

const store = useTopologyStore()

const presentProtocols = computed<string[]>(() => {
  const seen = new Set<string>()
  for (const e of store.edges) {
    for (const p of (e.protocols ?? [])) seen.add(p)
  }
  return Array.from(seen).sort()
})

const allActive = computed(() =>
  store.protocolLayers.length > 0 &&
  store.protocolLayers.every(l => store.activeLayers.includes(l.namespace))
)

const toggleAll = () => store.setAllLayers(!allActive.value)

const searchText = ref('')

const onSearch = useDebounceFn((val: string | number | undefined) => {
  store.setSearchQuery(String(val ?? ''))
}, 300)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.topology-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 16px;
  flex-shrink: 0;

  &__layers {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 6px;
  }

  &__chip {
    padding: 4px 14px;
    border-radius: 16px;
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

  &__legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 10px;
  }

  &__legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
  }

  &__legend-line {
    flex-shrink: 0;
  }

  &__search {
    width: 260px;
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
    border-radius: 4px;
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
}
</style>
