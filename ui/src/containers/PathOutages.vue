<template>
  <div class="path-outages-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="path-outages-page__header feather-row">
      <div class="feather-col-6">
        <h2 class="headline4">Path Outages</h2>
      </div>
      <div class="feather-col-6 path-outages-page__actions">
        <Button label="Add Path Outage" icon="pi pi-plus" @click="openAddDialog" />
      </div>
    </div>

    <p class="path-outages-page__desc body1">
      Configure critical path dependencies. When a node's critical path is down,
      its outage will not generate notifications.
    </p>

    <div v-if="loading" class="path-outages-page__status">Loading…</div>
    <div v-else-if="loadError" class="path-outages-page__status path-outages-page__status--error">
      Failed to load path outages.
    </div>
    <div v-else-if="!pathOutages.length" class="path-outages-page__status">
      No path outages configured.
    </div>

    <DataTable
      v-else
      :value="pathOutages"
      dataKey="nodeId"
      stripedRows
      rowHover
      class="path-outages-table"
    >
      <Column field="nodeId" header="Node ID" style="width: 8rem" />
      <Column field="nodeLabel" header="Node Label" />
      <Column field="criticalPathIp" header="Critical Path IP" />
      <Column field="criticalPathServiceName" header="Service" style="width: 10rem" />
      <Column header="Actions" style="width: 8rem">
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            :aria-label="`Delete path outage for node ${data.nodeId}`"
            @click="confirmDelete(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="addDialogVisible"
      header="Add Path Outage"
      :modal="true"
      style="width: 480px"
    >
      <div class="po-form__row">
        <label class="po-form__label">Node ID</label>
        <InputText v-model="form.nodeId" type="number" class="po-form__input" placeholder="e.g. 7" />
      </div>
      <div class="po-form__row">
        <label class="po-form__label">Critical Path IP</label>
        <InputText v-model="form.criticalPathIp" class="po-form__input" placeholder="e.g. 192.168.1.1" />
      </div>
      <div class="po-form__row">
        <label class="po-form__label">Service</label>
        <InputText v-model="form.criticalPathServiceName" class="po-form__input" placeholder="e.g. ICMP" />
      </div>
      <template #footer>
        <Button label="Cancel" text @click="addDialogVisible = false" />
        <Button label="Save" :loading="saving" @click="submitAdd" />
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
import { BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'
import {
  type PathOutage,
  getPathOutages,
  savePathOutage,
  deletePathOutage
} from '@/services/pathOutageService'

const menuStore = useMenuStore()
const confirm = useConfirm()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Path Outages', to: '#', position: 'last' }
])

const pathOutages = ref<PathOutage[]>([])
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const addDialogVisible = ref(false)
const form = ref({ nodeId: '', criticalPathIp: '', criticalPathServiceName: 'ICMP' })

const load = async () => {
  loading.value = true
  loadError.value = false
  try {
    pathOutages.value = await getPathOutages()
  } catch {
    loadError.value = true
    showSnackBar({ msg: 'Failed to load path outages.' })
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  form.value = { nodeId: '', criticalPathIp: '', criticalPathServiceName: 'ICMP' }
  addDialogVisible.value = true
}

const submitAdd = async () => {
  const nodeId = Number(form.value.nodeId)
  if (!nodeId || !form.value.criticalPathIp || !form.value.criticalPathServiceName) {
    showSnackBar({ msg: 'Node ID, critical path IP, and service name are required.' })
    return
  }
  saving.value = true
  try {
    await savePathOutage({
      nodeId,
      criticalPathIp: form.value.criticalPathIp,
      criticalPathServiceName: form.value.criticalPathServiceName
    })
    addDialogVisible.value = false
    showSnackBar({ msg: 'Path outage saved.' })
    await load()
  } catch {
    showSnackBar({ msg: 'Failed to save path outage.' })
  } finally {
    saving.value = false
  }
}

const confirmDelete = (outage: PathOutage) => {
  confirm.require({
    message: `Remove path outage for node ${outage.nodeId} (${outage.nodeLabel ?? outage.nodeId})?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      try {
        await deletePathOutage(outage.nodeId)
        showSnackBar({ msg: 'Path outage removed.' })
        await load()
      } catch {
        showSnackBar({ msg: 'Failed to remove path outage.' })
      }
    }
  })
}

onMounted(load)
</script>

<style scoped lang="scss">
.path-outages-page {
  padding: 1.5rem;
  max-width: 1200px;
}

.path-outages-page__header {
  margin-bottom: 0.5rem;
}

.path-outages-page__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.path-outages-page__desc {
  margin: 0 0 1.5rem;
  color: var(--feather-secondary-text-on-surface);
}

.path-outages-page__status {
  padding: 1rem 0;

  &--error {
    color: var(--feather-error);
  }
}

.po-form__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.po-form__label {
  font-weight: 500;
  font-size: 0.875rem;
}

.po-form__input {
  width: 100%;
}
</style>
