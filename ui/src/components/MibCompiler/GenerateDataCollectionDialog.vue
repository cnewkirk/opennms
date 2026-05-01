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
  <Dialog v-model:visible="dialogOpen" header="Generated Data Collection" :modal="true" :closable="true" @hide="close">
    <div class="generate-dc-dialog">
      <p class="summary">
        Found <strong>{{ store.generatedGroupCount }}</strong> data collection groups from
        <strong>{{ store.mibName }}</strong>
      </p>

      <textarea
        :value="store.generatedDataCollectionXml ?? ''"
        class="xml-preview"
        readonly
        spellcheck="false"
      />

      <div class="save-controls">
        <label class="field-label">Save as filename</label>
        <InputText v-model="fileName" class="filename-input" />
        <label class="checkbox-label">
          <Checkbox v-model="includeGraphs" binary :disabled="!store.generatedGraphTemplates" />
          Also save graph templates
        </label>
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
import Checkbox from 'primevue/checkbox'
import { useMibCompilerStore } from '@/stores/mibCompilerStore'
import { saveDataCollection } from '@/services/mibCompilerService'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useMibCompilerStore()
const dialogOpen = ref(true)
const saving = ref(false)
const fileName = ref(store.suggestedFileName ?? 'datacollection.xml')
const includeGraphs = ref(!!store.generatedGraphTemplates)

const save = async () => {
  saving.value = true
  try {
    const graphs = includeGraphs.value ? store.generatedGraphTemplates : null
    const result = await saveDataCollection(fileName.value, store.generatedDataCollectionXml!, graphs, false)
    let msg = `Data collection saved to ${result.savedPath}`
    if (result.graphPath) {
      msg += ` (graphs: ${result.graphPath})`
    }
    store.log('info', msg)
    close()
  } catch (e: any) {
    if (e?.response?.status === 409) {
      if (confirm(`File ${fileName.value} already exists. Overwrite?`)) {
        try {
          const graphs = includeGraphs.value ? store.generatedGraphTemplates : null
          const result = await saveDataCollection(fileName.value, store.generatedDataCollectionXml!, graphs, true)
          let msg = `Data collection saved to ${result.savedPath} (overwritten)`
          if (result.graphPath) {
            msg += ` (graphs: ${result.graphPath})`
          }
          store.log('info', msg)
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
  const blob = new Blob([store.generatedDataCollectionXml ?? ''], { type: 'application/xml' })
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
@import "@featherds/styles/themes/variables";

.generate-dc-dialog {
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
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var($secondary-text-on-surface);
}

.filename-input {
  width: 100%;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
</style>
