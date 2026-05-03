<template>
  <div class="reports-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="card__toolbar">
            <InputText
              v-model="filterText"
              placeholder="Filter reports…"
              class="card__filter"
            />
          </div>

          <DataTable
            :value="filteredReports"
            :loading="loading"
            size="small"
            striped-rows
            class="reports-page__table"
          >
            <template #empty>
              <span v-if="!loading">No reports found.</span>
            </template>
            <Column field="name" header="Name" sortable />
            <Column field="description" header="Description" sortable />
            <Column header="Status">
              <template #body="{ data }">
                <span :class="['status-badge', data.online ? 'status-badge--online' : 'status-badge--offline']">
                  {{ data.online ? 'Online' : 'Offline' }}
                </span>
              </template>
            </Column>
            <Column header="Actions">
              <template #body="{ data }">
                <a
                  :href="`/opennms/report/database/reportList.htm`"
                  target="_blank"
                  rel="noopener"
                >
                  <Button label="Run" size="small" text />
                </a>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useMenuStore } from '@/stores/menuStore'
import { getReportDefinitions, type ReportDefinition } from '@/services/reportService'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Reports', to: '#', position: 'last' }
])

const reports = ref<ReportDefinition[]>([])
const loading = ref(true)
const filterText = ref('')

const filteredReports = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return reports.value
  return reports.value.filter(
    r => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    reports.value = await getReportDefinitions()
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.reports-page {
  padding: 0 0 40px;
}

.card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;

  &__toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
    display: flex;
    gap: 12px;
  }

  &__filter {
    width: 280px;
  }
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  &--online {
    background: color-mix(in srgb, var($success) 15%, transparent);
    color: var($success);
  }

  &--offline {
    background: color-mix(in srgb, var($shade-1) 30%, transparent);
    color: var($secondary-text-on-surface);
  }
}
</style>
