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
  <Dialog v-model:visible="dialogOpen" header="Event UEI Base" :modal="true" :closable="true" @hide="close">
    <div class="uei-dialog">
      <p>Enter the UEI base for the generated events:</p>
      <label class="field-label">UEI Base</label>
      <InputText
        v-model="ueiBase"
        class="uei-input"
        placeholder="e.g. uei.opennms.org/traps/MY-MIB"
      />
    </div>
    <template #footer>
      <Button text label="Cancel" @click="close" />
      <Button label="Continue" @click="confirm" :disabled="!ueiBase.trim()" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  filename: string
}>()

const emit = defineEmits<{
  (e: 'confirm', ueiBase: string): void
  (e: 'close'): void
}>()

const dialogOpen = ref(true)

// Derive default UEI base from filename (strip extension)
const mibName = props.filename.replace(/\.[^.]+$/, '')
const ueiBase = ref(`uei.opennms.org/traps/${mibName}`)

const confirm = () => {
  emit('confirm', ueiBase.value.trim())
  dialogOpen.value = false
}

const close = () => {
  dialogOpen.value = false
  emit('close')
}

// Dialog 'hide' event handled via @hide="close" on the Dialog component
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.uei-dialog {
  min-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.uei-dialog p {
  margin-bottom: 0.5rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var($secondary-text-on-surface);
}

.uei-input {
  width: 100%;
}
</style>
