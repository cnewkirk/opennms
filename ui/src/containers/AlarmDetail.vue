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
            <dd><SeverityBadge :severity="alarm.severity" /></dd>

            <dt>Node</dt>
            <dd>
              <router-link v-if="alarm.nodeId" :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link>
              <span v-else>&mdash;</span>
            </dd>

            <dt>Interface</dt>
            <dd>
              <router-link
                v-if="alarm.ipAddress && alarm.nodeId"
                :to="`/interface/${alarm.nodeId}/${alarm.ipAddress}`"
              >{{ alarm.ipAddress }}</router-link>
              <span v-else-if="alarm.ipAddress">{{ alarm.ipAddress }}</span>
              <span v-else>&mdash;</span>
            </dd>

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

            <dt>UEI</dt>
            <dd class="alarm-detail__uei">{{ alarm.uei }}</dd>

            <dt>Last Event</dt>
            <dd>
              <router-link v-if="alarm.lastEvent" :to="`/event/${alarm.lastEvent.id}`">
                <span v-date>{{ alarm.lastEventTime }}</span>
              </router-link>
              <span v-else v-date>{{ alarm.lastEventTime }}</span>
            </dd>

            <dt>First Event</dt>
            <dd v-date>{{ alarm.firstEventTime }}</dd>

            <dt>Count</dt>
            <dd>{{ alarm.count }}</dd>

            <template v-if="alarm.managedObjectType">
              <dt>Managed Object Type</dt>
              <dd>{{ alarm.managedObjectType }}</dd>
            </template>

            <template v-if="alarm.managedObjectInstance">
              <dt>Managed Object Instance</dt>
              <dd>{{ alarm.managedObjectInstance }}</dd>
            </template>

            <template v-if="alarm.troubleTicket">
              <dt>Ticket ID</dt>
              <dd>{{ alarm.troubleTicket }}</dd>
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
          <Button severity="secondary" :disabled="actionInFlight" @click="toggleAck" :label="isAcknowledged ? 'Unacknowledge' : 'Acknowledge'" />
          <Button v-if="showEscalate" severity="secondary" :disabled="actionInFlight" @click="doEscalate" label="Escalate" />
          <Button v-if="showClear" severity="secondary" :disabled="actionInFlight" @click="doClear" label="Clear" />
          <template v-if="ticketerEnabled">
            <Button severity="secondary" :disabled="!canCreateTicket" @click="ticketAction('create')" label="Create Ticket" />
            <Button severity="secondary" :disabled="!canUpdateTicket" @click="ticketAction('update')" label="Update Ticket" />
            <Button severity="secondary" :disabled="!canCloseTicket" @click="ticketAction('close')" label="Close Ticket" />
          </template>
        </div>
      </div>
    </div>

    <!-- Log Message -->
    <div v-if="alarm.logMessage" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Log Message</div>
          <!-- TODO: sanitize with DOMPurify before rendering user content -->
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
          <!-- TODO: sanitize with DOMPurify before rendering user content -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="alarm.description" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Operator Instructions -->
    <div v-if="alarm.operatorInstructions" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Operator Instructions</div>
          <!-- TODO: sanitize with DOMPurify before rendering user content -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="alarm.operatorInstructions" class="card__body"></div>
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
                <td><SeverityBadge :severity="sit.severity" /></td>
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
                <td><SeverityBadge :severity="rel.severity" /></td>
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
                <td><SeverityBadge :severity="ev.severity" /></td>
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
            <Button severity="secondary" :disabled="readOnlyRole || memoInFlight" @click="saveMemo('sticky')" label="Save" />
            <Button severity="secondary" :disabled="readOnlyRole || memoInFlight || !alarm.stickyMemo?.body" @click="deleteMemo('sticky')" label="Delete" />
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
            <Button severity="secondary" :disabled="readOnlyRole || memoInFlight" @click="saveMemo('journal')" label="Save" />
            <Button severity="secondary" :disabled="readOnlyRole || memoInFlight || !alarm.reductionKeyMemo?.body" @click="deleteMemo('journal')" label="Delete" />
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
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
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
const canUpdateTicket = computed(() => !!alarm.value?.troubleTicket)
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

  if (!csrfToken) {
    showSnackBar({ msg: 'Cannot submit: CSRF token missing. Try reloading the page.', error: true })
    return
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
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/utils';
@use "@/styles/tokens" as fvars;
@import "@/styles/tokens";
@import "@featherds/styles/mixins/elevation";
@import "@/styles/typography";
@import "@/styles/severities";

.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: vars.$border-radius-surface;

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
    margin-bottom: 16px;
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
    border-radius: vars.$border-radius-surface;
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

// border-left on <tr> is ignored in border-separate mode; target first td instead
$row-opacity: 0.15;
.row {
  &--critical      { background: utils.alpha(fvars.$error,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-error); } }
  &--major         { background: utils.alpha(fvars.$major,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-major); } }
  &--minor         { background: utils.alpha(fvars.$minor,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-minor); } }
  &--warning       { background: utils.alpha(fvars.$warning,       $row-opacity); td:first-child { border-left: 3px solid var(--feather-warning); } }
  &--normal        { background: utils.alpha(fvars.$success,       $row-opacity); td:first-child { border-left: 3px solid var(--feather-success); } }
  &--cleared,
  &--unacknowledged { background: utils.alpha(fvars.$cleared,      $row-opacity); td:first-child { border-left: 3px solid var(--feather-cleared); } }
  &--indeterminate { background: utils.alpha(fvars.$indeterminate, $row-opacity); td:first-child { border-left: 3px solid var(--feather-indeterminate); } }
}

// Severity header card tinting — {severity}-color applied to alarm-detail__header.
// These must live here because _severities.scss is not a global stylesheet.
$header-opacity: 0.2;
.critical-color       { background: utils.alpha(fvars.$error,         $header-opacity); border-left: 4px solid var(--feather-error); }
.major-color          { background: utils.alpha(fvars.$major,         $header-opacity); border-left: 4px solid var(--feather-major); }
.minor-color          { background: utils.alpha(fvars.$minor,         $header-opacity); border-left: 4px solid var(--feather-minor); }
.warning-color        { background: utils.alpha(fvars.$warning,       $header-opacity); border-left: 4px solid var(--feather-warning); }
.normal-color         { background: utils.alpha(fvars.$success,       $header-opacity); border-left: 4px solid var(--feather-success); }
.cleared-color,
.unacknowledged-color { background: utils.alpha(fvars.$cleared,       $header-opacity); border-left: 4px solid var(--feather-cleared); }
.indeterminate-color  { background: utils.alpha(fvars.$indeterminate, $header-opacity); border-left: 4px solid var(--feather-indeterminate); }
</style>
