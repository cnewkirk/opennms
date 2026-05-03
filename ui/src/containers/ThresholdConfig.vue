<template>
  <div class="threshold-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="threshold-page__header feather-row">
      <div class="feather-col-8">
        <h2 class="headline4">Threshold Configuration</h2>
      </div>
      <div class="feather-col-4 threshold-page__header-actions">
        <Button severity="secondary" :disabled="reloading" @click="reloadThresholds" :label="reloading ? 'Reloading…' : 'Reload Thresholds'" />
      </div>
    </div>

    <div v-if="loading" class="threshold-page__loading">
      <PanelLoader :size="40" />
    </div>
    <div v-else-if="loadError" class="threshold-page__status threshold-page__status--error">
      Failed to load threshold groups.
    </div>

    <template v-if="!loading && !loadError">
      <div class="threshold-card">
        <div class="threshold-card__header">Threshold Groups</div>
        <div class="threshold-card__body">
          <table class="threshold-table">
            <thead>
              <tr>
                <th>Group Name</th>
                <th>RRD Repository</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in groups" :key="group.name">
                <td>{{ group.name }}</td>
                <td class="threshold-rrd">{{ group.rrdRepository }}</td>
                <td>
                  <Button text label="Edit" @click="editGroup(group.name)" />
                </td>
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
import PanelLoader from '@/components/Common/PanelLoader.vue'
import useSnackbar from '@/composables/useSnackbar'
import { v2 } from '@/services/axiosInstances'
import { BreadCrumb } from '@/types'

const router = useRouter()
const { showSnackBar } = useSnackbar()

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Threshold Configuration', to: '#', position: 'last' }
]

interface GroupSummary {
  name: string
  rrdRepository: string
}

const groups = ref<GroupSummary[]>([])
const loading = ref(true)
const loadError = ref(false)
const reloading = ref(false)

onMounted(async () => {
  try {
    const resp = await v2.get('/thresholds')
    const raw = resp.data.groups
    groups.value = Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch (e) {
    loadError.value = true
  } finally {
    loading.value = false
  }
})

function editGroup(name: string) {
  router.push(`/threshold-config/${name}`)
}

async function reloadThresholds() {
  reloading.value = true
  try {
    await v2.post('/thresholds/reload')
    showSnackBar({ msg: 'Threshold configuration reloaded.' })
  } catch (e) {
    showSnackBar({ msg: 'Failed to reload thresholds.' })
  } finally {
    reloading.value = false
  }
}
</script>

<style lang="scss" scoped>
.threshold-page {
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

  &__loading {
    display: flex;
    justify-content: center;
    padding: 3rem;
  }

  &__status {
    color: var(--feather-secondary-text-on-surface);
    padding: 1rem 0;

    &--error {
      color: var(--feather-error);
    }
  }
}

.threshold-card {
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

.threshold-table {
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

    &:last-child {
      width: 80px;
    }
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.threshold-rrd {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--feather-secondary-text-on-surface);
}
</style>
