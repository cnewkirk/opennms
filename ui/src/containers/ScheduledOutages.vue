<template>
  <div class="sched-outages-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="sched-outages-page__header feather-row">
      <div class="feather-col-6">
        <h2 class="headline4">Scheduled Outages</h2>
      </div>
      <div class="feather-col-6 sched-outages-page__actions">
        <Button label="New Outage" @click="openCreate" />
      </div>
    </div>

    <div v-if="loading" class="sched-outages-page__loading">
      <p class="subtitle1">Loading…</p>
    </div>
    <div v-else-if="error" class="sched-outages-page__error">
      <p class="body1">Failed to load scheduled outages.</p>
    </div>
    <div v-else-if="!outages.length" class="sched-outages-page__empty">
      <p class="body1">No scheduled outages configured.</p>
    </div>
    <table v-else class="sched-outages-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Time Windows</th>
          <th>Nodes / Interfaces</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="outage in outages" :key="outage.name">
          <td>{{ outage.name }}</td>
          <td class="sched-outages-table__type">{{ outage.type }}</td>
          <td>
            <div v-for="(t, i) in outage.time" :key="i" class="sched-outages-table__time">
              <span v-if="t.day">{{ t.day }} </span>{{ t.begins }} – {{ t.ends }}
            </div>
            <span v-if="!outage.time.length" class="sched-outages-table__none">—</span>
          </td>
          <td>
            <div v-for="n in outage.node" :key="n.id">Node {{ n.id }}</div>
            <div v-for="iface in outage.interface" :key="iface.address">{{ iface.address }}</div>
            <span v-if="!outage.node.length && !outage.interface.length" class="sched-outages-table__none">—</span>
          </td>
          <td class="sched-outages-table__actions">
            <Button text label="Edit" @click="openEdit(outage)" />
            <Button text label="Delete" @click="confirmDelete(outage.name)" />
          </td>
        </tr>
      </tbody>
    </table>

    <SchedOutageEditDialog v-model="dialogVisible" :outage="selectedOutage" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SchedOutageEditDialog from '@/components/ScheduledOutages/SchedOutageEditDialog.vue'
import { listSchedOutages, deleteSchedOutage } from '@/services/schedOutageService'
import { SchedOutage, BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Scheduled Outages', to: '#', position: 'last' }
])

const outages = ref<SchedOutage[]>([])
const loading = ref(false)
const error = ref(false)
const dialogVisible = ref(false)
const selectedOutage = ref<SchedOutage | null>(null)

const loadOutages = async () => {
  loading.value = true
  error.value = false
  const result = await listSchedOutages()
  loading.value = false
  if (result === false) {
    error.value = true
  } else {
    outages.value = result
  }
}

onMounted(() => loadOutages())

const openCreate = () => {
  selectedOutage.value = null
  dialogVisible.value = true
}

const openEdit = (outage: SchedOutage) => {
  selectedOutage.value = outage
  dialogVisible.value = true
}

const confirmDelete = async (name: string) => {
  if (!window.confirm(`Are you sure you want to delete outage "${name}"?`)) return
  const ok = await deleteSchedOutage(name)
  if (ok) {
    showSnackBar({ msg: `Outage "${name}" deleted.` })
    await loadOutages()
  } else {
    showSnackBar({ msg: `Failed to delete outage "${name}".`, error: true })
  }
}

const onSaved = async () => {
  dialogVisible.value = false
  await loadOutages()
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.sched-outages-page {
  padding: 0 20px 20px;
  background: var($surface);
  min-height: 100%;

  &__header {
    display: flex;
    align-items: center;
    padding: 16px 0 8px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  &__loading,
  &__error,
  &__empty {
    padding: 24px 0;
    color: var($secondary-text-on-surface);
  }

  &__error {
    color: var($error);
  }
}

.sched-outages-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  border-radius: 4px;
  overflow: hidden;

  th, td {
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid var($border-on-surface);
    vertical-align: top;
  }

  th {
    @include subtitle2();
    background: var($surface);
    color: var($secondary-text-on-surface);
  }

  &__type {
    text-transform: capitalize;
  }

  &__time {
    margin-bottom: 2px;
  }

  &__none {
    color: var($secondary-text-on-surface);
  }

  &__actions {
    white-space: nowrap;
    text-align: right;
  }
}
</style>
