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
  <div class="editor-overlay" @click.self="$emit('close')">
    <div class="editor-panel">
      <div class="editor-header">
        <h2 class="editor-title">{{ isNew ? 'New Business Service' : 'Edit: ' + form.name }}</h2>
        <Button text icon="pi pi-times" @click="$emit('close')" />
      </div>

      <div v-if="loading" class="loading-state"><PanelLoader :size="36" /></div>

      <template v-else>
        <!-- Name -->
        <section class="editor-section">
          <label class="field-label">Service Name</label>
          <InputText v-model="form.name" class="full-width" :class="{ 'p-invalid': nameError }" />
          <small v-if="nameError" class="p-error">{{ nameError }}</small>
        </section>

        <!-- Reduce Function -->
        <section class="editor-section">
          <h3 class="section-title">Reduce Function</h3>
          <Select
            :options="reduceFnOptions"
            optionLabel="name"
            :modelValue="(selectedReduceFn as any)"
            @update:modelValue="(v: any) => onReduceFnChange(v)"
            placeholder="Type"
            class="full-width"
          />
          <InputText
            v-if="form['reduce-function'].type === 'Threshold'"
            v-model="thresholdValue"
            placeholder="Threshold (0.0 – 1.0)"
            type="number"
            class="full-width"
            @update:modelValue="(v: any) => form['reduce-function'].properties['threshold'] = String(v)"
          />
          <Select
            v-if="form['reduce-function'].type === 'HighestSeverityAbove'"
            :options="STATUS_OPTIONS"
            optionLabel="label"
            :modelValue="(selectedThresholdStatus as any)"
            @update:modelValue="(v: any) => { form['reduce-function'].properties['threshold'] = v?.value; selectedThresholdStatus = v }"
            placeholder="Threshold Status"
            class="full-width"
          />
          <InputText
            v-if="form['reduce-function'].type === 'ExponentialPropagation'"
            v-model="expBase"
            placeholder="Base"
            type="number"
            class="full-width"
            @update:modelValue="(v: any) => form['reduce-function'].properties['base'] = String(v)"
          />
        </section>

        <!-- Attributes -->
        <section class="editor-section">
          <div class="section-header">
            <h3 class="section-title">Attributes</h3>
            <Button text icon="pi pi-plus" @click="addAttribute" />
          </div>
          <div v-for="(attr, i) in attributeRows" :key="i" class="attr-row">
            <InputText v-model="attr.key" placeholder="Key" class="attr-input" />
            <InputText v-model="attr.value" placeholder="Value" class="attr-input" />
            <Button text icon="pi pi-trash" @click="removeAttribute(i)" />
          </div>
          <p v-if="attributeRows.length === 0" class="empty-hint">No attributes.</p>
        </section>

        <!-- Edges (existing service only) -->
        <section v-if="!isNew" class="editor-section">
          <div class="section-header">
            <h3 class="section-title">Edges ({{ edges.length }})</h3>
            <Button text icon="pi pi-plus" @click="showAddEdge = !showAddEdge" />
          </div>

          <AddEdgeForm
            v-if="showAddEdge"
            :allServices="allServices"
            :currentServiceId="service?.id"
            @add="onAddEdge"
            @cancel="showAddEdge = false"
          />

          <p v-if="edges.length === 0 && !showAddEdge" class="empty-hint">No edges configured.</p>

          <table v-else-if="edges.length > 0" class="edge-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Target</th>
                <th>Map Fn</th>
                <th>Wt</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="edge in edges" :key="edge.id">
                <td>{{ edgeTypeLabel(edge.type) }}</td>
                <td class="edge-target">{{ edgeLabel(edge) }}</td>
                <td>{{ edge.mapFunction.type }}</td>
                <td>{{ edge.weight }}</td>
                <td><span :class="['status-chip', statusColor(edge.operationalStatus)]">{{ edge.operationalStatus }}</span></td>
                <td>
                  <Button text icon="pi pi-trash" @click="onRemoveEdge(edge.id)" :disabled="removingEdge === edge.id" />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <p v-if="isNew" class="new-service-note">Save the service first, then reopen it to add edges.</p>

        <!-- Footer -->
        <div class="editor-footer">
          <Button :label="saving ? 'Saving…' : 'Save'" @click="save" :disabled="saving || !form.name.trim()" />
          <Button text label="Cancel" @click="$emit('close')" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import AddEdgeForm from './AddEdgeForm.vue'
import type { AddEdgePayload } from './AddEdgeForm.vue'
import {
  getReduceFunctions, normalizeEdges, edgeLabel, edgeTypeLabel, statusColor,
  addIpServiceEdge, addReductionKeyEdge, addChildEdge, addApplicationEdge, removeEdge,
  defaultReduceFunction, BSM_STATUSES,
  type BusinessService, type BsmEdge, type BsmFunctionMetadata, type FunctionDTO
} from '@/services/bsmService'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps<{
  service: BusinessService | null
  allServices: BusinessService[]
}>()

const emit = defineEmits<{
  (e: 'save', payload: { name: string; attributes: Record<string, string>; 'reduce-function': FunctionDTO }): void
  (e: 'close'): void
  (e: 'edgesChanged'): void
}>()

const { showSnackBar } = useSnackbar()

const isNew = computed(() => !props.service)
const loading = ref(false)
const saving = ref(false)
const nameError = ref('')
const showAddEdge = ref(false)
const removingEdge = ref<number | null>(null)

const reduceFnOptions = ref<BsmFunctionMetadata[]>([])
const selectedReduceFn = ref<BsmFunctionMetadata | null>(null)
const selectedThresholdStatus = ref<{ value: string; label: string } | null>(null)
const thresholdValue = ref('0.5')
const expBase = ref('2.0')

const STATUS_OPTIONS = BSM_STATUSES.map(s => ({ value: s, label: s[0] + s.slice(1).toLowerCase() }))

interface AttrRow { key: string; value: string }
const attributeRows = ref<AttrRow[]>([])

const form = ref<{
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
}>({
  name: '',
  attributes: {},
  'reduce-function': defaultReduceFunction(),
})

const edges = computed<BsmEdge[]>(() =>
  props.service ? normalizeEdges(props.service) : []
)

onMounted(async () => {
  loading.value = true
  reduceFnOptions.value = await getReduceFunctions()

  if (props.service) {
    form.value.name = props.service.name
    form.value['reduce-function'] = { ...props.service['reduce-function'], properties: { ...props.service['reduce-function'].properties } }
    const attrs = props.service.attributes ?? {}
    attributeRows.value = Object.entries(attrs).map(([key, value]) => ({ key, value }))
    const rfType = form.value['reduce-function'].type
    selectedReduceFn.value = reduceFnOptions.value.find(f => f.name === rfType) ?? null
    if (rfType === 'Threshold') thresholdValue.value = form.value['reduce-function'].properties['threshold'] ?? '0.5'
    if (rfType === 'ExponentialPropagation') expBase.value = form.value['reduce-function'].properties['base'] ?? '2.0'
    if (rfType === 'HighestSeverityAbove') {
      const v = form.value['reduce-function'].properties['threshold']
      selectedThresholdStatus.value = STATUS_OPTIONS.find(s => s.value === v) ?? null
    }
  } else {
    selectedReduceFn.value = reduceFnOptions.value.find(f => f.name === 'HighestSeverity') ?? reduceFnOptions.value[0] ?? null
  }
  loading.value = false
})

function onReduceFnChange(v: BsmFunctionMetadata | null) {
  selectedReduceFn.value = v
  if (v) form.value['reduce-function'] = { type: v.name, properties: {} }
}

function addAttribute() {
  attributeRows.value.push({ key: '', value: '' })
}
function removeAttribute(i: number) {
  attributeRows.value.splice(i, 1)
}

function buildPayload() {
  const attributes: Record<string, string> = {}
  for (const row of attributeRows.value) {
    if (row.key.trim()) attributes[row.key.trim()] = row.value
  }
  return {
    name: form.value.name.trim(),
    attributes,
    'reduce-function': form.value['reduce-function'],
  }
}

function save() {
  if (!form.value.name.trim()) { nameError.value = 'Name is required'; return }
  nameError.value = ''
  saving.value = true
  emit('save', buildPayload())
  saving.value = false
}

async function onAddEdge(payload: AddEdgePayload) {
  if (!props.service) return
  try {
    const id = props.service.id
    switch (payload.type) {
      case 'ip-service':
        await addIpServiceEdge(id, {
          'ip-service-id': payload.ipServiceId!,
          'friendly-name': payload.friendlyName || undefined,
          'map-function': payload.mapFunction,
          weight: payload.weight,
        })
        break
      case 'reduction-key':
        await addReductionKeyEdge(id, {
          'reduction-key': payload.reductionKey!,
          'friendly-name': payload.friendlyName || undefined,
          'map-function': payload.mapFunction,
          weight: payload.weight,
        })
        break
      case 'child':
        await addChildEdge(id, {
          'child-id': payload.childId!,
          'map-function': payload.mapFunction,
          weight: payload.weight,
        })
        break
      case 'application':
        await addApplicationEdge(id, {
          applicationId: payload.applicationId!,
          mapFunction: payload.mapFunction,
          weight: payload.weight,
        })
        break
    }
    showAddEdge.value = false
    emit('edgesChanged')
  } catch (e: any) {
    showSnackBar({ msg: `Failed to add edge: ${e?.response?.data?.message ?? e?.message ?? 'Unknown error'}` })
  }
}

async function onRemoveEdge(edgeId: number) {
  if (!props.service) return
  removingEdge.value = edgeId
  try {
    await removeEdge(props.service.id, edgeId)
    emit('edgesChanged')
  } catch (e: any) {
    showSnackBar({ msg: `Failed to remove edge: ${e?.message ?? 'Unknown error'}` })
  } finally {
    removingEdge.value = null
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/typography" as typo;
@import "@/styles/tokens";

.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

.editor-panel {
  background: var($surface);
  width: min(620px, 100vw);
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 0;
  box-shadow: -4px 0 24px rgba(0,0,0,0.18);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-shrink: 0;
}

.editor-title {
  @include typo.headline2();
  margin: 0;
}

.editor-section {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  @include typo.subtitle1();
  margin: 0;
  color: var($secondary-text-on-surface);
}

.attr-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;

  .attr-input { flex: 1; }
}

.edge-table {
  width: 100%;
  border-collapse: collapse;
  @include typo.body-small();

  th {
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-bottom: 2px solid var($border-on-surface);
    color: var($secondary-text-on-surface);
    white-space: nowrap;
  }

  td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var($border-on-surface);
    vertical-align: middle;
  }
}

.edge-target {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip {
  display: inline-block;
  padding: 2px 6px;
  border-radius: vars.$border-radius-surface;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;

  &.status-critical      { background: var($error);         color: var($primary-text-on-color); }
  &.status-major         { background: var($major);         color: var($primary-text-on-color); }
  &.status-minor         { background: var($minor);         color: var($primary-text-on-color); }
  &.status-warning       { background: var($warning);       color: #1a1a2e; }
  &.status-normal        { background: var($success);       color: var($primary-text-on-color); }
  &.status-indeterminate { background: var($indeterminate); color: var($primary-text-on-color); }
}

.empty-hint {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  font-style: italic;
  margin: 0;
}

.new-service-note {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  font-style: italic;
  margin-bottom: 1rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.full-width {
  width: 100%;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var($secondary-text-on-surface);
  margin-bottom: 2px;
}

.editor-footer {
  display: flex;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid var($border-on-surface);
  flex-shrink: 0;
}
</style>
