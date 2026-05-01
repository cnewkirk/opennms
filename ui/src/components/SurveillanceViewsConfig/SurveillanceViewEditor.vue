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
  <div class="view-editor">
    <div class="editor-toolbar">
      <InputText v-model="localView.name" placeholder="View Name" class="name-input" @update:modelValue="emitUpdate" />
      <InputText
        :modelValue="String(localView.refreshSeconds)"
        placeholder="Refresh (seconds)"
        type="number"
        class="refresh-input"
        @update:modelValue="(v: any) => { localView.refreshSeconds = Number(v) || 300; emitUpdate() }"
      />
      <Button
        v-if="!isDefault"
        text
        label="Set as Default"
        @click="$emit('setDefault')"
      />
      <span v-else class="default-label">Default view</span>
    </div>

    <div class="editors-row">
      <div class="editor-section">
        <SurveillanceViewRowColumnEditor
          title="Rows"
          v-model="localView.rows"
          :allCategories="allCategories"
          @update:modelValue="emitUpdate"
        />
      </div>
      <div class="editor-section">
        <SurveillanceViewRowColumnEditor
          title="Columns"
          v-model="localView.columns"
          :allCategories="allCategories"
          @update:modelValue="emitUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SurveillanceViewRowColumnEditor from './SurveillanceViewRowColumnEditor.vue'
import type { SurveillanceView } from '@/services/surveillanceViewConfigService'

const props = defineProps<{
  modelValue: SurveillanceView
  isDefault: boolean
  allCategories: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: SurveillanceView): void
  (e: 'setDefault'): void
}>()

const localView = ref<SurveillanceView>(JSON.parse(JSON.stringify(props.modelValue)))

watch(() => props.modelValue, (v) => {
  localView.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(localView.value)))
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.view-editor {
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
  gap: 1rem;
  flex-wrap: wrap;
}

.name-input {
  width: 220px;
}

.refresh-input {
  width: 140px;
}

.default-label {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  padding-bottom: 0.5rem;
}

.editors-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.editor-section {
  flex: 1;
  min-width: 260px;
}
</style>
