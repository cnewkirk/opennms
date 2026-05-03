<template>
  <div class="status-page">
    <div class="breadcrumbs-row">
      <BreadCrumbs :items="breadcrumbs" />
    </div>

    <div class="page-header">
      <h1 class="page-title">System Status</h1>
    </div>

    <div v-if="loading" class="loading-state">
      <PanelLoader :size="40" />
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>

    <div v-else-if="daemonRows.length > 0" class="status-card">
      <div class="status-card__header">
        <i class="pi pi-server" />
        Daemon Status
        <span class="status-card__counts">
          <span class="count-badge count-badge--running">{{ runningCount }} running</span>
          <span v-if="stoppedCount > 0" class="count-badge count-badge--stopped">{{ stoppedCount }} stopped</span>
        </span>
      </div>
      <div class="status-table-wrap">
        <table class="status-table">
          <thead>
            <tr>
              <th>Daemon</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in daemonRows" :key="row.name">
              <td class="daemon-name">{{ row.name }}</td>
              <td>
                <span
                  class="status-badge"
                  :class="row.status === 'running' ? 'status-badge--running' : 'status-badge--stopped'"
                >
                  <i class="pi" :class="row.status === 'running' ? 'pi-check-circle' : 'pi-times-circle'" />
                  {{ row.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="empty-state">
      No daemon status information available.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import { getSystemInfo } from '@/services/systemInfoService'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'System Status', to: '#', position: 'last' }
])

const loading = ref(true)
const error = ref<string | null>(null)
const services = ref<Record<string, string>>({})

interface DaemonRow {
  name: string
  status: string
}

const daemonRows = computed<DaemonRow[]>(() =>
  Object.entries(services.value)
    .map(([name, status]) => ({ name, status }))
    .sort((a, b) => a.name.localeCompare(b.name))
)

const runningCount = computed(() => daemonRows.value.filter(r => r.status === 'running').length)
const stoppedCount = computed(() => daemonRows.value.filter(r => r.status !== 'running').length)

onMounted(async () => {
  const info = await getSystemInfo()
  if (!info) {
    error.value = 'Failed to load system status.'
  } else {
    services.value = info.services ?? {}
  }
  loading.value = false
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.status-page {
  padding: 0 20px 20px;
  min-height: 100%;
}

.breadcrumbs-row {
  padding-bottom: 4px;
}

.page-header {
  padding: 8px 0 16px;
}

.page-title {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var($error);
  @include body-large;

  .pi { font-size: 18px; }
}

.empty-state {
  padding: 16px;
  color: var($secondary-text-on-surface);
  @include body-small;
}

.status-card {
  background: var($surface);
  border-radius: 6px;
  border: 1px solid var($border-light-on-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  max-width: 640px;

  &__header {
    background: var($primary);
    padding: 12px 16px;
    @include subtitle1;
    color: var($primary-text-on-color);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;

    .pi { font-size: 16px; }
  }

  &__counts {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }
}

.count-badge {
  @include body-small;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;

  &--running {
    background: rgba(22, 101, 52, 0.15);
    color: #166534;
  }

  &--stopped {
    background: rgba(183, 28, 28, 0.15);
    color: #b71c1c;
  }
}

:global(html.open-dark) .count-badge--running {
  background: rgba(110, 231, 183, 0.15);
  color: #6ee7b7;
}

:global(html.open-dark) .count-badge--stopped {
  background: rgba(252, 165, 165, 0.15);
  color: #fca5a5;
}

.status-table-wrap {
  overflow-x: auto;
}

.status-table {
  width: 100%;
  border-collapse: collapse;

  thead tr {
    border-bottom: 2px solid var($border-on-surface);
  }

  th {
    padding: 10px 16px;
    text-align: left;
    @include body-small;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody tr {
    border-bottom: 1px solid var($border-light-on-surface);

    &:last-child { border-bottom: none; }

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }
  }

  td {
    padding: 10px 16px;
    @include body-small;
    color: var($primary-text-on-surface);
  }
}

.daemon-name {
  font-family: var($font-family);
  font-weight: 500;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 10px;
  @include body-small;
  font-weight: 600;

  &--running {
    background: rgba(22, 101, 52, 0.1);
    color: #166534;
  }

  &--stopped {
    background: rgba(183, 28, 28, 0.1);
    color: #b71c1c;
  }

  .pi { font-size: 12px; }
}

:global(html.open-dark) .status-badge--running {
  background: rgba(110, 231, 183, 0.15);
  color: #6ee7b7;
}

:global(html.open-dark) .status-badge--stopped {
  background: rgba(252, 165, 165, 0.15);
  color: #fca5a5;
}

:global(html.open-dark) .status-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.04);
}
</style>
