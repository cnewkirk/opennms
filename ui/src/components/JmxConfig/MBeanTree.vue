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
  <div class="mbean-tree">
    <h2 class="step-title">Step 3: Select MBeans and Attributes</h2>

    <div class="tree-toolbar">
      <Button label="Select All" text @click="selectAll" />
      <Button label="Deselect All" text @click="deselectAll" />
      <span class="count-summary">{{ selectedCount }} of {{ totalCount }} attributes selected</span>
    </div>

    <div class="mbean-list">
      <div v-for="mbean in localMbeans" :key="mbean.objectName" class="mbean-row">
        <div class="mbean-header" @click="toggleExpand(mbean.objectName)">
          <Checkbox
            :modelValue="mbean.include"
            :binary="true"
            :inputId="`mbean-${mbean.objectName}`"
            @update:modelValue="(v) => { mbean.include = !!v }"
            @click.stop
          />
          <label :for="`mbean-${mbean.objectName}`">{{ mbean.name || mbean.objectName }}</label>
          <span class="mbean-objectname">{{ mbean.objectName }}</span>
          <span class="expand-icon">{{ expanded.has(mbean.objectName) ? '▲' : '▼' }}</span>
        </div>

        <div v-if="expanded.has(mbean.objectName)" class="attribute-list">
          <div
            v-for="attr in mbean.attributes"
            :key="attr.name"
            class="attribute-row"
          >
            <Checkbox
              :modelValue="attr.include"
              :binary="true"
              :inputId="`attr-${attr.name}`"
              @update:modelValue="(v) => { attr.include = !!v }"
            />
            <label :for="`attr-${attr.name}`">{{ attr.name }}</label>
            <InputText
              v-model="attr.alias"
              placeholder="Alias (optional)"
              class="alias-input"
            />
            <span class="attr-type">{{ attr.type }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <Button label="Back" @click="$emit('back')" />
      <Button label="Next" @click="$emit('next', localMbeans)" :disabled="selectedCount === 0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import type { MBeanDto } from '@/services/jmxConfigService'

const props = defineProps<{ mbeans: MBeanDto[] }>()
const emit = defineEmits<{
  (e: 'next', mbeans: MBeanDto[]): void
  (e: 'back'): void
}>()

// Deep-clone so edits don't mutate the store directly
const localMbeans = ref<MBeanDto[]>(JSON.parse(JSON.stringify(props.mbeans)))

const expanded = ref<Set<string>>(new Set())

const toggleExpand = (objectName: string) => {
  if (expanded.value.has(objectName)) {
    expanded.value.delete(objectName)
  } else {
    expanded.value.add(objectName)
  }
}

const selectedCount = computed(() =>
  localMbeans.value
    .filter(m => m.include)
    .flatMap(m => m.attributes)
    .filter(a => a.include)
    .length
)

const totalCount = computed(() =>
  localMbeans.value.flatMap(m => m.attributes).length
)

const selectAll = () => {
  localMbeans.value.forEach(m => {
    m.include = true
    m.attributes.forEach(a => { a.include = true })
  })
}

const deselectAll = () => {
  localMbeans.value.forEach(m => {
    m.include = false
    m.attributes.forEach(a => { a.include = false })
  })
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/typography" as typo;
@import "@/styles/tokens";

.mbean-tree {
  width: 100%;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1rem;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.count-summary {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  margin-left: auto;
}

.mbean-list {
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  max-height: 60vh;
  overflow-y: auto;
}

.mbean-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var($surface-dark);
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var($surface-dark);
    filter: brightness(0.95);
  }
}

.mbean-objectname {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  flex: 1;
}

.expand-icon {
  @include typo.caption();
  color: var($secondary-text-on-surface);
}

.attribute-list {
  padding: 0.25rem 0;
}

.attribute-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.25rem 1rem 0.25rem 3rem;
}

.alias-input {
  max-width: 200px;
  opacity: 0.7;
}

.attr-type {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  min-width: 60px;
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}
</style>
