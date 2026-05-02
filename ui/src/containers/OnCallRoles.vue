<template>
  <div class="on-call-roles-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="on-call-roles-page__header feather-row">
      <div class="feather-col-6">
        <h2 class="headline4">On-Call Roles</h2>
      </div>
      <div class="feather-col-6 on-call-roles-page__actions">
        <Button label="Add Role" icon="pi pi-plus" @click="openAddDialog" />
      </div>
    </div>

    <p class="on-call-roles-page__desc body1">
      Manage on-call roles that define which users are responsible for receiving notifications
      during scheduled time windows.
    </p>

    <div v-if="loading" class="on-call-roles-page__status">Loading…</div>
    <div v-else-if="loadError" class="on-call-roles-page__status on-call-roles-page__status--error">
      Failed to load on-call roles.
    </div>
    <div v-else-if="!roles.length" class="on-call-roles-page__status">
      No on-call roles configured.
    </div>

    <DataTable
      v-else
      :value="roles"
      dataKey="name"
      stripedRows
      rowHover
      class="on-call-roles-table"
    >
      <Column field="name" header="Name">
        <template #body="{ data }">
          <RouterLink :to="`/on-call-role/${encodeURIComponent(data.name)}`" class="on-call-roles-page__link">
            {{ data.name }}
          </RouterLink>
        </template>
      </Column>
      <Column field="membership-group" header="Membership Group" />
      <Column field="supervisor" header="Supervisor" />
      <Column field="description" header="Description" />
      <Column header="Actions" style="width: 8rem">
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            :aria-label="`Delete role ${data.name}`"
            @click="confirmDelete(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="addDialogVisible"
      header="Add On-Call Role"
      :modal="true"
      style="width: 500px"
    >
      <div class="ocr-form__row">
        <label class="ocr-form__label">Name <span class="ocr-form__required">*</span></label>
        <InputText v-model="form.name" class="ocr-form__input" placeholder="e.g. Network-Admin" />
      </div>
      <div class="ocr-form__row">
        <label class="ocr-form__label">Membership Group <span class="ocr-form__required">*</span></label>
        <InputText v-model="form['membership-group']" class="ocr-form__input" placeholder="e.g. network-team" />
      </div>
      <div class="ocr-form__row">
        <label class="ocr-form__label">Supervisor <span class="ocr-form__required">*</span></label>
        <InputText v-model="form.supervisor" class="ocr-form__input" placeholder="e.g. admin" />
      </div>
      <div class="ocr-form__row">
        <label class="ocr-form__label">Description</label>
        <InputText v-model="form.description" class="ocr-form__input" placeholder="Optional description" />
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
import { RouterLink } from 'vue-router'
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
  type OnCallRole,
  getRoles,
  createRole,
  deleteRole
} from '@/services/onCallRoleService'

const menuStore = useMenuStore()
const confirm = useConfirm()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'On-Call Roles', to: '#', position: 'last' }
])

const roles = ref<OnCallRole[]>([])
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const addDialogVisible = ref(false)

const emptyForm = (): OnCallRole => ({
  name: '',
  'membership-group': '',
  supervisor: '',
  description: ''
})

const form = ref<OnCallRole>(emptyForm())

const load = async () => {
  loading.value = true
  loadError.value = false
  try {
    roles.value = await getRoles()
  } catch {
    loadError.value = true
    showSnackBar({ msg: 'Failed to load on-call roles.' })
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  form.value = emptyForm()
  addDialogVisible.value = true
}

const submitAdd = async () => {
  if (!form.value.name.trim() || !form.value['membership-group'].trim() || !form.value.supervisor.trim()) {
    showSnackBar({ msg: 'Name, membership group, and supervisor are required.' })
    return
  }
  saving.value = true
  try {
    await createRole(form.value)
    addDialogVisible.value = false
    showSnackBar({ msg: 'On-call role created.' })
    await load()
  } catch {
    showSnackBar({ msg: 'Failed to create on-call role.' })
  } finally {
    saving.value = false
  }
}

const confirmDelete = (role: OnCallRole) => {
  confirm.require({
    message: `Delete on-call role "${role.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      try {
        await deleteRole(role.name)
        showSnackBar({ msg: `Role "${role.name}" deleted.` })
        await load()
      } catch {
        showSnackBar({ msg: 'Failed to delete on-call role.' })
      }
    }
  })
}

onMounted(load)
</script>

<style scoped lang="scss">
.on-call-roles-page {
  padding: 1.5rem;
  max-width: 1200px;
}

.on-call-roles-page__header {
  margin-bottom: 0.5rem;
}

.on-call-roles-page__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.on-call-roles-page__desc {
  margin: 0 0 1.5rem;
  color: var(--feather-secondary-text-on-surface);
}

.on-call-roles-page__status {
  padding: 1rem 0;

  &--error {
    color: var(--feather-error);
  }
}

.on-call-roles-page__link {
  color: var(--feather-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.ocr-form__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.ocr-form__label {
  font-weight: 500;
  font-size: 0.875rem;
}

.ocr-form__required {
  color: var(--feather-error);
}

.ocr-form__input {
  width: 100%;
}
</style>
