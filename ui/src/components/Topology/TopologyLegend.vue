<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div v-if="!dismissed" class="topo-legend">
    <div class="topo-legend__header">
      <span class="topo-legend__title">Legend</span>
      <div class="topo-legend__actions">
        <button
          type="button"
          class="topo-legend__btn"
          :title="collapsed ? 'Expand' : 'Collapse'"
          @click="collapsed = !collapsed"
        >{{ collapsed ? '▸' : '▾' }}</button>
        <button
          type="button"
          class="topo-legend__btn"
          title="Dismiss"
          @click="dismissed = true"
        >✕</button>
      </div>
    </div>

    <div v-if="!collapsed" class="topo-legend__body">
      <div class="topo-legend__section">Link Utilization</div>
      <div v-for="item in UTIL_ITEMS" :key="item.label" class="topo-legend__row">
        <span class="topo-legend__swatch" :style="{ backgroundColor: item.color }"></span>
        <span class="topo-legend__label">{{ item.label }}</span>
      </div>

      <div class="topo-legend__divider"></div>

      <div class="topo-legend__section">No Weathermap Data</div>
      <div class="topo-legend__row">
        <span class="topo-legend__swatch topo-legend__swatch--protocol"></span>
        <span class="topo-legend__label">Protocol color</span>
      </div>

      <div class="topo-legend__divider"></div>

      <div class="topo-legend__section">Reference Bandwidth</div>
      <div class="topo-legend__row topo-legend__row--select">
        <select
          class="topo-legend__select"
          :value="selectedPreset"
          @change="onPresetChange"
        >
          <option
            v-for="p in PRESETS"
            :key="p.label"
            :value="p.bps ?? 'ifspeed'"
          >{{ p.label }}</option>
        </select>
      </div>
      <div class="topo-legend__hint">
        Utilization % is relative to this value.
        Set to match your committed or expected link rate.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { utilizationColor } from './protocolColors'
import { useWeathermapStore } from '@/stores/weathermapStore'

const COLLAPSED_KEY = 'opennms-topology-legend-collapsed'

const collapsed = ref(localStorage.getItem(COLLAPSED_KEY) === 'true')
const dismissed = ref(false)

watch(collapsed, v => localStorage.setItem(COLLAPSED_KEY, String(v)))

const wmStore = useWeathermapStore()

const PRESETS: { label: string; bps: number | null }[] = [
  { label: 'Interface speed (default)', bps: null          },
  { label: '10 Gbps',                   bps: 10_000_000_000 },
  { label: '1 Gbps',                    bps:  1_000_000_000 },
  { label: '500 Mbps',                  bps:    500_000_000 },
  { label: '200 Mbps',                  bps:    200_000_000 },
  { label: '100 Mbps',                  bps:    100_000_000 },
]

const selectedPreset = computed(() =>
  wmStore.referenceBps === null ? 'ifspeed' : wmStore.referenceBps
)

const onPresetChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  wmStore.setReferenceBps(val === 'ifspeed' ? null : Number(val))
  // Trigger a weathermap refresh so colors update immediately
  wmStore.refresh()
}

const UTIL_ITEMS = [
  { color: utilizationColor(0),   label: 'Idle (0 bps)' },
  { color: utilizationColor(10),  label: 'Low  (< 50%)' },
  { color: utilizationColor(60),  label: 'Moderate (50–75%)' },
  { color: utilizationColor(80),  label: 'High  (75–90%)' },
  { color: utilizationColor(95),  label: 'Critical  (≥ 90%)' },
]
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.topo-legend {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 10;
  pointer-events: all;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  min-width: 175px;
  font-size: 0.72rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    gap: 8px;
  }

  &__title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var($primary-text-on-surface);
  }

  &__actions {
    display: flex;
    gap: 2px;
  }

  &__btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    font-size: 0.68rem;
    padding: 1px 4px;
    border-radius: 2px;
    line-height: 1;

    &:hover {
      color: var($primary-text-on-surface);
      background: var($shade-2, rgba(255,255,255,0.08));
    }
  }

  &__body {
    padding: 4px 8px 8px;
    border-top: 1px solid var($border-on-surface);
  }

  &__section {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var($secondary-text-on-surface);
    margin: 6px 0 4px;

    &:first-child {
      margin-top: 2px;
    }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 2px 0;

    &--select {
      padding: 3px 0;
    }
  }

  &__swatch {
    width: 22px;
    height: 4px;
    border-radius: 2px;
    flex-shrink: 0;

    &--protocol {
      background: linear-gradient(
        to right,
        #4C9BE8 0%, #4C9BE8 33%,
        #48BB78 33%, #48BB78 66%,
        #ED8936 66%, #ED8936 100%
      );
    }
  }

  &__label {
    color: var($secondary-text-on-surface);
    white-space: nowrap;
  }

  &__select {
    width: 100%;
    background: var($shade-1, rgba(255,255,255,0.04));
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    color: var($primary-text-on-surface);
    font-size: 0.7rem;
    padding: 2px 4px;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: var($primary);
    }
  }

  &__hint {
    font-size: 0.62rem;
    color: var($secondary-text-on-surface);
    line-height: 1.4;
    padding: 2px 0 0;
    opacity: 0.8;
  }

  &__divider {
    height: 1px;
    background: var($border-on-surface);
    margin: 6px 0;
  }
}
</style>
