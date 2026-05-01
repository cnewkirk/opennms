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
  <Dialog v-model:visible="dialogOpen" header="Generated Events" :modal="true" :closable="true" @hide="close">
    <div class="generate-events-dialog">
      <p class="summary">
        Found <strong>{{ store.generatedEventCount }}</strong> events from
        <strong>{{ store.mibName }}</strong>
      </p>

      <textarea
        :value="store.generatedEventsXml ?? ''"
        class="xml-preview"
        readonly
        spellcheck="false"
      />

      <div class="save-controls">
        <label class="field-label">Save as filename</label>
        <InputText v-model="fileName" class="filename-input" />
      </div>
    </div>
    <template #footer>
      <Button text label="Cancel" @click="close" />
      <Button text label="Download" @click="download" />
      <Button label="Save to Server" @click="save" :disabled="saving || !fileName.trim()" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useMibCompilerStore } from '@/stores/mibCompilerStore'
import { saveEvents } from '@/services/mibCompilerService'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useMibCompilerStore()
const dialogOpen = ref(true)
const saving = ref(false)
const fileName = ref(store.suggestedFileName ?? 'events.xml')

const save = async () => {
  saving.value = true
  try {
    const result = await saveEvents(fileName.value, store.generatedEventsXml!, false)
    store.log('info', `Events saved to ${result.savedPath}`)
    close()
  } catch (e: any) {
    if (e?.response?.status === 409) {
      // File exists — try with overwrite
      if (confirm(`File ${fileName.value} already exists. Overwrite?`)) {
        try {
          const result = await saveEvents(fileName.value, store.generatedEventsXml!, true)
          store.log('info', `Events saved to ${result.savedPath} (overwritten)`)
          close()
        } catch (e2: any) {
          store.log('error', `Save failed: ${e2?.response?.data?.error ?? e2?.message}`)
        }
      }
    } else {
      store.log('error', `Save failed: ${e?.response?.data?.error ?? e?.message}`)
    }
  } finally {
    saving.value = false
  }
}

const download = () => {
  const blob = new Blob([store.generatedEventsXml ?? ''], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.value
  a.click()
  URL.revokeObjectURL(url)
}

const close = () => {
  dialogOpen.value = false
  emit('close')
}

// Dialog 'hide' event handled via @hide="close" on the Dialog component
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.generate-events-dialog {
  min-width: 600px;
}

.summary {
  margin-bottom: 1rem;
}

.xml-preview {
  width: 100%;
  min-height: 300px;
  max-height: 400px;
  font-family: monospace;
  font-size: 0.8rem;
  padding: 0.75rem;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  background: var($surface);
  color: var($primary-text-on-surface);
  resize: vertical;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.save-controls {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var($secondary-text-on-surface);
}

.filename-input {
  width: 100%;
}
</style>
