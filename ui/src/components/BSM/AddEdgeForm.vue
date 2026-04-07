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
  <div class="add-edge-form">
    <h4 class="form-section-title">Add Edge</h4>

    <FeatherSelect
      label="Edge Type"
      :options="EDGE_TYPE_OPTIONS"
      textProp="label"
      :modelValue="(selectedTypeOption as any)"
      @update:modelValue="(v: any) => onTypeChange(v)"
    />

    <!-- IP Service fields -->
    <template v-if="form.type === 'ip-service'">
      <FeatherInput
        v-model="ipQuery"
        label="Search IP Services"
        placeholder="Start typing node label…"
        @input="onIpSearch"
      />
      <div v-if="ipResults.length" class="picker-results">
        <div
          v-for="item in ipResults"
          :key="item.id"
          class="picker-item"
          :class="{ selected: form.ipServiceId === item.id }"
          @click="selectIpService(item)"
        >{{ item.label }}</div>
      </div>
      <p v-if="selectedIpService" class="selection-display">
        Selected: <strong>{{ selectedIpService.label }}</strong>
      </p>
      <FeatherInput v-model="form.friendlyName" label="Friendly Name (optional)" />
    </template>

    <!-- Reduction Key fields -->
    <template v-else-if="form.type === 'reduction-key'">
      <FeatherInput v-model="form.reductionKey" label="Reduction Key" />
      <FeatherInput v-model="form.friendlyName" label="Friendly Name (optional)" />
    </template>

    <!-- Child Service fields -->
    <template v-else-if="form.type === 'child'">
      <FeatherSelect
        label="Child Business Service"
        :options="(childOptions as any)"
        textProp="name"
        :modelValue="(selectedChildOption as any)"
        @update:modelValue="(v: any) => { form.childId = v?.id ?? undefined; selectedChildOption = v }"
      />
    </template>

    <!-- Application fields -->
    <template v-else-if="form.type === 'application'">
      <FeatherSelect
        label="Application"
        :options="appOptions"
        textProp="applicationName"
        :modelValue="(selectedAppOption as any)"
        @update:modelValue="(v: any) => { form.applicationId = v?.id ?? undefined; selectedAppOption = v }"
      />
    </template>

    <!-- Shared: Map Function + Weight -->
    <FeatherSelect
      label="Map Function"
      :options="mapFnOptions"
      textProp="name"
      :modelValue="(selectedMapFn as any)"
      @update:modelValue="(v: any) => onMapFnChange(v)"
    />

    <!-- SetTo status parameter -->
    <FeatherSelect
      v-if="form.mapFunction.type === 'SetTo'"
      label="Set To Status"
      :options="STATUS_OPTIONS"
      textProp="label"
      :modelValue="(selectedSetToStatus as any)"
      @update:modelValue="(v: any) => { form.mapFunction.properties['status'] = v?.value; selectedSetToStatus = v }"
    />

    <FeatherInput v-model.number="form.weight" label="Weight" type="number" />

    <div class="form-actions">
      <FeatherButton primary @click="submit" :disabled="!isValid">Add Edge</FeatherButton>
      <FeatherButton text @click="$emit('cancel')">Cancel</FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue'
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherSelect } from '@featherds/select'
import {
  searchIpServices, listApplications, getMapFunctions,
  defaultMapFunction, BSM_STATUSES,
  type IpServicePickerItem, type ApplicationPickerItem,
  type BsmFunctionMetadata, type FunctionDTO, type BusinessService
} from '@/services/bsmService'

const props = defineProps<{
  allServices: BusinessService[]
  currentServiceId?: number
}>()

export interface AddEdgePayload {
  type: 'ip-service' | 'reduction-key' | 'child' | 'application'
  ipServiceId?: number
  friendlyName?: string
  reductionKey?: string
  childId?: number
  applicationId?: number
  mapFunction: FunctionDTO
  weight: number
}

const emit = defineEmits<{
  (e: 'add', payload: AddEdgePayload): void
  (e: 'cancel'): void
}>()

const EDGE_TYPE_OPTIONS = [
  { value: 'ip-service',    label: 'IP Service' },
  { value: 'reduction-key', label: 'Reduction Key' },
  { value: 'child',         label: 'Child Business Service' },
  { value: 'application',   label: 'Application' },
]

const STATUS_OPTIONS = BSM_STATUSES.map(s => ({ value: s, label: s[0] + s.slice(1).toLowerCase() }))

const form = ref<AddEdgePayload>({
  type: 'ip-service',
  ipServiceId: undefined,
  friendlyName: '',
  reductionKey: '',
  childId: undefined,
  applicationId: undefined,
  mapFunction: defaultMapFunction(),
  weight: 1,
})

const selectedTypeOption = ref(EDGE_TYPE_OPTIONS[0])
const selectedMapFn = ref<BsmFunctionMetadata | null>(null)
const selectedSetToStatus = ref<{ value: string; label: string } | null>(null)
const selectedChildOption = ref<BusinessService | null>(null)
const selectedAppOption = ref<ApplicationPickerItem | null>(null)
const selectedIpService = ref<IpServicePickerItem | null>(null)

const mapFnOptions = ref<BsmFunctionMetadata[]>([])
const ipQuery = ref('')
const ipResults = ref<IpServicePickerItem[]>([])
const appOptions = ref<ApplicationPickerItem[]>([])

const childOptions = computed(() =>
  props.allServices.filter(s => s.id !== props.currentServiceId)
)

onMounted(async () => {
  mapFnOptions.value = await getMapFunctions()
  selectedMapFn.value = mapFnOptions.value.find(f => f.name === 'Identity') ?? mapFnOptions.value[0] ?? null
  if (selectedMapFn.value) {
    form.value.mapFunction = { type: selectedMapFn.value.name, properties: {} }
  }
  appOptions.value = await listApplications()
})

function onTypeChange(v: any) {
  selectedTypeOption.value = v
  form.value.type = v.value
}

function onMapFnChange(v: BsmFunctionMetadata | null) {
  selectedMapFn.value = v
  if (v) {
    form.value.mapFunction = { type: v.name, properties: {} }
    selectedSetToStatus.value = null
  }
}

let ipDebounce: ReturnType<typeof setTimeout>
async function onIpSearch() {
  clearTimeout(ipDebounce)
  ipDebounce = setTimeout(async () => {
    if (ipQuery.value.length < 2) { ipResults.value = []; return }
    ipResults.value = await searchIpServices(ipQuery.value)
  }, 300)
}

function selectIpService(item: IpServicePickerItem) {
  selectedIpService.value = item
  form.value.ipServiceId = item.id
  ipResults.value = []
  ipQuery.value = item.label
}

const isValid = computed(() => {
  switch (form.value.type) {
    case 'ip-service':    return !!form.value.ipServiceId
    case 'reduction-key': return !!form.value.reductionKey?.trim()
    case 'child':         return !!form.value.childId
    case 'application':   return !!form.value.applicationId
  }
})

function submit() {
  if (!isValid.value) return
  emit('add', { ...form.value })
}
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.add-edge-form {
  border: 1px solid var($border-on-surface);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var($surface-dark);
}

.form-section-title {
  @include typo.subtitle1();
  margin: 0 0 0.25rem;
}

.picker-results {
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  max-height: 160px;
  overflow-y: auto;
  background: var($surface);
}

.picker-item {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  @include typo.body-small();

  &:hover, &.selected { background: var($surface-dark); }
}

.selection-display {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
</style>
