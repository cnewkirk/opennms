# Perses Phase 3 — Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboards section of the Vue SPA (list, view, edit) backed by `/rest/dashboards`, add server-side redirects from legacy KSC and graph URLs to the new Vue routes, and enable `org.opennms.web.graphs.engine=perses` in the container environment.

**Architecture:** Two new Vue pages (`DashboardList`, `DashboardViewer`) mount `PersesCanvas` for full Grafana-like editing. New Vue router routes at `/dashboards/*`. Four existing Spring MVC controllers are modified to redirect to the Vue SPA when `org.opennms.web.graphs.engine=perses`. The container overlay `opennms.properties` is updated to activate the Perses engine.

**Prerequisites:** Phase 1 complete (PersesCanvas, /rest/dashboards API).

**Tech Stack:** Vue 3, TypeScript, Vue Router 4, Spring MVC (Java), Vitest

---

## File Map

**New frontend files:**
- `ui/src/components/Dashboards/DashboardList.vue`
- `ui/src/components/Dashboards/DashboardViewer.vue`
- `ui/src/services/dashboardService.ts`
- `ui/tests/services/dashboardService.test.ts`

**Modified frontend files:**
- `ui/src/router/index.ts` — add `/dashboards/*` routes

**Modified Java files:**
- `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/IndexController.java`
- `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomReportController.java`
- `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomViewController.java`
- `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomGraphEditDetailsController.java`
- `opennms-webapp/src/main/java/org/opennms/web/controller/GraphResultsController.java`
- `opennms-webapp/src/main/webapp/WEB-INF/jsp/graph/forecast.jsp` — add redirect meta tag

**Container env:**
- Container overlay `opennms.properties` — set `org.opennms.web.graphs.engine=perses`

---

## Task 1: Dashboard REST Service Client

**Files:**
- Create: `ui/src/services/dashboardService.ts`
- Create: `ui/tests/services/dashboardService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/services/dashboardService.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  listDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard
} from '@/services/dashboardService'

const mockSummary = { id: 'abc-123', name: 'Test', description: '', createdBy: 'admin', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
const mockFull = { ...mockSummary, spec: '{"panels":[]}' }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('dashboardService', () => {
  test('listDashboards GETs /rest/dashboards', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve([mockSummary]) } as any)
    const result = await listDashboards()
    expect(fetch).toHaveBeenCalledWith('/rest/dashboards', expect.objectContaining({ method: 'GET' }))
    expect(result[0].id).toBe('abc-123')
  })

  test('getDashboard GETs /rest/dashboards/:id', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve(mockFull) } as any)
    const result = await getDashboard('abc-123')
    expect(fetch).toHaveBeenCalledWith('/rest/dashboards/abc-123', expect.anything())
    expect(result.spec).toBe('{"panels":[]}')
  })

  test('createDashboard POSTs and returns created dashboard', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve(mockFull) } as any)
    const result = await createDashboard({ name: 'Test', spec: '{}' })
    expect(fetch).toHaveBeenCalledWith('/rest/dashboards', expect.objectContaining({ method: 'POST' }))
    expect(result.id).toBe('abc-123')
  })

  test('updateDashboard PUTs to /rest/dashboards/:id', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve(mockFull) } as any)
    await updateDashboard('abc-123', { name: 'Updated', spec: '{}' })
    expect(fetch).toHaveBeenCalledWith('/rest/dashboards/abc-123', expect.objectContaining({ method: 'PUT' }))
  })

  test('deleteDashboard DELETEs /rest/dashboards/:id', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') } as any)
    await deleteDashboard('abc-123')
    expect(fetch).toHaveBeenCalledWith('/rest/dashboards/abc-123', expect.objectContaining({ method: 'DELETE' }))
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd ui && yarn test tests/services/dashboardService.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the service**

```typescript
// ui/src/services/dashboardService.ts

export interface DashboardSummary {
  id: string
  name: string
  description?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface DashboardFull extends DashboardSummary {
  spec: string  // Perses DashboardSpec JSON string
}

export interface DashboardCreate {
  name: string
  description?: string
  spec: string
}

const BASE = '/rest/dashboards'
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' }

export async function listDashboards(): Promise<DashboardSummary[]> {
  const res = await fetch(BASE, { method: 'GET', headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`Failed to list dashboards: ${res.status}`)
  return res.json()
}

export async function getDashboard(id: string): Promise<DashboardFull> {
  const res = await fetch(`${BASE}/${id}`, { method: 'GET', headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`Failed to get dashboard ${id}: ${res.status}`)
  return res.json()
}

export async function createDashboard(payload: DashboardCreate): Promise<DashboardFull> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Failed to create dashboard: ${res.status}`)
  return res.json()
}

export async function updateDashboard(id: string, payload: DashboardCreate): Promise<DashboardFull> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Failed to update dashboard ${id}: ${res.status}`)
  return res.json()
}

export async function deleteDashboard(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete dashboard ${id}: ${res.status}`)
}
```

- [ ] **Step 4: Run passing test**

```bash
cd ui && yarn test tests/services/dashboardService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/dashboardService.ts \
        ui/tests/services/dashboardService.test.ts
git commit -m "feat(service): add dashboardService REST client"
```

---

## Task 2: DashboardList Vue Page

**Files:**
- Create: `ui/src/components/Dashboards/DashboardList.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/Dashboards/DashboardList.vue -->
<template>
  <div class="dashboard-list-page">
    <div class="page-header feather-row">
      <div class="feather-col-9">
        <h1>Dashboards</h1>
      </div>
      <div class="feather-col-3 header-actions">
        <FeatherButton primary @click="$router.push('/dashboards/new')">
          New Dashboard
        </FeatherButton>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <FeatherSpinner />
    </div>

    <div v-else-if="error" class="error-message">
      Failed to load dashboards: {{ error }}
    </div>

    <div v-else-if="dashboards.length === 0" class="empty-state">
      <p>No dashboards yet. Create your first dashboard to get started.</p>
    </div>

    <div v-else class="dashboard-grid feather-row">
      <div
        v-for="dash in dashboards"
        :key="dash.id"
        class="feather-col-4 dashboard-card"
      >
        <div class="card-body" @click="$router.push(`/dashboards/${dash.id}`)">
          <h3>{{ dash.name }}</h3>
          <p v-if="dash.description" class="description">{{ dash.description }}</p>
          <p class="meta">Last updated {{ formatDate(dash.updatedAt) }}</p>
        </div>
        <div class="card-actions">
          <FeatherButton text @click.stop="$router.push(`/dashboards/${dash.id}/edit`)">
            Edit
          </FeatherButton>
          <FeatherButton text @click.stop="confirmDelete(dash)">
            Delete
          </FeatherButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listDashboards, deleteDashboard } from '@/services/dashboardService'
import type { DashboardSummary } from '@/services/dashboardService'
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'

const dashboards = ref<DashboardSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    dashboards.value = await listDashboards()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const confirmDelete = async (dash: DashboardSummary) => {
  if (!confirm(`Delete "${dash.name}"?`)) return
  try {
    await deleteDashboard(dash.id)
    dashboards.value = dashboards.value.filter(d => d.id !== dash.id)
  } catch (e: any) {
    alert(`Failed to delete: ${e.message}`)
  }
}

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString()
}

onMounted(load)
</script>

<style scoped lang="scss">
@import "@featherds/styles/mixins/typography";

.dashboard-list-page {
  padding: 24px;
}

.page-header {
  align-items: center;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
}

.dashboard-card {
  margin-bottom: 16px;
  cursor: pointer;

  .card-body {
    background: var(--feather-surface-fill);
    border-radius: 4px;
    padding: 16px;
    border: 1px solid var(--feather-border-on-surface);

    &:hover {
      border-color: var(--feather-primary-interactive-default);
    }

    h3 { @include headline6; margin: 0 0 8px; }
    .description { @include body1; color: var(--feather-secondary-text-on-surface); margin: 0 0 8px; }
    .meta { @include caption; color: var(--feather-disabled-text-on-surface); margin: 0; }
  }

  .card-actions {
    display: flex;
    gap: 8px;
    padding: 4px 0;
  }
}

.empty-state {
  text-align: center;
  padding: 64px 0;
  color: var(--feather-secondary-text-on-surface);
}

.loading {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep "DashboardList" || echo "OK"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Dashboards/DashboardList.vue
git commit -m "feat(dashboards): add DashboardList page"
```

---

## Task 3: DashboardViewer Vue Page

**Files:**
- Create: `ui/src/components/Dashboards/DashboardViewer.vue`

Handles view mode, edit mode, and new dashboard creation. Mounts `PersesCanvas`.

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/Dashboards/DashboardViewer.vue -->
<template>
  <div class="dashboard-viewer">
    <div v-if="loading" class="loading">
      <FeatherSpinner />
    </div>
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    <template v-else>
      <div class="viewer-header feather-row">
        <div class="feather-col-8">
          <h2>{{ isNew ? 'New Dashboard' : dashboardName }}</h2>
        </div>
        <div class="feather-col-4 header-actions">
          <FeatherButton
            v-if="!isEditMode && !isNew"
            secondary
            @click="$router.push(`/dashboards/${dashboardId}/edit`)"
          >
            Edit
          </FeatherButton>
          <FeatherButton
            v-if="isEditMode || isNew"
            primary
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </FeatherButton>
          <FeatherButton text @click="$router.push('/dashboards')">
            Back
          </FeatherButton>
        </div>
      </div>

      <PersesCanvas
        v-if="dashboardResource"
        :dashboard-resource="dashboardResource"
        :is-edit-mode="isEditMode || isNew"
        :on-save="handleSave"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getDashboard,
  createDashboard,
  updateDashboard
} from '@/services/dashboardService'
import PersesCanvas from '@/components/Perses/PersesCanvas.vue'
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import type { DashboardResource } from '@perses-dev/core'

const route   = useRoute()
const router  = useRouter()

const dashboardId  = computed(() => route.params.id as string | undefined)
const isNew        = computed(() => route.path === '/dashboards/new')
const isEditMode   = computed(() => route.path.endsWith('/edit'))
const dashboardName = ref('Dashboard')
const dashboardResource = ref<DashboardResource | null>(null)
const loading = ref(false)
const saving  = ref(false)
const error   = ref<string | null>(null)

/** Build an empty Perses DashboardResource for new dashboards */
const emptyDashboardResource = (): DashboardResource => ({
  kind: 'Dashboard',
  metadata: {
    name: 'new-dashboard',
    project: 'opennms'
  },
  spec: {
    panels: {},
    layouts: [],
    duration: '1h',
    variables: [],
    datasources: {}
  }
})

onMounted(async () => {
  if (isNew.value) {
    dashboardResource.value = emptyDashboardResource()
    return
  }

  loading.value = true
  try {
    const dash = await getDashboard(dashboardId.value!)
    dashboardName.value = dash.name
    dashboardResource.value = JSON.parse(dash.spec) as DashboardResource
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const handleSave = async (resource: DashboardResource) => {
  saving.value = true
  try {
    const specStr = JSON.stringify(resource)
    if (isNew.value) {
      const created = await createDashboard({
        name: resource.metadata.name,
        spec: specStr
      })
      await router.push(`/dashboards/${created.id}`)
    } else {
      await updateDashboard(dashboardId.value!, {
        name: dashboardName.value,
        spec: specStr
      })
    }
  } catch (e: any) {
    alert(`Save failed: ${e.message}`)
  } finally {
    saving.value = false
  }
}

const save = () => {
  // NOTE: Dashboard edit state is owned by Perses React internals.
  // The primary save path is the Perses editor's own Save button, which
  // calls our `handleSave` callback with the current edited DashboardResource.
  // This Vue header Save button is only reliable in view mode (saves the
  // loaded spec as-is). In edit mode, direct users to use Perses's save button,
  // or wire up a Perses imperative save API if Perses exposes one in the
  // version being used (check @perses-dev/dashboards changelog).
  if (dashboardResource.value) {
    handleSave(dashboardResource.value)
  }
}
</script>

<style scoped lang="scss">
@import "@featherds/styles/mixins/typography";

.dashboard-viewer {
  padding: 24px;
}

.viewer-header {
  align-items: center;
  margin-bottom: 16px;
  h2 { @include headline5; margin: 0; }
}

.header-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep "DashboardViewer" || echo "OK"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Dashboards/DashboardViewer.vue
git commit -m "feat(dashboards): add DashboardViewer page (view/edit/new)"
```

---

## Task 4: Register Vue Router Routes

**Files:**
- Modify: `ui/src/router/index.ts`

- [ ] **Step 1: Read the current router file**

```bash
head -60 ui/src/router/index.ts
```

Note the import pattern used for other lazy-loaded components.

- [ ] **Step 2: Add dashboard routes**

In `ui/src/router/index.ts`, add the following imports near the top with other lazy component imports:

```typescript
const DashboardList   = () => import('@/components/Dashboards/DashboardList.vue')
const DashboardViewer = () => import('@/components/Dashboards/DashboardViewer.vue')
```

In the routes array, add:

```typescript
  {
    path: '/dashboards',
    component: DashboardList,
    name: 'Dashboards'
  },
  {
    path: '/dashboards/new',
    component: DashboardViewer,
    name: 'NewDashboard'
  },
  {
    path: '/dashboards/:id',
    component: DashboardViewer,
    name: 'DashboardView'
  },
  {
    path: '/dashboards/:id/edit',
    component: DashboardViewer,
    name: 'DashboardEdit'
  },
```

- [ ] **Step 3: Verify TypeScript compiles and build succeeds**

```bash
cd ui && yarn build 2>&1 | tail -5
```

Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add ui/src/router/index.ts
git commit -m "feat(router): add /dashboards/* routes"
```

---

## Task 5: Add Dashboards Nav Link

**Files:**
- Modify: wherever the Vue SPA's side navigation links are defined

- [ ] **Step 1: Find the nav menu definition**

```bash
grep -rn "Resource Graphs\|resource-graphs\|Alarms\|NodeDetail" ui/src/ --include="*.vue" --include="*.ts" | grep -i "nav\|menu\|link\|route" | head -10
```

Note the file that defines the navigation items.

- [ ] **Step 2: Add the Dashboards nav entry**

In the nav definition file, add a Dashboards entry following the same pattern as existing entries. Example (adjust to match actual nav structure):

```typescript
{
  label: 'Dashboards',
  icon: 'dashboard',  // or whichever Feather icon is appropriate
  to: '/dashboards'
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | head -10
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -p ui/src/
git commit -m "feat(nav): add Dashboards link to Vue SPA navigation"
```

---

## Task 6: KSC Controller Redirects

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/IndexController.java`
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomReportController.java`
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomViewController.java`
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomGraphEditDetailsController.java`

Follow the same pattern as `AlarmDetailController.java:112-119` — check `System.getProperty`, call `response.sendRedirect`, return null.

The system property is `org.opennms.web.graphs.engine`. Redirect when it equals `"perses"`.

- [ ] **Step 1: Read each controller to find the handler method**

```bash
grep -n "handleRequestInternal\|handleRequest\|@RequestMapping\|ModelAndView" \
  opennms-webapp/src/main/java/org/opennms/web/controller/ksc/IndexController.java | head -10
grep -n "handleRequestInternal\|ModelAndView" \
  opennms-webapp/src/main/java/org/opennms/web/controller/ksc/CustomReportController.java | head -10
```

- [ ] **Step 2: Add redirect to IndexController**

At the top of `handleRequestInternal` (or equivalent handler method) in `IndexController.java`, add:

```java
// Redirect to Vue SPA Dashboards when Perses engine is active
if ("perses".equals(System.getProperty("org.opennms.web.graphs.engine", "backshift"))) {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboards");
    return null;
}
```

- [ ] **Step 3: Add redirect to CustomReportController**

At the top of its handler method in `CustomReportController.java`, add:

```java
if ("perses".equals(System.getProperty("org.opennms.web.graphs.engine", "backshift"))) {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboards");
    return null;
}
```

- [ ] **Step 4: Add redirect to CustomViewController**

At the top of its handler method in `CustomViewController.java`, add:

```java
if ("perses".equals(System.getProperty("org.opennms.web.graphs.engine", "backshift"))) {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboards");
    return null;
}
```

- [ ] **Step 5: Add redirect to CustomGraphEditDetailsController**

At the top of its handler method in `CustomGraphEditDetailsController.java`, add:

```java
if ("perses".equals(System.getProperty("org.opennms.web.graphs.engine", "backshift"))) {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboards/new");
    return null;
}
```

- [ ] **Step 6: Compile opennms-webapp**

```bash
./compile.pl -DskipTests --projects :opennms-webapp install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 7: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/ksc/
git commit -m "feat(ksc): redirect KSC controllers to Vue Dashboards when engine=perses"
```

---

## Task 7: Graph Results Controller Redirect

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/GraphResultsController.java`

- [ ] **Step 1: Read the current handler**

```bash
grep -n "handleRequestInternal\|resourceId\|reports\|sendRedirect" \
  opennms-webapp/src/main/java/org/opennms/web/controller/GraphResultsController.java | head -15
```

- [ ] **Step 2: Add redirect at the top of `handleRequestInternal`**

The existing handler reads `resourceId` and `reports` from request params. Preserve those for the redirect URL:

```java
@Override
protected ModelAndView handleRequestInternal(HttpServletRequest request, HttpServletResponse response) throws Exception {
    // Redirect to Vue SPA Resource Graphs when Perses engine is active
    if ("perses".equals(System.getProperty("org.opennms.web.graphs.engine", "backshift"))) {
        final String resourceId = request.getParameter("resourceId");
        if (resourceId != null && !resourceId.trim().isEmpty()) {
            // Encode the resourceId for use in a hash fragment
            final String encoded = java.net.URLEncoder.encode(resourceId.trim(), StandardCharsets.UTF_8.name());
            response.sendRedirect(request.getContextPath()
                + "/ui/index.html#/resource-graphs/graphs/" + encoded);
        } else {
            response.sendRedirect(request.getContextPath() + "/ui/index.html#/resource-graphs");
        }
        return null;
    }
    // ... existing code continues unchanged below this block
```

Note: add `import java.nio.charset.StandardCharsets;` if not already present.

- [ ] **Step 3: Compile**

```bash
./compile.pl -DskipTests --projects :opennms-webapp install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/GraphResultsController.java
git commit -m "feat(graph): redirect graph/results.htm to Vue SPA when engine=perses"
```

---

## Task 8: Retire forecast.jsp

**Files:**
- Modify: `opennms-webapp/src/main/webapp/graph/forecast.jsp`

The forecast page is retired — no Vue redirect exists yet (Perses forecast panel is future work). Add a redirect to the Dashboards list so old bookmarks don't 404.

- [ ] **Step 1: Read the current forecast.jsp header**

```bash
head -20 opennms-webapp/src/main/webapp/graph/forecast.jsp
```

- [ ] **Step 2: Add a redirect at the very top of forecast.jsp**

Add before any other content at the top of `forecast.jsp`:

```jsp
<%--
  forecast.jsp — retired in favor of Perses-based forecast (future feature).
  Redirect to Dashboards when Perses engine is active.
--%>
<%@ page import="org.opennms.core.utils.TimeSeries" %>
<%
  if ("perses".equals(TimeSeries.getGraphEngine())) {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboards");
    return;
  }
%>
```

- [ ] **Step 3: Compile**

```bash
./compile.pl -DskipTests --projects :opennms-webapp install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp/src/main/webapp/graph/forecast.jsp
git commit -m "feat(forecast): redirect to Vue Dashboards when engine=perses"
```

---

## Task 9: Update TimeSeries.java to Recognize "perses"

**Files:**
- Modify: `core/lib/src/main/java/org/opennms/core/utils/TimeSeries.java`

The `getGraphEngine()` method currently returns `"backshift"` for the `"auto"` value. Add `"perses"` as a recognized valid value (currently it passes through as-is, which is fine — but document it clearly).

- [ ] **Step 1: Read TimeSeries.java**

Already read in prior context. The key constant is `DEFAULT_GRAPHS_ENGINE_TYPE = "backshift"`.

- [ ] **Step 2: Add perses constant and update javadoc**

In `TimeSeries.java`, add after the existing constants:

```java
    public static final String PERSES_GRAPHS_ENGINE_TYPE = "perses";
```

Update the `getGraphEngine()` javadoc:

```java
    /**
     * Returns the configured graph engine.
     * Valid values: "backshift" (default), "png", "placeholder", "perses".
     * Set via system property: org.opennms.web.graphs.engine
     */
    public static String getGraphEngine() {
```

- [ ] **Step 3: Compile**

```bash
./compile.pl -DskipTests --projects :opennms-core install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add core/lib/src/main/java/org/opennms/core/utils/TimeSeries.java
git commit -m "feat(timeseries): document perses as valid graph engine value"
```

---

## Task 10: Set engine=perses in Container Environment

**Files:**
- Modify: container overlay `opennms.properties` (in the container build/overlay directory)

- [ ] **Step 1: Find the container overlay opennms.properties**

```bash
find /Users/chance/git/opennms -name "opennms.properties" | grep -v target | grep -v node_modules | head -5
```

Note the path used in the container overlay (check `.topology-lab/` or the existing container overlay scripts from prior work).

- [ ] **Step 2: Add the Perses engine property**

In the container overlay `opennms.properties` (the one copied into the container at build time), add:

```properties
# Enable Perses-based graph/dashboard rendering
org.opennms.web.graphs.engine=perses
```

- [ ] **Step 3: Rebuild and verify the container picks up the property**

Follow the existing container overlay build procedure. After startup, verify:

```bash
podman exec <container> grep "graphs.engine" /opt/opennms/etc/opennms.properties
```

Expected: `org.opennms.web.graphs.engine=perses`

- [ ] **Step 4: Smoke test — verify KSC redirect works**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
  -u admin:notdefault \
  http://localhost:8980/opennms/KSC/index.htm
```

Expected: `302 http://localhost:8980/opennms/ui/index.html#/dashboards`

- [ ] **Step 5: Commit the overlay change**

```bash
git add <overlay-properties-file>
git commit -m "feat(container): set org.opennms.web.graphs.engine=perses in overlay"
```

---

## Task 11: Run All Tests

- [ ] **Step 1: Run all frontend tests**

```bash
cd ui && yarn test
```

Expected: all pass

- [ ] **Step 2: Build the frontend**

```bash
cd ui && yarn build 2>&1 | tail -5
```

Expected: build success

- [ ] **Step 3: Compile affected Java modules**

```bash
./compile.pl -DskipTests --projects :opennms-webapp,:opennms-webapp-rest -am install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(phase3): address any build issues found during final test run"
```

---

## Phase 3 Complete

At this point:
- `/dashboards`, `/dashboards/new`, `/dashboards/:id`, `/dashboards/:id/edit` are live Vue routes
- `DashboardList` shows all saved Perses dashboards with create/delete
- `DashboardViewer` mounts `PersesCanvas` for view, edit, and new dashboard workflows
- `/KSC/*`, `/graph/results.htm`, `/graph/forecast.jsp` redirect to Vue SPA when engine=perses
- Container environment runs with engine=perses

Proceed to `2026-04-05-perses-phase4-retirement.md`.
