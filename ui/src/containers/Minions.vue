<template>
  <div class="minions-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="minions-page__header feather-row">
      <div class="feather-col-12">
        <h2 class="headline4">Manage Minions</h2>
        <p class="minions-page__subtitle">Minions self-register when connected. Use this page to review status, reassign locations, or remove decommissioned minions.</p>
      </div>
    </div>

    <div v-if="loading" class="minions-page__status">Loading…</div>
    <div v-else-if="loadError" class="minions-page__status minions-page__status--error">
      Failed to load minions.
    </div>
    <div v-else-if="!minions.length" class="minions-page__empty">
      <div class="minions-page__empty-icon">—</div>
      <p class="minions-page__empty-text">No minions are currently registered.</p>
      <p class="minions-page__empty-sub">Minions appear here automatically once they connect and check in.</p>
    </div>

    <table v-else class="minions-table">
      <thead>
        <tr>
          <th>ID / Label</th>
          <th>Location</th>
          <th>Status</th>
          <th>Last Seen</th>
          <th>Version</th>
          <th>Node</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in minions" :key="m.id">
          <td class="minions-table__id">
            <div class="minions-table__label">{{ m.label || m.id }}</div>
            <div v-if="m.label && m.label !== m.id" class="minions-table__id-sub">{{ m.id }}</div>
          </td>
          <td>{{ m.location || '—' }}</td>
          <td>
            <span :class="['minions-table__status', statusClass(m.status)]">
              {{ m.status || 'Unknown' }}
            </span>
          </td>
          <td class="minions-table__date">{{ formatDate(m.date) }}</td>
          <td class="minions-table__version">{{ m.version || '—' }}</td>
          <td>
            <RouterLink
              v-if="nodeMap[`${m.id}\0${m.location}`]"
              :to="`/node/${nodeMap[m.id + '\0' + m.location]}`"
              class="minions-table__node-link"
            >
              Node {{ nodeMap[`${m.id}\0${m.location}`] }}
            </RouterLink>
            <span v-else class="minions-table__none">—</span>
          </td>
          <td class="minions-table__actions">
            <Button text label="Edit" @click="openEdit(m)" />
            <Button text label="Delete" class="minions-table__delete" @click="confirmDelete(m)" />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Edit dialog -->
    <Dialog
      v-model:visible="showForm"
      :header="`Edit Minion: ${editingId ?? ''}`"
      :modal="true"
      :closable="true"
    >
      <div class="minion-form">
        <div class="minion-form__row">
          <label class="minion-form__label">Label</label>
          <input v-model="form.label" type="text" class="minion-form__input" placeholder="Human-readable label" />
        </div>
        <div class="minion-form__row">
          <label class="minion-form__label">Location</label>
          <select v-model="form.location" class="minion-form__select">
            <option v-for="loc in locationNames" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
        <div v-if="formError" class="minion-form__error">{{ formError }}</div>
      </div>
      <template #footer>
        <Button :label="saving ? 'Saving…' : 'Update'" @click="submitEdit" :disabled="saving" />
        <Button text label="Cancel" @click="showForm = false" />
      </template>
    </Dialog>

    <!-- Delete confirmation dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      :header="`Delete: ${deletingId ?? ''}`"
      :modal="true"
      :closable="true"
    >
      <p>Remove minion <strong>{{ deletingId }}</strong>? It will reappear if the minion reconnects.</p>
      <template #footer>
        <Button :label="deleting ? 'Deleting…' : 'Delete'" class="minions-page__delete-confirm" @click="doDelete" :disabled="deleting" />
        <Button text label="Cancel" @click="showDeleteDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getMinions, updateMinion, deleteMinion, getMinionNodes } from '@/services/minionService'
import { getMonitoringLocations } from '@/services/monitoringLocationService'
import useSnackbar from '@/composables/useSnackbar'
import type { Minion } from '@/types'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Manage Minions', to: '#', position: 'last' }
]

const minions = ref<Minion[]>([])
const locationNames = ref<string[]>([])
const nodeMap = ref<Record<string, number>>({})
const loading = ref(true)
const loadError = ref(false)

// Edit state
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref<{ label: string; location: string }>({ label: '', location: '' })

// Delete state
const showDeleteDialog = ref(false)
const deletingId = ref<string | null>(null)
const deleting = ref(false)

const formatDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

const statusClass = (status: string): string => {
  const s = (status ?? '').toLowerCase()
  if (s === 'up') return 'minions-table__status--up'
  if (s === 'down') return 'minions-table__status--down'
  return 'minions-table__status--unknown'
}

const load = async () => {
  loading.value = true
  loadError.value = false

  const [minionResult, locationResult] = await Promise.all([
    getMinions(),
    getMonitoringLocations()
  ])

  if (minionResult === false) {
    loadError.value = true
    loading.value = false
    return
  }

  minions.value = minionResult.minion

  if (locationResult !== false) {
    locationNames.value = locationResult.location.map(l => l['location-name'])
  }

  if (minions.value.length) {
    nodeMap.value = await getMinionNodes(minions.value.map(m => m.id))
  }

  loading.value = false
}

const openEdit = (m: Minion) => {
  editingId.value = m.id
  form.value = { label: m.label ?? '', location: m.location ?? '' }
  formError.value = ''
  showForm.value = true
}

const submitEdit = async () => {
  if (!editingId.value) return
  saving.value = true
  formError.value = ''
  const ok = await updateMinion(editingId.value, form.value)
  saving.value = false
  if (ok) {
    showForm.value = false
    showSnackBar({ msg: 'Minion updated.' })
    await load()
  } else {
    formError.value = 'Failed to update minion.'
  }
}

const confirmDelete = (m: Minion) => {
  deletingId.value = m.id
  showDeleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingId.value) return
  deleting.value = true
  const ok = await deleteMinion(deletingId.value)
  deleting.value = false
  if (ok) {
    showDeleteDialog.value = false
    showSnackBar({ msg: `Minion "${deletingId.value}" removed.` })
    await load()
  } else {
    showSnackBar({ msg: `Failed to delete "${deletingId.value}".`, error: true })
    showDeleteDialog.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.minions-page {
  padding: 0 24px 40px;

  &__header {
    margin-bottom: 20px;

    .headline4 { margin: 0 0 4px; }
  }

  &__subtitle {
    color: var($secondary-text-on-surface);
    font-size: 14px;
    margin: 0;
  }

  &__status {
    color: var($secondary-text-on-surface);
    padding: 24px 0;

    &--error { color: var($error); }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px 24px;
    gap: 8px;
  }

  &__empty-icon {
    font-size: 48px;
    color: var($shade-3);
    line-height: 1;
  }

  &__empty-text {
    font-size: 16px;
    font-weight: 500;
    color: var($primary-text-on-surface);
    margin: 0;
  }

  &__empty-sub {
    font-size: 14px;
    color: var($secondary-text-on-surface);
    margin: 0;
  }

  &__delete-confirm {
    background: var($error) !important;
  }
}

.minions-table {
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

  &__label {
    font-weight: 500;
  }

  &__id-sub {
    font-size: 12px;
    color: var($secondary-text-on-surface);
    font-family: monospace;
    margin-top: 2px;
  }

  &__status {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;

    &--up {
      background: rgba(var(--feather-success), 0.12);
      color: var($success);
    }

    &--down {
      background: rgba(var(--feather-error), 0.12);
      color: var($error);
    }

    &--unknown {
      background: var($shade-4);
      color: var($secondary-text-on-surface);
    }
  }

  &__date {
    white-space: nowrap;
    font-size: 13px;
    color: var($secondary-text-on-surface);
  }

  &__version {
    font-size: 13px;
    font-family: monospace;
    color: var($secondary-text-on-surface);
  }

  &__node-link {
    color: var($clickable-normal);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }

  &__none {
    color: var($shade-3);
  }

  &__actions {
    white-space: nowrap;
    text-align: right;
  }

  &__delete {
    color: var($error) !important;
  }
}

.minion-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 340px;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__label {
    font-size: 13px;
    font-weight: 500;
    color: var($secondary-text-on-surface);
  }

  &__input,
  &__select {
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
  }

  &__error {
    color: var($error);
    font-size: 13px;
  }
}
</style>
