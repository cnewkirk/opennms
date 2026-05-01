<template>
  <div class="grafana-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="grafana-page__header feather-row">
      <div class="feather-col-6">
        <h2 class="headline4">Grafana Endpoints</h2>
      </div>
      <div class="feather-col-6 grafana-page__actions">
        <Button label="Add Endpoint" @click="openCreate" />
      </div>
    </div>

    <div v-if="loading" class="grafana-page__status">Loading…</div>
    <div v-else-if="loadError" class="grafana-page__status grafana-page__status--error">
      Failed to load Grafana endpoints.
    </div>
    <div v-else-if="!endpoints.length" class="grafana-page__status">
      No Grafana endpoints configured.
    </div>

    <table v-else class="grafana-table">
      <thead>
        <tr>
          <th>Grafana ID</th>
          <th>URL</th>
          <th>API Key</th>
          <th>Description</th>
          <th>Connect Timeout (s)</th>
          <th>Read Timeout (s)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ep in endpoints" :key="ep.id">
          <td class="grafana-table__uid">{{ ep.uid }}</td>
          <td>{{ ep.url }}</td>
          <td>
            <span class="grafana-table__apikey">
              {{ revealedKeys.has(ep.id!) ? ep.apiKey : '••••••••••' }}
            </span>
            <button class="grafana-table__reveal" @click="toggleReveal(ep.id!)" :title="revealedKeys.has(ep.id!) ? 'Hide' : 'Show'">
              {{ revealedKeys.has(ep.id!) ? '🙈' : '👁' }}
            </button>
          </td>
          <td>{{ ep.description || '—' }}</td>
          <td>{{ ep.connectTimeout ?? '—' }}</td>
          <td>{{ ep.readTimeout ?? '—' }}</td>
          <td class="grafana-table__actions">
            <Button text label="Edit" @click="openEdit(ep)" />
            <Button text label="Delete" class="grafana-table__delete" @click="confirmDelete(ep)" />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Add / Edit dialog -->
    <Dialog
      v-model:visible="showForm"
      :header="form.id != null ? 'Edit Grafana Endpoint' : 'Add Grafana Endpoint'"
      :modal="true"
      :closable="true"
    >
      <div class="ep-form">
        <div class="ep-form__row">
          <label class="ep-form__label">Grafana ID <span class="ep-form__required">*</span></label>
          <input
            v-model="form.uid"
            :disabled="form.id != null"
            type="text"
            class="ep-form__input"
            placeholder="e.g. production"
          />
          <span class="ep-form__hint">Alphanumeric, hyphens and underscores only. Cannot start with - or _.</span>
        </div>
        <div class="ep-form__row">
          <label class="ep-form__label">URL <span class="ep-form__required">*</span></label>
          <input v-model="form.url" type="text" class="ep-form__input" placeholder="http://grafana:3000" />
        </div>
        <div class="ep-form__row">
          <label class="ep-form__label">API Key <span class="ep-form__required">*</span></label>
          <input v-model="form.apiKey" type="text" class="ep-form__input" placeholder="API key" />
        </div>
        <div class="ep-form__row">
          <label class="ep-form__label">Description</label>
          <input v-model="form.description" type="text" class="ep-form__input" placeholder="Optional label" />
        </div>
        <div class="ep-form__row ep-form__row--halves">
          <div>
            <label class="ep-form__label">Connect Timeout (s)</label>
            <input v-model.number="form.connectTimeout" type="number" min="0" max="9999" class="ep-form__input" />
          </div>
          <div>
            <label class="ep-form__label">Read Timeout (s)</label>
            <input v-model.number="form.readTimeout" type="number" min="0" max="9999" class="ep-form__input" />
          </div>
        </div>

        <div class="ep-form__verify">
          <Button
            label="Test Connection"
            :disabled="!form.url || !form.apiKey || verifying"
            @click="testConnection"
            severity="secondary"
          />
          <span v-if="verifying" class="ep-form__verify-status">Connecting…</span>
          <span v-else-if="verifyResult === 'ok'" class="ep-form__verify-status ep-form__verify-status--ok">Connected</span>
          <span v-else-if="verifyResult === 'fail'" class="ep-form__verify-status ep-form__verify-status--fail">Could not connect</span>
        </div>

        <div v-if="formError" class="ep-form__error">{{ formError }}</div>
      </div>
      <template #footer>
        <Button
          :label="saving ? 'Saving…' : form.id != null ? 'Update' : 'Create'"
          :disabled="saving || !form.uid || !form.url || !form.apiKey"
          @click="submitForm"
        />
        <Button text label="Cancel" @click="showForm = false" />
      </template>
    </Dialog>

    <!-- Delete confirmation dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      :header="`Delete: ${deletingEndpoint?.uid ?? ''}`"
      :modal="true"
      :closable="true"
    >
      <p>
        Delete Grafana endpoint <strong>{{ deletingEndpoint?.uid }}</strong>
        (<code>{{ deletingEndpoint?.url }}</code>)?
      </p>
      <template #footer>
        <Button
          :label="deleting ? 'Deleting…' : 'Delete'"
          class="grafana-page__delete-confirm"
          @click="doDelete"
          :disabled="deleting"
        />
        <Button text label="Cancel" @click="showDeleteDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import {
  listEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  verifyEndpoint,
  type GrafanaEndpoint
} from '@/services/grafanaEndpointService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Grafana Endpoints', to: '#', position: 'last' }
]

const endpoints = ref<GrafanaEndpoint[]>([])
const loading = ref(true)
const loadError = ref(false)
const revealedKeys = ref(new Set<number>())

const showForm = ref(false)
const saving = ref(false)
const formError = ref('')
const verifying = ref(false)
const verifyResult = ref<'ok' | 'fail' | null>(null)
const form = ref<Partial<GrafanaEndpoint>>({})

const showDeleteDialog = ref(false)
const deletingEndpoint = ref<GrafanaEndpoint | null>(null)
const deleting = ref(false)

const load = async () => {
  loading.value = true
  loadError.value = false
  const result = await listEndpoints()
  if (result === null) {
    loadError.value = true
  } else {
    endpoints.value = result
  }
  loading.value = false
}

const toggleReveal = (id: number) => {
  const s = new Set(revealedKeys.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  revealedKeys.value = s
}

const openCreate = () => {
  form.value = {}
  formError.value = ''
  verifyResult.value = null
  showForm.value = true
}

const openEdit = (ep: GrafanaEndpoint) => {
  form.value = { ...ep }
  formError.value = ''
  verifyResult.value = null
  showForm.value = true
}

const testConnection = async () => {
  verifying.value = true
  verifyResult.value = null
  const res = await verifyEndpoint(form.value as GrafanaEndpoint)
  verifying.value = false
  verifyResult.value = res.ok ? 'ok' : 'fail'
}

const submitForm = async () => {
  formError.value = ''
  saving.value = true
  let res: { ok: boolean; error?: string }
  if (form.value.id != null) {
    res = await updateEndpoint(form.value as GrafanaEndpoint)
  } else {
    res = await createEndpoint(form.value as GrafanaEndpoint)
  }
  saving.value = false
  if (res.ok) {
    showForm.value = false
    showSnackBar({ msg: form.value.id != null ? 'Endpoint updated.' : 'Endpoint created.' })
    await load()
  } else {
    formError.value = res.error ?? 'Save failed.'
  }
}

const confirmDelete = (ep: GrafanaEndpoint) => {
  deletingEndpoint.value = ep
  showDeleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingEndpoint.value?.id) return
  deleting.value = true
  const ok = await deleteEndpoint(deletingEndpoint.value.id)
  deleting.value = false
  if (ok) {
    showSnackBar({ msg: `Endpoint "${deletingEndpoint.value.uid}" deleted.` })
    showDeleteDialog.value = false
    await load()
  } else {
    showSnackBar({ msg: 'Failed to delete endpoint.', error: true })
    showDeleteDialog.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.grafana-page {
  padding: 0 24px 40px;

  &__header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    .headline4 { margin: 0; }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  &__status {
    color: var($secondary-text-on-surface);
    padding: 24px 0;

    &--error { color: var($error); }
  }

  &__delete-confirm {
    background: var($error) !important;
  }
}

.grafana-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    border-bottom: 1px solid var($shade-3);
    white-space: nowrap;
  }

  td {
    padding: 10px 12px;
    border-bottom: 1px solid var($shade-3);
    vertical-align: middle;
  }

  tbody tr:hover {
    background: var($shade-4);
  }

  &__uid {
    font-weight: 500;
  }

  &__apikey {
    font-family: monospace;
    font-size: 13px;
  }

  &__reveal {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 4px;
    font-size: 14px;
    line-height: 1;
    vertical-align: middle;
  }

  &__actions {
    white-space: nowrap;
    text-align: right;
  }

  &__delete {
    color: var($error) !important;
  }
}

.ep-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 400px;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &--halves {
      flex-direction: row;
      gap: 16px;

      > div {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    }
  }

  &__label {
    font-size: 13px;
    font-weight: 500;
    color: var($secondary-text-on-surface);
  }

  &__required { color: var($error); }

  &__hint {
    font-size: 12px;
    color: var($secondary-text-on-surface);
  }

  &__input {
    padding: 8px 10px;
    border: 1px solid var($shade-3);
    border-radius: 4px;
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var($clickable-normal);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__verify {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__verify-status {
    font-size: 13px;

    &--ok { color: var($success); }
    &--fail { color: var($error); }
  }

  &__error {
    color: var($error);
    font-size: 13px;
  }
}
</style>
