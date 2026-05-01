<template>
  <div class="applications-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="applications-panel">
      <div class="applications-panel__header">
        <span class="applications-panel__title">Manage Applications</span>
      </div>

      <DataTable :value="applications" :loading="loading" stripedRows rowHover>
        <Column field="id" header="ID" style="width: 70px" />
        <Column field="name" header="Application Name" />
        <Column header="" style="width: 80px; text-align: right">
          <template #body="{ data }">
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click="confirmDelete(data)"
            />
          </template>
        </Column>
        <template #empty>{{ loading ? '' : 'No applications defined.' }}</template>
      </DataTable>

      <div class="applications-panel__add">
        <InputText
          v-model="newName"
          placeholder="Application name"
          class="add-input"
          @keyup.enter="addApplication"
        />
        <Button
          label="Add Application"
          icon="pi pi-plus"
          :disabled="!newName.trim()"
          :loading="adding"
          @click="addApplication"
        />
      </div>
    </div>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getApplications, createApplication, deleteApplication, type Application } from '@/services/applicationsService'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()
const confirm = useConfirm()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Applications', to: '#', position: 'last' },
])

const applications = ref<Application[]>([])
const loading = ref(false)
const adding = ref(false)
const newName = ref('')

const load = async () => {
  loading.value = true
  const result = await getApplications()
  if (result !== false) applications.value = result
  else showSnackBar({ msg: 'Failed to load applications.' })
  loading.value = false
}

const addApplication = async () => {
  if (!newName.value.trim()) return
  adding.value = true
  const ok = await createApplication(newName.value.trim())
  if (ok) {
    showSnackBar({ msg: `Application "${newName.value.trim()}" created.` })
    newName.value = ''
    await load()
  } else {
    showSnackBar({ msg: 'Failed to create application.' })
  }
  adding.value = false
}

const confirmDelete = (app: Application) => {
  confirm.require({
    message: `Permanently delete application "${app.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    accept: async () => {
      const ok = await deleteApplication(app.id)
      if (ok) showSnackBar({ msg: `Application "${app.name}" deleted.` })
      else showSnackBar({ msg: `Failed to delete "${app.name}".` })
      load()
    },
  })
}

onMounted(() => load())
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.applications-page { padding: 16px 20px; }

.applications-panel {
  max-width: 680px;
  background: var($surface);
  border-radius: 6px;

  &__header {
    padding: 14px 16px;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title { font-size: 16px; font-weight: 600; }

  &__add {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-top: 1px solid var($border-light-on-surface);
  }
}

.add-input { flex: 1; }
</style>
