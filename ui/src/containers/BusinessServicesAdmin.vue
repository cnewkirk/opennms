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
  <div class="bsm-admin">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">Business Service Management</h1>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <div v-else-if="loadError" class="error-state">
      <p class="error-text">{{ loadError }}</p>
      <Button label="Retry" @click="loadData" />
    </div>

    <template v-else>
      <div class="toolbar">
        <Button icon="pi pi-plus" label="New Service" @click="openCreate" />
        <Button text :label="reloading ? 'Reloading…' : 'Reload Daemon'" @click="doReload" :disabled="reloading" />
      </div>

      <div v-if="services.length === 0" class="empty-state">
        No business services defined. Click <strong>New Service</strong> to create one.
      </div>

      <table v-else class="services-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Reduce Function</th>
            <th>Status</th>
            <th>Edges</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="svc in services" :key="svc.id">
            <td class="svc-name">{{ svc.name }}</td>
            <td>{{ svc['reduce-function']?.type ?? '—' }}</td>
            <td>
              <span :class="['status-chip', statusColor(svc['operational-status'])]">
                {{ svc['operational-status'] }}
              </span>
            </td>
            <td>{{ edgeCount(svc) }}</td>
            <td class="actions-cell">
              <Button text label="Edit" @click="openEdit(svc)" />
              <Button text label="Delete" class="delete-btn" @click="confirmDelete(svc)" />
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Editor slide-over -->
    <BusinessServiceEditor
      v-if="editorOpen"
      :service="editingService"
      :allServices="services"
      @save="onSave"
      @close="editorOpen = false"
      @edgesChanged="reloadEditingService"
    />

    <!-- Delete confirmation dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      :header="`Delete: ${deletingService?.name ?? ''}`"
      :modal="true"
      :closable="true"
    >
      <p>Delete <strong>{{ deletingService?.name }}</strong>? This cannot be undone.</p>
      <template #footer>
        <Button :label="deleting ? 'Deleting…' : 'Delete'" @click="doDelete" :disabled="deleting" />
        <Button text label="Cancel" @click="showDeleteDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import BusinessServiceEditor from '@/components/BSM/BusinessServiceEditor.vue'
import {
  listBusinessServices, createBusinessService, updateBusinessService,
  deleteBusinessService, reloadDaemon, getBusinessService, statusColor,
  type BusinessService, type FunctionDTO
} from '@/services/bsmService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'Business Service Management', to: '/bsm-admin' }
]

const loading = ref(true)
const loadError = ref<string | null>(null)
const reloading = ref(false)
const services = ref<BusinessService[]>([])

const editorOpen = ref(false)
const editingService = ref<BusinessService | null>(null)

const showDeleteDialog = ref(false)
const deletingService = ref<BusinessService | null>(null)
const deleting = ref(false)

function edgeCount(svc: BusinessService): number {
  return (
    (svc['ip-service-edges']?.length ?? 0) +
    (svc['reduction-key-edges']?.length ?? 0) +
    (svc['child-edges']?.length ?? 0) +
    (svc['application-edges']?.length ?? 0)
  )
}

async function loadData() {
  loading.value = true
  loadError.value = null
  try {
    services.value = await listBusinessServices()
  } catch (e: any) {
    loadError.value = e.message ?? 'Failed to load business services'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function openCreate() {
  editingService.value = null
  editorOpen.value = true
}

function openEdit(svc: BusinessService) {
  editingService.value = svc
  editorOpen.value = true
}

async function reloadEditingService() {
  if (!editingService.value) return
  try {
    const updated = await getBusinessService(editingService.value.id)
    editingService.value = updated
    const idx = services.value.findIndex(s => s.id === updated.id)
    if (idx !== -1) services.value[idx] = updated
  } catch {
    // non-fatal — editor will still show stale edges but the data is correct server-side
  }
}

async function onSave(payload: { name: string; attributes: Record<string, string>; 'reduce-function': FunctionDTO }) {
  try {
    if (editingService.value) {
      await updateBusinessService(editingService.value.id, payload, editingService.value)
      showSnackBar({ msg: 'Business service updated.' })
    } else {
      await createBusinessService(payload)
      showSnackBar({ msg: 'Business service created.' })
    }
    editorOpen.value = false
    await loadData()
  } catch (e: any) {
    showSnackBar({ msg: `Save failed: ${e?.response?.data?.message ?? e?.message ?? 'Unknown error'}` })
  }
}

function confirmDelete(svc: BusinessService) {
  deletingService.value = svc
  showDeleteDialog.value = true
}

async function doDelete() {
  if (!deletingService.value) return
  deleting.value = true
  try {
    await deleteBusinessService(deletingService.value.id)
    showSnackBar({ msg: `Deleted "${deletingService.value.name}".` })
    showDeleteDialog.value = false
    deletingService.value = null
    await loadData()
  } catch (e: any) {
    showSnackBar({ msg: `Delete failed: ${e?.message ?? 'Unknown error'}` })
  } finally {
    deleting.value = false
  }
}

async function doReload() {
  reloading.value = true
  try {
    await reloadDaemon()
    showSnackBar({ msg: 'BSM daemon reloaded.' })
  } catch (e: any) {
    showSnackBar({ msg: `Reload failed: ${e?.message ?? 'Unknown error'}` })
  } finally {
    reloading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.bsm-admin {
  padding: 1.5rem;
  max-width: 1200px;
}

.page-title {
  @include typo.headline1();
  margin: 0.5rem 0 1.5rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.error-text {
  color: var($error);
  margin-bottom: 0.5rem;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.empty-state {
  @include typo.body-large();
  color: var($secondary-text-on-surface);
  padding: 2rem;
  text-align: center;
  border: 1px dashed var($border-on-surface);
  border-radius: vars.$border-radius-surface;
}

.services-table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    padding: 0.6rem 1rem;
    border-bottom: 2px solid var($border-on-surface);
    @include typo.subtitle2();
    color: var($secondary-text-on-surface);
  }

  td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var($border-on-surface);
    @include typo.body-large();
    vertical-align: middle;
  }

  tr:hover td { background: var($surface-dark); }
}

.svc-name { font-weight: 600; }

.actions-cell {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.delete-btn { color: var($error) !important; }

.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: vars.$border-radius-surface;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;

  &.status-critical      { background: #c0392b; color: #fff; }
  &.status-major         { background: #e67e22; color: #fff; }
  &.status-minor         { background: #f1c40f; color: #333; }
  &.status-warning       { background: #3498db; color: #fff; }
  &.status-normal        { background: #27ae60; color: #fff; }
  &.status-indeterminate { background: #95a5a6; color: #fff; }
}
</style>
