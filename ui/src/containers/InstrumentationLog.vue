<template>
  <div class="instrumentation-log">
    <BreadCrumbs :items="breadcrumbs" />
    <div class="instrumentation-log__toolbar">
      <InputText
        v-model="search"
        placeholder="Filter by service ID…"
        class="instrumentation-log__search"
        @input="debouncedLoad"
      />
      <Select
        v-model="sortColumn"
        :options="sortColumnOptions"
        option-label="label"
        option-value="value"
        class="instrumentation-log__sort-col"
        @change="load"
      />
      <Select
        v-model="sortOrder"
        :options="sortOrderOptions"
        option-label="label"
        option-value="value"
        class="instrumentation-log__sort-order"
        @change="load"
      />
    </div>

    <DataTable
      :value="entries"
      :loading="loading"
      size="small"
      striped-rows
      class="instrumentation-log__table"
    >
      <template #empty>
        <span v-if="!loading">No instrumentation log data found. Ensure <code>instrumentation.log</code> is set to INFO in <code>log4j2.xml</code>.</span>
      </template>
      <Column field="serviceId" header="Service ID" sortable />
      <Column field="collectionCount" header="Collections" sortable />
      <Column field="avgCollectionTimeMs" header="Avg Collect (ms)" sortable />
      <Column field="avgTimeBetweenCollectionsMs" header="Avg Between (ms)" sortable />
      <Column field="successfulCollectionCount" header="Successes" sortable />
      <Column header="Success %" sortable sort-field="successPercentage">
        <template #body="{ data }">
          <span :class="successClass(data.successPercentage)">
            {{ data.successPercentage === -1 ? 'N/A' : data.successPercentage.toFixed(1) + '%' }}
          </span>
        </template>
      </Column>
      <Column field="errorCollectionCount" header="Errors" sortable />
      <Column header="Error %" sortable sort-field="errorPercentage">
        <template #body="{ data }">
          {{ data.errorPercentage === -1 ? 'N/A' : data.errorPercentage.toFixed(1) + '%' }}
        </template>
      </Column>
      <Column field="avgErrorCollectionTimeMs" header="Avg Error (ms)" sortable />
      <Column field="avgPersistTimeMs" header="Avg Persist (ms)" sortable />
      <Column field="totalPersistTimeMs" header="Total Persist (ms)" sortable />
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { type BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import {
  getInstrumentationLog,
  type ServiceCollectorEntry,
  type SortColumn,
  type SortOrder
} from '@/services/instrumentationLogService'
import useSnackbar from '@/composables/useSnackbar'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: menuStore.mainMenu.homeUrl, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Instrumentation Log', to: '#', position: 'last' }
])

const entries = ref<ServiceCollectorEntry[]>([])
const loading = ref(false)
const search = ref('')
const sortColumn = ref<SortColumn>('TOTALCOLLECTS')
const sortOrder = ref<SortOrder>('DESCENDING')

const sortColumnOptions = [
  { label: 'Total Collections', value: 'TOTALCOLLECTS' },
  { label: 'Avg Collection Time', value: 'AVGCOLLECTTIME' },
  { label: 'Avg Time Between', value: 'AVGTIMEBETWEENCOLLECTS' },
  { label: 'Total Successes', value: 'TOTALSUCCESSCOLLECTS' },
  { label: 'Avg Success Time', value: 'AVGSUCCESSCOLLECTTIME' },
  { label: 'Total Errors', value: 'TOTALERRORS' },
  { label: 'Avg Error Time', value: 'AVGERRORTIME' },
  { label: 'Avg Persist Time', value: 'AVGPERSISTTIME' },
  { label: 'Total Persist Time', value: 'TOTALPERSISTTIME' }
]

const sortOrderOptions = [
  { label: 'Descending', value: 'DESCENDING' },
  { label: 'Ascending', value: 'ASCENDING' }
]

const load = async () => {
  loading.value = true
  try {
    entries.value = await getInstrumentationLog({
      search: search.value || undefined,
      sortColumn: sortColumn.value,
      sortOrder: sortOrder.value
    })
  } catch {
    showSnackBar({ msg: 'Failed to load instrumentation log data.' })
  } finally {
    loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout>
const debouncedLoad = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}
onBeforeUnmount(() => clearTimeout(debounceTimer))

const successClass = (pct: number) => {
  if (pct === -1) return ''
  if (pct >= 90) return 'il-success'
  if (pct >= 50) return 'il-warning'
  return 'il-error'
}

onMounted(load)
</script>

<style scoped lang="scss">
.instrumentation-log {
  padding: 1.5rem;
  max-width: 1400px;

  &__toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  &__search { flex: 1; min-width: 200px; }
  &__sort-col, &__sort-order { width: 220px; }
}
</style>

<style lang="scss">
.il-success { color: var(--feather-success, #2d9b45); font-weight: 600; }
.il-warning { color: var(--feather-warning, #e07800); font-weight: 600; }
.il-error   { color: var(--feather-error, #d24040); font-weight: 600; }
</style>
