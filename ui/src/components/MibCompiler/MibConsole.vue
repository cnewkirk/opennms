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
  <div class="mib-console">
    <div class="console-header">
      <h3 class="console-title">Console</h3>
      <FeatherButton text @click="store.clearLog()">Clear Log</FeatherButton>
    </div>
    <div ref="logContainer" class="console-log">
      <div
        v-for="(entry, i) in store.logEntries"
        :key="i"
        class="log-entry"
        :class="entry.level"
      >
        <span class="log-time">{{ entry.timestamp }}</span>
        <span class="log-level">[{{ entry.level.toUpperCase() }}]</span>
        <span class="log-message" v-html="entry.message" />
      </div>
      <div v-if="store.logEntries.length === 0" class="log-empty">
        No log entries yet. Use the MIB tree to perform operations.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { useMibCompilerStore } from '@/stores/mibCompilerStore'

const store = useMibCompilerStore()
const logContainer = ref<HTMLElement | null>(null)

watch(
  () => store.logEntries.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/themes/variables";

.mib-console {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var($border-on-surface);
}

.console-title {
  @include subtitle1();
  margin: 0;
}

.console-log {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1rem;
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
}

.log-entry {
  padding: 2px 0;

  &.error .log-level { color: #d32f2f; font-weight: bold; }
  &.warn .log-level { color: #f57c00; font-weight: bold; }
  &.info .log-level { color: #388e3c; font-weight: bold; }
  &.debug .log-level { color: var($secondary-text-on-surface); }
}

.log-time {
  color: var($secondary-text-on-surface);
  margin-right: 0.5rem;
}

.log-level {
  margin-right: 0.5rem;
}

.log-message {
  color: var($primary-text-on-surface);
}

.log-empty {
  color: var($secondary-text-on-surface);
  font-style: italic;
  padding: 1rem 0;
}
</style>
