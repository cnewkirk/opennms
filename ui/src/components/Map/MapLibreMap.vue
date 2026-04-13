<template>
  <div class="geo-map">
    <!-- Overlay controls positioned above the map canvas -->
    <MapSearch class="map-search-bar" @fly-to-node="flyTo" @set-bounding-box="setBoundingBox" />
    <SeverityFilter class="map-severity-bar" />

    <!-- Edge toggle button -->
    <button
      class="map-edge-toggle"
      :class="{ 'map-edge-toggle--active': edgesVisible }"
      @click="toggleEdges"
      :disabled="edgesLoading"
      :title="edgesVisible ? 'Hide topology links' : 'Show topology links'"
    >
      <span v-if="edgesLoading">Loading…</span>
      <span v-else>{{ edgesVisible ? 'Hide Links' : 'Show Links' }}</span>
    </button>

    <!-- MapLibre renders into this div -->
    <div ref="mapEl" class="geo-map__canvas" />

    <!-- Overlay: popup and tooltip render here, positioned relative to the map container -->
    <div class="geo-map__overlay">
      <MapNodePopup
        v-if="popupNode"
        :node="popupNode.node"
        :x="popupNode.x"
        :y="popupNode.y"
        @close="popupNode = null"
      />
      <TopologyEdgeTooltip :tooltip="edgeTooltip" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MapSearch from './MapSearch.vue'
import SeverityFilter from './SeverityFilter.vue'
import MapNodePopup from './MapNodePopup.vue'
import TopologyEdgeTooltip from '@/components/Topology/TopologyEdgeTooltip.vue'
import useMapLibre from '@/composables/useMapLibre'

const mapEl = ref<HTMLElement | null>(null)
const { popupNode, edgesVisible, edgesLoading, edgeTooltip, flyTo, setBoundingBox, toggleEdges, invalidateSize } = useMapLibre(mapEl)

// Exposed for Map.vue's resize debounce
const invalidateSizeFn = () => invalidateSize()
defineExpose({ invalidateSizeFn })
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.geo-map {
  height: 100%;
  position: relative;
  overflow: hidden;

  &__canvas {
    position: absolute;
    inset: 0;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    // Children (popup, tooltip) re-enable pointer events individually
    > * { pointer-events: auto; }
  }
}

.map-search-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 200;
}

.map-edge-toggle {
  position: absolute;
  top: 10px;
  right: 60px; // to the left of MapLibre zoom controls
  z-index: 200;
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var($surface);
  border: 2px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  color: var($primary-text-on-surface);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: var($primary); }

  &--active {
    background: var($primary);
    color: var($primary-text-on-color);
    border-color: var($primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
