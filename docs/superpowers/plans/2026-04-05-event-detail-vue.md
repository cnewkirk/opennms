# Event Detail Vue SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `event/detail.jsp` with a Vue 3 SPA event detail page that loads via `#/event/:id`, following the same redirect pattern used by the node detail page.

**Architecture:** The JSP becomes a thin redirect (request param `id` → `#/event/:id`). A `useEventDetail` composable fetches a single event from `GET /api/v2/events/{id}`. `EventDetail.vue` renders breadcrumbs, a severity-colored header, a details grid, and collapsible content cards.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Pinia, Vue Router hash history, Feather DS layout/typography, `v-date` directive, Axios (`v2` instance).

---

## File Map

| File | Action |
|---|---|
| `ui/src/types/index.ts` | Extend `Event` interface — 7 optional fields |
| `ui/src/services/eventService.ts` | Add `getEventById(id)` |
| `ui/src/services/index.ts` | Re-export `getEventById` from default object |
| `ui/src/composables/useEventDetail.ts` | New composable — mirrors `useNodeDetail` |
| `ui/src/containers/EventDetail.vue` | New container — full page |
| `ui/src/main/router/index.ts` | Add `/event/:id` route |
| `ui/src/components/Nodes/EventsTable.vue` | Swap `<a href>` back to `<router-link>` |
| `opennms-webapp/src/main/webapp/WEB-INF/jsp/event/detail.jsp` | Replace entire file with redirect scriptlet |

---

## Task 1: Extend Event type and add `getEventById`

**Files:**
- Modify: `ui/src/types/index.ts` (around line 176)
- Modify: `ui/src/services/eventService.ts`
- Modify: `ui/src/services/index.ts`

- [ ] **Step 1: Add missing fields to the `Event` interface**

In `ui/src/types/index.ts`, find the `Event` interface (line 176) and add the 7 optional fields. The full updated interface:

```ts
export interface Event {
  createTime: number
  description: string
  display: string
  id: number
  label: string
  location: string
  log: string
  logMessage: string
  nodeId: number
  nodeLabel: string
  parameters: Array<{ name: string; value: string; type?: string }>
  severity: string
  source: string
  time: number
  uei: string
  // Fields used by event detail page
  ipAddress?: string
  serviceName?: string
  serviceId?: number
  alarmId?: number
  operatorInstruction?: string
  systemId?: string
  nodeLocation?: string
}
```

- [ ] **Step 2: Add `getEventById` to `eventService.ts`**

The full updated `ui/src/services/eventService.ts`:

```ts
import { v2 } from './axiosInstances'
import { QueryParameters, EventApiResponse, Event } from '@/types'
import { queryParametersHandler } from './serviceHelpers'

const endpoint = '/events'

const getEvents = async (queryParameters?: QueryParameters): Promise<EventApiResponse | false> => {
  let endpointWithQueryString = ''

  if (queryParameters) {
    endpointWithQueryString = queryParametersHandler(queryParameters, endpoint)
  }

  try {
    const resp = await v2.get(endpointWithQueryString || endpoint)

    if (resp.status === 204) {
      return { event: [], count: 0, offset: 0, totalCount: 0 }
    }

    return resp.data
  } catch (err) {
    return false
  }
}

const getEventById = async (id: string | number): Promise<Event | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${id}`)
    return resp.data
  } catch (err) {
    return false
  }
}

export { getEvents, getEventById }
```

- [ ] **Step 3: Re-export `getEventById` in `services/index.ts`**

Find the import block for `eventService` (line 59) and the export object. Update both:

```ts
// Change this line:
import { getEvents } from './eventService'
// To:
import { getEvents, getEventById } from './eventService'
```

Add `getEventById` to the default export object (after `getEvents`):

```ts
  getEvents,
  getEventById,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the Event type or eventService.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/types/index.ts src/services/eventService.ts src/services/index.ts
git commit -m "feat(event-detail): extend Event type and add getEventById service"
```

---

## Task 2: Create `useEventDetail` composable

**Files:**
- Create: `ui/src/composables/useEventDetail.ts`

- [ ] **Step 1: Create the composable**

Create `ui/src/composables/useEventDetail.ts` with this content — mirrors `useNodeDetail.ts` exactly:

```ts
import { getEventById } from '@/services/eventService'
import { Event } from '@/types'

const useEventDetail = (eventId: string) => {
  const event = ref<Event | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null
    const result = await getEventById(eventId)
    if (result) {
      event.value = result
    } else {
      error.value = 'Failed to load event details'
    }
    loading.value = false
  }

  fetch()

  return { event, loading, error, refresh: fetch }
}

export default useEventDetail
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/composables/useEventDetail.ts
git commit -m "feat(event-detail): add useEventDetail composable"
```

---

## Task 3: Create `EventDetail.vue` container

**Files:**
- Create: `ui/src/containers/EventDetail.vue`

- [ ] **Step 1: Create the container**

Create `ui/src/containers/EventDetail.vue`:

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
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <!-- Error state -->
  <div v-if="error && !loading" class="feather-row">
    <div class="feather-col-12 event-detail__error">
      <p class="headline4">Event not found</p>
      <p class="subtitle1">{{ error }}</p>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 event-detail__skeleton headline3">Loading event…</div>
  </div>

  <template v-else-if="event">
    <!-- Header card — severity colored -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div :class="['card', 'event-detail__header', severityClass]">
          <div class="headline3">Event {{ event.id }}</div>
          <div class="subtitle1 event-detail__severity">{{ event.severity }}</div>
        </div>
      </div>
    </div>

    <!-- Details grid -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Details</div>
          <dl class="event-detail__grid">
            <dt>Time</dt>
            <dd v-date>{{ event.time }}</dd>

            <dt>Node</dt>
            <dd>
              <router-link v-if="event.nodeId" :to="`/node/${event.nodeId}`">{{ event.nodeLabel }}</router-link>
              <span v-else>&mdash;</span>
            </dd>

            <template v-if="event.ipAddress">
              <dt>Interface</dt>
              <dd>
                <!-- TODO: link to Vue interface detail once available -->
                <a
                  v-if="event.nodeId"
                  :href="`/opennms/element/interface.jsp?node=${event.nodeId}&intf=${event.ipAddress}`"
                >{{ event.ipAddress }}</a>
                <span v-else>{{ event.ipAddress }}</span>
              </dd>
            </template>

            <template v-if="event.serviceName">
              <dt>Service</dt>
              <dd>
                <!-- TODO: link to Vue service detail once available -->
                <a
                  v-if="event.nodeId && event.ipAddress && event.serviceId"
                  :href="`/opennms/element/service.jsp?node=${event.nodeId}&intf=${event.ipAddress}&service=${event.serviceId}`"
                >{{ event.serviceName }}</a>
                <span v-else>{{ event.serviceName }}</span>
              </dd>
            </template>

            <template v-if="event.location">
              <dt>Source Location</dt>
              <dd>{{ event.location }}{{ event.systemId ? ` (${event.systemId})` : '' }}</dd>
            </template>

            <template v-if="event.nodeLocation">
              <dt>Node Location</dt>
              <dd>{{ event.nodeLocation }}</dd>
            </template>

            <template v-if="event.uei">
              <dt>UEI</dt>
              <dd class="event-detail__uei">{{ event.uei }}</dd>
            </template>

            <template v-if="event.alarmId">
              <dt>Alarm</dt>
              <dd>
                <!-- TODO: link to Vue alarm detail once available -->
                <a :href="`/opennms/alarm/detail.htm?id=${event.alarmId}`">{{ event.alarmId }}</a>
              </dd>
            </template>
          </dl>
        </div>
      </div>
    </div>

    <!-- Log Message -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Log Message</div>
          <div v-html="event.logMessage" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Description</div>
          <div v-html="event.description" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Operator Instructions — only when present -->
    <div v-if="event.operatorInstruction" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Operator Instructions</div>
          <div v-html="event.operatorInstruction" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Parameters — only when present. System property gate dropped intentionally. -->
    <div v-if="event.parameters?.length" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Parameters</div>
          <dl class="event-detail__grid">
            <template v-for="param in event.parameters" :key="param.name">
              <dt>{{ param.name }}</dt>
              <dd>{{ param.value }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import useEventDetail from '@/composables/useEventDetail'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const id = route.params.id as string

const { event, loading, error } = useEventDetail(id)

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Events', to: '/opennms/event/index', isAbsoluteLink: true },
  { label: event.value ? `Event ${event.value.id}` : `Event ${id}`, to: '#', position: 'last' }
])

const severityClass = computed<string>(() =>
  event.value ? event.value.severity.toLowerCase() : ''
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;

  &__section-title {
    margin-bottom: 12px;
  }

  &__body {
    :deep(p) { margin: 0; }
  }
}

.event-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }

  &__header {
    padding: 16px;
    margin-bottom: 16px;
  }

  &__severity {
    margin-top: 4px;
    text-transform: capitalize;
  }

  &__uei {
    word-break: break-all;
    font-family: monospace;
    font-size: 0.875rem;
  }

  &__grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;

    dt {
      color: var($secondary-text-on-surface);
      font-weight: 600;
      white-space: nowrap;
    }

    dd {
      margin: 0;
      word-break: break-word;
    }
  }
}

// Severity background colors — matches EventsTable.vue palette
.indeterminate { background: rgba(200, 200, 200, 0.4); }
.cleared       { background: rgba(200, 200, 200, 0.4); }
.normal        { background: rgba(133, 217, 165, 0.4); }
.warning       { background: rgba(255, 175, 34, 0.4); }
.minor         { background: rgba(255, 137, 0, 0.4); }
.major         { background: rgba(215, 58, 58, 0.4); }
.critical      { background: rgba(153, 0, 0, 0.4); }
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/containers/EventDetail.vue
git commit -m "feat(event-detail): add EventDetail.vue container"
```

---

## Task 4: Add route + update EventsTable link

**Files:**
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/components/Nodes/EventsTable.vue`

- [ ] **Step 1: Add `/event/:id` route to the router**

In `ui/src/main/router/index.ts`, find the `/node/:id` route (line 165) and add the event route directly after it:

```ts
    {
      path: '/node/:id',
      name: 'Node Details',
      component: () => import('@/containers/NodeDetails.vue')
    },
    {
      path: '/event/:id',
      name: 'Event Detail',
      component: () => import('@/containers/EventDetail.vue')
    },
```

- [ ] **Step 2: Update EventsTable.vue to use router-link**

In `ui/src/components/Nodes/EventsTable.vue`, find the event ID table cell (line 26–28) and replace the `<a href>` with a `<router-link>`:

```vue
              <td>
                <router-link :to="`/event/${event.id}`">{{ event.id }}</router-link>
              </td>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chance/git/opennms/ui && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/chance/git/opennms/ui
git add src/main/router/index.ts src/components/Nodes/EventsTable.vue
git commit -m "feat(event-detail): add /event/:id route and update EventsTable link"
```

---

## Task 5: Replace `event/detail.jsp` with redirect

**Files:**
- Modify: `opennms-webapp/src/main/webapp/WEB-INF/jsp/event/detail.jsp`

- [ ] **Step 1: Replace the entire JSP with a redirect scriptlet**

The file at `opennms-webapp/src/main/webapp/WEB-INF/jsp/event/detail.jsp` is a Spring MVC view template forwarded to by the event detail controller. In a forward, the original request parameters (including `id`) are accessible via `request.getParameter("id")`. Replace the entire file contents with:

```jsp
<%--
  Redirects legacy event detail URL to the Vue SPA event detail page.
  Reads ?id=123 from the original request and redirects to /#/event/123.
--%>
<%@ page contentType="text/html" %>
<%
  String eventId = request.getParameter("id");
  if (eventId == null || eventId.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing id parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/event/" + eventId);
  }
%>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add opennms-webapp/src/main/webapp/WEB-INF/jsp/event/detail.jsp
git commit -m "feat(event-detail): redirect event/detail.jsp to Vue SPA"
```

---

## Task 6: Build and deploy

- [ ] **Step 1: Build the Vue UI**

```bash
cd /Users/chance/git/opennms/ui && npm run build 2>&1 | tail -10
```

Expected: `✓ built in ...` with no errors.

- [ ] **Step 2: Verify the built CSS has no bare `--feather-*` variable references**

```bash
grep -c '\-\-feather-' /Users/chance/git/opennms/ui/src/main/dist/assets/index-*.css | head -5
```

Expected: `0` — bare `--feather-*` values indicate lightningcss ran instead of esbuild and stripped `var()` calls. If non-zero, check that `cssMinify: 'esbuild'` is still set in `vite.config.ts`.

- [ ] **Step 3: Deploy to running container**

```bash
podman cp /Users/chance/git/opennms/ui/src/main/dist/. test-opennms:/opt/opennms/jetty-webapps/opennms/ui/
```

Expected: no output (success).

- [ ] **Step 4: Smoke test in browser**

Hard refresh (`Cmd+Shift+R`) to clear cached JS, then:

1. Navigate to the node detail page — click an event ID in the Recent Events table. Expected: stays within the SPA, URL changes to `#/event/{id}`, event detail page loads.
2. Navigate directly to `/opennms/event/detail.jsp?id={id}` — expected: redirects to `#/event/{id}`.
3. Verify all cards render: Details grid, Log Message, Description, Parameters (if any).
4. Verify the Node link in the Details grid navigates to the Vue node detail page.
5. Verify the Alarm link (if visible) uses the legacy `alarm/detail.htm` URL.
