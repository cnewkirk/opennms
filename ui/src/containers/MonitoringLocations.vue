<template>
  <div class="locations-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="locations-page__header feather-row">
      <div class="feather-col-6">
        <h2 class="headline4">Monitoring Locations</h2>
      </div>
      <div class="feather-col-6 locations-page__actions">
        <Button label="Add Location" @click="openCreate" />
      </div>
    </div>

    <div v-if="loading" class="locations-page__status">Loading…</div>
    <div v-else-if="loadError" class="locations-page__status locations-page__status--error">
      Failed to load monitoring locations.
    </div>
    <div v-else-if="!locations.length" class="locations-page__status">
      No monitoring locations found.
    </div>

    <table v-else class="locations-table">
      <thead>
        <tr>
          <th>Location Name</th>
          <th>Monitoring Area</th>
          <th>Priority</th>
          <th>Geolocation</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="loc in locations" :key="loc['location-name']">
          <td class="locations-table__name">{{ loc['location-name'] }}</td>
          <td>{{ loc['monitoring-area'] || '—' }}</td>
          <td>{{ loc.priority }}</td>
          <td>{{ loc.geolocation || '—' }}</td>
          <td class="locations-table__actions">
            <Button text label="Edit" @click="openEdit(loc)" />
            <Button text label="Delete" class="locations-table__delete" @click="confirmDelete(loc)" />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Add / Edit dialog -->
    <Dialog
      v-model:visible="showForm"
      :header="editingName ? 'Edit Location' : 'Add Location'"
      :modal="true"
      :closable="true"
    >
      <div class="loc-form">
        <div class="loc-form__row">
          <label class="loc-form__label">Location Name <span class="loc-form__required">*</span></label>
          <input
            v-model="form['location-name']"
            :disabled="!!editingName"
            type="text"
            class="loc-form__input"
            placeholder="e.g. Boston"
          />
        </div>
        <div class="loc-form__row">
          <label class="loc-form__label">Monitoring Area</label>
          <input v-model="form['monitoring-area']" type="text" class="loc-form__input" placeholder="e.g. 10.0.0.0/8" />
        </div>
        <div class="loc-form__row">
          <label class="loc-form__label">Priority</label>
          <input v-model.number="form.priority" type="number" class="loc-form__input" min="1" />
        </div>
        <div class="loc-form__row">
          <label class="loc-form__label">Geolocation</label>
          <input v-model="form.geolocation" type="text" class="loc-form__input" placeholder="e.g. 42.3601,-71.0589" />
        </div>
        <div class="loc-form__row loc-form__row--halves">
          <div>
            <label class="loc-form__label">Latitude</label>
            <input v-model.number="form.latitude" type="number" step="any" class="loc-form__input" />
          </div>
          <div>
            <label class="loc-form__label">Longitude</label>
            <input v-model.number="form.longitude" type="number" step="any" class="loc-form__input" />
          </div>
        </div>
        <div v-if="formError" class="loc-form__error">{{ formError }}</div>
      </div>
      <template #footer>
        <Button :label="saving ? 'Saving…' : editingName ? 'Update' : 'Create'" @click="submitForm" :disabled="saving" />
        <Button text label="Cancel" @click="showForm = false" />
      </template>
    </Dialog>

    <!-- Delete confirmation dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      :header="`Delete: ${deletingName ?? ''}`"
      :modal="true"
      :closable="true"
    >
      <p>Delete location <strong>{{ deletingName }}</strong>? Any nodes assigned to this location must be reassigned first.</p>
      <template #footer>
        <Button :label="deleting ? 'Deleting…' : 'Delete'" class="locations-page__delete-confirm" @click="doDelete" :disabled="deleting" />
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
  getMonitoringLocations,
  createMonitoringLocation,
  updateMonitoringLocation,
  deleteMonitoringLocation
} from '@/services/monitoringLocationService'
import useSnackbar from '@/composables/useSnackbar'
import type { MonitoringLocation } from '@/types'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Monitoring Locations', to: '#', position: 'last' }
]

const locations = ref<MonitoringLocation[]>([])
const loading = ref(true)
const loadError = ref(false)

// Form state
const showForm = ref(false)
const editingName = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref<Partial<MonitoringLocation>>({})

// Delete state
const showDeleteDialog = ref(false)
const deletingName = ref<string | null>(null)
const deleting = ref(false)

const load = async () => {
  loading.value = true
  loadError.value = false
  const result = await getMonitoringLocations()
  if (result === false) {
    loadError.value = true
  } else {
    locations.value = result.location
  }
  loading.value = false
}

const openCreate = () => {
  editingName.value = null
  form.value = { priority: 100, tags: [] }
  formError.value = ''
  showForm.value = true
}

const openEdit = (loc: MonitoringLocation) => {
  editingName.value = loc['location-name']
  form.value = {
    'location-name': loc['location-name'],
    'monitoring-area': loc['monitoring-area'],
    priority: loc.priority,
    geolocation: loc.geolocation ?? undefined,
    latitude: loc.latitude ?? undefined,
    longitude: loc.longitude ?? undefined,
    tags: [...(loc.tags ?? [])]
  }
  formError.value = ''
  showForm.value = true
}

const submitForm = async () => {
  if (!form.value['location-name']?.trim()) {
    formError.value = 'Location name is required.'
    return
  }
  saving.value = true
  formError.value = ''
  let ok: boolean
  if (editingName.value) {
    ok = await updateMonitoringLocation(editingName.value, form.value)
  } else {
    ok = await createMonitoringLocation(form.value)
  }
  saving.value = false
  if (ok) {
    showForm.value = false
    showSnackBar({ msg: editingName.value ? 'Location updated.' : 'Location created.' })
    await load()
  } else {
    formError.value = editingName.value ? 'Failed to update location.' : 'Failed to create location. The name may already be in use.'
  }
}

const confirmDelete = (loc: MonitoringLocation) => {
  deletingName.value = loc['location-name']
  showDeleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingName.value) return
  deleting.value = true
  const ok = await deleteMonitoringLocation(deletingName.value)
  deleting.value = false
  if (ok) {
    showDeleteDialog.value = false
    showSnackBar({ msg: `Location "${deletingName.value}" deleted.` })
    await load()
  } else {
    showSnackBar({ msg: `Failed to delete "${deletingName.value}". Ensure no nodes are assigned to it.`, error: true })
    showDeleteDialog.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.locations-page {
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

.locations-table {
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

  &__name {
    font-weight: 500;
  }

  &__actions {
    white-space: nowrap;
    text-align: right;
  }

  &__delete {
    color: var($error) !important;
  }
}

.loc-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 360px;

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

  &__required {
    color: var($error);
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

  &__error {
    color: var($error);
    font-size: 13px;
  }
}
</style>
