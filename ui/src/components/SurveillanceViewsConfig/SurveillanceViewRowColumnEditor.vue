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
  <div class="rowcol-editor">
    <div class="section-header">
      <span class="section-title">{{ title }}</span>
      <Button text label="+ Add" @click="addItem" />
    </div>

    <div v-if="localItems.length === 0" class="empty-state">
      No {{ title.toLowerCase() }} defined.
    </div>

    <div v-for="(item, i) in localItems" :key="i" class="item-row">
      <InputText
        v-model="item.label"
        :placeholder="title.slice(0, -1) + ' Label'"
        class="label-input"
        @update:modelValue="emitUpdate"
      />
      <div class="categories-section">
        <div class="category-chips">
          <span
            v-for="(cat, ci) in item.categories"
            :key="ci"
            class="category-chip"
          >
            {{ cat }}
            <button class="chip-remove" @click="removeCategory(i, ci)">×</button>
          </span>
        </div>
        <select class="category-select" @change="(e) => addCategory(i, (e.target as HTMLSelectElement).value, e)">
          <option value="">+ Add category…</option>
          <option
            v-for="cat in availableCategories(i)"
            :key="cat"
            :value="cat"
          >{{ cat }}</option>
        </select>
      </div>
      <Button text icon="pi pi-trash" @click="removeItem(i)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import type { SurveillanceViewRowOrColumn } from '@/services/surveillanceViewConfigService'

const props = defineProps<{
  title: string
  modelValue: SurveillanceViewRowOrColumn[]
  allCategories: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: SurveillanceViewRowOrColumn[]): void
}>()

const localItems = ref<SurveillanceViewRowOrColumn[]>(
  JSON.parse(JSON.stringify(props.modelValue))
)

watch(() => props.modelValue, (v) => {
  localItems.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(localItems.value)))

const addItem = () => {
  localItems.value.push({ label: '', categories: [] })
  emitUpdate()
}

const removeItem = (i: number) => {
  localItems.value.splice(i, 1)
  emitUpdate()
}

const addCategory = (itemIndex: number, catName: string, event: Event) => {
  if (!catName) return
  const item = localItems.value[itemIndex]
  if (!item.categories.includes(catName)) {
    item.categories.push(catName)
    emitUpdate()
  }
  ;(event.target as HTMLSelectElement).value = ''
}

const removeCategory = (itemIndex: number, catIndex: number) => {
  localItems.value[itemIndex].categories.splice(catIndex, 1)
  emitUpdate()
}

const availableCategories = (itemIndex: number) =>
  props.allCategories.filter(c => !localItems.value[itemIndex].categories.includes(c))
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@/styles/tokens";
@import "@/styles/vars";

.rowcol-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.section-title {
  @include typo.subtitle1();
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var($border-on-surface);
  border-radius: $border-radius-surface;
}

.label-input {
  width: 160px;
  flex-shrink: 0;
}

.categories-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-height: 1.5rem;
}

.category-chip {
  @include typo.caption();
  background: var($surface-dark);
  border: 1px solid var($border-on-surface);
  border-radius: $border-radius-pill;
  padding: 0.1rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var($secondary-text-on-surface);
  padding: 0;
  line-height: 1;
  font-size: 1rem;

  &:hover {
    color: var($error);
  }
}

.category-select {
  @include typo.body-small();
  border: 1px solid var($border-on-surface);
  border-radius: $border-radius-surface;
  padding: 0.25rem 0.5rem;
  background: var($surface);
  color: var($primary-text-on-surface);
  cursor: pointer;
  max-width: 200px;
}
</style>
