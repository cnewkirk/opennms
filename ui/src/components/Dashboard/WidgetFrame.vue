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
      <span class="widget-title">{{ title }}</span>
      <div class="widget-actions">
        <Button
          text
          rounded
          severity="secondary"
          size="small"
          :disabled="loading"
          title="Refresh"
          @click="$emit('refresh')"
        >
          <i class="pi pi-refresh" />
        </Button>
        <Button
          text
          rounded
          severity="secondary"
          size="small"
          title="Configure"
          @click="$emit('configure')"
        >
          <i class="pi pi-cog" />
        </Button>
        <Button
          text
          rounded
          severity="danger"
          size="small"
          title="Remove widget"
          @click="$emit('remove')"
        >
          <i class="pi pi-times" />
        </Button>
      </div>
    </div>
    <div class="widget-body">
      <div
        v-if="loading"
        class="widget-loading"
      >
        <ProgressSpinner style="width:32px;height:32px" />
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
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

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
@import "@/styles/tokens";
@import "@featherds/styles/mixins/typography";

.widget-frame {
  background: var($surface);
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-surface;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  border-bottom: 1px solid var($border-light-on-surface);
  flex-shrink: 0;
  cursor: grab;

  &:active { cursor: grabbing; }
}

.widget-title {
  @include subtitle1;
  font-weight: 600;
  color: var($primary-text-on-surface);
}

.widget-actions {
  display: flex;
  gap: 2px;
}

.widget-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
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
