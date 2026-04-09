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
  <div class="node-header">
    <div class="node-header__title">
      <span class="headline2">{{ node.label }}</span>
      <span class="status-badge" :class="statusClass">{{ statusText }}</span>
    </div>
    <div class="node-header__meta subtitle1">
      <span v-if="node.location">Location: {{ node.location }}</span>
      <span v-if="node.foreignSource && node.foreignId" class="node-header__fssource">
        {{ node.foreignSource }}:{{ node.foreignId }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Node } from '@/types'

const props = defineProps<{ node: Node }>()

const statusText = computed(() => props.node.type === 'A' ? 'UP' : 'DOWN')
const statusClass = computed(() => props.node.type === 'A' ? 'status-badge--up' : 'status-badge--down')
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.node-header {
  padding: 12px 16px;
  background: var($surface);
  margin-bottom: 16px;
  border-radius: vars.$border-radius-surface;

  &__title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__meta {
    display: flex;
    gap: 16px;
    margin-top: 4px;
    color: var($secondary-text-on-surface);
  }

  &__fssource {
    font-family: monospace;
    font-size: 0.85em;
  }
}

.status-badge {
  padding: 2px 10px;
  border-radius: vars.$border-radius-pill;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;

  &--up {
    background: var($success);
    color: var($primary-text-on-color);
  }

  &--down {
    background: var($error);
    color: var($primary-text-on-color);
  }
}
</style>
