<template>
  <div class="events-page">
    <BreadCrumbs :items="breadcrumbs" />

    <DataTable
      :value="events"
      :loading="loading"
      :rows="pageSize"
      :total-records="totalCount"
      lazy
      paginator
      @page="onPage"
      stripedRows
      class="events-table"
      data-key="id"
      @row-click="onRowClick"
      row-hover
    >
      <template #header>
        <div class="events-table__header">
          <span class="events-table__title">Events</span>
          <InputText
            v-model="searchText"
            placeholder="Filter by node or UEI…"
            size="small"
            @keydown.enter="applySearch"
          />
        </div>
      </template>

      <Column field="time" header="Time" style="width: 180px">
        <template #body="{ data }">
          {{ formatTime(data.time) }}
        </template>
      </Column>

      <Column field="severity" header="Severity" style="width: 110px">
        <template #body="{ data }">
          <span class="severity-badge" :class="`severity-badge--${data.severity?.toLowerCase()}`">
            {{ data.severity }}
          </span>
        </template>
      </Column>

      <Column field="nodeLabel" header="Node" style="width: 180px">
        <template #body="{ data }">
          <router-link v-if="data.nodeId" :to="`/node/${data.nodeId}`" class="events-table__node-link">
            {{ data.nodeLabel || data.nodeId }}
          </router-link>
          <span v-else>—</span>
        </template>
      </Column>

      <Column field="uei" header="Event Type">
        <template #body="{ data }">
          <span class="events-table__uei" :title="data.uei">{{ shortenUei(data.uei) }}</span>
        </template>
      </Column>

      <Column field="logMessage" header="Message">
        <template #body="{ data }">
          <span class="events-table__message" :title="data.logMessage">{{ data.logMessage }}</span>
        </template>
      </Column>

      <template #empty>
        <div class="events-table__empty">No events found.</div>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getEvents } from '@/services/eventService'
import { useMenuStore } from '@/stores/menuStore'
import type { Event, BreadCrumb } from '@/types'

const router = useRouter()
const menuStore = useMenuStore()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Events', to: '#', position: 'last' }
])

const events = ref<Event[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageSize = 25
const currentPage = ref(0)
const searchText = ref('')

const loadEvents = async (offset = 0) => {
  loading.value = true
  const params = {
    limit: pageSize,
    offset,
    orderBy: 'time',
    order: 'desc' as any,
    ...(searchText.value ? { _s: `nodeLabel==${searchText.value}*,uei==${searchText.value}*` } : {})
  }
  const result = await getEvents(params)
  if (result) {
    events.value = result.event ?? []
    totalCount.value = result.totalCount ?? 0
  }
  loading.value = false
}

const onPage = (event: { first: number }) => {
  currentPage.value = event.first
  loadEvents(event.first)
}

const applySearch = () => loadEvents(0)

const onRowClick = (event: { data: Event }) => {
  router.push(`/event/${event.data.id}`)
}

const formatTime = (ts: number): string => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

const shortenUei = (uei: string): string => {
  if (!uei) return '—'
  const parts = uei.split('/')
  return parts.at(-1) ?? uei
}

onMounted(() => loadEvents(0))
</script>

<style lang="scss" scoped>
.events-page {
  padding: 16px 20px;
}

.events-table {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
  }

  &__node-link {
    color: var(--feather-clickable-normal);
    text-decoration: none;
  }

  &__uei,
  &__message {
    display: block;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--feather-secondary-text-on-surface);
  }
}

.severity-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  &--critical   { background: var(--feather-error);   color: #fff; }
  &--major      { background: #e65100;                color: #fff; }
  &--minor      { background: #f57c00;                color: #fff; }
  &--warning    { background: #fbc02d;                color: #000; }
  &--normal,
  &--cleared    { background: var(--feather-success);  color: #fff; }
  &--indeterminate { background: var(--feather-secondary-text-on-surface); color: #fff; }
}
</style>
