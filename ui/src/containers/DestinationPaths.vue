<template>
  <div class="dest-paths-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="dest-paths-page__header feather-row">
      <div class="feather-col-8">
        <h2 class="headline4">Destination Paths</h2>
      </div>
      <div class="feather-col-4 dest-paths-page__header-actions">
        <Button label="+ New Path" @click="router.push('/notification-config/paths/new')" />
      </div>
    </div>

    <div v-if="loading" class="dest-paths-page__status">Loading…</div>
    <div v-else-if="loadError" class="dest-paths-page__status dest-paths-page__status--error">
      Failed to load destination paths.
    </div>

    <template v-if="!loading && !loadError">
      <div class="notif-card">
        <div class="notif-card__header">Paths</div>
        <div class="notif-card__body">
          <table class="notif-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Initial Delay</th>
                <th>Targets</th>
                <th>Escalations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="path in paths" :key="path.name">
                <td>{{ path.name }}</td>
                <td>{{ path.initialDelay ?? '—' }}</td>
                <td>{{ path.targets.length }}</td>
                <td>{{ (path.escalates ?? []).length }}</td>
                <td class="notif-table__actions">
                  <Button text label="Edit" @click="router.push(`/notification-config/paths/${encodeURIComponent(path.name)}`)" />
                  <Button text label="Delete" @click="deletePath(path.name)" />
                </td>
              </tr>
              <tr v-if="paths.length === 0">
                <td colspan="5" class="notif-table__empty">No destination paths configured.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import useSnackbar from '@/composables/useSnackbar'
import destinationPathService, { DestinationPathDTO } from '@/services/destinationPathService'
import { BreadCrumb } from '@/types'

const router = useRouter()
const { showSnackBar } = useSnackbar()

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Notification Configuration', to: '/notification-config' },
  { label: 'Destination Paths', to: '#', position: 'last' }
]

const paths = ref<DestinationPathDTO[]>([])
const loading = ref(true)
const loadError = ref(false)

onMounted(async () => {
  await loadPaths()
})

async function loadPaths() {
  loading.value = true
  loadError.value = false
  try {
    paths.value = await destinationPathService.getDestinationPaths()
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function deletePath(name: string) {
  if (!window.confirm(`Delete destination path "${name}"?`)) return
  const ok = await destinationPathService.deleteDestinationPath(name)
  if (ok) {
    paths.value = paths.value.filter(p => p.name !== name)
    showSnackBar({ msg: `Path "${name}" deleted.` })
  } else {
    showSnackBar({ msg: `Failed to delete path "${name}".` })
  }
}
</script>

<style lang="scss" scoped>
.dest-paths-page {
  padding: 1.5rem;

  &__header {
    align-items: center;
    margin-bottom: 1.5rem;
  }

  &__header-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  &__status {
    color: var(--feather-secondary-text-on-surface);
    padding: 1rem 0;

    &--error {
      color: var(--feather-error);
    }
  }
}

.notif-card {
  background: var(--feather-surface);
  border-radius: 6px;
  border: 1px solid var(--feather-border-on-surface);
  margin-bottom: 1.5rem;

  &__header {
    font-weight: 600;
    font-size: 1rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--feather-border-on-surface);
    color: var(--feather-primary-text-on-surface);
  }

  &__body {
    padding: 1.25rem;
  }
}

.notif-table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--feather-secondary-text-on-surface);
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--feather-border-on-surface);
  }

  td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--feather-border-on-surface);
    color: var(--feather-primary-text-on-surface);
    font-size: 0.9rem;
  }

  tr:last-child td {
    border-bottom: none;
  }

  &__actions {
    white-space: nowrap;
    width: 1%;
  }

  &__empty {
    text-align: center;
    color: var(--feather-secondary-text-on-surface);
    font-style: italic;
  }
}
</style>
