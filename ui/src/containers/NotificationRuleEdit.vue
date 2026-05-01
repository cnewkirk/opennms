<template>
  <div class="rule-edit-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="rule-edit-page__header feather-row">
      <div class="feather-col-8">
        <h2 class="headline4">{{ isNew ? 'New Notification Rule' : `Edit: ${ruleName}` }}</h2>
      </div>
      <div class="feather-col-4 rule-edit-page__header-actions">
        <Button severity="secondary" label="Cancel" @click="router.push('/notification-config/rules')" />
        <Button :disabled="saving" @click="save" :label="saving ? 'Saving…' : 'Save'" />
      </div>
    </div>

    <div v-if="loading" class="rule-edit-page__status">Loading…</div>
    <div v-else-if="loadError" class="rule-edit-page__status rule-edit-page__status--error">
      Failed to load notification rule.
    </div>

    <template v-if="!loading && !loadError">
      <!-- Card 1: Identity -->
      <div class="notif-card">
        <div class="notif-card__header">Identity</div>
        <div class="notif-card__body">
          <div class="form-row">
            <label class="form-label">Name <span class="required">*</span></label>
            <input v-model="rule.name" class="form-input" :disabled="!isNew" placeholder="Rule name" />
          </div>
          <div class="form-row">
            <label class="form-label">Status</label>
            <select v-model="rule.status" class="form-select">
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Description</label>
            <input v-model="rule.description" class="form-input" placeholder="Optional description" />
          </div>
          <div class="form-row">
            <label class="form-label">Event UEI <span class="required">*</span></label>
            <input v-model="rule.uei" class="form-input" list="uei-list" placeholder="uei.opennms.org/…" />
            <datalist id="uei-list">
              <option v-for="u in ueiList" :key="u" :value="u" />
            </datalist>
          </div>
        </div>
      </div>

      <!-- Card 2: Filter Rule -->
      <div class="notif-card">
        <div class="notif-card__header">Filter Rule</div>
        <div class="notif-card__body">
          <div class="form-row">
            <label class="form-label">Rule <span class="required">*</span></label>
            <textarea v-model="rule.rule" class="form-textarea" rows="3" placeholder="IPADDR != '0.0.0.0'" />
          </div>
          <div class="form-row form-row--inline">
            <Button severity="secondary" :disabled="validating" @click="validateRule" :label="validating ? 'Validating…' : 'Validate Rule'" />
            <span v-if="validateResult === 'ok'" class="validate-ok">Rule is valid.</span>
            <span v-else-if="validateResult" class="validate-error">{{ validateResult }}</span>
          </div>
        </div>
      </div>

      <!-- Card 3: Message -->
      <div class="notif-card">
        <div class="notif-card__header">Message</div>
        <div class="notif-card__body">
          <div class="form-row">
            <label class="form-label">Text Message <span class="required">*</span></label>
            <textarea v-model="rule.textMessage" class="form-textarea" rows="4" placeholder="Message body…" />
          </div>
          <div class="form-row">
            <label class="form-label">Subject</label>
            <input v-model="rule.subject" class="form-input" placeholder="Email subject" />
          </div>
          <div class="form-row">
            <label class="form-label">Numeric Message</label>
            <input v-model="rule.numericMessage" class="form-input" placeholder="Numeric pager message" />
          </div>
          <div class="form-row">
            <label class="form-label">Event Severity</label>
            <select v-model="rule.eventSeverity" class="form-select">
              <option value="">Any</option>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
              <option value="Warning">Warning</option>
              <option value="Indeterminate">Indeterminate</option>
              <option value="Normal">Normal</option>
              <option value="Cleared">Cleared</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Card 4: Destination -->
      <div class="notif-card">
        <div class="notif-card__header">Destination</div>
        <div class="notif-card__body">
          <div class="form-row">
            <label class="form-label">Destination Path <span class="required">*</span></label>
            <select v-model="rule.destinationPath" class="form-select">
              <option v-for="p in destinationPaths" :key="p.name" :value="p.name">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Notice Queue</label>
            <input v-model="rule.noticeQueue" class="form-input" placeholder="Optional queue name" />
          </div>
          <div class="form-row">
            <label class="form-label">Varbind Name</label>
            <input v-model="varbindName" class="form-input" placeholder="Variable binding name" />
          </div>
          <div class="form-row">
            <label class="form-label">Varbind Value</label>
            <input v-model="varbindValue" class="form-input" placeholder="Variable binding value" />
          </div>

          <div class="form-section-header">Parameters</div>
          <div v-for="(param, idx) in rule.parameters" :key="idx" class="form-dynamic-row">
            <input v-model="param.name" class="form-input form-input--half" placeholder="Name" />
            <input v-model="param.value" class="form-input form-input--half" placeholder="Value" />
            <button class="btn-remove" @click="rule.parameters!.splice(idx, 1)">✕</button>
          </div>
          <Button text label="+ Add Parameter" @click="addParam" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import useSnackbar from '@/composables/useSnackbar'
import notificationConfigService, { NotificationConfigDTO, ParameterDTO } from '@/services/notificationConfigService'
import destinationPathService, { DestinationPathDTO } from '@/services/destinationPathService'
import { v2, rest } from '@/services/axiosInstances'
import { BreadCrumb } from '@/types'

const router = useRouter()
const route = useRoute()
const { showSnackBar } = useSnackbar()

const ruleName = route.params.name as string | undefined
const isNew = !ruleName

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Notification Configuration', to: '/notification-config' },
  { label: 'Rules', to: '/notification-config/rules' },
  { label: isNew ? 'New Rule' : (ruleName ?? ''), to: '#', position: 'last' }
]

const defaultRule: NotificationConfigDTO = {
  name: '',
  status: 'on',
  uei: '',
  rule: "IPADDR != '0.0.0.0'",
  destinationPath: '',
  textMessage: '',
  subject: null,
  numericMessage: null,
  eventSeverity: null,
  noticeQueue: null,
  varbind: null,
  parameters: []
}

const rule = ref<NotificationConfigDTO>({ ...defaultRule, parameters: [] })
const loading = ref(!isNew)
const loadError = ref(false)
const saving = ref(false)
const validating = ref(false)
const validateResult = ref<string | null>(null)

const ueiList = ref<string[]>([])
const destinationPaths = ref<DestinationPathDTO[]>([])

const varbindName = computed({
  get: () => rule.value.varbind?.vbname ?? '',
  set: (v) => {
    if (!rule.value.varbind) rule.value.varbind = { vbname: '', vbvalue: '' }
    rule.value.varbind.vbname = v
  }
})

const varbindValue = computed({
  get: () => rule.value.varbind?.vbvalue ?? '',
  set: (v) => {
    if (!rule.value.varbind) rule.value.varbind = { vbname: '', vbvalue: '' }
    rule.value.varbind.vbvalue = v
  }
})

onMounted(async () => {
  const [paths, ueis] = await Promise.all([
    destinationPathService.getDestinationPaths(),
    loadUeis()
  ])
  destinationPaths.value = paths
  ueiList.value = ueis

  if (!isNew && ruleName) {
    const existing = await notificationConfigService.getNotificationConfig(ruleName)
    if (existing) {
      rule.value = { ...existing, parameters: existing.parameters ?? [] }
    } else {
      loadError.value = true
    }
    loading.value = false
  } else {
    if (paths.length > 0) rule.value.destinationPath = paths[0].name
  }
})

async function loadUeis(): Promise<string[]> {
  try {
    const resp = await rest.get<string[]>('/events/ueis')
    return Array.isArray(resp.data) ? resp.data : []
  } catch { return [] }
}

async function validateRule() {
  validating.value = true
  validateResult.value = null
  try {
    await v2.post('/filterRule/validate', { rule: rule.value.rule }, {
      headers: { 'Content-Type': 'application/json' }
    })
    validateResult.value = 'ok'
  } catch (e: any) {
    validateResult.value = e?.response?.data?.error ?? 'Invalid rule.'
  } finally {
    validating.value = false
  }
}

function addParam() {
  if (!rule.value.parameters) rule.value.parameters = []
  rule.value.parameters.push({ name: '', value: '' })
}

async function save() {
  if (!rule.value.name?.trim()) {
    showSnackBar({ msg: 'Rule name is required.' })
    return
  }
  if (!rule.value.uei?.trim()) {
    showSnackBar({ msg: 'Event UEI is required.' })
    return
  }
  if (!rule.value.destinationPath?.trim()) {
    showSnackBar({ msg: 'Destination path is required.' })
    return
  }
  if (!rule.value.textMessage?.trim()) {
    showSnackBar({ msg: 'Text message is required.' })
    return
  }

  // Clean up empty varbind
  if (rule.value.varbind && !rule.value.varbind.vbname && !rule.value.varbind.vbvalue) {
    rule.value.varbind = null
  }

  saving.value = true
  let ok: boolean
  if (isNew) {
    ok = await notificationConfigService.createNotificationConfig(rule.value)
  } else {
    ok = await notificationConfigService.saveNotificationConfig(ruleName!, rule.value)
  }

  if (ok) {
    showSnackBar({ msg: `Rule "${rule.value.name}" saved.` })
    router.push('/notification-config/rules')
  } else {
    showSnackBar({ msg: 'Failed to save rule.' })
  }
  saving.value = false
}
</script>

<style lang="scss" scoped>
.rule-edit-page {
  padding: 1.5rem;

  &__header {
    align-items: center;
    margin-bottom: 1.5rem;
  }

  &__header-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
  }

  &__status {
    color: var(--feather-secondary-text-on-surface);
    padding: 1rem 0;

    &--error {
      color: var(--feather-error);
    }
  }
}

.notif-card {
  background: var(--feather-surface);
  border-radius: 6px;
  border: 1px solid var(--feather-border-on-surface);
  margin-bottom: 1.5rem;

  &__header {
    font-weight: 600;
    font-size: 1rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--feather-border-on-surface);
    color: var(--feather-primary-text-on-surface);
  }

  &__body {
    padding: 1.25rem;
  }
}

.form-row {
  margin-bottom: 1rem;

  &--inline {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--feather-secondary-text-on-surface);
  margin-bottom: 0.35rem;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 4px;
  background: var(--feather-surface);
  color: var(--feather-primary-text-on-surface);
  font-size: 0.9rem;
  box-sizing: border-box;

  &:focus {
    outline: 2px solid var(--feather-primary);
    outline-offset: -1px;
  }

  &--half {
    width: calc(50% - 1.5rem);
  }
}

.form-textarea {
  resize: vertical;
  font-family: monospace;
  font-size: 0.85rem;
}

.form-section-header {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--feather-secondary-text-on-surface);
  margin: 1rem 0 0.5rem;
}

.form-dynamic-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.btn-remove {
  background: none;
  border: none;
  color: var(--feather-error);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;

  &:hover {
    opacity: 0.7;
  }
}

.required {
  color: var(--feather-error);
}

.validate-ok {
  color: var(--feather-success);
  font-size: 0.875rem;
}

.validate-error {
  color: var(--feather-error);
  font-size: 0.875rem;
}
</style>
