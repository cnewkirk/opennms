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
  <div
    v-if="tooltip"
    class="edge-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="edge-tooltip__endpoints">
      {{ tooltip.srcLabel }} ↔ {{ tooltip.tgtLabel }}
    </div>
    <div
      v-for="p in tooltip.protocols"
      :key="p"
      class="edge-tooltip__protocol"
    >
      <span
        class="edge-tooltip__chip"
        :style="{ backgroundColor: getProtocolColor(p) }"
      ></span>
      {{ p }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { getProtocolColor } from './protocolColors'

export interface EdgeTooltipState {
  x: number
  y: number
  protocols: string[]
  srcLabel: string
  tgtLabel: string
}

defineProps<{ tooltip: EdgeTooltipState | null }>()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.edge-tooltip {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  min-width: 160px;
  transform: translate(12px, -50%);

  &__endpoints {
    font-size: 0.75rem;
    font-weight: 600;
    color: var($primary-text-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
  }

  &__protocol {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    padding: 2px 0;
  }

  &__chip {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
</style>
