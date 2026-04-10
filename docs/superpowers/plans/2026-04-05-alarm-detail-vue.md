# Alarm Detail Vue SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `alarm/detail.htm` with a Vue 3 SPA page at `/#/alarm/:id` — full feature parity including memos, ticket ops, related alarms/situations, and ack history.

**Architecture:** Single `AlarmDetail.vue` container (no sub-components), new `useAlarmDetail` composable fetching alarm + ack history + related events in parallel, system-property-gated redirect prepended to `AlarmDetailController.detail()` leaving legacy path fully intact.

**Tech Stack:** Vue 3 Composition API, TypeScript, Feather DS, Pinia (`useInfoStore`), `v2`/`rest` axios instances, `@/styles/severities` SCSS.

---

## File Map

| File | Action |
|---|---|
| `ui/src/composables/useRole.ts` | Add `ROLE_READONLY` + expose `readOnlyRole` |
| `ui/src/types/index.ts` | Extend `Alarm`; add `AlarmMemo`, `AlarmAcknowledgment` |
| `ui/src/services/alarmService.ts` | Add `getAlarmById`, `getAlarmAcknowledgments`, memo CRUD |
| `ui/src/composables/useAlarmDetail.ts` | Create — parallel fetch of alarm, acks, related events |
| `ui/src/main/router/index.ts` | Add `/alarm/:id` route |
| `ui/src/containers/AlarmDetail.vue` | Create — full alarm detail page |
| `opennms-webapp/src/main/java/org/opennms/web/controller/alarm/AlarmDetailController.java` | Prepend redirect block to `detail()` method |

---

## Task 1: Add `ROLE_READONLY` to useRole and extend types

**Files:**
- Modify: `ui/src/composables/useRole.ts`
- Modify: `ui/src/types/index.ts`

- [ ] **Step 1: Add `ROLE_READONLY` to useRole**

Open `ui/src/composables/useRole.ts`. Replace the `Roles` enum and `useRole` return value:

```ts
const enum Roles {
  ROLE_ADMIN = 'ROLE_ADMIN',
  ROLE_USER = 'ROLE_USER',
  ROLE_REST = 'ROLE_REST',
  ROLE_FILESYSTEM_EDITOR = 'ROLE_FILESYSTEM_EDITOR',
  ROLE_DEVICE_CONFIG_BACKUP = 'ROLE_DEVICE_CONFIG_BACKUP',
  ROLE_READONLY = 'ROLE_READONLY'
}
```

And update the return:
```ts
const useRole = () => {
  const adminRole = computed<boolean>(() => hasOneOf(Roles.ROLE_ADMIN))
  const filesystemEditorRole = computed<boolean>(() => hasOneOf(Roles.ROLE_FILESYSTEM_EDITOR))
  const dcbRole = computed<boolean>(() => hasOneOf(Roles.ROLE_ADMIN, Roles.ROLE_REST, Roles.ROLE_DEVICE_CONFIG_BACKUP))
  const readOnlyRole = computed<boolean>(() => hasOneOf(Roles.ROLE_READONLY))

  return { adminRole, filesystemEditorRole, dcbRole, readOnlyRole, rolesAreLoaded }
}
```

- [ ] **Step 2: Add `AlarmMemo` and `AlarmAcknowledgment` types to `ui/src/types/index.ts`**

Find the `export interface Alarm` block (around line 165). Add these two new interfaces directly above it:

```ts
export interface AlarmMemo {
  body: string | null
  author: string | null
  created: number | null
  updated: number | null
}

export interface AlarmAcknowledgment {
  ackUser: string
  ackAction: string
  ackTime: number
}
```

- [ ] **Step 3: Extend the `Alarm` interface**

Replace the existing `Alarm` interface body with the extended version:

```ts
export interface Alarm {
  // existing fields (used by list views, dashboard widget, map)
  id: string
  severity: string
  nodeId: number
  nodeLabel: string
  uei: string
  count: number
  lastEventTime: number
  logMessage: string
  // detail-page fields
  firstEventTime?: number
  ipAddress?: string
  serviceType?: { id: number; name: string }
  ackTime?: number
  ackUser?: string
  description?: string
  operInstruct?: string
  reductionKey?: string
  managedObjectType?: string
  managedObjectInstance?: string
  troubleTicketId?: string
  troubleTicketState?: string
  isSituation?: boolean
  isPartOfSituation?: boolean
  relatedAlarms?: Alarm[]       // populated when isSituation=true
  relatedSituations?: Alarm[]   // populated when isPartOfSituation=true — verify field name against live /api/v2/alarms/{id} response
  lastEvent?: { id: number }
  stickyMemo?: AlarmMemo
  reductionKeyMemo?: AlarmMemo
  location?: string
  nodeLocation?: string
}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd ui && npm run build 2>&1 | grep -E "error TS|ERROR"
```
Expected: no TypeScript errors. If there are errors about the `Alarm` type being used elsewhere (e.g., `MapAlarmsGrid.vue`), they should all be compatible since we only added optional fields.

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/useRole.ts ui/src/types/index.ts
git commit -m "feat(alarm-detail): add ROLE_READONLY to useRole, extend Alarm type with detail fields"
```

---

## Task 2: Extend `alarmService.ts`

**Files:**
- Modify: `ui/src/services/alarmService.ts`

- [ ] **Step 1: Add imports**

At the top of `ui/src/services/alarmService.ts`, update the import line to include `rest` and the new types:

```ts
import { v2, rest } from './axiosInstances'
import { QueryParameters, AlarmQueryParameters, AlarmApiResponse, Alarm, AlarmAcknowledgment } from '@/types'
```

- [ ] **Step 2: Add `getAlarmById`**

Append after the existing `getAlarms` function:

```ts
const getAlarmById = async (id: string | number): Promise<Alarm | false> => {
  try {
    const resp = await v2.get(`${endpoint}/${id}`)
    return resp.data
  } catch (err) {
    return false
  }
}
```

- [ ] **Step 3: Add `getAlarmAcknowledgments`**

Acknowledgment history is available at the v1 REST endpoint `/rest/acks?alarmId={id}`. Append:

```ts
const getAlarmAcknowledgments = async (id: string | number): Promise<AlarmAcknowledgment[]> => {
  try {
    const resp = await rest.get(`/acks?alarmId=${id}`)
    return resp.data?.ack ?? []
  } catch (err) {
    return []
  }
}
```

- [ ] **Step 4: Add memo CRUD functions**

Append the four memo functions. The v2 API accepts `text/plain` bodies:

```ts
const saveStickyMemo = async (id: string | number, body: string): Promise<boolean> => {
  try {
    await v2.put(`${endpoint}/${id}/memo`, body, {
      headers: { 'Content-Type': 'text/plain' }
    })
    return true
  } catch (err) {
    return false
  }
}

const deleteStickyMemo = async (id: string | number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${id}/memo`)
    return true
  } catch (err) {
    return false
  }
}

const saveJournalMemo = async (id: string | number, body: string): Promise<boolean> => {
  try {
    await v2.put(`${endpoint}/${id}/journal`, body, {
      headers: { 'Content-Type': 'text/plain' }
    })
    return true
  } catch (err) {
    return false
  }
}

const deleteJournalMemo = async (id: string | number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${id}/journal`)
    return true
  } catch (err) {
    return false
  }
}
```

- [ ] **Step 5: Update the export line**

Replace the existing `export { getAlarms, modifyAlarm }` with:

```ts
export {
  getAlarms,
  modifyAlarm,
  getAlarmById,
  getAlarmAcknowledgments,
  saveStickyMemo,
  deleteStickyMemo,
  saveJournalMemo,
  deleteJournalMemo
}
```

- [ ] **Step 6: Build check**

```bash
cd ui && npm run build 2>&1 | grep -E "error TS|ERROR"
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add ui/src/services/alarmService.ts
git commit -m "feat(alarm-detail): add getAlarmById, getAlarmAcknowledgments, memo CRUD to alarmService"
```

---

## Task 3: Create `useAlarmDetail` composable

**Files:**
- Create: `ui/src/composables/useAlarmDetail.ts`

- [ ] **Step 1: Create the file**

Create `ui/src/composables/useAlarmDetail.ts`:

```ts
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

import { getAlarmById, getAlarmAcknowledgments } from '@/services/alarmService'
import { getEvents } from '@/services/eventService'
import { Alarm, AlarmAcknowledgment, Event } from '@/types'

const useAlarmDetail = (id: string) => {
  const alarm = ref<Alarm | null>(null)
  const acknowledgments = ref<AlarmAcknowledgment[]>([])
  const relatedEvents = ref<Event[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null

    const [alarmResult, acksResult, eventsResult] = await Promise.all([
      getAlarmById(id),
      getAlarmAcknowledgments(id),
      getEvents({ _s: `alarmId==${id}`, limit: 20, orderBy: 'id', order: 'DESC' })
    ])

    if (!alarmResult) {
      error.value = `Failed to load alarm ${id}`
    } else {
      alarm.value = alarmResult
      acknowledgments.value = Array.isArray(acksResult) ? acksResult : []
      relatedEvents.value = eventsResult ? eventsResult.event : []
    }
    loading.value = false
  }

  fetch()

  return { alarm, acknowledgments, relatedEvents, loading, error, refresh: fetch }
}

export default useAlarmDetail
```

- [ ] **Step 2: Build check**

```bash
cd ui && npm run build 2>&1 | grep -E "error TS|ERROR"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/composables/useAlarmDetail.ts
git commit -m "feat(alarm-detail): add useAlarmDetail composable"
```

---

## Task 4: Add router entry

**Files:**
- Modify: `ui/src/main/router/index.ts`

- [ ] **Step 1: Add the route**

In `ui/src/main/router/index.ts`, find the `/event/:id` route block:

```ts
{
  path: '/event/:id',
  name: 'Event Detail',
  component: () => import('@/containers/EventDetail.vue')
},
```

Add the alarm route immediately after it:

```ts
{
  path: '/alarm/:id',
  name: 'Alarm Detail',
  component: () => import('@/containers/AlarmDetail.vue')
},
```

- [ ] **Step 2: Build check**

```bash
cd ui && npm run build 2>&1 | grep -E "error TS|ERROR"
```
Expected: build warning about missing `AlarmDetail.vue` module is acceptable here — it will be created in Task 5.

- [ ] **Step 3: Commit**

```bash
git add ui/src/main/router/index.ts
git commit -m "feat(alarm-detail): add /alarm/:id route"
```

---

## Task 5: Create `AlarmDetail.vue`

**Files:**
- Create: `ui/src/containers/AlarmDetail.vue`

- [ ] **Step 1: Create the container**

Create `ui/src/containers/AlarmDetail.vue` with the full contents below. This is a single container — all sections are in one file:

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
    <div class="feather-col-12 alarm-detail__error">
      <p class="headline4">Alarm not found</p>
      <p class="subtitle1">{{ error }}</p>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 alarm-detail__skeleton headline3">Loading alarm…</div>
  </div>

  <template v-else-if="alarm">
    <!-- Header card — severity colored -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div :class="['card', 'alarm-detail__header', severityClass]">
          <div class="headline3">{{ alarm.isSituation ? 'Situation' : 'Alarm' }} {{ alarm.id }}</div>
          <div class="subtitle1 alarm-detail__severity">{{ alarm.severity }}</div>
        </div>
      </div>
    </div>

    <!-- Details card -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Details</div>
          <dl class="alarm-detail__grid">
            <dt>Severity</dt>
            <dd>{{ alarm.severity }}</dd>

            <dt>Node</dt>
            <dd>
              <router-link v-if="alarm.nodeId" :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link>
              <span v-else>&mdash;</span>
            </dd>

            <dt>Last Event</dt>
            <dd>
              <router-link v-if="alarm.lastEvent" :to="`/event/${alarm.lastEvent.id}`">
                <span v-date>{{ alarm.lastEventTime }}</span>
              </router-link>
              <span v-else v-date>{{ alarm.lastEventTime }}</span>
            </dd>

            <dt>Interface</dt>
            <dd>
              <a
                v-if="alarm.ipAddress && alarm.nodeId"
                :href="`/opennms/element/interface.jsp?node=${alarm.nodeId}&intf=${alarm.ipAddress}`"
              >{{ alarm.ipAddress }}</a>
              <span v-else-if="alarm.ipAddress">{{ alarm.ipAddress }}</span>
              <span v-else>&mdash;</span>
            </dd>

            <dt>First Event</dt>
            <dd v-date>{{ alarm.firstEventTime }}</dd>

            <dt>Service</dt>
            <dd>
              <a
                v-if="alarm.serviceType && alarm.ipAddress && alarm.nodeId"
                :href="`/opennms/element/service.jsp?node=${alarm.nodeId}&intf=${alarm.ipAddress}&service=${alarm.serviceType.id}`"
              >{{ alarm.serviceType.name }}</a>
              <span v-else-if="alarm.serviceType">{{ alarm.serviceType.name }}</span>
              <span v-else>&mdash;</span>
            </dd>

            <template v-if="alarm.location">
              <dt>Event Source Location</dt>
              <dd>{{ alarm.location }}</dd>
            </template>

            <template v-if="alarm.nodeLocation">
              <dt>Node Location</dt>
              <dd>{{ alarm.nodeLocation }}</dd>
            </template>

            <dt>Count</dt>
            <dd>{{ alarm.count }}</dd>

            <dt>UEI</dt>
            <dd class="alarm-detail__uei">{{ alarm.uei }}</dd>

            <template v-if="alarm.managedObjectType">
              <dt>Managed Object Type</dt>
              <dd>{{ alarm.managedObjectType }}</dd>
            </template>

            <template v-if="alarm.managedObjectInstance">
              <dt>Managed Object Instance</dt>
              <dd>{{ alarm.managedObjectInstance }}</dd>
            </template>

            <template v-if="alarm.troubleTicketId">
              <dt>Ticket ID</dt>
              <dd>{{ alarm.troubleTicketId }}</dd>
            </template>

            <template v-if="alarm.troubleTicketState">
              <dt>Ticket State</dt>
              <dd>{{ alarm.troubleTicketState }}</dd>
            </template>

            <template v-if="alarm.reductionKey">
              <dt>Reduction Key</dt>
              <dd class="alarm-detail__reduction-key">{{ alarm.reductionKey }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </div>

    <!-- Action bar — hidden for ROLE_READONLY -->
    <div v-if="!readOnlyRole" class="feather-row">
      <div class="feather-col-12">
        <div class="card alarm-detail__actions">
          <FeatherButton secondary :disabled="actionInFlight" @click="toggleAck">
            {{ isAcknowledged ? 'Unacknowledge' : 'Acknowledge' }}
          </FeatherButton>
          <FeatherButton v-if="showEscalate" secondary :disabled="actionInFlight" @click="doEscalate">
            Escalate
          </FeatherButton>
          <FeatherButton v-if="showClear" secondary :disabled="actionInFlight" @click="doClear">
            Clear
          </FeatherButton>
          <template v-if="ticketerEnabled">
            <FeatherButton secondary :disabled="!canCreateTicket" @click="ticketAction('create')">
              Create Ticket
            </FeatherButton>
            <FeatherButton secondary :disabled="!canUpdateTicket" @click="ticketAction('update')">
              Update Ticket
            </FeatherButton>
            <FeatherButton secondary :disabled="!canCloseTicket" @click="ticketAction('close')">
              Close Ticket
            </FeatherButton>
          </template>
        </div>
      </div>
    </div>

    <!-- Log Message -->
    <div v-if="alarm.logMessage" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Log Message</div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="alarm.logMessage" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div v-if="alarm.description" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Description</div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="alarm.description" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Operator Instructions -->
    <div v-if="alarm.operInstruct" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Operator Instructions</div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="alarm.operInstruct" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Parent Situation(s) — shown when this alarm is part of a situation -->
    <div v-if="alarm.isPartOfSituation && alarm.relatedSituations?.length" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Parent Situation(s)</div>
          <table class="alarm-detail__table">
            <thead>
              <tr>
                <th>ID</th><th>Severity</th><th>Node</th>
                <th>Count</th><th>Last Event</th><th>Log Message</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sit in alarm.relatedSituations"
                :key="sit.id"
                :class="`row--${sit.severity.toLowerCase()}`"
              >
                <td><router-link :to="`/alarm/${sit.id}`">{{ sit.id }}</router-link></td>
                <td>{{ sit.severity }}</td>
                <td>
                  <router-link v-if="sit.nodeId" :to="`/node/${sit.nodeId}`">{{ sit.nodeLabel }}</router-link>
                  <span v-else>&mdash;</span>
                </td>
                <td>{{ sit.count }}</td>
                <td v-date>{{ sit.lastEventTime }}</td>
                <td class="alarm-detail__log-msg">{{ sit.logMessage }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Related Alarms — shown only when this alarm IS a situation -->
    <div v-if="alarm.isSituation && alarm.relatedAlarms?.length" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Related Alarm(s)</div>
          <table class="alarm-detail__table">
            <thead>
              <tr>
                <th>ID</th><th>Situation</th><th>Severity</th><th>Node</th>
                <th>Count</th><th>Last Event</th><th>Log Message</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rel in alarm.relatedAlarms"
                :key="rel.id"
                :class="`row--${rel.severity.toLowerCase()}`"
              >
                <td><router-link :to="`/alarm/${rel.id}`">{{ rel.id }}</router-link></td>
                <td>{{ rel.isSituation ? '✓' : '' }}</td>
                <td>{{ rel.severity }}</td>
                <td>
                  <router-link v-if="rel.nodeId" :to="`/node/${rel.nodeId}`">{{ rel.nodeLabel }}</router-link>
                  <span v-else>&mdash;</span>
                </td>
                <td>{{ rel.count }}</td>
                <td v-date>{{ rel.lastEventTime }}</td>
                <td class="alarm-detail__log-msg">{{ rel.logMessage }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Related Events -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Related Events</div>
          <div v-if="!relatedEvents.length" class="card__body alarm-detail__empty">No related events.</div>
          <table v-else class="alarm-detail__table">
            <thead>
              <tr><th>Event</th><th>Severity</th><th>Time</th><th>UEI</th><th>Log Message</th></tr>
            </thead>
            <tbody>
              <tr
                v-for="ev in relatedEvents"
                :key="ev.id"
                :class="`row--${ev.severity.toLowerCase()}`"
              >
                <td><router-link :to="`/event/${ev.id}`">{{ ev.id }}</router-link></td>
                <td>{{ ev.severity }}</td>
                <td v-date>{{ ev.time }}</td>
                <td class="alarm-detail__uei">{{ ev.uei }}</td>
                <td class="alarm-detail__log-msg">{{ ev.logMessage }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Acknowledgements — hidden when empty -->
    <div v-if="acknowledgments.length" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Acknowledgements</div>
          <table class="alarm-detail__table">
            <thead>
              <tr><th>Acknowledged By</th><th>Action</th><th>Time Acknowledged</th></tr>
            </thead>
            <tbody>
              <tr v-for="(ack, i) in acknowledgments" :key="i">
                <td>{{ ack.ackUser }}</td>
                <td>{{ ack.ackAction }}</td>
                <td v-date>{{ ack.ackTime }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Memos row — sticky (left) + journal (right) -->
    <div class="feather-row">
      <div class="feather-col-6">
        <div class="card">
          <div class="headline4 card__section-title">Sticky Memo</div>
          <textarea
            v-model="stickyMemoBody"
            :disabled="readOnlyRole"
            class="alarm-detail__memo-textarea"
            rows="5"
          ></textarea>
          <div class="alarm-detail__memo-actions">
            <FeatherButton secondary :disabled="readOnlyRole || memoInFlight" @click="saveMemo('sticky')">
              Save
            </FeatherButton>
            <FeatherButton
              secondary
              :disabled="readOnlyRole || memoInFlight || !alarm.stickyMemo?.body"
              @click="deleteMemo('sticky')"
            >
              Delete
            </FeatherButton>
          </div>
          <div v-if="alarm.stickyMemo" class="alarm-detail__memo-meta">
            <span v-if="alarm.stickyMemo.author"><strong>Author:</strong> {{ alarm.stickyMemo.author }}</span>
            <span v-if="alarm.stickyMemo.updated"><strong>Updated:</strong> <span v-date>{{ alarm.stickyMemo.updated }}</span></span>
            <span v-if="alarm.stickyMemo.created"><strong>Created:</strong> <span v-date>{{ alarm.stickyMemo.created }}</span></span>
          </div>
        </div>
      </div>

      <div class="feather-col-6">
        <div class="card">
          <div class="headline4 card__section-title">Journal Memo</div>
          <textarea
            v-model="journalMemoBody"
            :disabled="readOnlyRole"
            class="alarm-detail__memo-textarea"
            rows="5"
          ></textarea>
          <div class="alarm-detail__memo-actions">
            <FeatherButton secondary :disabled="readOnlyRole || memoInFlight" @click="saveMemo('journal')">
              Save
            </FeatherButton>
            <FeatherButton
              secondary
              :disabled="readOnlyRole || memoInFlight || !alarm.reductionKeyMemo?.body"
              @click="deleteMemo('journal')"
            >
              Delete
            </FeatherButton>
          </div>
          <div v-if="alarm.reductionKeyMemo" class="alarm-detail__memo-meta">
            <span v-if="alarm.reductionKeyMemo.author"><strong>Author:</strong> {{ alarm.reductionKeyMemo.author }}</span>
            <span v-if="alarm.reductionKeyMemo.updated"><strong>Updated:</strong> <span v-date>{{ alarm.reductionKeyMemo.updated }}</span></span>
            <span v-if="alarm.reductionKeyMemo.created"><strong>Created:</strong> <span v-date>{{ alarm.reductionKeyMemo.created }}</span></span>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import useAlarmDetail from '@/composables/useAlarmDetail'
import useRole from '@/composables/useRole'
import useSnackbar from '@/composables/useSnackbar'
import { modifyAlarm, saveStickyMemo, deleteStickyMemo, saveJournalMemo, deleteJournalMemo } from '@/services/alarmService'
import { useMenuStore } from '@/stores/menuStore'
import { useInfoStore } from '@/stores/infoStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const infoStore = useInfoStore()
const id = route.params.id as string

const { alarm, acknowledgments, relatedEvents, loading, error, refresh } = useAlarmDetail(id)
const { readOnlyRole } = useRole()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Alarms', to: '/opennms/alarm/index.htm', isAbsoluteLink: true },
  {
    label: alarm.value
      ? `${alarm.value.isSituation ? 'Situation' : 'Alarm'} ${alarm.value.id}`
      : `Alarm ${id}`,
    to: '#',
    position: 'last'
  }
])

const severityClass = computed<string>(() =>
  alarm.value ? `${alarm.value.severity.toLowerCase()}-color` : ''
)

const ticketerEnabled = computed<boolean>(
  () => infoStore.info?.ticketerConfig?.enabled === true
)

// Severity-based action visibility
const SEVERITY_ORDER = ['INDETERMINATE', 'CLEARED', 'NORMAL', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL']
const severityIdx = computed(() =>
  alarm.value ? SEVERITY_ORDER.indexOf(alarm.value.severity.toUpperCase()) : -1
)
const showEscalate = computed(() => {
  const sev = alarm.value?.severity.toUpperCase()
  if (!sev) return false
  return sev === 'CLEARED' ||
    (severityIdx.value > SEVERITY_ORDER.indexOf('NORMAL') &&
     severityIdx.value < SEVERITY_ORDER.indexOf('CRITICAL'))
})
const showClear = computed(() =>
  severityIdx.value >= SEVERITY_ORDER.indexOf('NORMAL') &&
  severityIdx.value <= SEVERITY_ORDER.indexOf('CRITICAL')
)

// Ack state
const isAcknowledged = computed(() => !!alarm.value?.ackTime)

// Ticket button states
const canCreateTicket = computed(() =>
  !alarm.value?.troubleTicketState || alarm.value.troubleTicketState === 'CREATE_FAILED'
)
const canUpdateTicket = computed(() => !!alarm.value?.troubleTicketId)
const canCloseTicket = computed(() =>
  alarm.value?.troubleTicketState === 'OPEN' ||
  alarm.value?.troubleTicketState === 'CLOSE_FAILED'
)

// Action helpers
const actionInFlight = ref(false)

const toggleAck = async () => {
  actionInFlight.value = true
  const result = await modifyAlarm(id, { ack: !isAcknowledged.value })
  if (result === false) {
    showSnackBar({ msg: 'Failed to update alarm', error: true })
  } else {
    await refresh()
  }
  actionInFlight.value = false
}

const doEscalate = async () => {
  actionInFlight.value = true
  const result = await modifyAlarm(id, { escalate: true })
  if (result === false) {
    showSnackBar({ msg: 'Failed to escalate alarm', error: true })
  } else {
    await refresh()
  }
  actionInFlight.value = false
}

const doClear = async () => {
  actionInFlight.value = true
  const result = await modifyAlarm(id, { clear: true })
  if (result === false) {
    showSnackBar({ msg: 'Failed to clear alarm', error: true })
  } else {
    await refresh()
  }
  actionInFlight.value = false
}

// Ticket actions: programmatic form POST to legacy Spring MVC endpoints.
// Controller will process and redirect back to alarm/detail.htm?id=X,
// which then redirects to /#/alarm/X via our new redirect.
const ticketAction = (action: 'create' | 'update' | 'close') => {
  const csrfToken = document.cookie
    .split('; ')
    .find(c => c.startsWith('XSRF-TOKEN='))
    ?.split('=')[1]

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = `/opennms/alarm/ticket/${action}.htm`
  form.style.display = 'none'

  const alarmInput = document.createElement('input')
  alarmInput.name = 'alarm'
  alarmInput.value = id
  form.appendChild(alarmInput)

  // redirect back to legacy URL, which will redirect to Vue via our controller patch
  const redirectInput = document.createElement('input')
  redirectInput.name = 'redirect'
  redirectInput.value = `/alarm/detail.htm?id=${id}`
  form.appendChild(redirectInput)

  if (csrfToken) {
    const csrf = document.createElement('input')
    csrf.name = '_csrf'
    csrf.value = decodeURIComponent(csrfToken)
    form.appendChild(csrf)
  }

  document.body.appendChild(form)
  form.submit()
}

// Memo state — sync from alarm on load/refresh
const stickyMemoBody = ref('')
const journalMemoBody = ref('')
const memoInFlight = ref(false)

watch(
  () => alarm.value,
  (a) => {
    if (a) {
      stickyMemoBody.value = a.stickyMemo?.body ?? ''
      journalMemoBody.value = a.reductionKeyMemo?.body ?? ''
    }
  },
  { immediate: true }
)

const saveMemo = async (type: 'sticky' | 'journal') => {
  memoInFlight.value = true
  const body = type === 'sticky' ? stickyMemoBody.value : journalMemoBody.value
  const ok = type === 'sticky'
    ? await saveStickyMemo(id, body)
    : await saveJournalMemo(id, body)
  if (!ok) {
    showSnackBar({ msg: `Failed to save ${type} memo`, error: true })
  } else {
    await refresh()
  }
  memoInFlight.value = false
}

const deleteMemo = async (type: 'sticky' | 'journal') => {
  memoInFlight.value = true
  const ok = type === 'sticky'
    ? await deleteStickyMemo(id)
    : await deleteJournalMemo(id)
  if (!ok) {
    showSnackBar({ msg: `Failed to delete ${type} memo`, error: true })
  } else {
    await refresh()
  }
  memoInFlight.value = false
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";
@import "@/styles/severities";

.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;

  &__section-title {
    margin-bottom: 12px;
  }

  &__body {
    :deep(p) { margin: 0; }
  }
}

.alarm-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }
  &__empty    { color: var($secondary-text-on-surface); font-style: italic; }

  &__header {
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 4px;
  }

  &__severity {
    margin-top: 4px;
    text-transform: capitalize;
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

    dd { margin: 0; word-break: break-word; }
  }

  &__uei {
    word-break: break-all;
    font-family: monospace;
    font-size: 0.875rem;
  }

  &__reduction-key {
    word-break: break-all;
    font-family: monospace;
    font-size: 0.875rem;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 16px;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;

    th, td {
      @include body-small;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var($border-light-on-surface);
    }

    th {
      @include subtitle2;
      color: var($secondary-text-on-surface);
      font-weight: 600;
    }

    tbody tr:hover { background: var($shade-4); }

    a {
      color: var($clickable-normal);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  }

  &__log-msg {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__memo-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    background: var($surface);
    color: var($primary-text-on-surface);
    font-family: inherit;
    font-size: 0.875rem;
    resize: vertical;
    margin-bottom: 8px;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__memo-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__memo-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    @include body-small;
    color: var($secondary-text-on-surface);
  }
}

// Row severity tinting for related alarm/situation/event tables
// Using Feather DS severity variables via utils.alpha (same as _severities.scss)
@use '@featherds/styles/themes/utils';
@use '@featherds/styles/themes/variables' as fvars;

$row-opacity: 0.08;
.row {
  &--critical      { background: utils.alpha(fvars.$error, $row-opacity); }
  &--major         { background: utils.alpha(fvars.$major, $row-opacity); }
  &--minor         { background: utils.alpha(fvars.$minor, $row-opacity); }
  &--warning       { background: utils.alpha(fvars.$warning, $row-opacity); }
  &--normal        { background: utils.alpha(fvars.$success, $row-opacity); }
  &--cleared,
  &--unacknowledged { background: utils.alpha(fvars.$cleared, $row-opacity); }
  &--indeterminate { background: utils.alpha(fvars.$indeterminate, $row-opacity); }
}
</style>
```

- [ ] **Step 2: Build — confirm no TypeScript or compile errors**

```bash
cd ui && npm run build 2>&1 | grep -E "error TS|ERROR|✗"
```
Expected: clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/containers/AlarmDetail.vue
git commit -m "feat(alarm-detail): add AlarmDetail.vue container with full feature parity"
```

---

## Task 6: Patch `AlarmDetailController.java`

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/alarm/AlarmDetailController.java`

- [ ] **Step 1: Add the redirect block to `detail()`**

Open `AlarmDetailController.java`. Find the `detail()` method which begins at:

```java
public ModelAndView detail(HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) throws Exception {
    OnmsAlarm alarm = null;
    XssRequestWrapper safeRequest = new XssRequestWrapper(httpServletRequest);
```

Insert the redirect block as the very first thing inside the method body, before any existing logic:

```java
public ModelAndView detail(HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) throws Exception {
    // Redirect to Vue SPA — set opennms.alarms.vueEnabled=false in opennms.conf to revert to legacy view
    if (!"false".equals(System.getProperty("opennms.alarms.vueEnabled", "true"))) {
        final String alarmId = httpServletRequest.getParameter("id");
        if (alarmId != null && !alarmId.isEmpty()) {
            httpServletResponse.sendRedirect(httpServletRequest.getContextPath() + "/ui/index.html#/alarm/" + alarmId);
            return null;
        }
    }

    OnmsAlarm alarm = null;
    XssRequestWrapper safeRequest = new XssRequestWrapper(httpServletRequest);
```

Leave all existing code below unchanged.

- [ ] **Step 2: Confirm the Java file compiles**

This is a Maven project. Run a targeted compile to catch Java errors without a full build:

```bash
cd opennms-webapp && ../../maven/bin/mvn compile -q -DskipTests 2>&1 | tail -20
```
Expected: `BUILD SUCCESS`. If there are errors, they will be in the output above.

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/alarm/AlarmDetailController.java
git commit -m "feat(alarm-detail): redirect alarm/detail.htm to Vue SPA (system-property gated)"
```

---

## Task 7: Build, Deploy, and Verify

- [ ] **Step 1: Build the Vue assets**

```bash
cd ui && npm run build
```
Expected: clean build. Check output for any warnings about unresolved imports.

- [ ] **Step 2: Verify no bare CSS variable references in built output**

```bash
grep -r "\-\-feather-" ui/src/main/dist/assets/*.css | grep -v "var(--feather" | head -5
```
Expected: no output (bare `--feather-*` values would indicate lightningcss stripped `var()` wrappers — if found, check `vite.config.ts` has `cssMinify: 'esbuild'`).

- [ ] **Step 3: Deploy to test container**

Follow the overlay build procedure documented in `reference_overlay_build_checklist.md`. Typically:

```bash
./build-dark-mode-overlay.sh
```

Then restart the container and wait for health (cap at 60s per `feedback_container_startup_time`).

- [ ] **Step 4: Verify redirect**

Navigate to:
```
http://localhost:8980/opennms/alarm/detail.htm?id=1
```
Expected: browser redirects to `http://localhost:8980/opennms/ui/index.html#/alarm/1` and the Vue page loads.

- [ ] **Step 5: Verify revert path**

Temporarily add `opennms.alarms.vueEnabled=false` to `etc/opennms.conf` in the container and restart. Navigate to `alarm/detail.htm?id=1` — confirm the legacy JSP renders. Remove the property and restart again.

- [ ] **Step 6: Verify all page sections**

Using an alarm that is known to have data (severity, node, ack history, memos if possible):

```
✓ Header shows correct "Alarm N" or "Situation N" label with severity color
✓ Details grid: node links to /#/node/:id, last event links to /#/event/:id
✓ Interface/service links go to legacy JSPs
✓ Action bar present for admin user; hidden for readonly user
✓ Ack button toggles label after click, alarm data refreshes
✓ Escalate/Clear shown/hidden per severity logic
✓ Related Events table present; event IDs link to /#/event/:id
✓ Acknowledgements card hidden when no ack history
✓ Sticky and journal memo textareas populate with existing content
✓ Memo Save round-trips: author + timestamps appear after save
✓ Memo Delete clears content and metadata
✓ Light and dark mode: no broken contrast, no hardcoded colors
✓ Cards have rounded corners
```

- [ ] **Step 7: Update EventDetail.vue to link alarm ID to Vue route**

In `ui/src/containers/EventDetail.vue`, find the alarm link (currently points to legacy JSP):

```vue
<!-- TODO: link to Vue alarm detail once available -->
<a :href="`/opennms/alarm/detail.htm?id=${event.alarmId}`">{{ event.alarmId }}</a>
```

Replace with:

```vue
<router-link :to="`/alarm/${event.alarmId}`">{{ event.alarmId }}</router-link>
```

- [ ] **Step 8: Rebuild and redeploy, confirm event→alarm navigation works**

```bash
cd ui && npm run build
```

Redeploy overlay. Navigate to an event that has an alarm ID — confirm clicking the alarm link navigates to the Vue alarm detail page within the SPA.

- [ ] **Step 9: Final commit**

```bash
git add ui/src/containers/EventDetail.vue ui/src/main/dist/
git commit -m "feat(alarm-detail): update EventDetail to link alarm ID to Vue SPA route"
```

---

## Post-Implementation Notes

- **Memo endpoint verification**: If memo save/delete returns errors in the browser console, verify the correct HTTP method by checking `GET /api/v2/alarms/{id}` response shape and testing `PUT` vs `POST` against the live API. Update `alarmService.ts` accordingly.
- **`relatedSituations` field name**: The spec notes that the exact v2 API field name for parent situations needs verification against the live response. If `relatedSituations` is null but the alarm is known to be part of a situation, check the raw API response and update the type + template binding.
- **Alarm list page**: `alarm/index.htm` is not redirected in this phase. That is a separate spec/plan.
