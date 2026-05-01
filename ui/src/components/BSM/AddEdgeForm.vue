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

    <Select
      :options="EDGE_TYPE_OPTIONS"
      optionLabel="label"
      :modelValue="(selectedTypeOption as any)"
      @update:modelValue="(v: any) => onTypeChange(v)"
      placeholder="Edge Type"
      class="full-width"
    />

    <!-- IP Service fields -->
    <template v-if="form.type === 'ip-service'">
      <span class="p-float-label">
        <InputText
          v-model="ipQuery"
          placeholder="Search IP Services"
          @input="onIpSearch"
          class="full-width"
        />
      </span>
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
      <InputText v-model="form.friendlyName" placeholder="Friendly Name (optional)" class="full-width" />
    </template>

    <!-- Reduction Key fields -->
    <template v-else-if="form.type === 'reduction-key'">
      <InputText v-model="form.reductionKey" placeholder="Reduction Key" class="full-width" />
      <InputText v-model="form.friendlyName" placeholder="Friendly Name (optional)" class="full-width" />
    </template>

    <!-- Child Service fields -->
    <template v-else-if="form.type === 'child'">
      <Select
        :options="(childOptions as any)"
        optionLabel="name"
        :modelValue="(selectedChildOption as any)"
        @update:modelValue="(v: any) => { form.childId = v?.id ?? undefined; selectedChildOption = v }"
        placeholder="Child Business Service"
        class="full-width"
      />
    </template>

    <!-- Application fields -->
    <template v-else-if="form.type === 'application'">
      <Select
        :options="appOptions"
        optionLabel="applicationName"
        :modelValue="(selectedAppOption as any)"
        @update:modelValue="(v: any) => { form.applicationId = v?.id ?? undefined; selectedAppOption = v }"
        placeholder="Application"
        class="full-width"
      />
    </template>

    <!-- Shared: Map Function + Weight -->
    <Select
      :options="mapFnOptions"
      optionLabel="name"
      :modelValue="(selectedMapFn as any)"
      @update:modelValue="(v: any) => onMapFnChange(v)"
      placeholder="Map Function"
      class="full-width"
    />

    <!-- SetTo status parameter -->
    <Select
      v-if="form.mapFunction.type === 'SetTo'"
      :options="STATUS_OPTIONS"
      optionLabel="label"
      :modelValue="(selectedSetToStatus as any)"
      @update:modelValue="(v: any) => { form.mapFunction.properties['status'] = v?.value; selectedSetToStatus = v }"
      placeholder="Set To Status"
      class="full-width"
    />

    <InputText :modelValue="String(form.weight)" @update:modelValue="(v: any) => form.weight = Number(v)" placeholder="Weight" type="number" class="full-width" />

    <div class="form-actions">
      <Button label="Add Edge" @click="submit" :disabled="!isValid" />
      <Button text label="Cancel" @click="$emit('cancel')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
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
@use '@/styles/vars' as vars;
@use "@featherds/styles/mixins/typography" as typo;
@import "@/styles/tokens";

.add-edge-form {
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
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
  border-radius: vars.$border-radius-surface;
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

.full-width {
  width: 100%;
}
</style>
