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
  <FeatherDialog
    :modelValue="visible"
    :labels="dialogLabels"
    @update:modelValue="$emit('close')"
  >
    <div class="config-content">
      <FeatherInput
        v-model="draft.title"
        label="Widget Title"
        class="config-field"
      />

      <div
        v-if="draft.type !== 'summary'"
        class="config-field"
      >
        <p class="field-label">Filter by Categories <span class="field-hint">(leave empty for all)</span></p>
        <div class="category-list">
          <FeatherCheckbox
            v-for="cat in allCategories"
            :key="cat.id"
            v-model="selectedCategories[cat.name]"
          >
            {{ cat.name }}
          </FeatherCheckbox>
          <span
            v-if="!allCategories.length"
            class="empty-hint"
          >Loading categories…</span>
        </div>
      </div>

      <div
        v-if="draft.type === 'alarms'"
        class="config-field"
      >
        <p class="field-label">Severities <span class="field-hint">(leave empty for all)</span></p>
        <div class="severity-list">
          <FeatherCheckbox
            v-for="sev in SEVERITIES"
            :key="sev"
            v-model="selectedSeverities[sev]"
          >
            <span :class="`severity-label severity-${sev.toLowerCase()}`">{{ sev }}</span>
          </FeatherCheckbox>
        </div>
      </div>

      <FeatherInput
        v-if="draft.type !== 'summary'"
        v-model.number="draft.limit"
        label="Max rows to show"
        type="number"
        class="config-field"
      />

      <div
        v-if="draft.type !== 'summary' && availableColumns.length"
        class="config-field"
      >
        <p class="field-label">Visible Columns</p>
        <div class="column-list">
          <FeatherCheckbox
            v-for="col in availableColumns"
            :key="col.key"
            v-model="selectedColumns[col.key]"
          >
            {{ col.label }}
          </FeatherCheckbox>
        </div>
      </div>

      <FeatherSelect
        v-model="selectedRefreshInterval"
        :options="refreshOptions"
        text-prop="label"
        class="config-field"
        label="Refresh interval"
      />

      <div class="config-actions">
        <FeatherButton @click="$emit('close')">Cancel</FeatherButton>
        <FeatherButton
          primary
          @click="save"
        >Save</FeatherButton>
      </div>
    </div>
  </FeatherDialog>
</template>

<script setup lang="ts">
import { FeatherDialog } from '@featherds/dialog'
import { FeatherButton } from '@featherds/button'
import { FeatherCheckbox } from '@featherds/checkbox'
import { FeatherInput } from '@featherds/input'
import { FeatherSelect } from '@featherds/select'
import { type WidgetConfig, WIDGET_COLUMNS, type ColumnDef } from '@/services/dashboardConfigService'
import { type Category } from '@/types'
import API from '@/services'

const props = defineProps<{
  visible: boolean
  widgetConfig: WidgetConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', config: WidgetConfig): void
}>()

const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'NORMAL', 'INDETERMINATE']

const availableColumns = computed<ColumnDef[]>(() => {
  const t = draft.value.type as 'alarms' | 'outages' | 'nodes' | 'summary'
  return t !== 'summary' ? (WIDGET_COLUMNS[t] ?? []) : []
})

const refreshOptions = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 }
]

const dialogLabels = reactive({ title: 'Configure Widget', close: 'Close' })

const allCategories = ref<Category[]>([])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const draft = ref<any>({ ...props.widgetConfig })

// checkbox maps for multi-select
const selectedCategories = ref<Record<string, boolean>>({})
const selectedSeverities = ref<Record<string, boolean>>({})
const selectedColumns = ref<Record<string, boolean>>({})

const selectedRefreshInterval = ref(
  refreshOptions.find(o => o.value === props.widgetConfig.refreshInterval) ?? refreshOptions[1]
)

watch(
  () => props.widgetConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cfg: any) => {
    draft.value = { ...cfg }
    selectedCategories.value = {}
    for (const c of (cfg.categories ?? [])) selectedCategories.value[c] = true
    selectedSeverities.value = {}
    for (const s of (cfg.severities ?? [])) selectedSeverities.value[s] = true
    selectedRefreshInterval.value = refreshOptions.find(o => o.value === cfg.refreshInterval) ?? refreshOptions[1]
    selectedColumns.value = {}
    if (cfg.type !== 'summary') {
      const tableType = cfg.type as 'alarms' | 'outages' | 'nodes'
      const cols = WIDGET_COLUMNS[tableType] ?? []
      // if columns is unset treat all as enabled
      const enabled = cfg.columns?.length ? cfg.columns : cols.map((c: ColumnDef) => c.key)
      for (const c of cols) selectedColumns.value[c.key] = enabled.includes(c.key)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  const resp = await API.getCategories()
  if (resp) {
    allCategories.value = [...resp.category].sort((a, b) => a.name.localeCompare(b.name))
  }
})

const save = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved: WidgetConfig = {
    ...draft.value,
    categories: Object.entries(selectedCategories.value)
      .filter(([, v]) => v)
      .map(([k]) => k),
    severities: Object.entries(selectedSeverities.value)
      .filter(([, v]) => v)
      .map(([k]) => k),
    refreshInterval: selectedRefreshInterval.value?.value ?? 60,
    columns: draft.value.type !== 'summary'
      ? Object.entries(selectedColumns.value).filter(([, v]) => v).map(([k]) => k)
      : undefined
  } as any
  emit('save', saved)
}
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.config-content {
  min-width: 380px;
  max-width: 500px;
}

.config-field {
  margin-bottom: 16px;
}

.field-label {
  @include subtitle2;
  margin-bottom: 8px;
  color: var($primary-text-on-surface);
}

.field-hint {
  @include body-small;
  color: var($secondary-text-on-surface);
  font-weight: normal;
}

.category-list,
.severity-list,
.column-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  max-height: 200px;
  overflow-y: auto;
}

.empty-hint {
  @include body-small;
  color: var($secondary-text-on-surface);
}

.severity-label {
  text-transform: capitalize;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
