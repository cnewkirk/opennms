<template>
  <div
    v-if="node"
    class="map-node-popup"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div class="map-node-popup__header">
      <a :href="`${baseHref}${baseNodeUrl}${node.id}`" target="_blank" rel="noopener noreferrer" class="map-node-popup__title">
        {{ node.label }}
      </a>
      <SeverityBadge :severity="severity" />
    </div>

    <div class="map-node-popup__coords">
      {{ latitude }}, {{ longitude }}
    </div>

    <div class="map-node-popup__body">
      <div class="map-node-popup__row">
        <span class="map-node-popup__key">IP Address</span>
        <span>{{ ipAddress || 'N/A' }}</span>
      </div>
      <div class="map-node-popup__row" v-if="node.assetRecord?.description">
        <span class="map-node-popup__key">Description</span>
        <span>{{ node.assetRecord.description }}</span>
      </div>
      <div class="map-node-popup__row" v-if="node.assetRecord?.maintcontract">
        <span class="map-node-popup__key">Maint. Contract</span>
        <span>{{ node.assetRecord.maintcontract }}</span>
      </div>
      <div class="map-node-popup__row" v-if="node.categories?.length">
        <span class="map-node-popup__key">Category</span>
        <span>{{ node.categories[0].name }}</span>
      </div>
    </div>

    <div class="map-node-popup__footer">
      <a :href="topologyLink" class="map-node-popup__topo-link">View in Topology</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, type PropType } from 'vue'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
import { useMenuStore } from '@/stores/menuStore'
import { useMapStore } from '@/stores/mapStore'
import type { Node } from '@/types'

const props = defineProps({
  node: { type: Object as PropType<Node>, default: null },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  ipAddress: { type: String, default: '' }
})

const emit = defineEmits(['close'])

const menuStore = useMenuStore()
const mapStore = useMapStore()

const baseHref = computed(() => menuStore.mainMenu.baseHref ?? '')
const baseNodeUrl = computed(() => menuStore.mainMenu.baseNodeUrl ?? 'element/node.jsp?node=')

const severity = computed(() => {
  if (!props.node) return 'NORMAL'
  const sevMap = mapStore.getNodeAlarmSeverityMap()
  return sevMap[props.node.label] ?? 'NORMAL'
})

const latitude = computed(() => {
  const v = parseFloat(String(props.node?.assetRecord?.latitude))
  return isNaN(v) ? '' : v.toFixed(6)
})

const longitude = computed(() => {
  const v = parseFloat(String(props.node?.assetRecord?.longitude))
  return isNaN(v) ? '' : v.toFixed(6)
})

const topologyLink = computed(() =>
  `${baseHref.value}topology?provider=Enhanced Linkd&focus-vertices=${props.node?.id}`
)

// Dismiss on Escape
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.map-node-popup {
  position: absolute;
  z-index: 200;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  width: 320px;
  transform: translate(12px, -50%);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px 8px;
    border-bottom: 1px solid var($border-on-surface);
  }

  &__title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var($primary);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &:hover { text-decoration: underline; }
  }

  &__coords {
    padding: 4px 14px;
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    font-family: monospace;
  }

  &__body {
    padding: 4px 14px 8px;
  }

  &__row {
    display: flex;
    gap: 8px;
    font-size: 0.78rem;
    padding: 2px 0;
    color: var($primary-text-on-surface);
  }

  &__key {
    font-weight: 600;
    min-width: 110px;
    color: var($secondary-text-on-surface);
    flex-shrink: 0;
  }

  &__footer {
    padding: 8px 14px 10px;
    border-top: 1px solid var($border-on-surface);
    font-size: 0.78rem;
  }

  &__topo-link {
    color: var($primary);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}
</style>
