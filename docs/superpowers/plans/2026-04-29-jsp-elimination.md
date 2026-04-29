# JSP Elimination Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 15 remaining legacy JSP `href:` links in Admin.vue with Vue routes backed by REST APIs, eliminating the last JSP pages from the admin hub.

**Architecture:** Each JSP page is replaced by a Vue container + service file + router route. The old JSP is reduced to a single `sendRedirect` to the new Vue route. Admin.vue `href:` entries become `to:` entries. Pages requiring Angular or with no REST backing are deferred with clear reasoning.

**Tech Stack:** Vue 3 Composition API, PrimeVue 4 (Aura preset), Feather DS CSS tokens (`--feather-*`), OpenNMS REST API, TypeScript

**Branch:** `feat/ui-refactor-omnibus`

---

## Current State Inventory

These 15 Admin.vue links still use `href:` pointing at legacy JSPs:

| Priority | Label | JSP | REST | Action |
|---|---|---|---|---|
| ✅ Tier 1 | Manage Surveillance Categories | `admin/categories.htm` | `GET/POST/PUT/DELETE /rest/categories` | Convert |
| ✅ Tier 1 | Manually Send an Event | `admin/sendevent.htm` | `POST /rest/events` | Convert |
| ✅ Tier 1 | Manage Flow Classification | `admin/classification/index.jsp` | `GET /rest/classification/groups` | Convert |
| ✅ Tier 1 | Delete Nodes | `admin/delete.jsp` | `DELETE /rest/nodes/{id}` | Convert |
| 🔶 Tier 2 | Manage Applications | `admin/applications.htm` | `GET /rest/applications` | Convert |
| 🔶 Tier 2 | Import/Export Asset Info | `admin/asset/index.jsp` | `POST /rest/assets/import` | Convert (upload form) |
| 🔶 Tier 2 | Manually Add an Interface | `admin/newInterface.jsp` | `PUT /rest/nodes/{id}/ipinterfaces` | Convert |
| 🔶 Tier 2 | Run Single Discovery Scan | `admin/discovery/edit-scan.jsp` | `POST /rest/discoveryConfig/scan` | Embed in DiscoveryConfig |
| ❌ Deferred | Manage Provisioning Requisitions | `admin/ng-requisitions/index.jsp` | complex | Angular SPA — skip |
| ❌ Deferred | Manage/Unmanage Interfaces | `admin/manage.jsp` | complex | Angular app embedded |
| ❌ Deferred | SNMP Data Collection per Interface | `admin/snmpInterfaces.jsp` | complex | Angular app embedded |
| ❌ Deferred | Configure Geocoder Service | `admin/geoservice/index.jsp` | none | Config file editor |
| ❌ Deferred | Configure Grafana Endpoints | `admin/endpoint/index.jsp` | low value | Rarely used |
| ❌ Deferred | Instrumentation Log Reader | `admin/nodemanagement/instrumentationLogReader.jsp` | none | Log file viewer |
| ❌ Deferred | Configure Path Outages (legacy) | `admin/notification/noticeWizard/buildPathOutage.jsp` | complex | DB/FilterDao — intentionally deferred |

---

## Build Mechanics

**JSP changes require a full image rebuild** — `podman cp` does NOT work for JSPs.

Full rebuild sequence (needed for Tasks 1-4 JSP redirect files):
```bash
./build-dark-mode-overlay.sh   # ~3-5 min
podman rm -f test-opennms && podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms -e OPENNMS_DBUSER=opennms -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
```
Then set password to `notdefault` via the Jasypt command printed at the end of the build script output.

**Vue-only changes** (no JSP redirect yet): just pnpm build + deploy:
```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```

**Bundle hash verification** (run after every deploy):
```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
# Both must match
```

---

## Key Patterns

### JSP Redirect Pattern
All converted JSPs become a single-line redirect:
```jsp
<% response.sendRedirect(request.getContextPath() + "/ui/route-name"); %>
```

### Vue Service Pattern (use discoveryConfigService.ts as canonical reference)
```typescript
// ui/src/services/xxxService.ts
import { rest } from './axiosInstances'

const getItems = async (): Promise<Item[] | false> => {
  try {
    const resp = await rest.get('/items')
    const raw = resp.data.item
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}
export { getItems }
```

### JAXB Array Normalization (always apply — single items come back as objects, not arrays)
```typescript
const raw = resp.data.someField
return Array.isArray(raw) ? raw : raw ? [raw] : []
```

### Admin Router Guard (copy exactly — used in all 8+ admin routes)
```typescript
{
  path: '/route-name',
  name: 'Route Name',
  component: () => import('@/containers/RouteName.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'Must be admin to access Route Name.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
}
```

### Vue Container Pattern
```vue
<template>
  <div class="page-name-page">
    <BreadCrumbs :items="breadcrumbs" />
    <!-- content -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Page Name', to: '#', position: 'last' }
])
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
</style>
```

### Admin.vue Link: href → to
Change:
```typescript
{ label: 'My Page', href: baseHref.value + 'admin/my-page.jsp' }
```
To:
```typescript
{ label: 'My Page', to: '/my-route' }
```

---

## Task 1: Surveillance Categories Page

**Files:**
- Modify: `ui/src/services/categoryService.ts` (**already exists** — add create/update/delete functions)
- Create: `ui/src/containers/SurveillanceCategories.vue`
- Modify: `ui/src/main/router/index.ts` (add route)
- Modify: `ui/src/containers/Admin.vue` (href → to)
- Modify: `opennms-webapp/src/main/webapp/admin/categories.htm` (add sendRedirect)

**REST Shape:**
```
GET  /rest/categories          → { category: [{ id, name, authorizedGroups }] }
POST /rest/categories          Body: <category name="X"/>  → 201
PUT  /rest/categories/{id}     Body: <category name="X"/>  → 200
DELETE /rest/categories/{id}   → 204
```
REST accepts XML. Use `Content-Type: application/xml`.

Verify first:
```bash
curl -s -u admin:notdefault http://localhost:8980/opennms/rest/categories \
  -H "Accept: application/json" | python3 -m json.tool
```

- [ ] **Step 1: Extend categoryService.ts with CRUD functions**

The file already exists with `getCategories`. Add the missing create/update/delete functions. Open `ui/src/services/categoryService.ts` and append before the `export` block:

```typescript
const createCategory = async (name: string): Promise<boolean> => {
  try {
    await rest.post('/categories', `<category name="${name}"/>`, {
      headers: { 'Content-Type': 'application/xml' }
    })
    return true
  } catch { return false }
}

const updateCategory = async (id: number, name: string): Promise<boolean> => {
  try {
    await rest.put(`/categories/${id}`, `<category name="${name}"/>`, {
      headers: { 'Content-Type': 'application/xml' }
    })
    return true
  } catch { return false }
}

const deleteCategory = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`/categories/${id}`)
    return true
  } catch { return false }
}

export { getCategories, createCategory, updateCategory, deleteCategory }
```

Update the existing `export` line at the bottom of the file to include the new functions:
```typescript
export { getCategories, createCategory, updateCategory, deleteCategory }
```

The `Category` interface already exists in `@/types` (`{ id, name, authorizedGroups }`) — do not re-declare it. Import it: `import type { Category } from '@/types'` when needed in SurveillanceCategories.vue.

- [ ] **Step 2: Create SurveillanceCategories.vue**

```vue
<!-- ui/src/containers/SurveillanceCategories.vue -->
<template>
  <div class="surveillance-categories-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="categories-panel">
      <div class="categories-panel__header">
        <h2 class="categories-panel__title">Surveillance Categories</h2>
        <Button label="Add Category" icon="pi pi-plus" size="small" @click="startAdd" />
      </div>

      <DataTable :value="categories" :loading="loading" stripedRows rowHover>
        <Column field="name" header="Category Name" />
        <Column header="Actions" style="width: 140px">
          <template #body="{ data }">
            <div class="categories-panel__actions">
              <Button icon="pi pi-pencil" text size="small" @click="startEdit(data)" aria-label="Edit" />
              <Button icon="pi pi-trash" text severity="danger" size="small" @click="confirmDelete(data)" aria-label="Delete" />
            </div>
          </template>
        </Column>
        <template #empty>No categories defined.</template>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialogVisible" :header="editingId ? 'Edit Category' : 'Add Category'" modal style="width: 400px">
      <div class="categories-dialog">
        <label for="cat-name" class="categories-dialog__label">Category Name</label>
        <InputText id="cat-name" v-model="editingName" class="categories-dialog__input" @keydown.enter="save" />
      </div>
      <template #footer>
        <Button label="Cancel" text @click="cancelDialog" />
        <Button label="Save" :loading="saving" @click="save" />
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categoryService'
import type { Category } from '@/types'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()
const confirm = useConfirm()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Surveillance Categories', to: '#', position: 'last' }
])

const categories = ref<Category[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const editingName = ref('')

const load = async () => {
  loading.value = true
  const result = await getCategories()
  if (result !== false) categories.value = result
  else showSnackBar({ msg: 'Failed to load categories.' })
  loading.value = false
}

const startAdd = () => {
  editingId.value = null
  editingName.value = ''
  dialogVisible.value = true
}

const startEdit = (cat: Category) => {
  editingId.value = cat.id
  editingName.value = cat.name
  dialogVisible.value = true
}

const cancelDialog = () => { dialogVisible.value = false }

const save = async () => {
  if (!editingName.value.trim()) return
  saving.value = true
  const ok = editingId.value
    ? await updateCategory(editingId.value, editingName.value.trim())
    : await createCategory(editingName.value.trim())
  saving.value = false
  if (ok) {
    dialogVisible.value = false
    showSnackBar({ msg: editingId.value ? 'Category updated.' : 'Category created.' })
    load()
  } else {
    showSnackBar({ msg: 'Failed to save category.' })
  }
}

const confirmDelete = (cat: Category) => {
  confirm.require({
    message: `Delete category "${cat.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptSeverity: 'danger',
    accept: async () => {
      const ok = await deleteCategory(cat.id)
      if (ok) { showSnackBar({ msg: 'Category deleted.' }); load() }
      else showSnackBar({ msg: 'Failed to delete category.' })
    }
  })
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.surveillance-categories-page { padding: 16px 20px; }
.categories-panel {
  background: var($surface);
  border-radius: 6px;
  padding: 20px;
  &__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  &__title { margin: 0; font-size: 18px; font-weight: 600; }
  &__actions { display: flex; gap: 4px; }
}
.categories-dialog {
  display: flex; flex-direction: column; gap: 8px; padding: 8px 0;
  &__label { font-size: 13px; font-weight: 500; }
  &__input { width: 100%; }
}
</style>
```

- [ ] **Step 3: Add route to router/index.ts**

In `ui/src/main/router/index.ts`, after the `/monitoring-locations` route (around line 695), add:
```typescript
{
  path: '/surveillance-categories',
  name: 'Surveillance Categories',
  component: () => import('@/containers/SurveillanceCategories.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'Must be admin to access Surveillance Categories.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
```

- [ ] **Step 4: Update Admin.vue — change href to to**

In `ui/src/containers/Admin.vue`, find:
```typescript
{ label: 'Manage Surveillance Categories', href: baseHref.value + 'admin/categories.htm' },
```
Change to:
```typescript
{ label: 'Manage Surveillance Categories', to: '/surveillance-categories' },
```

- [ ] **Step 5: Build Vue and smoke-test in browser**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
# Verify hash matches, then navigate to http://localhost:8980/opennms/ui/surveillance-categories
```
Confirm: page loads, categories list shows (Routers, Switches, Servers…), Add/Edit/Delete work.

- [ ] **Step 6: Add JSP redirect (requires full image rebuild — batch with other JSP changes)**

In `opennms-webapp/src/main/webapp/admin/categories.htm`, replace ALL content with:
```jsp
<% response.sendRedirect(request.getContextPath() + "/ui/surveillance-categories"); %>
```

Note: Do NOT rebuild the image yet — batch this redirect with Tasks 2 and 3 JSP changes, then do ONE rebuild.

- [ ] **Step 7: Commit Vue changes (before image rebuild)**

```bash
git add ui/src/services/categoryService.ts \
        ui/src/containers/SurveillanceCategories.vue \
        ui/src/main/router/index.ts \
        ui/src/containers/Admin.vue \
        opennms-webapp/src/main/webapp/admin/categories.htm
git commit -m "feat(admin): add Vue Surveillance Categories page, retire categories.htm"
```

---

## Task 2: Send Event Page

**Files:**
- Create: `ui/src/containers/SendEvent.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/containers/Admin.vue`
- Modify: `opennms-webapp/src/main/webapp/admin/sendevent.htm`

**REST Shape:**
```
POST /rest/events   Content-Type: application/json
Body: { "uei": "uei.opennms.org/...", "source": "Vue UI", "time": "<ISO>",
        "severity": "Normal|Warning|Minor|Major|Critical",
        "nodeId": 1, "interface": "10.0.0.1", "service": "ICMP",
        "descr": "Free text", "operinstruct": "...", "parms": [...] }
→ 202 Accepted
```

Common UEIs (pre-populate as suggestions):
- `uei.opennms.org/internal/test`
- `uei.opennms.org/nodes/nodeDown`
- `uei.opennms.org/nodes/nodeUp`

Verify:
```bash
curl -s -u admin:notdefault -X POST \
  -H "Content-Type: application/json" \
  "http://localhost:8980/opennms/rest/events" \
  -d '{"uei":"uei.opennms.org/internal/test","source":"Vue UI","time":"2026-04-29T00:00:00Z","severity":"Normal"}' \
  -w "\n%{http_code}"
# Expect 202
```

- [ ] **Step 1: Create SendEvent.vue**

```vue
<!-- ui/src/containers/SendEvent.vue -->
<template>
  <div class="send-event-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="send-event-form">
      <h2 class="send-event-form__title">Send Event</h2>

      <div class="send-event-form__field">
        <label for="se-uei">Event UEI <span class="required">*</span></label>
        <AutoComplete
          id="se-uei"
          v-model="form.uei"
          :suggestions="ueiSuggestions"
          @complete="searchUei"
          placeholder="uei.opennms.org/..."
          class="send-event-form__input"
          forceSelection
        />
      </div>

      <div class="send-event-form__row">
        <div class="send-event-form__field">
          <label for="se-node">Node ID (optional)</label>
          <InputText id="se-node" v-model="form.nodeId" type="number" placeholder="1" />
        </div>
        <div class="send-event-form__field">
          <label for="se-interface">Interface (optional)</label>
          <InputText id="se-interface" v-model="form.iface" placeholder="10.0.0.1" />
        </div>
        <div class="send-event-form__field">
          <label for="se-service">Service (optional)</label>
          <InputText id="se-service" v-model="form.service" placeholder="ICMP" />
        </div>
      </div>

      <div class="send-event-form__field">
        <label for="se-severity">Severity</label>
        <Select id="se-severity" v-model="form.severity" :options="severities" />
      </div>

      <div class="send-event-form__field">
        <label for="se-descr">Description (optional)</label>
        <Textarea id="se-descr" v-model="form.descr" rows="3" class="send-event-form__input" />
      </div>

      <div class="send-event-form__actions">
        <Button label="Send Event" :loading="sending" :disabled="!form.uei" @click="sendEvent" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { rest } from '@/services/axiosInstances'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Send Event', to: '#', position: 'last' }
])

const COMMON_UEIS = [
  'uei.opennms.org/internal/test',
  'uei.opennms.org/nodes/nodeDown',
  'uei.opennms.org/nodes/nodeUp',
  'uei.opennms.org/nodes/interfaceDown',
  'uei.opennms.org/nodes/interfaceUp',
  'uei.opennms.org/nodes/serviceDown',
  'uei.opennms.org/nodes/serviceUp',
]

const severities = ['Normal', 'Warning', 'Minor', 'Major', 'Critical', 'Indeterminate']

const form = reactive({
  uei: '',
  nodeId: '',
  iface: '',
  service: '',
  severity: 'Normal',
  descr: ''
})

const sending = ref(false)
const ueiSuggestions = ref<string[]>([])

const searchUei = (event: { query: string }) => {
  ueiSuggestions.value = COMMON_UEIS.filter(u => u.includes(event.query))
}

const sendEvent = async () => {
  if (!form.uei) return
  sending.value = true
  try {
    const body: Record<string, unknown> = {
      uei: form.uei,
      source: 'Vue Admin UI',
      time: new Date().toISOString(),
      severity: form.severity,
    }
    if (form.nodeId) body.nodeId = parseInt(form.nodeId)
    if (form.iface) body.interface = form.iface
    if (form.service) body.service = form.service
    if (form.descr) body.descr = form.descr

    await rest.post('/events', body, { headers: { 'Content-Type': 'application/json' } })
    showSnackBar({ msg: 'Event sent successfully.' })
    // reset
    form.uei = ''; form.nodeId = ''; form.iface = ''
    form.service = ''; form.severity = 'Normal'; form.descr = ''
  } catch {
    showSnackBar({ msg: 'Failed to send event.' })
  }
  sending.value = false
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.send-event-page { padding: 16px 20px; }
.send-event-form {
  max-width: 700px;
  background: var($surface);
  border-radius: 6px;
  padding: 24px;
  &__title { margin: 0 0 20px; font-size: 18px; font-weight: 600; }
  &__field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; label { font-size: 13px; font-weight: 500; } }
  &__row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  &__input { width: 100%; }
  &__actions { margin-top: 8px; }
}
.required { color: var(--feather-error); }
</style>
```

- [ ] **Step 2: Add route to router/index.ts**

After the `/surveillance-categories` route, add:
```typescript
{
  path: '/send-event',
  name: 'Send Event',
  component: () => import('@/containers/SendEvent.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'Must be admin to send events.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
```

- [ ] **Step 3: Update Admin.vue**

Find:
```typescript
{ label: 'Manually Send an Event', href: baseHref.value + 'admin/sendevent.htm' },
```
Replace with:
```typescript
{ label: 'Manually Send an Event', to: '/send-event' },
```

- [ ] **Step 4: Patch sendevent.htm (for image rebuild batch)**

Replace all content of `opennms-webapp/src/main/webapp/admin/sendevent.htm`:
```jsp
<% response.sendRedirect(request.getContextPath() + "/ui/send-event"); %>
```

- [ ] **Step 5: Build, deploy, verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `http://localhost:8980/opennms/ui/send-event`. Fill the UEI field with `uei.opennms.org/internal/test`, click Send Event. Confirm snackbar says "Event sent successfully."

- [ ] **Step 6: Commit**

```bash
git add ui/src/containers/SendEvent.vue \
        ui/src/main/router/index.ts \
        ui/src/containers/Admin.vue \
        opennms-webapp/src/main/webapp/admin/sendevent.htm
git commit -m "feat(admin): add Vue Send Event page, retire sendevent.htm"
```

---

## Task 3: Manage Flow Classification Page

**Files:**
- Create: `ui/src/services/classificationService.ts`
- Create: `ui/src/containers/FlowClassification.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/containers/Admin.vue`
- Modify: `opennms-webapp/src/main/webapp/admin/classification/index.jsp`

**REST — verify before writing code:**
```bash
curl -s -u admin:notdefault "http://localhost:8980/opennms/rest/classification/groups" \
  -H "Accept: application/json" | python3 -m json.tool
curl -s -u admin:notdefault "http://localhost:8980/opennms/rest/classification/groups/1/rules?limit=5" \
  -H "Accept: application/json" | python3 -m json.tool
```

Expected shape: `{ groups: [{ id, name, priority, enabled, readOnly, rules: [...] }] }`

If the endpoint returns 404 or empty, the feature may not be installed. In that case skip this task and leave the `href:` link as-is.

- [ ] **Step 1: Create classificationService.ts**

```typescript
// ui/src/services/classificationService.ts
import { rest } from './axiosInstances'

export interface ClassificationGroup {
  id: number
  name: string
  priority: number
  enabled: boolean
  readOnly: boolean
}

export interface ClassificationRule {
  id: number
  name: string
  protocol?: string
  srcAddress?: string
  srcPort?: string
  dstAddress?: string
  dstPort?: string
  exporterFilter?: string
}

const getGroups = async (): Promise<ClassificationGroup[] | false> => {
  try {
    const resp = await rest.get('/classification/groups', { headers: { Accept: 'application/json' } })
    const raw = resp.data.group ?? resp.data.groups ?? resp.data
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

const getRules = async (groupId: number): Promise<ClassificationRule[] | false> => {
  try {
    const resp = await rest.get(`/classification/groups/${groupId}/rules`, { headers: { Accept: 'application/json' } })
    const raw = resp.data.rule ?? resp.data.rules ?? resp.data
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

export { getGroups, getRules }
```

- [ ] **Step 2: Create FlowClassification.vue**

This page shows classification groups in a tree — click a group to expand its rules.

```vue
<!-- ui/src/containers/FlowClassification.vue -->
<template>
  <div class="flow-classification-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="classification-panel">
      <h2 class="classification-panel__title">Flow Classification Groups</h2>

      <DataTable
        :value="groups"
        :loading="loading"
        expandedRowIcon="pi pi-chevron-down"
        collapsedRowIcon="pi pi-chevron-right"
        v-model:expandedRows="expandedRows"
        dataKey="id"
        stripedRows
      >
        <Column expander style="width: 3rem" />
        <Column field="name" header="Group Name" />
        <Column field="priority" header="Priority" style="width: 100px" />
        <Column field="enabled" header="Enabled" style="width: 100px">
          <template #body="{ data }">
            <span :class="data.enabled ? 'status--enabled' : 'status--disabled'">
              {{ data.enabled ? 'Yes' : 'No' }}
            </span>
          </template>
        </Column>
        <Column field="readOnly" header="Read Only" style="width: 100px">
          <template #body="{ data }">{{ data.readOnly ? 'Yes' : 'No' }}</template>
        </Column>

        <template #expansion="{ data }">
          <div class="classification-rules">
            <RulesTable :groupId="data.id" />
          </div>
        </template>

        <template #empty>No classification groups found. The Flow Classification feature may not be installed.</template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import RulesTable from '@/components/FlowClassification/RulesTable.vue'
import { getGroups, type ClassificationGroup } from '@/services/classificationService'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Flow Classification', to: '#', position: 'last' }
])

const groups = ref<ClassificationGroup[]>([])
const loading = ref(false)
const expandedRows = ref<Record<number, boolean>>({})

const load = async () => {
  loading.value = true
  const result = await getGroups()
  if (result !== false) groups.value = result
  else showSnackBar({ msg: 'Failed to load classification groups.' })
  loading.value = false
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.flow-classification-page { padding: 16px 20px; }
.classification-panel {
  background: var($surface);
  border-radius: 6px;
  padding: 20px;
  &__title { margin: 0 0 16px; font-size: 18px; font-weight: 600; }
}
.classification-rules { padding: 12px 24px; }
.status--enabled { color: var(--feather-success); font-weight: 600; }
.status--disabled { color: var(--feather-error); }
</style>
```

- [ ] **Step 3: Create RulesTable sub-component**

Create `ui/src/components/FlowClassification/RulesTable.vue`:
```vue
<template>
  <DataTable :value="rules" :loading="loading" size="small">
    <Column field="name" header="Rule Name" />
    <Column field="protocol" header="Protocol" style="width: 90px" />
    <Column field="srcAddress" header="Src Address" />
    <Column field="srcPort" header="Src Port" style="width: 90px" />
    <Column field="dstAddress" header="Dst Address" />
    <Column field="dstPort" header="Dst Port" style="width: 90px" />
    <template #empty>No rules in this group.</template>
  </DataTable>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { getRules, type ClassificationRule } from '@/services/classificationService'

const props = defineProps<{ groupId: number }>()
const rules = ref<ClassificationRule[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  const result = await getRules(props.groupId)
  if (result !== false) rules.value = result
  loading.value = false
})
</script>
```

- [ ] **Step 4: Add route and update Admin.vue**

Add to router:
```typescript
{
  path: '/flow-classification',
  name: 'Flow Classification',
  component: () => import('@/containers/FlowClassification.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'Must be admin to access Flow Classification.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
```

In Admin.vue, change:
```typescript
{ label: 'Manage Flow Classification', href: baseHref.value + 'admin/classification/index.jsp' },
```
To:
```typescript
{ label: 'Manage Flow Classification', to: '/flow-classification' },
```

- [ ] **Step 5: Patch classification JSP**

Replace all content of `opennms-webapp/src/main/webapp/admin/classification/index.jsp`:
```jsp
<% response.sendRedirect(request.getContextPath() + "/ui/flow-classification"); %>
```

- [ ] **Step 6: Build, deploy, verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `http://localhost:8980/opennms/ui/flow-classification`. Confirm groups table renders (or shows empty-state message if feature not installed).

- [ ] **Step 7: Commit**

```bash
git add ui/src/services/classificationService.ts \
        ui/src/containers/FlowClassification.vue \
        ui/src/components/FlowClassification/RulesTable.vue \
        ui/src/main/router/index.ts \
        ui/src/containers/Admin.vue \
        opennms-webapp/src/main/webapp/admin/classification/index.jsp
git commit -m "feat(admin): add Vue Flow Classification page, retire classification/index.jsp"
```

---

## Task 4: Delete Nodes Page

**Files:**
- Create: `ui/src/services/deleteNodesService.ts`
- Create: `ui/src/containers/DeleteNodes.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/containers/Admin.vue`
- Modify: `opennms-webapp/src/main/webapp/admin/delete.jsp`

**REST Shape:**
```
GET  /rest/nodes?limit=25&offset=0   → { node: [{ id, label, ... }], totalCount }
DELETE /rest/nodes/{id}              → 200
```
Also check: `GET /rest/nodes?comparator=label&orderBy=label&limit=25&label=...` for search.

Verify:
```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/nodes?limit=5" \
  -H "Accept: application/json" | python3 -m json.tool | grep -E '"id"|"label"'
```

- [ ] **Step 1: Create deleteNodesService.ts**

```typescript
// ui/src/services/deleteNodesService.ts
import { rest } from './axiosInstances'

export interface NodeSummary {
  id: number
  label: string
  foreignSource?: string
  foreignId?: string
}

const searchNodes = async (query: string): Promise<NodeSummary[] | false> => {
  try {
    const params: Record<string, string> = { limit: '25', orderBy: 'label', comparator: 'label' }
    if (query) params['label'] = `%${query}%`
    const resp = await rest.get('/nodes', { params, headers: { Accept: 'application/json' } })
    const raw = resp.data.node
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch { return false }
}

const deleteNode = async (id: number): Promise<boolean> => {
  try {
    await rest.delete(`/nodes/${id}`)
    return true
  } catch { return false }
}

export { searchNodes, deleteNode }
```

- [ ] **Step 2: Create DeleteNodes.vue**

This page lets admins search for nodes, select one or more, and delete them with a confirmation step.

```vue
<!-- ui/src/containers/DeleteNodes.vue -->
<template>
  <div class="delete-nodes-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="delete-nodes-panel">
      <h2 class="delete-nodes-panel__title">Delete Nodes</h2>
      <p class="delete-nodes-panel__warning">
        <i class="pi pi-exclamation-triangle" /> Deleting a node permanently removes it and all associated data.
      </p>

      <div class="delete-nodes-panel__search">
        <InputText
          v-model="searchQuery"
          placeholder="Filter by node label…"
          @input="debounceSearch"
        />
      </div>

      <DataTable
        :value="nodes"
        :loading="loading"
        v-model:selection="selectedNodes"
        dataKey="id"
        stripedRows
        rowHover
      >
        <Column selectionMode="multiple" style="width: 3rem" />
        <Column field="id" header="ID" style="width: 80px" />
        <Column field="label" header="Node Label" />
        <Column field="foreignSource" header="Foreign Source" />
        <Column field="foreignId" header="Foreign ID" />
        <template #empty>{{ loading ? '' : 'No nodes found.' }}</template>
      </DataTable>

      <div class="delete-nodes-panel__footer">
        <span class="delete-nodes-panel__count">
          {{ selectedNodes.length }} node{{ selectedNodes.length === 1 ? '' : 's' }} selected
        </span>
        <Button
          label="Delete Selected"
          severity="danger"
          :disabled="selectedNodes.length === 0"
          :loading="deleting"
          @click="confirmDelete"
        />
      </div>
    </div>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { searchNodes, deleteNode, type NodeSummary } from '@/services/deleteNodesService'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()
const confirm = useConfirm()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Delete Nodes', to: '#', position: 'last' }
])

const nodes = ref<NodeSummary[]>([])
const loading = ref(false)
const deleting = ref(false)
const searchQuery = ref('')
const selectedNodes = ref<NodeSummary[]>([])
let debounceTimer: ReturnType<typeof setTimeout>

const load = async (query = '') => {
  loading.value = true
  const result = await searchNodes(query)
  if (result !== false) nodes.value = result
  else showSnackBar({ msg: 'Failed to load nodes.' })
  loading.value = false
}

const debounceSearch = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => load(searchQuery.value), 300)
}

const confirmDelete = () => {
  const labels = selectedNodes.value.map(n => n.label).join(', ')
  confirm.require({
    message: `Permanently delete ${selectedNodes.value.length} node(s): ${labels}?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptSeverity: 'danger',
    acceptLabel: 'Delete',
    accept: async () => {
      deleting.value = true
      const results = await Promise.all(selectedNodes.value.map(n => deleteNode(n.id)))
      const failed = results.filter(r => !r).length
      if (failed === 0) showSnackBar({ msg: `${selectedNodes.value.length} node(s) deleted.` })
      else showSnackBar({ msg: `${failed} deletion(s) failed.` })
      selectedNodes.value = []
      deleting.value = false
      load(searchQuery.value)
    }
  })
}

onMounted(() => load())
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
.delete-nodes-page { padding: 16px 20px; }
.delete-nodes-panel {
  background: var($surface);
  border-radius: 6px;
  padding: 20px;
  &__title { margin: 0 0 8px; font-size: 18px; font-weight: 600; }
  &__warning { color: var(--feather-warning); margin-bottom: 16px; font-size: 13px; }
  &__search { margin-bottom: 16px; }
  &__footer { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
  &__count { font-size: 13px; color: var($secondary-text-on-surface); }
}
</style>
```

- [ ] **Step 3: Add route, update Admin.vue, patch delete.jsp**

Add to router:
```typescript
{
  path: '/delete-nodes',
  name: 'Delete Nodes',
  component: () => import('@/containers/DeleteNodes.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'Must be admin to delete nodes.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
```

In Admin.vue, change:
```typescript
{ label: 'Delete Nodes', href: baseHref.value + 'admin/delete.jsp' },
```
To:
```typescript
{ label: 'Delete Nodes', to: '/delete-nodes' },
```

Replace all content of `opennms-webapp/src/main/webapp/admin/delete.jsp`:
```jsp
<% response.sendRedirect(request.getContextPath() + "/ui/delete-nodes"); %>
```

- [ ] **Step 4: Build, deploy, verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `http://localhost:8980/opennms/ui/delete-nodes`. Confirm node list loads. Select a non-critical node and verify the confirmation dialog appears but cancel — do NOT actually delete production nodes in the lab.

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/deleteNodesService.ts \
        ui/src/containers/DeleteNodes.vue \
        ui/src/main/router/index.ts \
        ui/src/containers/Admin.vue \
        opennms-webapp/src/main/webapp/admin/delete.jsp
git commit -m "feat(admin): add Vue Delete Nodes page, retire delete.jsp"
```

---

## Task 5: Full Image Rebuild for JSP Redirects

After Tasks 1-4, rebuild the overlay image so all four JSP sendRedirects go live.

- [ ] **Step 1: Verify all four JSP files have been patched**

```bash
grep -l "sendRedirect" \
  opennms-webapp/src/main/webapp/admin/categories.htm \
  opennms-webapp/src/main/webapp/admin/sendevent.htm \
  opennms-webapp/src/main/webapp/admin/classification/index.jsp \
  opennms-webapp/src/main/webapp/admin/delete.jsp
# All four must appear in the output
```

- [ ] **Step 2: Rebuild overlay image**

```bash
./build-dark-mode-overlay.sh
```
Wait ~3-5 minutes. Watch for errors. A successful build ends with the Jasypt password command.

- [ ] **Step 3: Recreate container**

```bash
podman rm -f test-opennms
podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms -e OPENNMS_DBUSER=opennms -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
```

- [ ] **Step 4: Wait for startup and set password**

```bash
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/info 2>/dev/null)
  echo "Attempt $i: $code"
  [ "$code" = "200" ] && break
  sleep 5
done
```
Then run the Jasypt command from the build output to set password to `notdefault`.

- [ ] **Step 5: Deploy Vue bundle**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 6: Smoke test all four redirects**

```bash
# Each should redirect to the Vue route (follow redirects with -L)
curl -s -o /dev/null -w "%{url_effective}\n" -L -u admin:notdefault \
  "http://localhost:8980/opennms/admin/categories.htm"
# Should land at: http://localhost:8980/opennms/ui/surveillance-categories

curl -s -o /dev/null -w "%{url_effective}\n" -L -u admin:notdefault \
  "http://localhost:8980/opennms/admin/sendevent.htm"
# Should land at: http://localhost:8980/opennms/ui/send-event

curl -s -o /dev/null -w "%{url_effective}\n" -L -u admin:notdefault \
  "http://localhost:8980/opennms/admin/classification/index.jsp"
# Should land at: http://localhost:8980/opennms/ui/flow-classification

curl -s -o /dev/null -w "%{url_effective}\n" -L -u admin:notdefault \
  "http://localhost:8980/opennms/admin/delete.jsp"
# Should land at: http://localhost:8980/opennms/ui/delete-nodes
```

---

## Task 6: Tier 2 — Manage Applications (if REST available)

Before starting this task, verify the applications REST endpoint:
```bash
curl -s -u admin:notdefault "http://localhost:8980/opennms/rest/applications" \
  -H "Accept: application/json" | python3 -m json.tool | head -30
```

If this returns a valid response with application data, proceed. If 404 or empty, skip — the feature may not be installed.

**REST Shape (expected):**
```
GET    /rest/applications              → { application: [{ id, name }] }
POST   /rest/applications             → 201
PUT    /rest/applications/{id}        → 200
DELETE /rest/applications/{id}        → 200
GET    /rest/applications/{id}/monitoredServices → { monitoredService: [...] }
```

**Files:**
- Create: `ui/src/services/applicationService.ts`
- Create: `ui/src/containers/Applications.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/containers/Admin.vue`
- Modify: `opennms-webapp/src/main/webapp/admin/applications.htm`

The page should list applications (name, service count) with add/rename/delete. Use the same patterns as SurveillanceCategories.vue.

Steps follow the same structure as Task 1 — create service, create container, add route, update Admin.vue, patch JSP, build+deploy+verify, commit.

---

## Task 7: Deferred — Angular-Embedded Pages

These pages embed Angular apps and cannot be migrated by simply building a Vue container. They require either:
1. A new Vue implementation of the equivalent functionality (major effort)
2. An iframe wrapper (poor UX, not recommended)

**Pages in this category:**
- `admin/manage.jsp` (ngApp: `onms-interfaces-config-manage`)
- `admin/snmpInterfaces.jsp` (ngApp: `onms-interfaces-config`)
- `admin/ng-requisitions/index.jsp` (Angular provisioning SPA)

**Recommended approach:** Keep these as `href:` links in Admin.vue. Do NOT add `(legacy)` labels — they are fully functional. These are Phase 2 of JSP elimination.

**Pages to keep as-is indefinitely (low value / no REST):**
- `admin/geoservice/index.jsp` — config file editor
- `admin/endpoint/index.jsp` — Grafana reports config
- `admin/nodemanagement/instrumentationLogReader.jsp` — log file reader
- `admin/notification/noticeWizard/buildPathOutage.jsp` — intentionally deferred
- `admin/asset/index.jsp` — file import/export (medium)
- `admin/newInterface.jsp` — low traffic
- `admin/discovery/edit-scan.jsp` — could be modal in DiscoveryConfig

No action needed for this task — documenting intentional scope boundary.
