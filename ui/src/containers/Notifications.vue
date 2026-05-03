<template>
  <div class="notifications-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="card__header">
            <span class="card__title">Notifications</span>
            <Button
              v-if="isAdmin && selectedIds.length > 0"
              label="Acknowledge Selected"
              size="small"
              :disabled="acking"
              @click="acknowledgeSelected"
            />
          </div>

          <DataTable
            v-model:selection="selectedRows"
            :value="notifications"
            :loading="loading"
            size="small"
            striped-rows
            :row-class="() => 'notifications-page__row'"
            @row-click="onRowClick"
          >
            <template #empty>
              <span v-if="!loading">No unacknowledged notifications.</span>
            </template>
            <Column v-if="isAdmin" selection-mode="multiple" header-style="width:3rem" />
            <Column header="Date" sortable sort-field="pageTime">
              <template #body="{ data }">
                {{ formatDate(data.pageTime) }}
              </template>
            </Column>
            <Column field="nodeLabel" header="Node" sortable>
              <template #body="{ data }">
                <router-link v-if="data.nodeId" :to="`/node/${data.nodeId}`">
                  {{ data.nodeLabel ?? data.nodeId }}
                </router-link>
                <span v-else>—</span>
              </template>
            </Column>
            <Column field="ipAddress" header="IP Address" sortable>
              <template #body="{ data }">{{ data.ipAddress ?? '—' }}</template>
            </Column>
            <Column header="Message">
              <template #body="{ data }">
                <span class="notifications-page__msg" :title="data.textMsg">
                  {{ truncate(data.textMsg, 80) }}
                </span>
              </template>
            </Column>
            <Column header="Acknowledged">
              <template #body="{ data }">
                <span v-if="data.answerTime" class="ack-badge ack-badge--yes">Yes</span>
                <span v-else class="ack-badge ack-badge--no">No</span>
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
import { useRouter } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import { useMenuStore } from '@/stores/menuStore'
import { useAuthStore } from '@/stores/authStore'
import {
  getNotifications,
  acknowledgeNotifications,
  type Notification
} from '@/services/notificationInboxService'
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
  { label: 'Notifications', to: '#', position: 'last' }
])

const notifications = ref<Notification[]>([])
const loading = ref(true)
const acking = ref(false)
const selectedRows = ref<Notification[]>([])

const selectedIds = computed(() => selectedRows.value.map(n => n.notifyId))

const formatDate = (ts?: number | null): string => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

const truncate = (s: string, max: number): string => {
  if (!s) return '—'
  return s.length > max ? s.slice(0, max) + '…' : s
}

const onRowClick = (event: any) => {
  const n = event.data as Notification
  router.push(`/notification/${n.notifyId}`)
}

const acknowledgeSelected = async () => {
  if (!selectedIds.value.length) return
  acking.value = true
  const ok = await acknowledgeNotifications(selectedIds.value)
  if (ok) {
    showSnackBar({ msg: `Acknowledged ${selectedIds.value.length} notification(s).` })
    selectedRows.value = []
    loading.value = true
    try {
      const result = await getNotifications({ limit: 50 })
      notifications.value = result.notifications
    } finally {
      loading.value = false
    }
  } else {
    showSnackBar({ msg: 'Failed to acknowledge notifications.' })
  }
  acking.value = false
}

onMounted(async () => {
  try {
    const result = await getNotifications({ limit: 50 })
    notifications.value = result.notifications
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.notifications-page {
  padding: 0 0 40px;

  &__row {
    cursor: pointer;
  }

  &__msg {
    font-size: 13px;
    color: var($primary-text-on-surface);
  }
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

.ack-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  &--yes {
    background: color-mix(in srgb, var($success) 15%, transparent);
    color: var($success);
  }

  &--no {
    background: color-mix(in srgb, var($warning) 15%, transparent);
    color: var($warning);
  }
}
</style>
