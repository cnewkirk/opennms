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
  <div class="jmx-config-generator">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">JMX Configuration Generator</h1>

    <div class="step-indicator">
      <span
        v-for="(label, i) in stepLabels"
        :key="i"
        class="step-chip"
        :class="{ active: store.currentStep === i + 1, done: store.currentStep > i + 1 }"
      >{{ i + 1 }}. {{ label }}</span>
    </div>

    <div class="wizard-body">
      <ConnectionForm
        v-if="store.currentStep === 1"
        v-model="store.connectionConfig"
        @submit="onConnectionSubmit"
      />

      <MBeanDetection
        v-else-if="store.currentStep === 2"
        :jobId="store.jobId!"
        @done="onDetectionDone"
        @back="store.currentStep = 1"
      />

      <MBeanTree
        v-else-if="store.currentStep === 3"
        :mbeans="store.mbeans"
        @next="onMBeansSelected"
        @back="store.currentStep = 1"
      />

      <ReviewSave
        v-else-if="store.currentStep === 4"
        :serviceName="store.connectionConfig.serviceName"
        :outputFileName="store.outputFileName"
        :mbeans="store.mbeans"
        @back="store.currentStep = 3"
        @reset="store.reset()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import ConnectionForm from '@/components/JmxConfig/ConnectionForm.vue'
import MBeanDetection from '@/components/JmxConfig/MBeanDetection.vue'
import MBeanTree from '@/components/JmxConfig/MBeanTree.vue'
import ReviewSave from '@/components/JmxConfig/ReviewSave.vue'
import { useJmxConfigStore } from '@/stores/jmxConfigStore'
import { startDetect } from '@/services/jmxConfigService'
import type { DetectRequest, MBeanDto } from '@/services/jmxConfigService'
import useSnackbar from '@/composables/useSnackbar'

const store = useJmxConfigStore()
const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'JMX Configuration Generator', to: '/jmx-config-generator' }
]

const stepLabels = ['Connection', 'Detecting', 'Select MBeans', 'Review & Save']

const onConnectionSubmit = async (config: DetectRequest) => {
  try {
    store.jobStatus = 'pending'
    store.currentStep = 2
    const jobId = await startDetect(config)
    store.jobId = jobId
  } catch (e: any) {
    store.currentStep = 1
    showSnackBar({ msg: 'Failed to start detection: ' + (e?.message ?? 'Unknown error') })
  }
}

const onDetectionDone = (mbeans: MBeanDto[]) => {
  store.setDetectionResult(mbeans)
  store.currentStep = 3
}

const onMBeansSelected = (mbeans: MBeanDto[]) => {
  store.mbeans = mbeans
  store.currentStep = 4
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@featherds/styles/mixins/typography" as typo;
@import "@/styles/tokens";

.jmx-config-generator {
  padding: 1.5rem;
}

.page-title {
  @include typo.headline1();
  margin-bottom: 1rem;
}

.step-indicator {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.step-chip {
  @include typo.caption();
  padding: 0.25rem 0.75rem;
  border-radius: vars.$border-radius-pill;
  border: 1px solid var($border-on-surface);
  color: var($secondary-text-on-surface);

  &.active {
    background: var($primary);
    color: var($primary-text-on-color);
    border-color: var($primary);
    font-weight: 600;
  }

  &.done {
    background: var($surface-dark);
    color: var($secondary-text-on-surface);
  }
}

.wizard-body {
  max-width: 900px;
}
</style>
