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
  <div class="dashlet-row" :class="{ expanded }">
    <div class="dashlet-summary" @click="expanded = !expanded">
      <span class="dashlet-type-badge">{{ local.dashletName }}</span>
      <span class="dashlet-title">{{ local.title || '(untitled)' }}</span>
      <div class="row-actions">
        <Button text icon="pi pi-arrow-up" @click.stop="$emit('moveUp')" :disabled="isFirst" />
        <Button text icon="pi pi-arrow-down" @click.stop="$emit('moveDown')" :disabled="isLast" />
        <Button text icon="pi pi-trash" @click.stop="$emit('delete')" />
        <i :class="['pi', expanded ? 'pi-chevron-up' : 'pi-chevron-down', 'expand-icon']" />
      </div>
    </div>

    <div v-if="expanded" class="dashlet-form">
      <div class="form-row">
        <div class="form-field">
          <label class="field-label">Type</label>
          <select class="type-select" v-model="local.dashletName" @change="emitUpdate">
            <option v-for="t in DASHLET_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <InputText v-model="local.title" placeholder="Title" class="title-input" @update:modelValue="emitUpdate" />
      </div>

      <div class="form-row">
        <InputText
          :modelValue="String(local.duration)"
          placeholder="Duration (s)"
          type="number"
          class="num-input"
          @update:modelValue="(v: any) => { local.duration = Number(v) || 0; emitUpdate() }"
        />
        <InputText
          :modelValue="String(local.priority)"
          placeholder="Priority"
          type="number"
          class="num-input"
          @update:modelValue="(v: any) => { local.priority = Number(v) || 0; emitUpdate() }"
        />
        <InputText
          :modelValue="String(local.boostDuration)"
          placeholder="Boost Duration (s)"
          type="number"
          class="num-input"
          @update:modelValue="(v: any) => { local.boostDuration = Number(v) || 0; emitUpdate() }"
        />
        <InputText
          :modelValue="String(local.boostPriority)"
          placeholder="Boost Priority"
          type="number"
          class="num-input"
          @update:modelValue="(v: any) => { local.boostPriority = Number(v) || 0; emitUpdate() }"
        />
      </div>

      <ParametersTable v-model="local.parameters" @update:modelValue="emitUpdate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ParametersTable from './ParametersTable.vue'
import { DASHLET_TYPES } from '@/services/wallboardConfigService'
import type { DashletEntry } from '@/services/wallboardConfigService'

const props = defineProps<{
  modelValue: DashletEntry
  isFirst: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: DashletEntry): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
  (e: 'delete'): void
}>()

const expanded = ref(false)
const local = ref<DashletEntry>(JSON.parse(JSON.stringify(props.modelValue)))

watch(() => props.modelValue, (v) => {
  local.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(local.value)))
</script>

<style lang="scss" scoped>
@use "@/styles/typography" as typo;
@import "@/styles/tokens";
@import "@/styles/vars";

.dashlet-row {
  border: 1px solid var($border-on-surface);
  border-radius: $border-radius-surface;
  overflow: hidden;
}

.dashlet-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  background: var($surface-dark);
  user-select: none;

  &:hover {
    filter: brightness(0.97);
  }
}

.dashlet-type-badge {
  @include typo.caption();
  background: var($primary);
  color: var($primary-text-on-color);
  border-radius: $border-radius-pill;
  padding: 0.1rem 0.6rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.dashlet-title {
  @include typo.body-large();
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.expand-icon {
  color: var($secondary-text-on-surface);
}

.dashlet-form {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 1px solid var($border-on-surface);
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.type-select {
  @include typo.body-large();
  border: 1px solid var($border-on-surface);
  border-radius: $border-radius-surface;
  padding: 0.4rem 0.75rem;
  background: var($surface);
  color: var($primary-text-on-surface);
  cursor: pointer;
  height: 2.5rem;
}

.field-label {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  display: block;
  margin-bottom: 0.25rem;
}

.title-input { flex: 1; min-width: 160px; }
.num-input { width: 130px; }
</style>
