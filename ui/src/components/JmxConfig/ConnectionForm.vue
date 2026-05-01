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
  <div class="connection-form">
    <h2 class="step-title">Step 1: JMX Connection</h2>

    <div class="form-field">
      <label class="field-label">Service Name</label>
      <InputText v-model="config.serviceName" class="field-input" />
      <small class="field-hint">Used as the collection name in the generated XML (e.g. jmx-cassandra)</small>
    </div>

    <div class="form-field">
      <label class="field-label">JMX Connection URL</label>
      <InputText v-model="config.connection" class="field-input" />
      <small class="field-hint">e.g. service:jmx:rmi://hostname:port/jndi/rmi://hostname:port/jmxrmi</small>
    </div>

    <div class="form-field">
      <div class="flex align-items-center gap-2">
        <Checkbox v-model="config.authenticate" inputId="auth-check" :binary="true" />
        <label for="auth-check">Requires Authentication</label>
      </div>
    </div>

    <template v-if="config.authenticate">
      <div class="form-field">
        <label class="field-label">Username</label>
        <InputText
          :modelValue="config.user ?? ''"
          class="field-input"
          @update:modelValue="(v) => { config.user = (v as string) || null }"
        />
      </div>
      <div class="form-field">
        <label class="field-label">Password</label>
        <InputText
          :modelValue="config.password ?? ''"
          type="password"
          class="field-input"
          @update:modelValue="(v) => { config.password = (v as string) || null }"
        />
      </div>
    </template>

    <div class="form-field options-row">
      <div class="flex align-items-center gap-2">
        <Checkbox v-model="config.skipDefaultVM" inputId="skip-jvm" :binary="true" />
        <label for="skip-jvm">Skip Default JVM MBeans</label>
      </div>
      <div class="flex align-items-center gap-2">
        <Checkbox v-model="config.skipNonNumber" inputId="skip-non-num" :binary="true" />
        <label for="skip-non-num">Skip Non-numeric Attributes</label>
      </div>
    </div>

    <div class="form-actions">
      <Button label="Detect MBeans" @click="$emit('submit', config)" :disabled="!isValid" />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import type { DetectRequest } from '@/services/jmxConfigService'

const props = defineProps<{ modelValue: DetectRequest }>()
const emit = defineEmits<{
  (e: 'submit', config: DetectRequest): void
  (e: 'update:modelValue', config: DetectRequest): void
}>()

const config = reactive({ ...props.modelValue })

watch(config, (val) => emit('update:modelValue', { ...val }), { deep: true })

const isValid = computed(() =>
  config.serviceName.trim().length > 0 &&
  config.connection.trim().length > 0 &&
  (!config.authenticate || (!!config.user && !!config.password))
)
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.connection-form {
  max-width: 600px;
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

.options-row {
  display: flex;
  gap: 2rem;
  flex-direction: row;
}

.form-actions {
  margin-top: 1.5rem;
}
</style>
