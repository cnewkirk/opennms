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
  <div class="mib-upload">
    <FeatherButton primary @click="triggerUpload" :disabled="uploading">
      {{ uploading ? 'Uploading...' : 'Upload MIB' }}
    </FeatherButton>
    <input
      ref="fileInput"
      type="file"
      class="hidden-input"
      accept=".mib,.txt,.my"
      @change="onFileSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { useMibCompilerStore } from '@/stores/mibCompilerStore'
import { uploadMib, listMibs } from '@/services/mibCompilerService'

const store = useMibCompilerStore()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const triggerUpload = () => {
  fileInput.value?.click()
}

const onFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    store.log('info', `Uploading ${file.name}...`)
    const result = await uploadMib(file)
    store.log('info', `File ${result.filename} uploaded successfully`)
    // Refresh the MIB list
    const mibs = await listMibs()
    store.pendingMibs = mibs.pending
    store.compiledMibs = mibs.compiled
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? 'Unknown error'
    store.log('error', `Upload failed: ${msg}`)
  } finally {
    uploading.value = false
    // Reset file input so the same file can be selected again
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<style lang="scss" scoped>
.mib-upload {
  margin-bottom: 0.75rem;
}

.hidden-input {
  display: none;
}
</style>
