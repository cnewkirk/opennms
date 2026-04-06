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
  <div class="parameters-table">
    <div class="params-header">
      <span class="params-label">Parameters</span>
      <FeatherButton text @click="addRow">+ Add</FeatherButton>
    </div>

    <div v-if="rows.length === 0" class="empty-state">No parameters.</div>

    <div v-for="(row, i) in rows" :key="i" class="param-row">
      <FeatherInput
        v-model="row.key"
        label="Key"
        class="key-input"
        @update:modelValue="emitUpdate"
      />
      <FeatherInput
        v-model="row.value"
        label="Value"
        class="val-input"
        @update:modelValue="emitUpdate"
      />
      <FeatherButton text @click="removeRow(i)">
        <FeatherIcon :icon="DeleteIcon" />
      </FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherIcon } from '@featherds/icon'
import Delete from '@featherds/icon/action/Delete'
import { markRaw } from 'vue'

const props = defineProps<{ modelValue: Record<string, string> }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: Record<string, string>): void }>()

const DeleteIcon = markRaw(Delete)

interface KVRow { key: string; value: string }

const rows = ref<KVRow[]>(
  Object.entries(props.modelValue).map(([key, value]) => ({ key, value }))
)

watch(() => props.modelValue, (v) => {
  rows.value = Object.entries(v).map(([key, value]) => ({ key, value }))
}, { deep: true })

const emitUpdate = () => {
  const obj: Record<string, string> = {}
  rows.value.forEach(r => { if (r.key) obj[r.key] = r.value })
  emit('update:modelValue', obj)
}

const addRow = () => { rows.value.push({ key: '', value: '' }) }
const removeRow = (i: number) => { rows.value.splice(i, 1); emitUpdate() }
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.parameters-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.params-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.params-label {
  @include typo.subtitle2();
  color: var($secondary-text-on-surface);
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
}

.param-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.key-input { width: 140px; flex-shrink: 0; }
.val-input { flex: 1; }
</style>
