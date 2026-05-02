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
  <div class="wallboard-config">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">Ops Board Configuration</h1>

    <div v-if="loading" class="loading-state">
      <PanelLoader :size="40" />
    </div>

    <div v-else-if="loadError" class="error-state">
      <p class="error-text">{{ loadError }}</p>
      <Button label="Retry" @click="loadData" />
    </div>

    <template v-else>
      <div class="toolbar">
        <Button :label="saving ? 'Saving…' : 'Save'" @click="save" :disabled="saving || !isDirty" />
        <Button v-if="isDirty" text label="Discard Changes" @click="resetChanges" />
      </div>

      <div class="editor-layout">
        <WallboardList
          :wallboards="config.wallboards"
          :selectedIndex="selectedIndex"
          :disabled="saving"
          @select="selectedIndex = $event"
          @add="addBoard"
          @delete="deleteBoard"
        />

        <WallboardEditor
          v-if="selectedBoard"
          :modelValue="selectedBoard"
          @update:modelValue="updateSelectedBoard"
        />

        <div v-else class="no-selection">
          <p>Select a board to edit, or create a new one.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import WallboardList from '@/components/WallboardConfig/WallboardList.vue'
import WallboardEditor from '@/components/WallboardConfig/WallboardEditor.vue'
import { getConfig, saveConfig, makeDefaultWallboard } from '@/services/wallboardConfigService'
import type { WallboardsConfig, WallboardEntry } from '@/services/wallboardConfigService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'Ops Board Configuration', to: '/wallboard-config' }
]

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const config = ref<WallboardsConfig>({ wallboards: [] })
const savedSnapshot = ref<string>('')
const selectedIndex = ref(0)

const isDirty = computed(() => JSON.stringify(config.value) !== savedSnapshot.value)
const selectedBoard = computed(() => config.value.wallboards[selectedIndex.value] ?? null)

const loadData = async () => {
  loading.value = true
  loadError.value = null
  try {
    const cfg = await getConfig()
    config.value = cfg
    savedSnapshot.value = JSON.stringify(cfg)
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load configuration'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await saveConfig(config.value)
    savedSnapshot.value = JSON.stringify(config.value)
    showSnackBar({ msg: 'Ops board configuration saved.' })
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? 'Save failed'
    showSnackBar({ msg })
  } finally {
    saving.value = false
  }
}

const resetChanges = () => {
  config.value = JSON.parse(savedSnapshot.value)
  selectedIndex.value = 0
}

const addBoard = () => {
  config.value.wallboards.push(makeDefaultWallboard())
  selectedIndex.value = config.value.wallboards.length - 1
}

const deleteBoard = (i: number) => {
  config.value.wallboards.splice(i, 1)
  selectedIndex.value = Math.max(0, Math.min(selectedIndex.value, config.value.wallboards.length - 1))
}

const updateSelectedBoard = (updated: WallboardEntry) => {
  if (updated.default) {
    config.value.wallboards.forEach((b, i) => {
      if (i !== selectedIndex.value) b.default = false
    })
  }
  config.value.wallboards[selectedIndex.value] = updated
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/typography" as typo;
@import "@/styles/tokens";

.wallboard-config {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  box-sizing: border-box;
}

.page-title {
  @include typo.headline1();
  margin: 0;
}

.toolbar {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.editor-layout {
  display: flex;
  flex: 1;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  overflow: hidden;
  min-height: 0;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
}

.error-text {
  @include typo.body-large();
  color: var($error);
}

.no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var($secondary-text-on-surface);
}
</style>
