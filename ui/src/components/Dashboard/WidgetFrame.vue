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
  <div class="widget-frame">
    <div class="widget-header widget-drag-handle">
      <span class="widget-title subtitle1">{{ title }}</span>
      <div class="widget-actions">
        <button
          class="icon-btn"
          title="Refresh"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          <FeatherIcon :icon="RefreshIcon" />
        </button>
        <button
          class="icon-btn"
          title="Configure"
          @click="$emit('configure')"
        >
          <FeatherIcon :icon="SettingsIcon" />
        </button>
        <button
          class="icon-btn icon-btn--danger"
          title="Remove widget"
          @click="$emit('remove')"
        >
          <FeatherIcon :icon="RemoveIcon" />
        </button>
      </div>
    </div>
    <div class="widget-body">
      <div
        v-if="loading"
        class="widget-loading"
      >
        <FeatherSpinner />
      </div>
      <div
        v-else-if="error"
        class="widget-error"
      >
        {{ error }}
      </div>
      <slot v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherIcon } from '@featherds/icon'
import { FeatherSpinner } from '@featherds/progress'
import SettingsIcon from '@featherds/icon/action/Settings'
import RefreshIcon from '@featherds/icon/navigation/Refresh'
import RemoveIcon from '@featherds/icon/action/Remove'

defineProps<{
  title: string
  loading?: boolean
  error?: string
}>()

defineEmits<{
  (e: 'refresh'): void
  (e: 'configure'): void
  (e: 'remove'): void
}>()
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.widget-frame {
  background: var($surface);
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-surface;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 220px;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var($border-light-on-surface);
  flex-shrink: 0;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.widget-title {
  @include subtitle1;
  font-weight: 600;
  color: var($primary-text-on-surface);
}

.widget-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: vars.$border-radius-surface;
  color: var($secondary-text-on-surface);
  display: flex;
  align-items: center;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var($surface);
    color: var($primary-text-on-surface);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &--danger:hover {
    color: var($error);
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.widget-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.widget-loading,
.widget-error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
}

.widget-error {
  color: var($error);
  @include body-large;
  padding: 16px;
}
</style>
