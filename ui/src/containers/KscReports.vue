<template>
  <div class="ksc-reports-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="card__header">
            <span class="card__title">KSC Reports</span>
            <Button v-if="isAdmin" label="New Report" size="small" @click="showCreate = true" />
          </div>

          <DataTable
            :value="reports"
            :loading="loading"
            size="small"
            striped-rows
            class="ksc-reports-page__table"
          >
            <template #empty>
              <span v-if="!loading">No KSC reports configured.</span>
            </template>
            <Column field="label" header="Label" sortable />
            <Column header="Graphs" sortable sort-field="graphCount">
              <template #body="{ data }">
                {{ (data.kscGraph ?? []).length }}
              </template>
            </Column>
            <Column field="graphs_per_line" header="Per Line" sortable />
            <Column header="Actions">
              <template #body="{ data }">
                <router-link :to="`/ksc-report/${data.id}`">
                  <Button label="View" size="small" text />
                </router-link>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>

    <!-- Create dialog -->
    <Dialog v-model:visible="showCreate" header="New KSC Report" modal style="width: 400px">
      <div class="create-form">
        <label class="create-form__label" for="ksc-label">Report Label</label>
        <InputText
          id="ksc-label"
          v-model="newLabel"
          placeholder="Report name…"
          class="create-form__input"
          @keydown.enter="submitCreate"
        />
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showCreate = false" />
        <Button
          label="Create"
          :disabled="!newLabel.trim() || creating"
          @click="submitCreate"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useMenuStore } from '@/stores/menuStore'
import { useAuthStore } from '@/stores/authStore'
import { getReports, createReport, type KscReport } from '@/services/kscReportService'
import useSnackbar from '@/composables/useSnackbar'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const authStore = useAuthStore()
const router = useRouter()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const isAdmin = computed(() => authStore.whoAmI?.roles?.includes('ROLE_ADMIN'))

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'KSC Reports', to: '#', position: 'last' }
])

const reports = ref<KscReport[]>([])
const loading = ref(true)
const showCreate = ref(false)
const newLabel = ref('')
const creating = ref(false)

onMounted(async () => {
  try {
    reports.value = await getReports()
  } finally {
    loading.value = false
  }
})

const submitCreate = async () => {
  if (!newLabel.value.trim()) return
  creating.value = true
  const ok = await createReport(newLabel.value.trim())
  if (ok) {
    showSnackBar({ msg: 'Report created.' })
    showCreate.value = false
    newLabel.value = ''
    loading.value = true
    try {
      reports.value = await getReports()
    } finally {
      loading.value = false
    }
  } else {
    showSnackBar({ msg: 'Failed to create report.' })
  }
  creating.value = false
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.ksc-reports-page {
  padding: 0 0 40px;
}

.card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__title {
    font-weight: 600;
    font-size: 14px;
  }
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 8px;

  &__label {
    font-size: 13px;
    font-weight: 600;
  }

  &__input {
    width: 100%;
  }
}
</style>
