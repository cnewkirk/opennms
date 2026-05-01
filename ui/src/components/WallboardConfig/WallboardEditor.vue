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
  <div class="wallboard-editor">
    <div class="editor-toolbar">
      <InputText v-model="local.title" placeholder="Board Title" class="title-input" @update:modelValue="emitUpdate" />
      <label class="checkbox-label">
        <Checkbox v-model="local.default" binary @update:modelValue="emitUpdate" />
        Default board
      </label>
    </div>

    <div class="dashlets-section">
      <div class="dashlets-header">
        <span class="dashlets-label">Dashlets ({{ local.dashlets.length }})</span>
        <Button text label="+ Add Dashlet" @click="addDashlet" />
      </div>

      <div v-if="local.dashlets.length === 0" class="empty-state">
        No dashlets. Add one to get started.
      </div>

      <div class="dashlets-list">
        <DashletRow
          v-for="(dashlet, i) in local.dashlets"
          :key="i"
          :modelValue="dashlet"
          :isFirst="i === 0"
          :isLast="i === local.dashlets.length - 1"
          @update:modelValue="(v) => updateDashlet(i, v)"
          @moveUp="moveDashlet(i, -1)"
          @moveDown="moveDashlet(i, 1)"
          @delete="removeDashlet(i)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import DashletRow from './DashletRow.vue'
import { makeDefaultDashlet } from '@/services/wallboardConfigService'
import type { WallboardEntry, DashletEntry } from '@/services/wallboardConfigService'

const props = defineProps<{ modelValue: WallboardEntry }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: WallboardEntry): void }>()

const local = ref<WallboardEntry>(JSON.parse(JSON.stringify(props.modelValue)))

watch(() => props.modelValue, (v) => {
  local.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(local.value)))

const addDashlet = () => {
  local.value.dashlets.push(makeDefaultDashlet())
  emitUpdate()
}

const removeDashlet = (i: number) => {
  local.value.dashlets.splice(i, 1)
  emitUpdate()
}

const updateDashlet = (i: number, updated: DashletEntry) => {
  local.value.dashlets[i] = updated
  emitUpdate()
}

const moveDashlet = (i: number, direction: -1 | 1) => {
  const j = i + direction
  if (j < 0 || j >= local.value.dashlets.length) return
  const tmp = local.value.dashlets[i]
  local.value.dashlets[i] = local.value.dashlets[j]
  local.value.dashlets[j] = tmp
  emitUpdate()
}
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@/styles/tokens";

.wallboard-editor {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
}

.editor-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.title-input { width: 250px; }

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.dashlets-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashlets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashlets-label {
  @include typo.subtitle1();
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
}

.dashlets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
