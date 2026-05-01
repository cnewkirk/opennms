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
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="review-save">
    <h2 class="step-title">Step 4: Review and Save</h2>

    <div v-if="!generated" class="generate-section">
      <div class="form-field">
        <label class="field-label">Output File Name</label>
        <InputText v-model="localFileName" class="field-input" />
        <small class="field-hint">Saved to /opt/opennms/etc/jmx-datacollection-config.d/</small>
      </div>

      <div v-if="error" class="inline-error">
        <span v-if="conflictError">
          File already exists.
          <Button label="Overwrite" text @click="generateWithOverwrite" />
        </span>
        <span v-else>{{ error }}</span>
      </div>

      <div class="form-actions">
        <Button label="Back" @click="$emit('back')" />
        <Button :label="saving ? 'Saving…' : 'Save to Server'" @click="save" :disabled="saving" />
      </div>
    </div>

    <div v-else class="result-section">
      <div class="saved-path" v-if="savedPath">
        Saved to <code>{{ savedPath }}</code>
      </div>

      <div class="xml-preview-label">Generated XML:</div>
      <textarea class="xml-preview" readonly :value="xml" />

      <div class="form-actions">
        <Button label="Download XML" @click="download" />
        <Button label="Start Over" text @click="$emit('reset')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { generate } from '@/services/jmxConfigService'
import type { MBeanDto } from '@/services/jmxConfigService'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps<{
  serviceName: string
  outputFileName: string
  mbeans: MBeanDto[]
}>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'reset'): void
}>()

const { showSnackBar } = useSnackbar()
const localFileName = ref(props.outputFileName)
const saving = ref(false)
const generated = ref(false)
const xml = ref('')
const savedPath = ref<string | null>(null)
const error = ref<string | null>(null)
const conflictError = ref(false)

const doGenerate = async (overwrite: boolean) => {
  saving.value = true
  error.value = null
  conflictError.value = false
  try {
    const result = await generate({
      serviceName: props.serviceName,
      outputFileName: localFileName.value,
      saveToServer: true,
      overwrite,
      mbeans: props.mbeans
    })
    xml.value = result.xml
    savedPath.value = result.savedPath
    generated.value = true
    if (result.savedPath) {
      showSnackBar({ msg: `Saved to ${result.savedPath}` })
    }
  } catch (e: any) {
    if (e?.response?.status === 409) {
      conflictError.value = true
      error.value = 'File already exists.'
    } else {
      error.value = e?.response?.data?.error ?? 'Failed to generate configuration.'
    }
  } finally {
    saving.value = false
  }
}

const save = () => doGenerate(false)
const generateWithOverwrite = () => doGenerate(true)

const download = () => {
  const blob = new Blob([xml.value], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = localFileName.value
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/typography" as typo;
@import "@/styles/tokens";

.review-save {
  max-width: 800px;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1.5rem;
}

.form-field {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-weight: 500;
  font-size: 0.875rem;
}

.field-hint {
  color: var($secondary-text-on-surface);
}

.field-input {
  width: 100%;
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}

.inline-error {
  @include typo.body-small();
  color: var($error);
  margin-bottom: 1rem;
}

.saved-path {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  margin-bottom: 1rem;

  code {
    font-family: monospace;
  }
}

.xml-preview-label {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  margin-bottom: 0.25rem;
}

.xml-preview {
  width: 100%;
  height: 400px;
  font-family: monospace;
  font-size: 0.75rem;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  padding: 0.5rem;
  resize: vertical;
  background: var($surface-dark);
  color: var($primary-text-on-surface);
}
</style>
