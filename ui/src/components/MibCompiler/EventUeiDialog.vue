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
  <FeatherDialog v-model="dialogOpen" :labels="{ title: 'Event UEI Base', close: 'Close' }">
    <template #default>
      <div class="uei-dialog">
        <p>Enter the UEI base for the generated events:</p>
        <FeatherInput
          v-model="ueiBase"
          label="UEI Base"
          hint="e.g. uei.opennms.org/traps/MY-MIB"
        />
      </div>
    </template>
    <template #footer>
      <FeatherButton text @click="close">Cancel</FeatherButton>
      <FeatherButton primary @click="confirm" :disabled="!ueiBase.trim()">
        Continue
      </FeatherButton>
    </template>
  </FeatherDialog>
</template>

<script setup lang="ts">
import { FeatherDialog } from '@featherds/dialog'
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'

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

watch(dialogOpen, (val) => {
  if (!val) emit('close')
})
</script>

<style lang="scss" scoped>
.uei-dialog {
  min-width: 400px;
}

.uei-dialog p {
  margin-bottom: 1rem;
}
</style>
