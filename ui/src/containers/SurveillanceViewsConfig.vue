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
  <div class="surveillance-views-config">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">Surveillance Views Configuration</h1>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
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
        <SurveillanceViewList
          :views="config.views"
          :selectedIndex="selectedIndex"
          :defaultView="config.defaultView"
          :disabled="saving"
          @select="selectedIndex = $event"
          @add="addView"
          @delete="deleteView"
        />

        <SurveillanceViewEditor
          v-if="selectedView"
          :modelValue="selectedView"
          :isDefault="selectedView.name === config.defaultView"
          :allCategories="allCategories"
          @update:modelValue="updateSelectedView"
          @setDefault="config.defaultView = selectedView?.name ?? ''"
        />

        <div v-else class="no-selection">
          <p>Select a view to edit, or create a new one.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SurveillanceViewList from '@/components/SurveillanceViewsConfig/SurveillanceViewList.vue'
import SurveillanceViewEditor from '@/components/SurveillanceViewsConfig/SurveillanceViewEditor.vue'
import { getConfig, saveConfig } from '@/services/surveillanceViewConfigService'
import type { SurveillanceViewConfig, SurveillanceView } from '@/services/surveillanceViewConfigService'
import { v2 } from '@/services/axiosInstances'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'Surveillance Views Configuration', to: '/surveillance-views-config' }
]

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const config = ref<SurveillanceViewConfig>({ defaultView: '', views: [] })
const savedSnapshot = ref<string>('')
const selectedIndex = ref(0)
const allCategories = ref<string[]>([])

const isDirty = computed(() => JSON.stringify(config.value) !== savedSnapshot.value)
const selectedView = computed(() => config.value.views[selectedIndex.value] ?? null)

const loadData = async () => {
  loading.value = true
  loadError.value = null
  try {
    const [cfg, catResp] = await Promise.all([
      getConfig(),
      v2.get('/categories').catch(() => ({ data: { category: [] } }))
    ])
    config.value = cfg
    savedSnapshot.value = JSON.stringify(cfg)
    allCategories.value = (catResp.data?.category ?? []).map((c: any) => c.name as string).sort()
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
    showSnackBar({ msg: 'Surveillance view configuration saved.' })
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

const addView = () => {
  const newView: SurveillanceView = {
    name: `view-${config.value.views.length + 1}`,
    refreshSeconds: 300,
    rows: [],
    columns: []
  }
  config.value.views.push(newView)
  selectedIndex.value = config.value.views.length - 1
}

const deleteView = (i: number) => {
  const deleted = config.value.views[i]
  config.value.views.splice(i, 1)
  if (deleted.name === config.value.defaultView) {
    config.value.defaultView = ''
  }
  selectedIndex.value = Math.min(selectedIndex.value, config.value.views.length - 1)
}

const updateSelectedView = (updated: SurveillanceView) => {
  config.value.views[selectedIndex.value] = updated
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@featherds/styles/mixins/typography" as typo;
@import "@/styles/tokens";

.surveillance-views-config {
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
