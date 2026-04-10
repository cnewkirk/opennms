# BSM Admin + Final Vaadin Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `admin/bsm/adminpage.jsp` with a full Vue CRUD admin page for Business Service Management, and redirect `admin/manageEvents.jsp` and `surveillance-box.jsp`, eliminating all remaining Vaadin iframes.

**Architecture:** `bsmService.ts` owns all types and API calls. `BusinessServicesAdmin.vue` is the page container with a services table. `BusinessServiceEditor.vue` is a slide-over panel for create/edit with inline edge management via `AddEdgeForm.vue`. No Pinia — local reactive state only. All data from `/api/v2/business-services` and its sub-resources.

**Tech Stack:** Vue 3 Composition API (`<script setup lang="ts">`), Feather DS, `v2` axios instance, Vitest + happy-dom

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `ui/src/services/bsmService.ts` | All types + API functions |
| Create | `ui/tests/bsm.test.ts` | Unit tests for service functions |
| Create | `ui/src/components/BSM/AddEdgeForm.vue` | Inline form: type selector → conditional fields → map function picker |
| Create | `ui/src/components/BSM/BusinessServiceEditor.vue` | Slide-over: name + reduce fn + attributes + edge table |
| Create | `ui/src/containers/BusinessServicesAdmin.vue` | Page: services table + reload daemon button |
| Modify | `ui/src/main/router/index.ts` | Add `/bsm-admin` route with admin guard |
| Modify | `ui/src/components/Menu/SideMenu.vue` | Add `admin/bsm/adminpage.jsp` + `admin/manageEvents.jsp` to legacyToVueRoutes |
| Replace | `opennms-webapp/src/main/webapp/admin/bsm/adminpage.jsp` | Redirect to `#/bsm-admin` |
| Replace | `opennms-webapp/src/main/webapp/admin/manageEvents.jsp` | Redirect to `#/event-config` |
| Replace | `opennms-webapp/src/main/webapp/surveillance-box.jsp` | Redirect to `#/surveillance-dashboard` |

---

## Task 1: `bsmService.ts` — types + API

**Files:**
- Create: `ui/src/services/bsmService.ts`
- Create: `ui/tests/bsm.test.ts`

- [ ] **Step 1: Write failing tests**

Create `ui/tests/bsm.test.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { describe, it, expect } from 'vitest'
import { extractIdFromUrl, edgeLabel, statusColor } from '@/services/bsmService'

describe('extractIdFromUrl', () => {
  it('extracts numeric id from BSM URL', () => {
    expect(extractIdFromUrl('/api/v2/business-services/42')).toBe(42)
  })
  it('handles URL with trailing slash', () => {
    expect(extractIdFromUrl('/api/v2/business-services/7/')).toBe(7)
  })
})

describe('edgeLabel', () => {
  it('labels ip-service edge with node and service', () => {
    const edge = { type: 'ip-service' as const, ipService: { id: 1, nodeLabel: 'router1', ipAddress: '10.0.0.1', serviceName: 'ICMP' }, friendlyName: undefined, id: 1, operationalStatus: 'NORMAL', mapFunction: { type: 'Identity', properties: {} }, weight: 1 }
    expect(edgeLabel(edge)).toBe('router1 / 10.0.0.1 / ICMP')
  })
  it('labels ip-service edge with friendly name when present', () => {
    const edge = { type: 'ip-service' as const, ipService: { id: 1, nodeLabel: 'router1', ipAddress: '10.0.0.1', serviceName: 'ICMP' }, friendlyName: 'My Router ICMP', id: 1, operationalStatus: 'NORMAL', mapFunction: { type: 'Identity', properties: {} }, weight: 1 }
    expect(edgeLabel(edge)).toBe('My Router ICMP')
  })
  it('labels reduction-key edge', () => {
    const edge = { type: 'reduction-key' as const, reductionKey: 'uei.opennms.org/test::1', friendlyName: undefined, id: 2, operationalStatus: 'NORMAL', mapFunction: { type: 'Identity', properties: {} }, weight: 1 }
    expect(edgeLabel(edge)).toBe('uei.opennms.org/test::1')
  })
  it('labels reduction-key edge with friendly name', () => {
    const edge = { type: 'reduction-key' as const, reductionKey: 'uei.opennms.org/test::1', friendlyName: 'My Alert', id: 2, operationalStatus: 'NORMAL', mapFunction: { type: 'Identity', properties: {} }, weight: 1 }
    expect(edgeLabel(edge)).toBe('My Alert')
  })
  it('labels child edge', () => {
    const edge = { type: 'child' as const, childId: 5, id: 3, operationalStatus: 'NORMAL', mapFunction: { type: 'Identity', properties: {} }, weight: 1 }
    expect(edgeLabel(edge)).toBe('Child Service #5')
  })
  it('labels application edge', () => {
    const edge = { type: 'application' as const, application: { id: 2, applicationName: 'WebApp' }, id: 4, operationalStatus: 'NORMAL', mapFunction: { type: 'Identity', properties: {} }, weight: 1 }
    expect(edgeLabel(edge)).toBe('WebApp')
  })
})

describe('statusColor', () => {
  it('returns correct color class for CRITICAL', () => {
    expect(statusColor('CRITICAL')).toBe('status-critical')
  })
  it('returns correct color class for NORMAL', () => {
    expect(statusColor('NORMAL')).toBe('status-normal')
  })
  it('returns unknown class for unknown status', () => {
    expect(statusColor('UNKNOWN')).toBe('status-indeterminate')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn test --run tests/bsm.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '@/services/bsmService'"

- [ ] **Step 3: Create `bsmService.ts`**

Create `ui/src/services/bsmService.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { v2 } from './axiosInstances'

// ─── Status ──────────────────────────────────────────────────────────────────

export const BSM_STATUSES = ['INDETERMINATE', 'NORMAL', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL'] as const
export type BsmStatus = typeof BSM_STATUSES[number]

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    CRITICAL:      'status-critical',
    MAJOR:         'status-major',
    MINOR:         'status-minor',
    WARNING:       'status-warning',
    NORMAL:        'status-normal',
    INDETERMINATE: 'status-indeterminate',
  }
  return map[status] ?? 'status-indeterminate'
}

// ─── Functions ────────────────────────────────────────────────────────────────

export interface BsmFunctionParam {
  key: string
  type: string     // 'float' | 'double' | 'status' | ...
  description: string
  required: boolean
}

export interface BsmFunctionMetadata {
  type: string     // 'MapFunction' | 'ReduceFunction'
  name: string
  description: string
  parameter: BsmFunctionParam[]
}

export interface FunctionDTO {
  type: string
  properties: Record<string, string>
}

// ─── Edges ────────────────────────────────────────────────────────────────────

export interface IpServiceInfo {
  id: number
  nodeLabel: string
  ipAddress: string
  serviceName: string
}

export interface ApplicationInfo {
  id: number
  applicationName: string
}

interface EdgeBase {
  id: number
  operationalStatus: string
  mapFunction: FunctionDTO
  weight: number
}

export interface IpServiceEdge extends EdgeBase {
  type: 'ip-service'
  ipService: IpServiceInfo
  friendlyName?: string
}

export interface ReductionKeyEdge extends EdgeBase {
  type: 'reduction-key'
  reductionKey: string
  friendlyName?: string
}

export interface ChildEdge extends EdgeBase {
  type: 'child'
  childId: number
}

export interface ApplicationEdge extends EdgeBase {
  type: 'application'
  application: ApplicationInfo
}

export type BsmEdge = IpServiceEdge | ReductionKeyEdge | ChildEdge | ApplicationEdge

// ─── BusinessService ──────────────────────────────────────────────────────────

export interface BusinessService {
  id: number
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
  'operational-status': string
  'ip-service-edges': BsmIpServiceEdgeResponse[]
  'reduction-key-edges': BsmReductionKeyEdgeResponse[]
  'child-edges': BsmChildEdgeResponse[]
  'application-edges': BsmApplicationEdgeResponse[]
  'parent-services': number[]
}

// Raw API response shapes (hyphenated keys from JAXB)
export interface BsmIpServiceEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  'ip-service': {
    id: number
    'node-label': string
    'ip-address': string
    'service-name': string
  }
  'friendly-name'?: string
}

export interface BsmReductionKeyEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  'reduction-key': string
  'friendly-name'?: string
}

export interface BsmChildEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  'child-id': number
}

export interface BsmApplicationEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  application: {
    id: number
    'application-name': string
  }
}

// ─── Normalized Edge (flat, typed union) ──────────────────────────────────────

export function normalizeEdges(svc: BusinessService): BsmEdge[] {
  const edges: BsmEdge[] = []

  for (const e of (svc['ip-service-edges'] ?? [])) {
    edges.push({
      type: 'ip-service',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      ipService: {
        id: e['ip-service'].id,
        nodeLabel: e['ip-service']['node-label'],
        ipAddress: e['ip-service']['ip-address'],
        serviceName: e['ip-service']['service-name'],
      },
      friendlyName: e['friendly-name'],
    })
  }

  for (const e of (svc['reduction-key-edges'] ?? [])) {
    edges.push({
      type: 'reduction-key',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      reductionKey: e['reduction-key'],
      friendlyName: e['friendly-name'],
    })
  }

  for (const e of (svc['child-edges'] ?? [])) {
    edges.push({
      type: 'child',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      childId: e['child-id'],
    })
  }

  for (const e of (svc['application-edges'] ?? [])) {
    edges.push({
      type: 'application',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      application: {
        id: e.application.id,
        applicationName: e.application['application-name'],
      },
    })
  }

  return edges
}

// ─── Edge label ───────────────────────────────────────────────────────────────

export function edgeLabel(edge: BsmEdge): string {
  switch (edge.type) {
    case 'ip-service':
      return edge.friendlyName || `${edge.ipService.nodeLabel} / ${edge.ipService.ipAddress} / ${edge.ipService.serviceName}`
    case 'reduction-key':
      return edge.friendlyName || edge.reductionKey
    case 'child':
      return `Child Service #${edge.childId}`
    case 'application':
      return edge.application.applicationName
  }
}

export function edgeTypeLabel(type: BsmEdge['type']): string {
  const labels: Record<BsmEdge['type'], string> = {
    'ip-service':    'IP Service',
    'reduction-key': 'Reduction Key',
    'child':         'Child Service',
    'application':   'Application',
  }
  return labels[type]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function extractIdFromUrl(url: string): number {
  const clean = url.endsWith('/') ? url.slice(0, -1) : url
  return parseInt(clean.split('/').pop()!, 10)
}

export function defaultReduceFunction(): FunctionDTO {
  return { type: 'HighestSeverity', properties: {} }
}

export function defaultMapFunction(): FunctionDTO {
  return { type: 'Identity', properties: {} }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function listBusinessServices(): Promise<BusinessService[]> {
  const listRes = await v2.get<{ 'business-services': string[] }>('/business-services')
  const urls: string[] = listRes.data['business-services'] ?? []
  if (urls.length === 0) return []
  const ids = urls.map(extractIdFromUrl)
  const results = await Promise.all(ids.map(id => v2.get<BusinessService>(`/business-services/${id}`)))
  return results.map(r => r.data)
}

export async function getBusinessService(id: number): Promise<BusinessService> {
  const res = await v2.get<BusinessService>(`/business-services/${id}`)
  return res.data
}

export async function createBusinessService(payload: {
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
}): Promise<number> {
  const res = await v2.post('/business-services', payload)
  // Created: 201, Location header has the new service URL
  const location: string = res.headers['location'] ?? res.headers['Location'] ?? ''
  return extractIdFromUrl(location)
}

export async function updateBusinessService(id: number, payload: {
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
}): Promise<void> {
  await v2.put(`/business-services/${id}`, payload)
}

export async function deleteBusinessService(id: number): Promise<void> {
  await v2.delete(`/business-services/${id}`)
}

export async function addIpServiceEdge(serviceId: number, payload: {
  'ip-service-id': number
  'friendly-name'?: string
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/ip-service-edge`, payload)
}

export async function addReductionKeyEdge(serviceId: number, payload: {
  'reduction-key': string
  'friendly-name'?: string
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/reduction-key-edge`, payload)
}

export async function addChildEdge(serviceId: number, payload: {
  'child-id': number
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/child-edge`, payload)
}

export async function addApplicationEdge(serviceId: number, payload: {
  'application-id': number
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/application-edge`, payload)
}

export async function removeEdge(serviceId: number, edgeId: number): Promise<void> {
  await v2.delete(`/business-services/${serviceId}/edges/${edgeId}`)
}

export async function reloadDaemon(): Promise<void> {
  await v2.post('/business-services/daemon/reload')
}

export async function getMapFunctions(): Promise<BsmFunctionMetadata[]> {
  const res = await v2.get<{ function: BsmFunctionMetadata[] }>('/business-services/functions/map')
  return res.data.function ?? []
}

export async function getReduceFunctions(): Promise<BsmFunctionMetadata[]> {
  const res = await v2.get<{ function: BsmFunctionMetadata[] }>('/business-services/functions/reduce')
  return res.data.function ?? []
}

// ─── IP Service / Application pickers ────────────────────────────────────────

export interface IpServicePickerItem {
  id: number
  nodeLabel: string
  ipAddress: string
  serviceName: string
  label: string   // for display: "nodeLabel / ipAddress / serviceName"
}

export async function searchIpServices(query: string): Promise<IpServicePickerItem[]> {
  const res = await v2.get<{ service: Array<{ id: number; nodeLabel: string; ipAddress: string; serviceType: { name: string } }> }>(`/ifservices?limit=50&_s=status==A;node.label==${encodeURIComponent(query)}*`)
  return (res.data.service ?? []).map(s => ({
    id: s.id,
    nodeLabel: s.nodeLabel,
    ipAddress: s.ipAddress,
    serviceName: s.serviceType.name,
    label: `${s.nodeLabel} / ${s.ipAddress} / ${s.serviceType.name}`,
  }))
}

export interface ApplicationPickerItem {
  id: number
  applicationName: string
}

export async function listApplications(): Promise<ApplicationPickerItem[]> {
  const res = await v2.get<{ application: Array<{ id: number; 'application-name': string }> }>('/applications')
  return (res.data.application ?? []).map(a => ({
    id: a.id,
    applicationName: a['application-name'],
  }))
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn test --run tests/bsm.test.ts 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/services/bsmService.ts ui/tests/bsm.test.ts
git commit -m "feat(bsm): add bsmService — types, API functions, normalizers"
```

---

## Task 2: `AddEdgeForm.vue` — inline edge creation form

**Files:**
- Create: `ui/src/components/BSM/AddEdgeForm.vue`

This form lives inside the editor slide-over. It has a type selector, then conditionally renders fields for each edge type, plus a shared map-function picker and weight input.

- [ ] **Step 1: Create `ui/src/components/BSM/AddEdgeForm.vue`**

```vue
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
      :modelValue="selectedTypeOption"
      @update:modelValue="onTypeChange"
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
        :options="childOptions"
        textProp="name"
        :modelValue="selectedChildOption"
        @update:modelValue="(v: any) => { form.childId = v?.id ?? null; selectedChildOption = v }"
      />
    </template>

    <!-- Application fields -->
    <template v-else-if="form.type === 'application'">
      <FeatherSelect
        label="Application"
        :options="appOptions"
        textProp="applicationName"
        :modelValue="selectedAppOption"
        @update:modelValue="(v: any) => { form.applicationId = v?.id ?? null; selectedAppOption = v }"
      />
    </template>

    <!-- Shared: Map Function + Weight -->
    <FeatherSelect
      label="Map Function"
      :options="mapFnOptions"
      textProp="name"
      :modelValue="selectedMapFn"
      @update:modelValue="onMapFnChange"
    />

    <!-- SetTo status parameter -->
    <FeatherSelect
      v-if="form.mapFunction.type === 'SetTo'"
      label="Set To Status"
      :options="STATUS_OPTIONS"
      textProp="label"
      :modelValue="selectedSetToStatus"
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
import { ref, computed, onMounted, watch } from 'vue'
import { markRaw } from 'vue'
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
  allServices: BusinessService[]      // for child picker
  currentServiceId?: number           // exclude self from child picker
}>()

const emit = defineEmits<{
  (e: 'add', payload: AddEdgePayload): void
  (e: 'cancel'): void
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/components/BSM/AddEdgeForm.vue
git commit -m "feat(bsm): add AddEdgeForm component"
```

---

## Task 3: `BusinessServiceEditor.vue` — slide-over editor

**Files:**
- Create: `ui/src/components/BSM/BusinessServiceEditor.vue`

- [ ] **Step 1: Create `ui/src/components/BSM/BusinessServiceEditor.vue`**

```vue
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
      <!-- Header -->
      <div class="editor-header">
        <h2 class="editor-title">{{ isNew ? 'New Business Service' : 'Edit: ' + form.name }}</h2>
        <FeatherButton text @click="$emit('close')">
          <FeatherIcon :icon="CloseIcon" />
        </FeatherButton>
      </div>

      <div v-if="loading" class="loading-state"><FeatherSpinner /></div>

      <template v-else>
        <!-- Name -->
        <section class="editor-section">
          <FeatherInput v-model="form.name" label="Service Name" :error="nameError" />
        </section>

        <!-- Reduce Function -->
        <section class="editor-section">
          <h3 class="section-title">Reduce Function</h3>
          <FeatherSelect
            label="Type"
            :options="reduceFnOptions"
            textProp="name"
            :modelValue="selectedReduceFn"
            @update:modelValue="onReduceFnChange"
          />
          <!-- Threshold float param -->
          <FeatherInput
            v-if="form['reduce-function'].type === 'Threshold'"
            v-model.number="thresholdValue"
            label="Threshold (0.0 – 1.0)"
            type="number"
            @update:modelValue="(v: number) => { form['reduce-function'].properties['threshold'] = String(v) }"
          />
          <!-- HighestSeverityAbove status param -->
          <FeatherSelect
            v-if="form['reduce-function'].type === 'HighestSeverityAbove'"
            label="Threshold Status"
            :options="STATUS_OPTIONS"
            textProp="label"
            :modelValue="selectedThresholdStatus"
            @update:modelValue="(v: any) => { form['reduce-function'].properties['threshold'] = v?.value; selectedThresholdStatus = v }"
          />
          <!-- ExponentialPropagation base param -->
          <FeatherInput
            v-if="form['reduce-function'].type === 'ExponentialPropagation'"
            v-model.number="expBase"
            label="Base"
            type="number"
            @update:modelValue="(v: number) => { form['reduce-function'].properties['base'] = String(v) }"
          />
        </section>

        <!-- Attributes -->
        <section class="editor-section">
          <div class="section-header">
            <h3 class="section-title">Attributes</h3>
            <FeatherButton text @click="addAttribute">
              <FeatherIcon :icon="AddIcon" /> Add
            </FeatherButton>
          </div>
          <div v-for="(attr, i) in attributeRows" :key="i" class="attr-row">
            <FeatherInput v-model="attr.key" label="Key" class="attr-input" />
            <FeatherInput v-model="attr.value" label="Value" class="attr-input" />
            <FeatherButton text @click="removeAttribute(i)">
              <FeatherIcon :icon="DeleteIcon" />
            </FeatherButton>
          </div>
        </section>

        <!-- Edges (only when editing existing service) -->
        <section v-if="!isNew" class="editor-section">
          <div class="section-header">
            <h3 class="section-title">Edges ({{ edges.length }})</h3>
            <FeatherButton text @click="showAddEdge = !showAddEdge">
              <FeatherIcon :icon="AddIcon" /> Add Edge
            </FeatherButton>
          </div>

          <AddEdgeForm
            v-if="showAddEdge"
            :allServices="allServices"
            :currentServiceId="service?.id"
            @add="onAddEdge"
            @cancel="showAddEdge = false"
          />

          <div v-if="edges.length === 0 && !showAddEdge" class="empty-edges">No edges configured.</div>

          <table v-else-if="edges.length > 0" class="edge-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Target</th>
                <th>Map Fn</th>
                <th>Weight</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="edge in edges" :key="edge.id">
                <td>{{ edgeTypeLabel(edge.type) }}</td>
                <td>{{ edgeLabel(edge) }}</td>
                <td>{{ edge.mapFunction.type }}</td>
                <td>{{ edge.weight }}</td>
                <td><span :class="['status-chip', statusColor(edge.operationalStatus)]">{{ edge.operationalStatus }}</span></td>
                <td>
                  <FeatherButton text @click="onRemoveEdge(edge.id)" :disabled="removingEdge === edge.id">
                    <FeatherIcon :icon="DeleteIcon" />
                  </FeatherButton>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div v-if="isNew" class="new-service-note">
          Save the service first to add edges.
        </div>

        <!-- Footer actions -->
        <div class="editor-footer">
          <FeatherButton primary @click="save" :disabled="saving || !form.name.trim()">
            {{ saving ? 'Saving…' : 'Save' }}
          </FeatherButton>
          <FeatherButton text @click="$emit('close')">Cancel</FeatherButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, markRaw } from 'vue'
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherSelect } from '@featherds/select'
import { FeatherSpinner } from '@featherds/progress'
import { FeatherIcon } from '@featherds/icon'
import Close from '@featherds/icon/navigation/Close'
import Add from '@featherds/icon/action/Add'
import Delete from '@featherds/icon/action/Delete'
import AddEdgeForm from './AddEdgeForm.vue'
import type { AddEdgePayload } from './AddEdgeForm.vue'
import {
  getReduceFunctions, normalizeEdges, edgeLabel, edgeTypeLabel, statusColor,
  addIpServiceEdge, addReductionKeyEdge, addChildEdge, addApplicationEdge, removeEdge,
  defaultReduceFunction, BSM_STATUSES,
  type BusinessService, type BsmEdge, type BsmFunctionMetadata, type FunctionDTO
} from '@/services/bsmService'
import useSnackbar from '@/composables/useSnackbar'

const CloseIcon = markRaw(Close)
const AddIcon   = markRaw(Add)
const DeleteIcon = markRaw(Delete)

const props = defineProps<{
  service: BusinessService | null   // null = create mode
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
const thresholdValue = ref(0.5)
const expBase = ref(2.0)

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
    form.value['reduce-function'] = { ...props.service['reduce-function'] }
    const attrs = props.service.attributes ?? {}
    attributeRows.value = Object.entries(attrs).map(([key, value]) => ({ key, value }))
    // Restore reduce fn selection
    const rfType = form.value['reduce-function'].type
    selectedReduceFn.value = reduceFnOptions.value.find(f => f.name === rfType) ?? null
    if (rfType === 'Threshold') thresholdValue.value = parseFloat(form.value['reduce-function'].properties['threshold'] ?? '0.5')
    if (rfType === 'ExponentialPropagation') expBase.value = parseFloat(form.value['reduce-function'].properties['base'] ?? '2.0')
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
          'application-id': payload.applicationId!,
          'map-function': payload.mapFunction,
          weight: payload.weight,
        })
        break
    }
    showAddEdge.value = false
    emit('edgesChanged')
  } catch (e: any) {
    showSnackBar({ msg: `Failed to add edge: ${e.message ?? 'Unknown error'}` })
  }
}

async function onRemoveEdge(edgeId: number) {
  if (!props.service) return
  removingEdge.value = edgeId
  try {
    await removeEdge(props.service.id, edgeId)
    emit('edgesChanged')
  } catch (e: any) {
    showSnackBar({ msg: `Failed to remove edge: ${e.message ?? 'Unknown error'}` })
  } finally {
    removingEdge.value = null
  }
}
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

.editor-panel {
  background: var($surface);
  width: min(600px, 100vw);
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 0;
  box-shadow: -4px 0 20px rgba(0,0,0,0.15);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
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
  }

  td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var($border-on-surface);
    vertical-align: middle;
  }
}

.status-chip {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;

  &.status-critical      { background: #c0392b; color: #fff; }
  &.status-major         { background: #e67e22; color: #fff; }
  &.status-minor         { background: #f1c40f; color: #333; }
  &.status-warning       { background: #3498db; color: #fff; }
  &.status-normal        { background: #27ae60; color: #fff; }
  &.status-indeterminate { background: #95a5a6; color: #fff; }
}

.empty-edges {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  text-align: center;
  padding: 1rem;
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

.editor-footer {
  display: flex;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid var($border-on-surface);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/components/BSM/BusinessServiceEditor.vue
git commit -m "feat(bsm): add BusinessServiceEditor slide-over component"
```

---

## Task 4: `BusinessServicesAdmin.vue` — page container

**Files:**
- Create: `ui/src/containers/BusinessServicesAdmin.vue`

- [ ] **Step 1: Create `ui/src/containers/BusinessServicesAdmin.vue`**

```vue
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
  software distributed under the LICENSE IS distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="bsm-admin">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">Business Service Management</h1>

    <div v-if="loading" class="loading-state">
      <FeatherSpinner />
    </div>

    <div v-else-if="loadError" class="error-state">
      <p class="error-text">{{ loadError }}</p>
      <FeatherButton @click="loadData">Retry</FeatherButton>
    </div>

    <template v-else>
      <div class="toolbar">
        <FeatherButton primary @click="openCreate">
          <FeatherIcon :icon="AddIcon" /> New Service
        </FeatherButton>
        <FeatherButton text @click="doReload" :disabled="reloading">
          {{ reloading ? 'Reloading…' : 'Reload Daemon' }}
        </FeatherButton>
      </div>

      <div v-if="services.length === 0" class="empty-state">
        No business services defined. Click <strong>New Service</strong> to create one.
      </div>

      <table v-else class="services-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Reduce Function</th>
            <th>Status</th>
            <th>Edges</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="svc in services" :key="svc.id">
            <td class="svc-name">{{ svc.name }}</td>
            <td>{{ svc['reduce-function']?.type ?? '—' }}</td>
            <td>
              <span :class="['status-chip', statusColor(svc['operational-status'])]">
                {{ svc['operational-status'] }}
              </span>
            </td>
            <td>{{ edgeCount(svc) }}</td>
            <td class="actions-cell">
              <FeatherButton text @click="openEdit(svc)">Edit</FeatherButton>
              <FeatherButton text class="delete-btn" @click="confirmDelete(svc)">Delete</FeatherButton>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Editor slide-over -->
    <BusinessServiceEditor
      v-if="editorOpen"
      :service="editingService"
      :allServices="services"
      @save="onSave"
      @close="editorOpen = false"
      @edgesChanged="reloadEditingService"
    />

    <!-- Delete confirmation dialog -->
    <FeatherDialog v-if="deletingService" title="Delete Business Service" @update:modelValue="deletingService = null">
      <p>Delete <strong>{{ deletingService.name }}</strong>? This cannot be undone.</p>
      <template #footer>
        <FeatherButton primary @click="doDelete" :disabled="deleting">
          {{ deleting ? 'Deleting…' : 'Delete' }}
        </FeatherButton>
        <FeatherButton text @click="deletingService = null">Cancel</FeatherButton>
      </template>
    </FeatherDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw } from 'vue'
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import { FeatherDialog } from '@featherds/dialog'
import { FeatherIcon } from '@featherds/icon'
import Add from '@featherds/icon/action/Add'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import BusinessServiceEditor from '@/components/BSM/BusinessServiceEditor.vue'
import {
  listBusinessServices, createBusinessService, updateBusinessService,
  deleteBusinessService, reloadDaemon, getBusinessService,
  normalizeEdges, statusColor,
  type BusinessService, type FunctionDTO
} from '@/services/bsmService'
import useSnackbar from '@/composables/useSnackbar'

const AddIcon = markRaw(Add)
const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'Business Service Management', to: '/bsm-admin' }
]

const loading = ref(true)
const loadError = ref<string | null>(null)
const reloading = ref(false)
const services = ref<BusinessService[]>([])
const editorOpen = ref(false)
const editingService = ref<BusinessService | null>(null)
const deletingService = ref<BusinessService | null>(null)
const deleting = ref(false)

function edgeCount(svc: BusinessService): number {
  return (
    (svc['ip-service-edges']?.length ?? 0) +
    (svc['reduction-key-edges']?.length ?? 0) +
    (svc['child-edges']?.length ?? 0) +
    (svc['application-edges']?.length ?? 0)
  )
}

async function loadData() {
  loading.value = true
  loadError.value = null
  try {
    services.value = await listBusinessServices()
  } catch (e: any) {
    loadError.value = e.message ?? 'Failed to load business services'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function openCreate() {
  editingService.value = null
  editorOpen.value = true
}

function openEdit(svc: BusinessService) {
  editingService.value = svc
  editorOpen.value = true
}

async function reloadEditingService() {
  if (!editingService.value) return
  try {
    const updated = await getBusinessService(editingService.value.id)
    editingService.value = updated
    // Also update in list
    const idx = services.value.findIndex(s => s.id === updated.id)
    if (idx !== -1) services.value[idx] = updated
  } catch {
    // non-fatal
  }
}

async function onSave(payload: { name: string; attributes: Record<string, string>; 'reduce-function': FunctionDTO }) {
  try {
    if (editingService.value) {
      await updateBusinessService(editingService.value.id, payload)
      showSnackBar({ msg: 'Business service updated.' })
    } else {
      await createBusinessService(payload)
      showSnackBar({ msg: 'Business service created.' })
    }
    editorOpen.value = false
    await loadData()
  } catch (e: any) {
    showSnackBar({ msg: `Save failed: ${e.message ?? 'Unknown error'}` })
  }
}

function confirmDelete(svc: BusinessService) {
  deletingService.value = svc
}

async function doDelete() {
  if (!deletingService.value) return
  deleting.value = true
  try {
    await deleteBusinessService(deletingService.value.id)
    showSnackBar({ msg: `Deleted "${deletingService.value.name}".` })
    deletingService.value = null
    await loadData()
  } catch (e: any) {
    showSnackBar({ msg: `Delete failed: ${e.message ?? 'Unknown error'}` })
  } finally {
    deleting.value = false
  }
}

async function doReload() {
  reloading.value = true
  try {
    await reloadDaemon()
    showSnackBar({ msg: 'BSM daemon reloaded.' })
  } catch (e: any) {
    showSnackBar({ msg: `Reload failed: ${e.message ?? 'Unknown error'}` })
  } finally {
    reloading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.bsm-admin {
  padding: 1.5rem;
  max-width: 1200px;
}

.page-title {
  @include typo.headline1();
  margin: 0.5rem 0 1.5rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.error-text {
  color: var($error);
  margin-bottom: 0.5rem;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.empty-state {
  @include typo.body-large();
  color: var($secondary-text-on-surface);
  padding: 2rem;
  text-align: center;
  border: 1px dashed var($border-on-surface);
  border-radius: 8px;
}

.services-table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    padding: 0.6rem 1rem;
    border-bottom: 2px solid var($border-on-surface);
    @include typo.subtitle2();
    color: var($secondary-text-on-surface);
  }

  td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var($border-on-surface);
    @include typo.body-large();
    vertical-align: middle;
  }

  tr:hover td { background: var($surface-dark); }
}

.svc-name {
  font-weight: 600;
}

.actions-cell {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.delete-btn { color: var($error) !important; }

.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;

  &.status-critical      { background: #c0392b; color: #fff; }
  &.status-major         { background: #e67e22; color: #fff; }
  &.status-minor         { background: #f1c40f; color: #333; }
  &.status-warning       { background: #3498db; color: #fff; }
  &.status-normal        { background: #27ae60; color: #fff; }
  &.status-indeterminate { background: #95a5a6; color: #fff; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/containers/BusinessServicesAdmin.vue
git commit -m "feat(bsm): add BusinessServicesAdmin page container"
```

---

## Task 5: Router + SideMenu + BSM JSP redirect

**Files:**
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/components/Menu/SideMenu.vue`
- Replace: `opennms-webapp/src/main/webapp/admin/bsm/adminpage.jsp`

- [ ] **Step 1: Add route to `ui/src/main/router/index.ts`**

Find the snmp-collections-config block (around line 143) and add immediately after its closing `},`:

```typescript
    {
      path: '/bsm-admin',
      name: 'BusinessServicesAdmin',
      component: () => import('@/containers/BusinessServicesAdmin.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'No role access to BSM admin.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
```

- [ ] **Step 2: Add BSM to `legacyToVueRoutes` in `ui/src/components/Menu/SideMenu.vue`**

Find the line `'vaadin-wallboard': 'ui/index.html#/wallboard-config'` and add after it:

```typescript
  'admin/bsm/adminpage.jsp':            'ui/index.html#/bsm-admin',
```

- [ ] **Step 3: Replace `opennms-webapp/src/main/webapp/admin/bsm/adminpage.jsp`**

Replace the entire file content with:

```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/bsm-admin"); %>
```

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms && git add ui/src/main/router/index.ts ui/src/components/Menu/SideMenu.vue opennms-webapp/src/main/webapp/admin/bsm/adminpage.jsp
git commit -m "feat(bsm): wire up route, menu redirect, and JSP redirect for BSM admin"
```

---

## Task 6: `manageEvents.jsp` redirect + SideMenu

**Files:**
- Replace: `opennms-webapp/src/main/webapp/admin/manageEvents.jsp`
- Modify: `ui/src/components/Menu/SideMenu.vue`

- [ ] **Step 1: Replace `opennms-webapp/src/main/webapp/admin/manageEvents.jsp`**

Replace the entire file content with:

```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/event-config"); %>
```

- [ ] **Step 2: Add manageEvents to `legacyToVueRoutes` in `ui/src/components/Menu/SideMenu.vue`**

Add after the `admin/bsm/adminpage.jsp` line:

```typescript
  'admin/manageEvents.jsp':             'ui/index.html#/event-config',
```

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms && git add opennms-webapp/src/main/webapp/admin/manageEvents.jsp ui/src/components/Menu/SideMenu.vue
git commit -m "feat(vaadin): redirect manageEvents.jsp to Vue event-config"
```

---

## Task 7: `surveillance-box.jsp` redirect

**Files:**
- Replace: `opennms-webapp/src/main/webapp/surveillance-box.jsp`

- [ ] **Step 1: Replace the Vaadin iframe with a redirect**

Replace the entire `surveillance-box.jsp` file content with:

```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-dashboard"); %>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms && git add opennms-webapp/src/main/webapp/surveillance-box.jsp
git commit -m "feat(vaadin): redirect surveillance-box.jsp to Vue surveillance-dashboard"
```

---

## Task 8: Build, Deploy, Verify

- [ ] **Step 1: Run yarn build**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: Build succeeds, `src/main/dist/index.html` has `assets/index-*.js` paths.

- [ ] **Step 2: Verify no bare CSS var() issues**

```bash
grep -r "var(\$" /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | head -5
```

Expected: No output (bare `var($x)` would indicate lightningcss stripping failure).

- [ ] **Step 3: Deploy to container**

```bash
cd /Users/chance/git/opennms && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 4: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: Both lines are identical.

- [ ] **Step 5: Verify JSP redirects are live**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -u admin:notdefault http://localhost:8980/opennms/admin/bsm/adminpage.jsp
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -u admin:notdefault http://localhost:8980/opennms/admin/manageEvents.jsp
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -u admin:notdefault http://localhost:8980/opennms/surveillance-box.jsp
```

Expected:
```
302 http://...#/bsm-admin
302 http://...#/event-config
302 http://...#/surveillance-dashboard
```

- [ ] **Step 6: Verify Vue bundle loads**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```

Expected: `200`

- [ ] **Step 7: Verify no Vaadin iframes remain**

```bash
grep -rn "vaadin-fullscreen\|vaadin-iframe" /Users/chance/git/opennms/opennms-webapp/src/main/webapp --include="*.jsp" | grep -v target
```

Expected: No output.

- [ ] **Step 8: Tell user to hard-refresh**

Hard refresh the browser with `Cmd+Shift+R`, then navigate to Admin → Business Services to verify the new page loads.
