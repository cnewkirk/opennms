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
  <Dialog v-model:visible="dialogOpen" :header="dialogTitle" :modal="true" :closable="true" @hide="close">
    <div class="file-editor">
      <div v-if="loading" class="loading-state">Loading file content...</div>
      <div v-else-if="loadError" class="error-state">{{ loadError }}</div>
      <textarea
        v-else
        v-model="content"
        class="file-content"
        :readonly="readOnly"
        spellcheck="false"
      />
    </div>
    <template #footer>
      <Button text label="Cancel" @click="close" />
      <Button v-if="!readOnly" :label="saving ? 'Saving...' : 'Save'" @click="save" :disabled="saving || loading" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useMibCompilerStore } from '@/stores/mibCompilerStore'
import { getMibContent, saveMibContent } from '@/services/mibCompilerService'

const props = defineProps<{
  folder: string
  filename: string
  readOnly: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useMibCompilerStore()
const dialogOpen = ref(true)
const content = ref('')
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const dialogTitle = computed(() =>
  props.readOnly ? `View: ${props.filename}` : `Edit: ${props.filename}`
)

onMounted(async () => {
  try {
    const result = await getMibContent(props.folder, props.filename)
    content.value = result.content
  } catch (e: any) {
    loadError.value = e?.response?.data?.error ?? e?.message ?? 'Failed to load file'
  } finally {
    loading.value = false
  }
})

const save = async () => {
  saving.value = true
  try {
    await saveMibContent(props.filename, content.value)
    store.log('info', `File ${props.filename} saved successfully`)
    close()
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? 'Failed to save'
    store.log('error', `Save failed: ${msg}`)
  } finally {
    saving.value = false
  }
}

const close = () => {
  dialogOpen.value = false
  emit('close')
}

// Dialog 'hide' event handled via @hide="close" on the Dialog component
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.file-editor {
  min-height: 400px;
  display: flex;
  flex-direction: column;
}

.file-content {
  width: 100%;
  min-height: 400px;
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.75rem;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  background: var($surface);
  color: var($primary-text-on-surface);
  resize: vertical;
  line-height: 1.5;
}

.loading-state,
.error-state {
  padding: 2rem;
  text-align: center;
  color: var($secondary-text-on-surface);
}

.error-state {
  color: #d32f2f;
}
</style>
