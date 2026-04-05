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
      <FeatherInput
        v-model="config.serviceName"
        label="Service Name"
        hint="Used as the collection name in the generated XML (e.g. jmx-cassandra)"
      />
    </div>

    <div class="form-field">
      <FeatherInput
        v-model="config.connection"
        label="JMX Connection URL"
        hint="e.g. service:jmx:rmi://hostname:port/jndi/rmi://hostname:port/jmxrmi"
      />
    </div>

    <div class="form-field">
      <FeatherCheckbox v-model="config.authenticate" label="Requires Authentication" />
    </div>

    <template v-if="config.authenticate">
      <div class="form-field">
        <FeatherInput
          :modelValue="config.user ?? ''"
          label="Username"
          @update:modelValue="(v) => { config.user = (v as string) || null }"
        />
      </div>
      <div class="form-field">
        <FeatherInput
          :modelValue="config.password ?? ''"
          label="Password"
          type="password"
          @update:modelValue="(v) => { config.password = (v as string) || null }"
        />
      </div>
    </template>

    <div class="form-field options-row">
      <FeatherCheckbox v-model="config.skipDefaultVM" label="Skip Default JVM MBeans" />
      <FeatherCheckbox v-model="config.skipNonNumber" label="Skip Non-numeric Attributes" />
    </div>

    <div class="form-actions">
      <FeatherButton primary @click="$emit('submit', config)" :disabled="!isValid">
        Detect MBeans
      </FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherCheckbox } from '@featherds/checkbox'
import { FeatherButton } from '@featherds/button'
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
@import "@featherds/styles/themes/variables";
@use "@featherds/styles/mixins/typography" as typo;

.connection-form {
  max-width: 600px;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1.5rem;
}

.form-field {
  margin-bottom: 1rem;
}

.options-row {
  display: flex;
  gap: 2rem;
}

.form-actions {
  margin-top: 1.5rem;
}
</style>
