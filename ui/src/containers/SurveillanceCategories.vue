<template>
  <div class="surveillance-categories-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="categories-panel">
      <div class="categories-panel__header">
        <span class="categories-panel__title">Surveillance Categories</span>
        <Button label="Add Category" icon="pi pi-plus" size="small" @click="startAdd" />
      </div>

      <DataTable :value="categories" :loading="loading" stripedRows rowHover dataKey="id">
        <Column field="name" header="Category Name" />
        <Column header="" style="width: 90px">
          <template #body="{ data }">
            <div class="categories-panel__actions">
              <Button icon="pi pi-pencil" text size="small" @click="startEdit(data)" aria-label="Edit" />
              <Button icon="pi pi-trash" text severity="danger" size="small" @click="confirmDelete(data)" aria-label="Delete" />
            </div>
          </template>
        </Column>
        <template #empty>No categories defined.</template>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialogVisible" :header="editingId ? 'Edit Category' : 'Add Category'" modal style="width: 380px">
      <div class="form-stack">
        <div class="form-field">
          <label for="cat-name">Name</label>
          <InputText id="cat-name" v-model="editingName" class="w-full" @keydown.enter="save" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="dialogVisible = false" />
        <Button label="Save" :loading="saving" :disabled="!editingName.trim()" @click="save" />
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
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categoryService'
import type { Category, BreadCrumb } from '@/types'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()
const confirm = useConfirm()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Surveillance Categories', to: '#', position: 'last' },
])

const categories = ref<Category[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const editingName = ref('')

const load = async () => {
  loading.value = true
  const result = await getCategories()
  if (result !== false) {
    const raw = result.category
    categories.value = Array.isArray(raw) ? raw : raw ? [raw] : []
  } else {
    showSnackBar({ msg: 'Failed to load categories.' })
  }
  loading.value = false
}

const startAdd = () => {
  editingId.value = null
  editingName.value = ''
  dialogVisible.value = true
}

const startEdit = (cat: Category) => {
  editingId.value = cat.id
  editingName.value = cat.name
  dialogVisible.value = true
}

const save = async () => {
  if (!editingName.value.trim()) return
  saving.value = true
  const ok = editingId.value
    ? await updateCategory(editingId.value, editingName.value.trim())
    : await createCategory(editingName.value.trim())
  saving.value = false
  if (ok) {
    dialogVisible.value = false
    showSnackBar({ msg: editingId.value ? 'Category updated.' : 'Category created.' })
    load()
  } else {
    showSnackBar({ msg: 'Failed to save category.' })
  }
}

const confirmDelete = (cat: Category) => {
  confirm.require({
    message: `Delete category "${cat.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    accept: async () => {
      const ok = await deleteCategory(cat.id)
      if (ok) { showSnackBar({ msg: 'Category deleted.' }); load() }
      else showSnackBar({ msg: 'Failed to delete category.' })
    },
  })
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.surveillance-categories-page { padding: 16px 20px; }

.categories-panel {
  background: var($surface);
  border-radius: 6px;
  max-width: 600px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title { font-size: 16px; font-weight: 600; }

  &__actions { display: flex; gap: 2px; }
}

.form-stack { padding: 4px 0; }
.form-field { display: flex; flex-direction: column; gap: 5px; label { font-size: 13px; font-weight: 500; } }
.w-full { width: 100%; }
</style>
