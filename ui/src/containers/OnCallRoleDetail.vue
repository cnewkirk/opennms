<template>
  <div class="on-call-role-detail-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div v-if="loading" class="on-call-role-detail-page__status">Loading…</div>

    <div v-else-if="notFound" class="on-call-role-detail-page__status on-call-role-detail-page__status--error">
      On-call role "{{ roleName }}" was not found.
    </div>

    <div v-else-if="loadError" class="on-call-role-detail-page__status on-call-role-detail-page__status--error">
      Failed to load on-call role.
    </div>

    <template v-else-if="role">
      <div class="on-call-role-detail-page__header feather-row">
        <div class="feather-col-12">
          <h2 class="headline4">{{ role.name }}</h2>
        </div>
      </div>

      <div class="on-call-role-detail-page__card">
        <h3 class="on-call-role-detail-page__section-title">Role Details</h3>
        <dl class="on-call-role-detail-page__grid">
          <dt>Name</dt>
          <dd>{{ role.name }}</dd>

          <dt>Membership Group</dt>
          <dd>{{ role['membership-group'] }}</dd>

          <dt>Supervisor</dt>
          <dd>{{ role.supervisor }}</dd>

          <dt>Description</dt>
          <dd>{{ role.description || '—' }}</dd>
        </dl>
      </div>

      <div v-if="role.schedule && role.schedule.length" class="on-call-role-detail-page__card">
        <h3 class="on-call-role-detail-page__section-title">Schedule</h3>
        <DataTable
          :value="role.schedule as Record<string, unknown>[]"
          stripedRows
          rowHover
          class="on-call-role-detail-page__schedule-table"
        >
          <Column
            v-for="col in scheduleColumns"
            :key="col"
            :field="col"
            :header="col"
          />
        </DataTable>
      </div>

      <div v-else class="on-call-role-detail-page__card">
        <h3 class="on-call-role-detail-page__section-title">Schedule</h3>
        <p class="on-call-role-detail-page__empty">No schedule entries configured for this role.</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import { type OnCallRole, getRole } from '@/services/onCallRoleService'

const route = useRoute()
const menuStore = useMenuStore()

const roleName = computed<string>(() => decodeURIComponent(String(route.params.name ?? '')))
const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'On-Call Roles', to: '/on-call-roles' },
  { label: roleName.value || 'Detail', to: '#', position: 'last' }
])

const role = ref<OnCallRole | null>(null)
const loading = ref(false)
const loadError = ref(false)
const notFound = ref(false)

const scheduleColumns = computed<string[]>(() => {
  if (!role.value?.schedule?.length) return []
  const first = role.value.schedule[0] as Record<string, unknown>
  return Object.keys(first)
})

const load = async () => {
  if (!roleName.value) return
  loading.value = true
  loadError.value = false
  notFound.value = false
  try {
    role.value = await getRole(roleName.value)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      notFound.value = true
    } else {
      loadError.value = true
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.on-call-role-detail-page {
  padding: 1.5rem;
  max-width: 900px;
}

.on-call-role-detail-page__header {
  margin-bottom: 1rem;
}

.on-call-role-detail-page__status {
  padding: 1rem 0;

  &--error {
    color: var(--feather-error);
  }
}

.on-call-role-detail-page__card {
  background: var(--feather-surface);
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}

.on-call-role-detail-page__section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--feather-primary-text-on-surface);
}

.on-call-role-detail-page__grid {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.5rem 1rem;
  margin: 0;

  dt {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--feather-secondary-text-on-surface);
    padding: 0.25rem 0;
  }

  dd {
    margin: 0;
    padding: 0.25rem 0;
    word-break: break-word;
  }
}

.on-call-role-detail-page__empty {
  margin: 0;
  color: var(--feather-secondary-text-on-surface);
  font-size: 0.875rem;
}

.on-call-role-detail-page__schedule-table {
  width: 100%;
}
</style>
