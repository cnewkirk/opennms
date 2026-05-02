# Domain A — Admin Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `admin/manage.jsp`, `admin/snmpInterfaces.jsp`, and `admin/nodemanagement/instrumentationLogReader.jsp` with Vue SPA pages backed by existing (manage, snmp) or new (log reader) REST endpoints.

**Architecture:** Three new Vue containers each backed by a service file. `ManageInterfaces` and `SnmpInterfaces` compose existing v1 REST (no new Java). `InstrumentationLog` requires one new JAX-RS service (`InstrumentationLogRestService`) and a companion DTO (`ServiceCollectorDTO`) added to `opennms-webapp-rest`. The ilr dependency (`org.opennms.features.instrumentationLogReader`) must be added to `opennms-webapp-rest/pom.xml` for compile-time resolution (the jar is already in the deployed war via `opennms-webapp`).

**Tech Stack:** Vue 3, TypeScript, PrimeVue 4, Java 17 JAX-RS (CXF), `org.opennms.util.ilr.Collector`, existing v1 REST (`/rest/nodes`, `/rest/ifservices`), pnpm build, podman hot-patch.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `opennms-webapp-rest/pom.xml` | Add ilr compile dependency |
| Create | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/ServiceCollectorDTO.java` | JSON DTO mapping ServiceCollector fields |
| Create | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/InstrumentationLogRestService.java` | `GET /api/v2/instrumentation-log` |
| Create | `ui/src/services/instrumentationLogService.ts` | Axios wrapper for instrumentation log endpoint |
| Create | `ui/src/containers/InstrumentationLog.vue` | Log reader UI — search + sortable table |
| Create | `ui/src/services/manageInterfacesService.ts` | Axios wrappers for nodes/ipinterfaces/ifservices |
| Create | `ui/src/containers/ManageInterfaces.vue` | Node search → interface+service managed state toggles |
| Create | `ui/src/services/snmpInterfacesService.ts` | Axios wrapper for SNMP interface REST |
| Create | `ui/src/containers/SnmpInterfaces.vue` | Node search → SNMP interface collection toggles |
| Modify | `ui/src/main/router/index.ts` | Add three new routes |
| Modify | `ui/src/containers/Admin.vue` | `href:` → `to:` for all three pages |
| Modify | `opennms-webapp/src/main/webapp/admin/manage.jsp` | sendRedirect scriptlet |
| Modify | `opennms-webapp/src/main/webapp/admin/snmpInterfaces.jsp` | sendRedirect scriptlet |
| Modify | `opennms-webapp/src/main/webapp/admin/nodemanagement/instrumentationLogReader.jsp` | sendRedirect scriptlet |

---

## Task 1: Add ilr dependency to opennms-webapp-rest

**Files:**
- Modify: `opennms-webapp-rest/pom.xml`

- [ ] **Step 1: Find the dependencies block**

Open `opennms-webapp-rest/pom.xml`. Find the `<dependencies>` section.

- [ ] **Step 2: Add the dependency**

Add the following block inside `<dependencies>`, adjacent to other `org.opennms.features` entries:

```xml
<dependency>
  <groupId>org.opennms.features</groupId>
  <artifactId>org.opennms.features.instrumentationLogReader</artifactId>
  <scope>${onmsLibScope}</scope>
</dependency>
```

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp-rest/pom.xml
git commit -m "chore: add ilr dependency to opennms-webapp-rest for InstrumentationLogRestService"
```

---

## Task 2: Create ServiceCollectorDTO

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/ServiceCollectorDTO.java`

- [ ] **Step 1: Create the DTO class**

```java
package org.opennms.web.rest.v2;

import org.opennms.util.ilr.ServiceCollector;

public class ServiceCollectorDTO {
    public String serviceId;
    public String parsedServiceId;
    public int collectionCount;
    public int successfulCollectionCount;
    public int errorCollectionCount;
    public double successPercentage;
    public double errorPercentage;
    public long avgCollectionTimeMs;
    public long avgTimeBetweenCollectionsMs;
    public long avgErrorCollectionTimeMs;
    public long avgPersistTimeMs;
    public long totalPersistTimeMs;

    public static ServiceCollectorDTO from(ServiceCollector sc) {
        ServiceCollectorDTO dto = new ServiceCollectorDTO();
        dto.serviceId = sc.getServiceID();
        dto.parsedServiceId = sc.getParsedServiceID();
        dto.collectionCount = sc.getCollectionCount();
        dto.successfulCollectionCount = sc.getSuccessfulCollectionCount();
        dto.errorCollectionCount = sc.getErrorCollectionCount();
        dto.successPercentage = sc.getSuccessPercentage();
        dto.errorPercentage = sc.getErrorPercentage();
        dto.avgCollectionTimeMs = sc.getAverageCollectionTime();
        dto.avgTimeBetweenCollectionsMs = sc.getAverageTimeBetweenCollections();
        dto.avgErrorCollectionTimeMs = sc.getAverageErrorCollectionTime();
        dto.avgPersistTimeMs = sc.getAveragePersistTime();
        dto.totalPersistTimeMs = sc.getTotalPersistTime();
        return dto;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/ServiceCollectorDTO.java
git commit -m "feat: add ServiceCollectorDTO for instrumentation log REST endpoint"
```

---

## Task 3: Create InstrumentationLogRestService

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/InstrumentationLogRestService.java`

- [ ] **Step 1: Create the REST service**

```java
package org.opennms.web.rest.v2;

import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.web.api.Authentication;
import org.opennms.util.ilr.Collector;
import org.springframework.stereotype.Component;

@Component
@Path("instrumentation-log")
@Tag(name = "Instrumentation Log", description = "Instrumentation Log Reader API")
@Produces(MediaType.APPLICATION_JSON)
public class InstrumentationLogRestService {

    @GET
    @Operation(summary = "Get instrumentation log statistics", operationId = "getInstrumentationLog")
    public Response getInstrumentationLog(
            @Context SecurityContext securityContext,
            @QueryParam("search") @DefaultValue("") String search,
            @QueryParam("sortColumn") @DefaultValue("TOTALCOLLECTS") String sortColumn,
            @QueryParam("sortOrder") @DefaultValue("DESCENDING") String sortOrder) {

        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Status.FORBIDDEN).build();
        }

        String opennmsHome = System.getProperty("opennms.home");
        if (opennmsHome == null) {
            return Response.ok(Collections.emptyList()).build();
        }

        Collector collector = new Collector();
        if (!search.isEmpty()) {
            collector.setSearchString(search);
        }
        try {
            collector.setSortColumn(Collector.SortColumn.valueOf(sortColumn));
        } catch (IllegalArgumentException ignored) { }
        try {
            collector.setSortOrder(Collector.SortOrder.valueOf(sortOrder));
        } catch (IllegalArgumentException ignored) { }

        File logDir = new File(opennmsHome, "logs");
        if (logDir.exists() && logDir.isDirectory()) {
            File[] logFiles = logDir.listFiles(f -> f.getName().startsWith("instrumentation.log"));
            if (logFiles != null) {
                for (File f : logFiles) {
                    try {
                        collector.readLogMessagesFromFile(f.getPath());
                    } catch (IOException ignored) { }
                }
            }
        }

        List<ServiceCollectorDTO> result = collector.getServiceCollectors()
                .stream()
                .map(ServiceCollectorDTO::from)
                .collect(Collectors.toList());

        return Response.ok(result).build();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/InstrumentationLogRestService.java
git commit -m "feat: add InstrumentationLogRestService at GET /api/v2/instrumentation-log"
```

---

## Task 4: Compile and hot-patch the REST service

**Files:**
- No source changes — build and deploy only.

- [ ] **Step 1: Compile opennms-webapp-rest**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp-rest -am
```

Expected: `BUILD SUCCESS`

- [ ] **Step 2: Locate compiled classes**

```bash
ls opennms-webapp-rest/target/classes/org/opennms/web/rest/v2/InstrumentationLog* \
   opennms-webapp-rest/target/classes/org/opennms/web/rest/v2/ServiceCollectorDTO*
```

Expected: both `.class` files present.

- [ ] **Step 3: Find the REST jar in the container**

```bash
podman exec test-opennms ls /opt/opennms/jetty-webapps/opennms/WEB-INF/lib/ | grep webapp-rest
```

Note the exact filename (e.g. `opennms-webapp-rest-35.0.4.jar`). Use it in the next step.

- [ ] **Step 4: Hot-patch the jar**

```bash
# Run from repo root
cp $(podman exec test-opennms sh -c 'cat /dev/stdin' < /dev/null; \
  podman cp test-opennms:/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-rest-35.0.4.jar /tmp/opennms-webapp-rest-35.0.4.jar) \
  /tmp/opennms-webapp-rest-35.0.4.jar 2>/dev/null; \
podman cp test-opennms:/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-rest-35.0.4.jar \
  /tmp/opennms-webapp-rest-35.0.4.jar

cd opennms-webapp-rest/target/classes && \
  jar uf /tmp/opennms-webapp-rest-35.0.4.jar \
    org/opennms/web/rest/v2/InstrumentationLogRestService.class \
    org/opennms/web/rest/v2/ServiceCollectorDTO.class
cd -

podman cp /tmp/opennms-webapp-rest-35.0.4.jar \
  test-opennms:/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-rest-35.0.4.jar

podman restart test-opennms
```

- [ ] **Step 5: Wait for startup and verify**

```bash
# Poll until ready (up to 60s)
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/info)
  [ "$code" = "200" ] && echo "Ready" && break
  echo "Attempt $i: $code — waiting 5s"; sleep 5
done
```

- [ ] **Step 6: curl verify the endpoint**

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/instrumentation-log" \
  -H "Accept: application/json" | python3 -m json.tool | head -30
```

Expected: JSON array (may be empty `[]` if no instrumentation log exists — that is correct behaviour). HTTP 200.

```bash
# Also verify 403 without admin
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8980/opennms/api/v2/instrumentation-log" \
  -u guest:guest -H "Accept: application/json"
```

Expected: `403`

---

## Task 5: Create instrumentationLogService.ts

**Files:**
- Create: `ui/src/services/instrumentationLogService.ts`

- [ ] **Step 1: curl the endpoint and note actual JSON shape**

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/instrumentation-log" \
  -H "Accept: application/json" | python3 -m json.tool
```

Confirm the response is an array of objects with fields: `serviceId`, `parsedServiceId`, `collectionCount`, `successfulCollectionCount`, `errorCollectionCount`, `successPercentage`, `errorPercentage`, `avgCollectionTimeMs`, `avgTimeBetweenCollectionsMs`, `avgErrorCollectionTimeMs`, `avgPersistTimeMs`, `totalPersistTimeMs`.

- [ ] **Step 2: Create the service file**

```typescript
import { v2 } from '@/services/axiosInstances'

export interface ServiceCollectorEntry {
  serviceId: string
  parsedServiceId: string
  collectionCount: number
  successfulCollectionCount: number
  errorCollectionCount: number
  successPercentage: number
  errorPercentage: number
  avgCollectionTimeMs: number
  avgTimeBetweenCollectionsMs: number
  avgErrorCollectionTimeMs: number
  avgPersistTimeMs: number
  totalPersistTimeMs: number
}

export type SortColumn = 'TOTALCOLLECTS' | 'AVGCOLLECTTIME' | 'AVGTIMEBETWEENCOLLECTS'
  | 'TOTALSUCCESSCOLLECTS' | 'AVGSUCCESSCOLLECTTIME' | 'TOTALERRORS'
  | 'AVGERRORTIME' | 'AVGPERSISTTIME' | 'TOTALPERSISTTIME'

export type SortOrder = 'ASCENDING' | 'DESCENDING'

export const getInstrumentationLog = async (params?: {
  search?: string
  sortColumn?: SortColumn
  sortOrder?: SortOrder
}): Promise<ServiceCollectorEntry[]> => {
  const resp = await v2.get<ServiceCollectorEntry[]>('/instrumentation-log', { params })
  return resp.data
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/services/instrumentationLogService.ts
git commit -m "feat: add instrumentationLogService"
```

---

## Task 6: Create InstrumentationLog.vue

**Files:**
- Create: `ui/src/containers/InstrumentationLog.vue`

- [ ] **Step 1: Create the container**

```vue
<template>
  <div class="instrumentation-log">
    <BreadCrumb :items="breadcrumbs" />
    <div class="instrumentation-log__toolbar">
      <InputText
        v-model="search"
        placeholder="Filter by service ID…"
        class="instrumentation-log__search"
        @input="debouncedLoad"
      />
      <Select
        v-model="sortColumn"
        :options="sortColumnOptions"
        option-label="label"
        option-value="value"
        class="instrumentation-log__sort-col"
        @change="load"
      />
      <Select
        v-model="sortOrder"
        :options="sortOrderOptions"
        option-label="label"
        option-value="value"
        class="instrumentation-log__sort-order"
        @change="load"
      />
    </div>

    <DataTable
      :value="entries"
      :loading="loading"
      size="small"
      striped-rows
      class="instrumentation-log__table"
    >
      <template #empty>
        <span v-if="!loading">No instrumentation log data found. Ensure <code>instrumentation.log</code> is set to INFO in <code>log4j2.xml</code>.</span>
      </template>
      <Column field="serviceId" header="Service ID" sortable>
        <template #body="{ data }">
          <RouterLink :to="`/node/${data.parsedServiceId}`">{{ data.serviceId }}</RouterLink>
        </template>
      </Column>
      <Column field="collectionCount" header="Collections" sortable />
      <Column field="avgCollectionTimeMs" header="Avg Collect (ms)" sortable />
      <Column field="avgTimeBetweenCollectionsMs" header="Avg Between (ms)" sortable />
      <Column field="successfulCollectionCount" header="Successes" sortable />
      <Column header="Success %" sortable>
        <template #body="{ data }">
          <span :class="successClass(data.successPercentage)">
            {{ data.successPercentage === -1 ? 'N/A' : data.successPercentage.toFixed(1) + '%' }}
          </span>
        </template>
      </Column>
      <Column field="errorCollectionCount" header="Errors" sortable />
      <Column header="Error %" sortable>
        <template #body="{ data }">
          {{ data.errorPercentage === -1 ? 'N/A' : data.errorPercentage.toFixed(1) + '%' }}
        </template>
      </Column>
      <Column field="avgErrorCollectionTimeMs" header="Avg Error (ms)" sortable />
      <Column field="avgPersistTimeMs" header="Avg Persist (ms)" sortable />
      <Column field="totalPersistTimeMs" header="Total Persist (ms)" sortable />
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BreadCrumb from '@/components/Layout/BreadCrumb.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import {
  getInstrumentationLog,
  type ServiceCollectorEntry,
  type SortColumn,
  type SortOrder
} from '@/services/instrumentationLogService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Instrumentation Log', to: '#', position: 'last' }
]

const entries = ref<ServiceCollectorEntry[]>([])
const loading = ref(false)
const search = ref('')
const sortColumn = ref<SortColumn>('TOTALCOLLECTS')
const sortOrder = ref<SortOrder>('DESCENDING')

const sortColumnOptions = [
  { label: 'Total Collections', value: 'TOTALCOLLECTS' },
  { label: 'Avg Collection Time', value: 'AVGCOLLECTTIME' },
  { label: 'Avg Time Between', value: 'AVGTIMEBETWEENCOLLECTS' },
  { label: 'Total Successes', value: 'TOTALSUCCESSCOLLECTS' },
  { label: 'Avg Success Time', value: 'AVGSUCCESSCOLLECTTIME' },
  { label: 'Total Errors', value: 'TOTALERRORS' },
  { label: 'Avg Error Time', value: 'AVGERRORTIME' },
  { label: 'Avg Persist Time', value: 'AVGPERSISTTIME' },
  { label: 'Total Persist Time', value: 'TOTALPERSISTTIME' }
]

const sortOrderOptions = [
  { label: 'Descending', value: 'DESCENDING' },
  { label: 'Ascending', value: 'ASCENDING' }
]

const load = async () => {
  loading.value = true
  try {
    entries.value = await getInstrumentationLog({
      search: search.value || undefined,
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value
    })
  } catch {
    showSnackBar({ msg: 'Failed to load instrumentation log data.' })
  } finally {
    loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout>
const debouncedLoad = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

const successClass = (pct: number) => {
  if (pct === -1) return ''
  if (pct >= 90) return 'il-success'
  if (pct >= 50) return 'il-warning'
  return 'il-error'
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '@/styles/tokens';

.instrumentation-log {
  &__toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  &__search { flex: 1; min-width: 200px; }
  &__sort-col, &__sort-order { width: 220px; }
}

.il-success { color: #{$success}; font-weight: 600; }
.il-warning { color: #{$warning}; font-weight: 600; }
.il-error   { color: #{$error};   font-weight: 600; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/InstrumentationLog.vue
git commit -m "feat: add InstrumentationLog container"
```

---

## Task 7: Create manageInterfacesService.ts

**Files:**
- Create: `ui/src/services/manageInterfacesService.ts`

- [ ] **Step 1: curl verify the REST shapes before writing types**

```bash
# Node list
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes?limit=5" \
  -H "Accept: application/json" | python3 -m json.tool | grep -E '"id"|"label"' | head -10

# IP interfaces for node 1
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes/1/ipinterfaces?limit=10" \
  -H "Accept: application/json" | python3 -m json.tool | head -30

# Services on 127.0.0.1
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes/1/ipinterfaces/127.0.0.1/services" \
  -H "Accept: application/json" | python3 -m json.tool | head -30
```

Confirm:
- Node: `{ id, label }`
- IpInterface: `{ id, ipAddress, isManaged: "M"|"U"|"D", nodeId }`
- Service: `{ id, status: "A"|"F"|"N", serviceType: { name } }`

- [ ] **Step 2: Create the service file**

```typescript
import { rest, v2 } from '@/services/axiosInstances'

export interface ManagedNode {
  id: string
  label: string
}

export interface ManagedInterface {
  id: string
  ipAddress: string
  isManaged: 'M' | 'U' | 'D'
  nodeId: number
}

export interface ManagedService {
  id: number
  status: 'A' | 'F' | 'N'
  serviceType: { name: string }
}

export const searchNodes = async (label: string): Promise<ManagedNode[]> => {
  const resp = await v2.get('/nodes', { params: { label: `%${label}%`, limit: 10 } })
  const raw = resp.data.node
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const getInterfacesForNode = async (nodeId: string): Promise<ManagedInterface[]> => {
  const resp = await rest.get(`/nodes/${nodeId}/ipinterfaces`, { params: { limit: 0 } })
  const raw = resp.data.ipInterface
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const getServicesForInterface = async (nodeId: string, ip: string): Promise<ManagedService[]> => {
  const resp = await rest.get(`/nodes/${nodeId}/ipinterfaces/${ip}/services`, { params: { limit: 0 } })
  const raw = resp.data.service
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const setInterfaceManaged = async (nodeId: string, ip: string, managed: boolean): Promise<void> => {
  const params = new URLSearchParams({ isManaged: managed ? 'M' : 'U' })
  await rest.put(`/nodes/${nodeId}/ipinterfaces/${ip}`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}

// Toggles a single service on a specific IP address.
// Uses IfServicesRestService: PUT /rest/ifservices?ipInterface.ipAddress={ip}&services={name}
export const setServiceManaged = async (ip: string, serviceName: string, managed: boolean): Promise<void> => {
  const params = new URLSearchParams({ status: managed ? 'A' : 'F', services: serviceName })
  await rest.put(
    `/ifservices?ipInterface.ipAddress=${encodeURIComponent(ip)}`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/services/manageInterfacesService.ts
git commit -m "feat: add manageInterfacesService"
```

---

## Task 8: Create ManageInterfaces.vue

**Files:**
- Create: `ui/src/containers/ManageInterfaces.vue`

- [ ] **Step 1: Create the container**

```vue
<template>
  <div class="manage-interfaces">
    <BreadCrumb :items="breadcrumbs" />

    <div class="manage-interfaces__search-row">
      <AutoComplete
        v-model="selectedNode"
        :suggestions="nodeSuggestions"
        option-label="label"
        placeholder="Search for a node…"
        @complete="onNodeSearch"
        @option-select="onNodeSelected"
        class="manage-interfaces__node-search"
      />
    </div>

    <Message v-if="saveWarning" severity="warn" :closable="false" class="manage-interfaces__warning">
      Changing managed state may take several minutes to take effect. A rescan will revert unmanaged interfaces back to managed.
    </Message>

    <div v-if="loadingIfaces" class="manage-interfaces__loading">Loading interfaces…</div>

    <template v-else-if="interfaces.length">
      <DataTable :value="interfaces" size="small" striped-rows class="manage-interfaces__table">
        <Column header="IP Address" field="ipAddress" />
        <Column header="Managed">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.isManaged === 'M'"
              @update:model-value="val => toggleInterface(data, val)"
            />
          </template>
        </Column>
        <Column header="Services">
          <template #body="{ data }">
            <div v-if="data.services" class="manage-interfaces__services">
              <div
                v-for="svc in data.services"
                :key="svc.id"
                class="manage-interfaces__svc-row"
              >
                <span class="manage-interfaces__svc-name">{{ svc.serviceType.name }}</span>
                <ToggleSwitch
                  :model-value="svc.status === 'A'"
                  @update:model-value="val => toggleService(data, svc, val)"
                />
              </div>
            </div>
            <span v-else class="manage-interfaces__svc-loading">loading…</span>
          </template>
        </Column>
      </DataTable>

      <div class="manage-interfaces__actions">
        <Button
          label="Apply Changes"
          :loading="saving"
          @click="applyChanges"
        />
      </div>
    </template>

    <div v-else-if="selectedNode" class="manage-interfaces__empty">
      No interfaces found for this node.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BreadCrumb from '@/components/Layout/BreadCrumb.vue'
import AutoComplete from 'primevue/autocomplete'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import useSnackbar from '@/composables/useSnackbar'
import {
  searchNodes,
  getInterfacesForNode,
  getServicesForInterface,
  setInterfaceManaged,
  setServiceManaged,
  type ManagedNode,
  type ManagedInterface,
  type ManagedService
} from '@/services/manageInterfacesService'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Manage Interfaces', to: '#', position: 'last' }
]

type SvcRow = ManagedService & { _managed: boolean }
type IfaceRow = ManagedInterface & { services?: SvcRow[]; _managed: boolean }

const selectedNode = ref<ManagedNode | null>(null)
const nodeSuggestions = ref<ManagedNode[]>([])
const interfaces = ref<IfaceRow[]>([])
const loadingIfaces = ref(false)
const saving = ref(false)
const saveWarning = ref(false)

const pendingIfaceChanges = new Map<string, boolean>()
const pendingSvcChanges = new Map<string, boolean>()

const onNodeSearch = async (event: { query: string }) => {
  nodeSuggestions.value = await searchNodes(event.query)
}

const onNodeSelected = async (event: { value: ManagedNode }) => {
  selectedNode.value = event.value
  pendingIfaceChanges.clear()
  pendingSvcChanges.clear()
  saveWarning.value = false
  loadingIfaces.value = true
  try {
    const ifaces = await getInterfacesForNode(event.value.id)
    interfaces.value = ifaces.map(i => ({ ...i, _managed: i.isManaged === 'M', services: undefined }))
    // Load services for each interface in parallel
    await Promise.all(interfaces.value.map(async iface => {
      const svcs = await getServicesForInterface(event.value.id, iface.ipAddress)
      iface.services = svcs.map(s => ({ ...s, _managed: s.status === 'A' }))
    }))
  } catch {
    showSnackBar({ msg: 'Failed to load interfaces.' })
  } finally {
    loadingIfaces.value = false
  }
}

const toggleInterface = (iface: IfaceRow, managed: boolean) => {
  iface._managed = managed
  pendingIfaceChanges.set(iface.ipAddress, managed)
  saveWarning.value = true
}

const toggleService = (iface: IfaceRow, svc: SvcRow, managed: boolean) => {
  svc._managed = managed
  pendingSvcChanges.set(`${iface.ipAddress}:${svc.serviceType.name}`, managed)
  saveWarning.value = true
}

const applyChanges = async () => {
  if (!selectedNode.value) return
  saving.value = true
  try {
    const ifacePuts = Array.from(pendingIfaceChanges.entries()).map(([ip, managed]) =>
      setInterfaceManaged(selectedNode.value!.id, ip, managed)
    )
    await Promise.all(ifacePuts)

    const svcPuts = [...pendingSvcChanges.entries()].map(([key, managed]) => {
      const colonIdx = key.indexOf(':')
      const ip = key.slice(0, colonIdx)
      const serviceName = key.slice(colonIdx + 1)
      return setServiceManaged(ip, serviceName, managed)
    })
    await Promise.all(svcPuts)

    pendingIfaceChanges.clear()
    pendingSvcChanges.clear()
    saveWarning.value = false
    showSnackBar({ msg: 'Changes applied. May take several minutes to update.' })
  } catch {
    showSnackBar({ msg: 'Failed to apply changes.' })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.manage-interfaces {
  &__search-row { margin-bottom: 16px; }
  &__node-search { width: 320px; }
  &__warning { margin-bottom: 16px; }
  &__loading, &__empty { padding: 16px; opacity: 0.6; }
  &__table { margin-bottom: 16px; }
  &__services { display: flex; flex-direction: column; gap: 6px; }
  &__svc-row { display: flex; align-items: center; gap: 8px; }
  &__svc-name { min-width: 120px; }
  &__svc-loading { opacity: 0.5; font-style: italic; }
  &__actions { display: flex; justify-content: flex-end; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/ManageInterfaces.vue
git commit -m "feat: add ManageInterfaces container"
```

---

## Task 9: Create snmpInterfacesService.ts

**Files:**
- Create: `ui/src/services/snmpInterfacesService.ts`

- [ ] **Step 1: curl verify SNMP interface shape**

```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes/1/snmpinterfaces?limit=5" \
  -H "Accept: application/json" | python3 -m json.tool | head -40
```

Note the field names — particularly `ifIndex`, `ifName`, `ifDescr`, `collect` (`C` = collect, `N` = do not collect, `U` = unknown).

- [ ] **Step 2: Create the service file**

```typescript
import { rest } from '@/services/axiosInstances'

export interface SnmpInterface {
  ifIndex: number
  ifName: string | null
  ifDescr: string | null
  ifAlias: string | null
  ifSpeed: number | null
  collect: 'C' | 'N' | 'U'
  nodeId: number
  id: string
}

export const getSnmpInterfaces = async (nodeId: string): Promise<SnmpInterface[]> => {
  const resp = await rest.get(`/nodes/${nodeId}/snmpinterfaces`, { params: { limit: 0 } })
  const raw = resp.data.snmpInterface
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const setSnmpCollect = async (nodeId: string, ifIndex: number, collect: boolean): Promise<void> => {
  const params = new URLSearchParams({ collect: collect ? 'C' : 'N' })
  await rest.put(`/nodes/${nodeId}/snmpinterfaces/${ifIndex}`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/services/snmpInterfacesService.ts
git commit -m "feat: add snmpInterfacesService"
```

---

## Task 10: Create SnmpInterfaces.vue

**Files:**
- Create: `ui/src/containers/SnmpInterfaces.vue`

- [ ] **Step 1: Create the container**

```vue
<template>
  <div class="snmp-interfaces">
    <BreadCrumb :items="breadcrumbs" />

    <div class="snmp-interfaces__search-row">
      <AutoComplete
        v-model="selectedNode"
        :suggestions="nodeSuggestions"
        option-label="label"
        placeholder="Search for a node…"
        @complete="onNodeSearch"
        @option-select="onNodeSelected"
        class="snmp-interfaces__node-search"
      />
    </div>

    <div v-if="loading" class="snmp-interfaces__loading">Loading SNMP interfaces…</div>

    <DataTable
      v-else-if="interfaces.length"
      :value="interfaces"
      size="small"
      striped-rows
      class="snmp-interfaces__table"
    >
      <Column field="ifIndex" header="ifIndex" sortable />
      <Column header="Name / Desc">
        <template #body="{ data }">
          {{ data.ifName || data.ifDescr || '—' }}
          <span v-if="data.ifAlias" class="snmp-interfaces__alias">({{ data.ifAlias }})</span>
        </template>
      </Column>
      <Column field="ifSpeed" header="Speed" sortable>
        <template #body="{ data }">{{ data.ifSpeed ? (data.ifSpeed / 1_000_000).toFixed(0) + ' Mbps' : '—' }}</template>
      </Column>
      <Column header="Collect">
        <template #body="{ data }">
          <ToggleSwitch
            :model-value="data.collect === 'C'"
            :disabled="saving"
            @update:model-value="val => toggleCollect(data, val)"
          />
        </template>
      </Column>
    </DataTable>

    <div v-else-if="selectedNode" class="snmp-interfaces__empty">
      No SNMP interfaces found for this node.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BreadCrumb from '@/components/Layout/BreadCrumb.vue'
import AutoComplete from 'primevue/autocomplete'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import useSnackbar from '@/composables/useSnackbar'
import { searchNodes, type ManagedNode } from '@/services/manageInterfacesService'
import {
  getSnmpInterfaces,
  setSnmpCollect,
  type SnmpInterface
} from '@/services/snmpInterfacesService'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'SNMP Interfaces', to: '#', position: 'last' }
]

type SnmpRow = SnmpInterface & { _saving: boolean }

const selectedNode = ref<ManagedNode | null>(null)
const nodeSuggestions = ref<ManagedNode[]>([])
const interfaces = ref<SnmpRow[]>([])
const loading = ref(false)
const saving = ref(false)

const onNodeSearch = async (event: { query: string }) => {
  nodeSuggestions.value = await searchNodes(event.query)
}

const onNodeSelected = async (event: { value: ManagedNode }) => {
  selectedNode.value = event.value
  loading.value = true
  try {
    const ifaces = await getSnmpInterfaces(event.value.id)
    interfaces.value = ifaces.map(i => ({ ...i, _saving: false }))
  } catch {
    showSnackBar({ msg: 'Failed to load SNMP interfaces.' })
  } finally {
    loading.value = false
  }
}

const toggleCollect = async (iface: SnmpRow, collect: boolean) => {
  if (!selectedNode.value) return
  iface._saving = true
  saving.value = true
  try {
    await setSnmpCollect(selectedNode.value.id, iface.ifIndex, collect)
    iface.collect = collect ? 'C' : 'N'
    showSnackBar({ msg: `Collection ${collect ? 'enabled' : 'disabled'} for ${iface.ifName || iface.ifIndex}.` })
  } catch {
    showSnackBar({ msg: 'Failed to update SNMP collection setting.' })
  } finally {
    iface._saving = false
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.snmp-interfaces {
  &__search-row { margin-bottom: 16px; }
  &__node-search { width: 320px; }
  &__loading, &__empty { padding: 16px; opacity: 0.6; }
  &__alias { opacity: 0.6; font-size: 0.85em; margin-left: 4px; }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/SnmpInterfaces.vue
git commit -m "feat: add SnmpInterfaces container"
```

---

## Task 11: Register routes and update Admin.vue

**Files:**
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/containers/Admin.vue`

- [ ] **Step 1: Add routes to router/index.ts**

Open `ui/src/main/router/index.ts`. Find the admin routes block (near `/admin`, `/system-config`, etc.).

Add these three entries in the same style as the surrounding routes:

```typescript
{
  path: '/manage-interfaces',
  component: () => import('@/containers/ManageInterfaces.vue'),
  meta: { requiresAdmin: true }
},
{
  path: '/snmp-interfaces',
  component: () => import('@/containers/SnmpInterfaces.vue'),
  meta: { requiresAdmin: true }
},
{
  path: '/instrumentation-log',
  component: () => import('@/containers/InstrumentationLog.vue'),
  meta: { requiresAdmin: true }
},
```

- [ ] **Step 2: Update Admin.vue links**

Open `ui/src/containers/Admin.vue`. Find the three legacy `href:` links for these pages and replace them with `to:` router-link entries:

Search for (approximate text):
- `href: 'admin/manage.jsp'` → `to: '/manage-interfaces'`
- `href: 'admin/snmpInterfaces.jsp'` → `to: '/snmp-interfaces'`
- `href: 'admin/nodemanagement/instrumentationLogReader.jsp'` → `to: '/instrumentation-log'`

- [ ] **Step 3: Commit**

```bash
git add ui/src/main/router/index.ts ui/src/containers/Admin.vue
git commit -m "feat: register manage-interfaces, snmp-interfaces, instrumentation-log routes"
```

---

## Task 12: JSP redirects

**Files:**
- Modify: `opennms-webapp/src/main/webapp/admin/manage.jsp`
- Modify: `opennms-webapp/src/main/webapp/admin/snmpInterfaces.jsp`
- Modify: `opennms-webapp/src/main/webapp/admin/nodemanagement/instrumentationLogReader.jsp`

- [ ] **Step 1: Replace manage.jsp**

Replace the entire contents of `opennms-webapp/src/main/webapp/admin/manage.jsp` with:

```jsp
<%@ page language="java" %>
<%
  response.sendRedirect(request.getContextPath() + "/ui/manage-interfaces");
%>
```

- [ ] **Step 2: Replace snmpInterfaces.jsp**

Replace the entire contents of `opennms-webapp/src/main/webapp/admin/snmpInterfaces.jsp` with:

```jsp
<%@ page language="java" %>
<%
  response.sendRedirect(request.getContextPath() + "/ui/snmp-interfaces");
%>
```

- [ ] **Step 3: Replace instrumentationLogReader.jsp**

Replace the entire contents of `opennms-webapp/src/main/webapp/admin/nodemanagement/instrumentationLogReader.jsp` with:

```jsp
<%@ page language="java" %>
<%
  response.sendRedirect(request.getContextPath() + "/ui/instrumentation-log");
%>
```

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp/src/main/webapp/admin/manage.jsp \
        opennms-webapp/src/main/webapp/admin/snmpInterfaces.jsp \
        opennms-webapp/src/main/webapp/admin/nodemanagement/instrumentationLogReader.jsp
git commit -m "chore: Domain A — redirect manage, snmpInterfaces, instrumentationLogReader JSPs to Vue SPA"
```

> **Note:** JSP redirects are dormant until the next `./build-dark-mode-overlay.sh` run. The Vue pages are live immediately after UI deploy.

---

## Task 13: Build, deploy, and verify

**Files:**
- No source changes — build and verify only.

- [ ] **Step 1: Run TypeScript check**

```bash
cd ui && ../target/node/pnpm exec vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors in the three new containers or service files.

- [ ] **Step 2: Build**

```bash
cd ui && ../target/node/pnpm build
```

Expected: `BUILD SUCCESS`. Ignore Sass deprecation warnings.

- [ ] **Step 3: Verify built hash**

```bash
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

- [ ] **Step 4: Deploy**

```bash
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 5: Verify live bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' \
  /opt/opennms/jetty-webapps/opennms/ui/index.html
```

Both hashes must match.

- [ ] **Step 6: Verify all three pages load**

```bash
# Each should return 200
curl -s -o /dev/null -w "%{http_code}" -L \
  "http://localhost:8980/opennms/ui/manage-interfaces" -u admin:notdefault
curl -s -o /dev/null -w "%{http_code}" -L \
  "http://localhost:8980/opennms/ui/snmp-interfaces" -u admin:notdefault
curl -s -o /dev/null -w "%{http_code}" -L \
  "http://localhost:8980/opennms/ui/instrumentation-log" -u admin:notdefault
```

Expected: three `200` responses.

- [ ] **Step 7: Manual smoke test**

Navigate to `http://localhost:8980/opennms/ui/manage-interfaces`:
1. Type a node name in the search box — autocomplete should appear
2. Select a node — interfaces and services should load with toggle switches
3. Toggle an interface/service — "Apply Changes" button appears with warning
4. Apply — snackbar confirms success

Navigate to `http://localhost:8980/opennms/ui/snmp-interfaces`:
1. Search and select a node
2. SNMP interfaces load with toggle switches
3. Toggle one — immediate save, snackbar confirms

Navigate to `http://localhost:8980/opennms/ui/instrumentation-log`:
1. Page loads (may show empty table if no instrumentation log)
2. Sort dropdowns work
3. Search box filters (if data present)

Navigate to `http://localhost:8980/opennms/ui/admin`:
1. All three Admin Hub links (`Manage/Unmanage Interfaces`, `SNMP Interface Collection`, `Instrumentation Log`) should be router-links to the Vue pages (not `href:` to JSPs).

- [ ] **Step 8: Test in both light and dark mode**

Toggle dark mode via the topbar icon. Visit all three pages — no bare white panels, no invisible text.

- [ ] **Step 9: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: Domain A post-deploy corrections"
```

---

## Self-Review Checklist

| Requirement | Task |
|---|---|
| `manage.jsp` replaced with Vue page | Tasks 7, 8, 12 |
| `snmpInterfaces.jsp` replaced with Vue page | Tasks 9, 10, 12 |
| `instrumentationLogReader.jsp` replaced with Vue page | Tasks 2, 3, 4, 5, 6, 12 |
| New REST endpoint for instrumentation log | Tasks 1, 2, 3, 4 |
| No new REST for manage/snmpInterfaces (compose v1) | Tasks 7, 9 |
| Admin.vue links updated | Task 11 |
| JSP redirects committed | Task 12 |
| PrimeVue only (no Feather DS) | Tasks 6, 8, 10 |
| Both light and dark mode verified | Task 13 |
| Curl-verified REST before TypeScript interfaces | Tasks 4, 7, 9 |
