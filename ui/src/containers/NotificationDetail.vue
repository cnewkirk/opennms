<template>
  <div class="notification-detail-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div v-if="loading" class="feather-row">
      <div class="feather-col-12 notification-detail-page__status">Loading…</div>
    </div>

    <div v-else-if="!notification" class="feather-row">
      <div class="feather-col-12 notification-detail-page__status">Notification not found.</div>
    </div>

    <template v-else>
      <div class="feather-row">
        <div class="feather-col-12">
          <div class="card">
            <div class="card__header">
              <span class="card__title">Notification #{{ id }}</span>
              <Button
                v-if="isAdmin && !notification.answerTime"
                label="Acknowledge"
                size="small"
                :disabled="acking"
                @click="doAck"
              />
            </div>
            <div class="card__body">
              <dl class="detail-grid">
                <dt>Page Time</dt>
                <dd>{{ formatDate(notification.pageTime) }}</dd>

                <dt>Respond Time</dt>
                <dd>{{ formatDate(notification.respondTime) }}</dd>

                <dt>Answer Time</dt>
                <dd>{{ formatDate(notification.answerTime) }}</dd>

                <dt>Node</dt>
                <dd>
                  <router-link v-if="notification.nodeId" :to="`/node/${notification.nodeId}`">
                    {{ notification.nodeLabel ?? notification.nodeId }}
                  </router-link>
                  <span v-else>—</span>
                </dd>

                <dt>IP Address</dt>
                <dd>{{ notification.ipAddress ?? '—' }}</dd>

                <dt>Message</dt>
                <dd class="detail-grid__msg">{{ notification.textMsg }}</dd>

                <template v-if="notification.numericMsg">
                  <dt>Numeric Message</dt>
                  <dd>{{ notification.numericMsg }}</dd>
                </template>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import { useMenuStore } from '@/stores/menuStore'
import { useAuthStore } from '@/stores/authStore'
import {
  getNotification,
  acknowledgeNotifications,
  type Notification
} from '@/services/notificationInboxService'
import useSnackbar from '@/composables/useSnackbar'
import { type BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const authStore = useAuthStore()
const { showSnackBar } = useSnackbar()

const id = Number(route.params.id)
const notification = ref<Notification | null>(null)
const loading = ref(true)
const acking = ref(false)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const isAdmin = computed(() => authStore.whoAmI?.roles?.includes('ROLE_ADMIN'))

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Notifications', to: '/notifications' },
  { label: `Notification #${id}`, to: '#', position: 'last' }
])

const formatDate = (ts?: number | null): string => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

const doAck = async () => {
  acking.value = true
  const ok = await acknowledgeNotifications([id])
  if (ok) {
    showSnackBar({ msg: 'Notification acknowledged.' })
    if (notification.value) {
      notification.value = { ...notification.value, answerTime: Date.now() }
    }
  } else {
    showSnackBar({ msg: 'Failed to acknowledge notification.' })
  }
  acking.value = false
}

onMounted(async () => {
  try {
    notification.value = await getNotification(id)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.notification-detail-page {
  padding: 0 0 40px;

  &__status {
    padding: 24px;
    color: var($secondary-text-on-surface);
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

  &__body {
    padding: 16px;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 20px;
  margin: 0;

  dt {
    font-weight: 600;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    font-size: 13px;
  }

  dd {
    margin: 0;
    font-size: 13px;
    word-break: break-word;

    a {
      color: var($clickable-normal);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  }

  &__msg {
    font-family: monospace;
    font-size: 12px;
    white-space: pre-wrap;
    background: var($shade-4);
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid var($shade-3);
  }
}
</style>
