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
  <div class="view-list">
    <div class="view-list-header">
      <span class="list-label">Views</span>
      <FeatherButton text @click="$emit('add')" :disabled="disabled">
        <FeatherIcon :icon="AddIcon" />
      </FeatherButton>
    </div>

    <div
      v-for="(view, i) in views"
      :key="view.name + i"
      class="view-item"
      :class="{ selected: i === selectedIndex }"
      @click="$emit('select', i)"
    >
      <span class="view-name">{{ view.name || '(unnamed)' }}</span>
      <span v-if="view.name === defaultView" class="default-badge">default</span>
      <FeatherButton text class="delete-btn" @click.stop="$emit('delete', i)" :disabled="disabled">
        <FeatherIcon :icon="DeleteIcon" />
      </FeatherButton>
    </div>

    <div v-if="views.length === 0" class="empty-state">No views configured.</div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import Add from '@featherds/icon/action/Add'
import Delete from '@featherds/icon/action/Delete'
import { markRaw } from 'vue'
import type { SurveillanceView } from '@/services/surveillanceViewConfigService'

defineProps<{
  views: SurveillanceView[]
  selectedIndex: number
  defaultView: string
  disabled?: boolean
}>()

defineEmits<{
  (e: 'select', index: number): void
  (e: 'add'): void
  (e: 'delete', index: number): void
}>()

const AddIcon = markRaw(Add)
const DeleteIcon = markRaw(Delete)
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";
@import "@/styles/vars";

.view-list {
  border-right: 1px solid var($border-on-surface);
  min-width: 200px;
  display: flex;
  flex-direction: column;
}

.view-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  border-bottom: 1px solid var($border-on-surface);
}

.list-label {
  @include typo.subtitle1();
  color: var($secondary-text-on-surface);
}

.view-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var($surface-dark);
  }

  &.selected {
    background: var($surface-dark);
    border-left: 3px solid var($primary);
  }

  .delete-btn {
    margin-left: auto;
    opacity: 0;
  }

  &:hover .delete-btn {
    opacity: 1;
  }
}

.view-name {
  @include typo.body-large();
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.default-badge {
  @include typo.caption();
  background: var($primary);
  color: var($primary-text-on-color);
  border-radius: $border-radius-pill;
  padding: 0 0.5rem;
  white-space: nowrap;
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  padding: 1rem;
  text-align: center;
}
</style>
