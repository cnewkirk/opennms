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
  <div class="mbean-detection">
    <h2 class="step-title">Step 2: Detecting MBeans</h2>

    <div v-if="status === 'pending' || status === 'running'" class="detecting">
      <PanelLoader :size="32" />
      <p class="detecting-msg">Connecting to JMX server and enumerating MBeans…</p>
    </div>

    <div v-else-if="status === 'error'" class="detection-error">
      <p class="error-text">Detection failed: {{ error }}</p>
      <Button label="Back" @click="$emit('back')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import PanelLoader from '@/components/Common/PanelLoader.vue'
import Button from 'primevue/button'
import { pollDetect } from '@/services/jmxConfigService'
import type { MBeanDto } from '@/services/jmxConfigService'

const props = defineProps<{ jobId: string }>()
const emit = defineEmits<{
  (e: 'done', mbeans: MBeanDto[]): void
  (e: 'back'): void
}>()

const status = ref<'pending' | 'running' | 'done' | 'error'>('pending')
const error = ref<string | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let networkFailures = 0
const MAX_NETWORK_FAILURES = 3

const startPolling = () => {
  pollTimer = setInterval(async () => {
    try {
      const result = await pollDetect(props.jobId)
      networkFailures = 0

      if (result.status === 'DONE') {
        stopPolling()
        status.value = 'done'
        emit('done', result.mbeans)
      } else if (result.status === 'ERROR') {
        stopPolling()
        status.value = 'error'
        error.value = result.error ?? 'Unknown error'
      } else {
        status.value = 'running'
      }
    } catch (e) {
      networkFailures++
      if (networkFailures >= MAX_NETWORK_FAILURES) {
        stopPolling()
        status.value = 'error'
        error.value = 'Network error while polling for job status'
      }
    }
  }, 2000)
}

const stopPolling = () => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => startPolling())
onUnmounted(() => stopPolling())
</script>

<style lang="scss" scoped>
@use "@/styles/typography" as typo;
@import "@/styles/tokens";

.mbean-detection {
  max-width: 600px;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1.5rem;
}

.detecting {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detecting-msg {
  @include typo.body-large();
  color: var($secondary-text-on-surface);
}

.detection-error {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-text {
  @include typo.body-large();
  color: var($error);
}
</style>
