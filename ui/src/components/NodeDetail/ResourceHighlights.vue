///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///
<template>
  <div class="resource-highlights">
    <div v-if="loading" class="resource-highlights__empty caption">Loading graphs…</div>
    <div v-else-if="!highlights.length" class="resource-highlights__empty caption">
      No performance graphs available for this node.
    </div>
    <template v-else>
      <div class="resource-highlights__grid">
        <div
          v-for="item in visibleHighlights"
          :key="`${item.resourceId}-${item.definition}`"
          class="resource-highlights__cell"
        >
          <Graph
            :definition="item.definition"
            :resourceId="item.resourceId"
            :time="time"
            :label="item.label"
            :isSingleGraph="false"
          />
        </div>
      </div>
      <button
        v-if="highlights.length > INITIAL_COUNT"
        class="resource-highlights__toggle"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show fewer' : `Show all ${highlights.length} graphs` }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import Graph from '@/components/Resources/Graph.vue'
import type { HighlightItem } from '@/types/resourceGraphs'
import type { StartEndTime } from '@/types'

const props = defineProps<{
  highlights: HighlightItem[]
  time: StartEndTime
  loading: boolean
}>()

const INITIAL_COUNT = 4
const showAll = ref(false)
const visibleHighlights = computed(() =>
  showAll.value ? props.highlights : props.highlights.slice(0, INITIAL_COUNT)
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.resource-highlights {
  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    @media (max-width: 800px) {
      grid-template-columns: 1fr;
    }
  }

  &__cell {
    min-width: 0;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__toggle {
    display: block;
    margin: 14px auto 0;
    background: none;
    border: none;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 4px 8px;
    &:hover { text-decoration: underline; }
  }
}
</style>
