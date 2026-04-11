# Phase 1: Element Sub-pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `element/interface.jsp`, `element/snmpinterface.jsp`, and all remaining element sub-pages with proper Vue 3 SPA pages, eliminating the SPA navigation break that currently occurs whenever an operator follows an alarm or outage to an interface.

**Architecture:** Each new page follows the established Vaadin→Vue pattern: JSP becomes a redirect scriptlet, a Vue container in `ui/src/containers/` owns routing/breadcrumbs, panel components in `ui/src/components/<Feature>/` handle display logic, and service functions are added to `ui/src/services/nodeService.ts`. All existing types (`IpInterface`, `SnmpInterface`, `IfService`) are extended rather than replaced; a new `OnmsMetaData` type is added.

**Tech Stack:** Vue 3 Composition API, Pinia, Feather DS components (`@featherds/table`, `@featherds/badge`), existing axios instances (`v2` for `/api/v2/*`, `rest` for `/rest/*`), Vue Router hash history.

---

## File Map

**New files:**
- `ui/src/containers/InterfaceDetail.vue` — IP interface detail page
- `ui/src/containers/SnmpInterfaceDetail.vue` — SNMP interface detail page
- `ui/src/components/InterfaceDetail/InterfaceHeader.vue` — interface info card + action links
- `ui/src/components/InterfaceDetail/ServicesTable.vue` — services with poll status
- `ui/src/components/SnmpInterfaceDetail/SnmpInterfaceHeader.vue` — SNMP interface info card

**Modified files:**
- `ui/src/types/index.ts` — add `OnmsMetaData`, `MetaDataApiResponse`
- `ui/src/services/nodeService.ts` — add `getNodeIpInterface`, `getNodeIpInterfaceServices`, `getNodeSnmpInterfaceByIfIndex`, `getNodeMetaData`, `getNodeIpInterfaceMetaData`, `deleteNodeIpInterface`
- `ui/src/main/router/index.ts` — add routes for `/interface/:nodeId/:ipAddress` and `/snmpinterface/:nodeId/:ifIndex`
- `ui/src/containers/NodeDetails.vue` — add Metadata panel to Overview tab
- `ui/src/components/Nodes/NodesTable.vue:473` — update interface link
- `ui/src/containers/AlarmDetail.vue:73` — update interface link
- `ui/src/containers/EventDetail.vue:75` — update interface link
- `ui/src/containers/OutageDetail.vue:71` — update interface link
- `ui/src/components/Nodes/NodesTable.vue:473` — update interface link
- `ui/src/containers/AlarmDetail.vue:73` — update interface link
- `ui/src/containers/EventDetail.vue:75` — update interface link
- `ui/src/containers/OutageDetail.vue:71` — update interface link

**Replaced JSPs (redirect-only):**
- `opennms-webapp/src/main/webapp/element/interface.jsp`
- `opennms-webapp/src/main/webapp/element/snmpinterface.jsp`
- `opennms-webapp/src/main/webapp/element/availability.jsp`
- `opennms-webapp/src/main/webapp/element/linkednode.jsp`
- `opennms-webapp/src/main/webapp/element/index.jsp`
- `opennms-webapp/src/main/webapp/element/rescan.jsp`
- `opennms-webapp/src/main/webapp/element/interface-metadata.jsp`
- `opennms-webapp/src/main/webapp/element/node-metadata.jsp`
- `opennms-webapp/src/main/webapp/element/service-metadata.jsp`

---

## Task 1: Verify API shapes with curl

Before writing any TypeScript, confirm the actual JSON response shapes from the live container. This prevents type mismatches.

**Files:** none (verification only)

- [ ] **Step 1: Verify single IP interface endpoint**

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes/1/ipinterfaces/127.0.0.1" \
  | python3 -m json.tool
```

Expected: JSON with `ipAddress`, `hostName`, `isManaged`, `snmpPrimary`, `isDown`, `snmpInterface` nested object. Note field names exactly.

- [ ] **Step 2: Verify interface services endpoint**

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes/1/ipinterfaces/127.0.0.1/services" \
  | python3 -m json.tool
```

Expected: `{"monitored-service": [...], "count": N, "totalCount": N, "offset": 0}`. Each service has `serviceName`, `status`, `statusCode`, `isDown`, `isMonitored`.

- [ ] **Step 3: Verify single SNMP interface endpoint**

```bash
# First get a valid ifIndex from a node
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes/1/snmpinterfaces?limit=1" \
  | python3 -m json.tool | grep ifIndex

curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes/1/snmpinterfaces/1" \
  | python3 -m json.tool
```

Expected: JSON with `ifIndex`, `ifDescr`, `ifName`, `ifAlias`, `ifType`, `ifSpeed`, `physAddr`, `ifAdminStatus`, `ifOperStatus`.

- [ ] **Step 4: Verify metadata endpoint**

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes/1/metadata" \
  | python3 -m json.tool
```

Expected: `{"metaData": [{"context": "...", "key": "...", "value": "..."}], ...}` or empty array. Note the wrapper key name exactly.

- [ ] **Step 5: Note any field name differences from existing types**

Compare curl output against `ui/src/types/index.ts` `IpInterface` and `SnmpInterface` definitions. Record any discrepancies before Task 2.

---

## Task 2: Add types and service functions

**Files:**
- Modify: `ui/src/types/index.ts`
- Modify: `ui/src/services/nodeService.ts`

- [ ] **Step 1: Add MetaData types to `ui/src/types/index.ts`**

After the `IfServiceApiResponse` interface (around line 101), add:

```typescript
export interface OnmsMetaData {
  context: string
  key: string
  value: string
}

export interface MetaDataApiResponse extends ApiResponse {
  metaData: OnmsMetaData[]
}
```

- [ ] **Step 2: Add service functions to `ui/src/services/nodeService.ts`**

After the `getNodeIpInterfaces` function (around line 115), add:

```typescript
const getNodeIpInterface = async (
  nodeId: string,
  ipAddress: string
): Promise<IpInterface | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${nodeId}/ipinterfaces/${encodeURIComponent(ipAddress)}`)
    return resp.data as IpInterface
  } catch (err) {
    return false
  }
}

const getNodeIpInterfaceServices = async (
  nodeId: string,
  ipAddress: string
): Promise<IfServiceApiResponse | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${nodeId}/ipinterfaces/${encodeURIComponent(ipAddress)}/services?limit=100`)
    return resp.data as IfServiceApiResponse
  } catch (err) {
    return false
  }
}

const getNodeSnmpInterfaceByIfIndex = async (
  nodeId: string,
  ifIndex: string
): Promise<SnmpInterface | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${nodeId}/snmpinterfaces/${ifIndex}`)
    return resp.data as SnmpInterface
  } catch (err) {
    return false
  }
}

const getNodeMetaData = async (
  nodeId: string
): Promise<MetaDataApiResponse | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${nodeId}/metadata`)
    return resp.data as MetaDataApiResponse
  } catch (err) {
    return false
  }
}

const getNodeIpInterfaceMetaData = async (
  nodeId: string,
  ipAddress: string
): Promise<MetaDataApiResponse | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${nodeId}/ipinterfaces/${encodeURIComponent(ipAddress)}/metadata`)
    return resp.data as MetaDataApiResponse
  } catch (err) {
    return false
  }
}

const deleteNodeIpInterface = async (
  nodeId: string,
  ipAddress: string
): Promise<boolean> => {
  try {
    await rest.delete(`/nodes/${nodeId}/ipinterfaces/${encodeURIComponent(ipAddress)}`)
    return true
  } catch (err) {
    return false
  }
}
```

- [ ] **Step 3: Export the new functions**

In `nodeService.ts` update the export block at the bottom to include all new functions:

```typescript
export default {
  getNodes,
  getNodeById,
  getNodeOutages,
  getNodeIpInterfaces,
  getNodeIpInterface,
  getNodeIpInterfaceServices,
  getNodeSnmpInterfaces,
  getNodeSnmpInterfaceByIfIndex,
  getNodeAvailabilityPercentage,
  getNodeMetaData,
  getNodeIpInterfaceMetaData,
  deleteNodeIpInterface
}
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
cd /path/to/repo/ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no type errors. Fix any mismatches against actual API shapes found in Task 1.

- [ ] **Step 5: Commit**

```bash
git add ui/src/types/index.ts ui/src/services/nodeService.ts
git commit -m "feat(element): add interface/metadata types and service functions"
```

---

## Task 3: InterfaceHeader.vue

**Files:**
- Create: `ui/src/components/InterfaceDetail/InterfaceHeader.vue`

- [ ] **Step 1: Create the component**

```bash
mkdir -p ui/src/components/InterfaceDetail
```

Create `ui/src/components/InterfaceDetail/InterfaceHeader.vue`:

```vue
<template>
  <div class="interface-header card">
    <div class="interface-header__primary">
      <div class="headline3">{{ iface.ipAddress }}</div>
      <div v-if="iface.hostName" class="subtitle1 interface-header__hostname">{{ iface.hostName }}</div>
      <div class="interface-header__badges">
        <span :class="['badge', managedClass]">{{ managedLabel }}</span>
        <span v-if="iface.snmpPrimary === 'P'" class="badge badge--primary">Primary SNMP</span>
        <span v-if="iface.isDown" class="badge badge--down">Down</span>
      </div>
    </div>

    <div class="interface-header__meta">
      <dl class="interface-header__grid">
        <dt>Node</dt>
        <dd><router-link :to="`/node/${iface.nodeId}`">{{ nodeLabel }}</router-link></dd>
        <template v-if="iface.snmpInterface">
          <dt>ifIndex</dt>
          <dd>
            <router-link :to="`/snmpinterface/${iface.nodeId}/${iface.snmpInterface.ifIndex}`">
              {{ iface.snmpInterface.ifIndex }}
            </router-link>
          </dd>
          <dt>ifDescr</dt>
          <dd>{{ iface.snmpInterface.ifDescr || 'N/A' }}</dd>
        </template>
      </dl>
    </div>

    <div class="interface-header__actions">
      <router-link
        v-if="responseTimeResourceId"
        :to="`/resource-graphs/graphs/${encodeURIComponent(nodeLabel)}/${encodeURIComponent('all')}/${encodeURIComponent(responseTimeResourceId)}`"
        class="btn btn-secondary btn-sm"
      >Response Time Graphs</router-link>
      <router-link
        v-if="snmpIntfResourceId"
        :to="`/resource-graphs/graphs/${encodeURIComponent(nodeLabel)}/${encodeURIComponent('all')}/${encodeURIComponent(snmpIntfResourceId)}`"
        class="btn btn-secondary btn-sm"
      >SNMP Interface Graphs</router-link>
      <button
        v-if="isAdmin"
        class="btn btn-danger btn-sm"
        @click="$emit('delete')"
      >Delete Interface</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IpInterface } from '@/types'
import useRole from '@/composables/useRole'

const props = defineProps<{
  iface: IpInterface
  nodeLabel: string
}>()

defineEmits<{ delete: [] }>()

const { adminRole: isAdmin } = useRole()

const managedClass = computed(() => {
  if (props.iface.isManaged === 'M') return 'badge--managed'
  if (props.iface.isManaged === 'U') return 'badge--unmanaged'
  return 'badge--unknown'
})

const managedLabel = computed(() => {
  if (props.iface.isManaged === 'M') return 'Managed'
  if (props.iface.isManaged === 'U') return 'Unmanaged'
  return props.iface.isManaged ?? 'Unknown'
})

// Resource IDs for graph links — format: node[nodeId].interfaceSnmp[ipAddr]
const responseTimeResourceId = computed(() => {
  if (!props.iface.nodeId || !props.iface.ipAddress) return null
  const safeIp = props.iface.ipAddress.replace(/\./g, '_')
  return `node[${props.iface.nodeId}].responseTime[${safeIp}]`
})

const snmpIntfResourceId = computed(() => {
  if (!props.iface.snmpInterface?.ifIndex) return null
  return `node[${props.iface.nodeId}].interfaceSnmp[${props.iface.ipAddress}]`
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use '@/styles/vars' as vars;

.interface-header {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: start;

  &__hostname { color: var($secondary-text-on-surface); }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  &__grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    dt { font-weight: 600; color: var($secondary-text-on-surface); }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;

  &--managed   { background: var($success); color: var($primary-text-on-color); }
  &--unmanaged { background: var($shade-4); color: var($primary-text-on-surface); }
  &--unknown   { background: var($shade-4); color: var($primary-text-on-surface); }
  &--primary   { background: var($primary); color: var($primary-text-on-color); }
  &--down      { background: var($error); color: var($primary-text-on-color); }
}
</style>
```

- [ ] **Step 2: Verify resource ID format is correct**

Check how the existing ResourceGraphsPanel or resource graph route handles resource IDs:

```bash
grep -n "resourceId\|resource-graphs\|responseTime\|interfaceSnmp" \
  ui/src/components/NodeDetail/ResourceGraphsPanel.vue | head -10
grep -n "resourceId\|responseTime\|interfaceSnmp" \
  ui/src/services/measurementsService.ts | head -10
```

If the resource ID format differs from `node[N].responseTime[ip]`, update the computed properties in InterfaceHeader.vue accordingly.

---

## Task 4: ServicesTable.vue

**Files:**
- Create: `ui/src/components/InterfaceDetail/ServicesTable.vue`

- [ ] **Step 1: Create the component**

Create `ui/src/components/InterfaceDetail/ServicesTable.vue`:

```vue
<template>
  <div class="services-table card">
    <div class="headline4 services-table__title">Monitored Services</div>

    <div v-if="loading" class="services-table__loading">Loading services…</div>
    <div v-else-if="!services.length" class="services-table__empty">No monitored services</div>
    <table v-else class="tl1 tl2 tl3 tl4">
      <thead>
        <tr>
          <th scope="col">Service</th>
          <th scope="col">Status</th>
          <th scope="col">Managed</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="svc in services"
          :key="svc.id"
          :class="{ 'services-table__row--down': svc.isDown }"
        >
          <td>{{ svc.serviceName }}</td>
          <td>
            <span :class="['services-table__status', statusClass(svc)]">
              {{ statusLabel(svc) }}
            </span>
          </td>
          <td>{{ svc.isMonitored ? 'Yes' : 'No' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { IfService } from '@/types'

defineProps<{
  services: IfService[]
  loading: boolean
}>()

const statusClass = (svc: IfService) => {
  if (!svc.isMonitored) return 'services-table__status--unmonitored'
  if (svc.isDown) return 'services-table__status--down'
  return 'services-table__status--up'
}

const statusLabel = (svc: IfService) => {
  if (!svc.isMonitored) return 'Not Monitored'
  if (svc.isDown) return 'Down'
  return 'Up'
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@/styles/severities";

.services-table {
  padding: 16px 20px;

  &__title { margin-bottom: 12px; }
  &__loading, &__empty { color: var($secondary-text-on-surface); padding: 8px 0; }

  &__row--down td { background: rgba(var(--feather-error-rgb, 176, 0, 32), 0.08); }

  &__status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;

    &--up           { background: var($success); color: var($primary-text-on-color); }
    &--down         { background: var($error);   color: var($primary-text-on-color); }
    &--unmonitored  { background: var($shade-4); color: var($primary-text-on-surface); }
  }
}
</style>
```

---

## Task 5: InterfaceDetail.vue container

**Files:**
- Create: `ui/src/containers/InterfaceDetail.vue`

- [ ] **Step 1: Create the container**

Create `ui/src/containers/InterfaceDetail.vue`:

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div v-if="error && !loading" class="feather-row">
    <div class="feather-col-12 interface-detail__error">
      <p class="headline4">Interface not found</p>
      <p class="subtitle1">{{ error }}</p>
    </div>
  </div>

  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 interface-detail__skeleton headline3">Loading interface…</div>
  </div>

  <template v-else-if="iface">
    <div class="feather-row">
      <div class="feather-col-12">
        <InterfaceHeader
          :iface="iface"
          :nodeLabel="nodeLabel"
          @delete="handleDelete"
        />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-6">
        <ServicesTable :services="services" :loading="servicesLoading" />
      </div>
      <div class="feather-col-6">
        <MetaDataPanel
          v-if="metaData.length"
          title="Interface Metadata"
          :items="metaData"
        />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Recent Events</div>
          <EventsTable :nodeId="nodeId" />
        </div>
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Recent Outages</div>
          <!-- filterFiql narrows outages to this interface's IP address -->
          <OutagesTable :nodeId="nodeId" :filterFiql="`ipAddress==${ipAddress}`" />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import InterfaceHeader from '@/components/InterfaceDetail/InterfaceHeader.vue'
import ServicesTable from '@/components/InterfaceDetail/ServicesTable.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import MetaDataPanel from '@/components/Common/MetaDataPanel.vue'
import nodeService from '@/services/nodeService'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import { IpInterface, IfService, OnmsMetaData, BreadCrumb } from '@/types'

const route = useRoute()
const router = useRouter()
const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const nodeId = route.params.nodeId as string
const ipAddress = route.params.ipAddress as string

const iface = ref<IpInterface | null>(null)
const services = ref<IfService[]>([])
const metaData = ref<OnmsMetaData[]>([])
const loading = ref(true)
const servicesLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const [ifaceResult, servicesResult, metaResult] = await Promise.all([
    nodeService.getNodeIpInterface(nodeId, ipAddress),
    nodeService.getNodeIpInterfaceServices(nodeId, ipAddress),
    nodeService.getNodeIpInterfaceMetaData(nodeId, ipAddress)
  ])

  loading.value = false
  servicesLoading.value = false

  if (!ifaceResult) {
    error.value = `Interface ${ipAddress} not found on node ${nodeId}`
    return
  }

  iface.value = ifaceResult
  services.value = servicesResult ? servicesResult['monitored-service'] : []
  metaData.value = metaResult ? metaResult.metaData : []
})

const nodeLabel = computed(() => iface.value?.hostName || `Node ${nodeId}`)

const homeUrl = computed(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: `Node ${nodeId}`, to: `/node/${nodeId}` },
  { label: ipAddress, to: '#', position: 'last' }
])

const handleDelete = async () => {
  if (!confirm(`Delete interface ${ipAddress}? This cannot be undone.`)) return
  const ok = await nodeService.deleteNodeIpInterface(nodeId, ipAddress)
  if (ok) {
    showSnackBar({ msg: `Interface ${ipAddress} deleted` })
    router.push(`/node/${nodeId}`)
  } else {
    showSnackBar({ msg: `Failed to delete interface ${ipAddress}`, error: true })
  }
}
</script>

<style lang="scss" scoped>
.interface-detail {
  &__error   { padding: 24px; text-align: center; }
  &__skeleton { padding: 16px; }
}

.feather-row + .feather-row { margin-top: 12px; }

.card__section-title { padding: 16px 20px 8px; }
</style>
```

- [ ] **Step 2: Verify FIQL filter works for OutagesTable**

`OutagesTable` accepts `filterFiql?: string` and applies it as `_s`. Verify the FIQL key for IP address in the outages API:

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/outages?_s=ipAddress==127.0.0.1&limit=5" \
  | python3 -m json.tool | grep -E '"count"|"ipAddress"' | head -5
```

If no results or an error, try `ipAddr` instead of `ipAddress`. Update the `filterFiql` prop in `InterfaceDetail.vue` to match the correct field name.

- [ ] **Step 3: Create MetaDataPanel component (if it doesn't exist)**

```bash
ls ui/src/components/Common/MetaDataPanel.vue 2>/dev/null || echo "MISSING"
```

If missing, create `ui/src/components/Common/MetaDataPanel.vue`:

```vue
<template>
  <div class="metadata-panel card">
    <div class="headline4 metadata-panel__title">{{ title }}</div>
    <div v-if="!items.length" class="metadata-panel__empty">No metadata</div>
    <table v-else class="tl1 tl2 tl3">
      <thead>
        <tr>
          <th scope="col">Context</th>
          <th scope="col">Key</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in items" :key="`${item.context}_${item.key}_${i}`">
          <td>{{ item.context }}</td>
          <td>{{ item.key }}</td>
          <td>{{ item.value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { OnmsMetaData } from '@/types'
defineProps<{ title: string; items: OnmsMetaData[] }>()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.metadata-panel {
  padding: 16px 20px;
  &__title  { margin-bottom: 12px; }
  &__empty  { color: var($secondary-text-on-surface); }
}
</style>
```

- [ ] **Step 4: Build to verify no errors**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "^.*error" | head -20
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add ui/src/containers/InterfaceDetail.vue \
        ui/src/components/InterfaceDetail/ \
        ui/src/components/Common/MetaDataPanel.vue
git commit -m "feat(element): add InterfaceDetail Vue page"
```

---

## Task 6: Wire InterfaceDetail into router + update inbound links + replace JSP

**Files:**
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/components/Menu/SideMenu.vue`
- Modify: `ui/src/components/Nodes/NodesTable.vue`
- Modify: `ui/src/containers/AlarmDetail.vue`
- Modify: `ui/src/containers/EventDetail.vue`
- Modify: `ui/src/containers/OutageDetail.vue`
- Modify: `opennms-webapp/src/main/webapp/element/interface.jsp`

- [ ] **Step 1: Add route to `ui/src/main/router/index.ts`**

After the `/node/:id` route (around line 205), add:

```typescript
{
  path: '/interface/:nodeId/:ipAddress',
  name: 'Interface Detail',
  component: () => import('@/containers/InterfaceDetail.vue')
},
```

- [ ] **Step 2: Update `NodesTable.vue` link**

In `ui/src/components/Nodes/NodesTable.vue` at line 473, replace:

```typescript
return `${mainMenu.value.baseHref}element/interface.jsp?node=${nodeId}&intf=${ipAddress}`
```

with:

```typescript
return `/opennms/ui/index.html#/interface/${nodeId}/${encodeURIComponent(ipAddress)}`
```

Check how this URL is rendered (as `href` or as a router-link). If it's a plain `<a href>`, keep the `/opennms/ui/index.html#/interface/...` form. If it goes through the Vue router, use a `{ name: 'Interface Detail', params: { nodeId, ipAddress } }` push instead.

- [ ] **Step 3: Update `AlarmDetail.vue` link (line 73)**

Replace:

```typescript
:href="`/opennms/element/interface.jsp?node=${alarm.nodeId}&intf=${alarm.ipAddress}`"
```

with:

```typescript
:href="`/opennms/ui/index.html#/interface/${alarm.nodeId}/${encodeURIComponent(alarm.ipAddress)}`"
```

- [ ] **Step 4: Update `EventDetail.vue` link (line 75)**

Replace:

```typescript
:href="`/opennms/element/interface.jsp?node=${event.nodeId}&intf=${event.ipAddress}`"
```

with:

```typescript
:href="`/opennms/ui/index.html#/interface/${event.nodeId}/${encodeURIComponent(event.ipAddress)}`"
```

- [ ] **Step 5: Update `OutageDetail.vue` link (line 71)**

Replace:

```typescript
:href="`/opennms/element/interface.jsp?node=${outage.nodeId}&intf=${outage.ipAddress}`"
```

with:

```typescript
:href="`/opennms/ui/index.html#/interface/${outage.nodeId}/${encodeURIComponent(outage.ipAddress)}`"
```

- [ ] **Step 6: Replace `element/interface.jsp` with redirect**

Replace the entire contents of `opennms-webapp/src/main/webapp/element/interface.jsp` with:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  String intf = request.getParameter("intf");
  if (node == null || intf == null || node.isEmpty() || intf.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing node or intf parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/interface/" + node + "/" + java.net.URLEncoder.encode(intf, "UTF-8"));
  }
%>
```

- [ ] **Step 7: Build, deploy, and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Verify built hash matches deployed hash:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Then test in the browser: navigate to an alarm detail page, click the interface link — it should go to `#/interface/{nodeId}/{ip}` within the SPA, not break out to a JSP.

- [ ] **Step 8: Commit**

```bash
git add ui/src/main/router/index.ts \
        ui/src/components/Menu/SideMenu.vue \
        ui/src/components/Nodes/NodesTable.vue \
        ui/src/containers/AlarmDetail.vue \
        ui/src/containers/EventDetail.vue \
        ui/src/containers/OutageDetail.vue \
        opennms-webapp/src/main/webapp/element/interface.jsp
git commit -m "feat(element): wire InterfaceDetail route, replace interface.jsp redirect, update inbound links"
```

---

## Task 7: SnmpInterfaceHeader.vue

**Files:**
- Create: `ui/src/components/SnmpInterfaceDetail/SnmpInterfaceHeader.vue`

- [ ] **Step 1: Create the directory and component**

```bash
mkdir -p ui/src/components/SnmpInterfaceDetail
```

Create `ui/src/components/SnmpInterfaceDetail/SnmpInterfaceHeader.vue`:

```vue
<template>
  <div class="snmp-header card">
    <div class="snmp-header__primary">
      <div class="headline3">{{ title }}</div>
      <div class="snmp-header__badges">
        <span :class="['badge', adminStatusClass]">Admin: {{ adminStatusLabel }}</span>
        <span :class="['badge', operStatusClass]">Oper: {{ operStatusLabel }}</span>
      </div>
    </div>

    <dl class="snmp-header__grid">
      <dt>Node</dt>
      <dd><router-link :to="`/node/${nodeId}`">Node {{ nodeId }}</router-link></dd>
      <dt>ifIndex</dt>
      <dd>{{ iface.ifIndex }}</dd>
      <dt>ifName</dt>
      <dd>{{ iface.ifName || 'N/A' }}</dd>
      <dt>ifAlias</dt>
      <dd>{{ iface.ifAlias || 'N/A' }}</dd>
      <dt>ifType</dt>
      <dd>{{ iface.ifType }}</dd>
      <dt>Speed</dt>
      <dd>{{ formattedSpeed }}</dd>
      <dt>Physical Addr</dt>
      <dd>{{ iface.physAddr || 'N/A' }}</dd>
    </dl>

    <div class="snmp-header__actions">
      <router-link
        v-if="snmpIntfResourceId"
        :to="`/resource-graphs/graphs/${encodeURIComponent('Node ' + nodeId)}/${encodeURIComponent('all')}/${encodeURIComponent(snmpIntfResourceId)}`"
        class="btn btn-secondary btn-sm"
      >Interface Data Graphs</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SnmpInterface } from '@/types'

const props = defineProps<{
  iface: SnmpInterface
  nodeId: string
}>()

const title = computed(() =>
  props.iface.ifDescr || props.iface.ifName || `Interface ${props.iface.ifIndex}`
)

// Admin status: 1=up, 2=down, 3=testing
const adminStatusLabel = computed(() => ({ 1: 'Up', 2: 'Down', 3: 'Testing' }[props.iface.ifAdminStatus] ?? String(props.iface.ifAdminStatus))
)
const adminStatusClass = computed(() =>
  props.iface.ifAdminStatus === 1 ? 'badge--up' : 'badge--down'
)

// Oper status: 1=up, 2=down, 3=testing, 4=unknown, 5=dormant, 6=notPresent, 7=lowerLayerDown
const operStatusLabel = computed(() =>
  ({ 1: 'Up', 2: 'Down', 3: 'Testing', 4: 'Unknown', 5: 'Dormant', 6: 'Not Present', 7: 'Lower Layer Down' }[props.iface.ifOperStatus] ?? String(props.iface.ifOperStatus))
)
const operStatusClass = computed(() =>
  props.iface.ifOperStatus === 1 ? 'badge--up' : 'badge--down'
)

const formattedSpeed = computed(() => {
  const bps = props.iface.ifSpeed
  if (!bps) return 'N/A'
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(1)} Gbps`
  if (bps >= 1_000_000)     return `${(bps / 1_000_000).toFixed(0)} Mbps`
  if (bps >= 1_000)         return `${(bps / 1_000).toFixed(0)} Kbps`
  return `${bps} bps`
})

const snmpIntfResourceId = computed(() =>
  `node[${props.nodeId}].interfaceSnmp[${props.iface.ifName || props.iface.ifDescr || props.iface.ifIndex}]`
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.snmp-header {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: start;

  &__badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

  &__grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    dt { font-weight: 600; color: var($secondary-text-on-surface); }
  }

  &__actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  &--up   { background: var($success); color: var($primary-text-on-color); }
  &--down { background: var($error);   color: var($primary-text-on-color); }
}
</style>
```

---

## Task 8: SnmpInterfaceDetail.vue container + route + JSP redirect

**Files:**
- Create: `ui/src/containers/SnmpInterfaceDetail.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `opennms-webapp/src/main/webapp/element/snmpinterface.jsp`

- [ ] **Step 1: Create `ui/src/containers/SnmpInterfaceDetail.vue`**

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div v-if="error && !loading" class="feather-row">
    <div class="feather-col-12 snmp-detail__error">
      <p class="headline4">SNMP Interface not found</p>
      <p class="subtitle1">{{ error }}</p>
    </div>
  </div>

  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 snmp-detail__skeleton headline3">Loading SNMP interface…</div>
  </div>

  <template v-else-if="iface">
    <div class="feather-row">
      <div class="feather-col-12">
        <SnmpInterfaceHeader :iface="iface" :nodeId="nodeId" />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Recent Events</div>
          <EventsTable :nodeId="nodeId" />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SnmpInterfaceHeader from '@/components/SnmpInterfaceDetail/SnmpInterfaceHeader.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import nodeService from '@/services/nodeService'
import { useMenuStore } from '@/stores/menuStore'
import { SnmpInterface, BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()

const nodeId = route.params.nodeId as string
const ifIndex = route.params.ifIndex as string

const iface = ref<SnmpInterface | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const result = await nodeService.getNodeSnmpInterfaceByIfIndex(nodeId, ifIndex)
  loading.value = false
  if (!result) {
    error.value = `SNMP interface ifIndex ${ifIndex} not found on node ${nodeId}`
    return
  }
  iface.value = result
})

const title = computed(() =>
  iface.value ? (iface.value.ifDescr || iface.value.ifName || `ifIndex ${ifIndex}`) : `ifIndex ${ifIndex}`
)

const homeUrl = computed(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: `Node ${nodeId}`, to: `/node/${nodeId}` },
  { label: title.value, to: '#', position: 'last' }
])
</script>

<style lang="scss" scoped>
.snmp-detail {
  &__error   { padding: 24px; text-align: center; }
  &__skeleton { padding: 16px; }
}
.feather-row + .feather-row { margin-top: 12px; }
.card__section-title { padding: 16px 20px 8px; }
</style>
```

- [ ] **Step 2: Add route to router**

After the `/interface/:nodeId/:ipAddress` route added in Task 6, add:

```typescript
{
  path: '/snmpinterface/:nodeId/:ifIndex',
  name: 'SNMP Interface Detail',
  component: () => import('@/containers/SnmpInterfaceDetail.vue')
},
```

- [ ] **Step 3: Replace `element/snmpinterface.jsp` with redirect**

Replace the entire contents of `opennms-webapp/src/main/webapp/element/snmpinterface.jsp` with:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  String ifIndex = request.getParameter("ifindex");
  if (node == null || ifIndex == null || node.isEmpty() || ifIndex.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing node or ifindex parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/snmpinterface/" + node + "/" + ifIndex);
  }
%>
```

- [ ] **Step 4: Check for any existing Vue links to snmpinterface.jsp and update them**

```bash
grep -rn "snmpinterface\.jsp" ui/src/ --include="*.vue" --include="*.ts"
```

Update any found references to use `#/snmpinterface/{nodeId}/{ifIndex}`.

- [ ] **Step 5: Build, deploy, and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Verify: navigate to a node's Network tab, click an SNMP interface — should stay in SPA.

- [ ] **Step 6: Commit**

```bash
git add ui/src/containers/SnmpInterfaceDetail.vue \
        ui/src/components/SnmpInterfaceDetail/ \
        ui/src/main/router/index.ts \
        opennms-webapp/src/main/webapp/element/snmpinterface.jsp
git commit -m "feat(element): add SnmpInterfaceDetail Vue page and redirect"
```

---

## Task 9: Node metadata panel in NodeDetails.vue

**Files:**
- Modify: `ui/src/containers/NodeDetails.vue`

- [ ] **Step 1: Add metadata fetch to NodeDetails.vue**

In the `<script setup>` block, after the existing imports and near the other `onMounted` data loading, add:

```typescript
import MetaDataPanel from '@/components/Common/MetaDataPanel.vue'
import { OnmsMetaData } from '@/types'

const metaData = ref<OnmsMetaData[]>([])

// Fetch metadata alongside existing data
onMounted(async () => {
  const result = await nodeService.getNodeMetaData(id)
  if (result) metaData.value = result.metaData
})
```

Check how `nodeService` is imported in `NodeDetails.vue` — if it isn't, add the import:
```typescript
import nodeService from '@/services/nodeService'
```

- [ ] **Step 2: Add metadata display to the Overview tab**

In the Overview `<FeatherTabPanel>` in `NodeDetails.vue`, after `<AvailabilityPanel>`, add:

```vue
<MetaDataPanel
  v-if="metaData.length"
  title="Node Metadata"
  :items="metaData"
/>
```

- [ ] **Step 3: Replace `element/node-metadata.jsp` with redirect**

Replace the entire contents of `opennms-webapp/src/main/webapp/element/node-metadata.jsp` with:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  if (node == null || node.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing node parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/node/" + node + "?tab=overview");
  }
%>
```

- [ ] **Step 4: Build and verify metadata panel appears on a node**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Navigate to a node's Overview tab. If metadata exists, the panel should appear below the availability chart.

- [ ] **Step 5: Commit**

```bash
git add ui/src/containers/NodeDetails.vue \
        opennms-webapp/src/main/webapp/element/node-metadata.jsp
git commit -m "feat(element): add node metadata panel to NodeDetails overview tab"
```

---

## Task 10: Redirect-only JSPs

These JSPs have Vue equivalents that already exist. Replace each with a minimal redirect.

**Files:**
- Modify: `opennms-webapp/src/main/webapp/element/availability.jsp`
- Modify: `opennms-webapp/src/main/webapp/element/linkednode.jsp`
- Modify: `opennms-webapp/src/main/webapp/element/index.jsp`
- Modify: `opennms-webapp/src/main/webapp/element/rescan.jsp`
- Modify: `opennms-webapp/src/main/webapp/element/interface-metadata.jsp`
- Modify: `opennms-webapp/src/main/webapp/element/service-metadata.jsp`

- [ ] **Step 1: Replace `element/availability.jsp`**

Replace the entire file contents:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  String target = (node != null && !node.isEmpty())
    ? "/ui/index.html#/node/" + node + "?tab=overview"
    : "/ui/index.html#/nodes";
  response.sendRedirect(request.getContextPath() + target);
%>
```

- [ ] **Step 2: Replace `element/linkednode.jsp`**

Replace the entire file contents:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  if (node == null || node.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing node parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/node/" + node + "?tab=network");
  }
%>
```

- [ ] **Step 3: Replace `element/index.jsp`**

Replace the entire file contents:

```jsp
<%@ page contentType="text/html" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/nodes"); %>
```

- [ ] **Step 4: Replace `element/rescan.jsp`**

Replace the entire file contents:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  String target = (node != null && !node.isEmpty())
    ? "/ui/index.html#/node/" + node
    : "/ui/index.html#/nodes";
  response.sendRedirect(request.getContextPath() + target);
%>
```

- [ ] **Step 5: Replace `element/interface-metadata.jsp`**

Replace the entire file contents:

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  String ipAddr = request.getParameter("ipAddr");
  if (node == null || ipAddr == null || node.isEmpty() || ipAddr.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing node or ipAddr parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/interface/" + node + "/" + java.net.URLEncoder.encode(ipAddr, "UTF-8"));
  }
%>
```

- [ ] **Step 6: Replace `element/service-metadata.jsp`**

Check the params this JSP uses:

```bash
grep -n "getParameter\|param" opennms-webapp/src/main/webapp/element/service-metadata.jsp | head -10
```

Then replace with a redirect to the interface page using whatever params it accepts (typically `node` + `ipAddr`):

```jsp
<%@ page contentType="text/html" %>
<%
  String node = request.getParameter("node");
  String ipAddr = request.getParameter("ipAddr");
  String target = (node != null && ipAddr != null && !node.isEmpty() && !ipAddr.isEmpty())
    ? "/ui/index.html#/interface/" + node + "/" + java.net.URLEncoder.encode(ipAddr, "UTF-8")
    : "/ui/index.html#/nodes";
  response.sendRedirect(request.getContextPath() + target);
%>
```

- [ ] **Step 7: Commit all redirect JSPs**

```bash
git add opennms-webapp/src/main/webapp/element/availability.jsp \
        opennms-webapp/src/main/webapp/element/linkednode.jsp \
        opennms-webapp/src/main/webapp/element/index.jsp \
        opennms-webapp/src/main/webapp/element/rescan.jsp \
        opennms-webapp/src/main/webapp/element/interface-metadata.jsp \
        opennms-webapp/src/main/webapp/element/service-metadata.jsp
git commit -m "feat(element): replace remaining element JSPs with Vue SPA redirects"
```

---

## Task 11: Final build, deploy, and end-to-end verification

- [ ] **Step 1: Final build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```

Verify `ui/src/main/dist/index.html` has `src="/opennms/ui/assets/index-*.js"` paths.

- [ ] **Step 2: Deploy**

```bash
./ui/deploy-to-container.sh test-opennms
```

Verify hash match:
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

- [ ] **Step 3: End-to-end smoke test**

Test each operator workflow that previously broke out of the SPA:

1. Navigate to an alarm → click the IP address link → should land on `#/interface/{nodeId}/{ip}`, not a JSP
2. Navigate to an outage → click the interface link → same
3. Navigate to a node's Network tab → click an IP interface row → should open `#/interface/...`
4. Navigate to a node's Network tab → click an SNMP interface → should open `#/snmpinterface/...`
5. Navigate to a node's Overview tab → metadata panel should render (if node has metadata)
6. Try `element/availability.jsp?node=1` directly → should redirect to `#/node/1?tab=overview`
7. Try `element/linkednode.jsp?node=1` → should redirect to `#/node/1?tab=network`
8. Verify dark mode: toggle theme, check InterfaceDetail and SnmpInterfaceDetail in dark mode

- [ ] **Step 4: Check for CSS var() issues**

```bash
grep -n 'var(\$\|--feather' ui/src/main/dist/assets/*.css | grep -v 'var(--' | head -10
```

Expected: no bare `--feather-*` values — all should be wrapped in `var()`.

- [ ] **Step 5: Final commit if any touch-ups needed**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(element): phase 1 touch-ups from e2e verification"
```
