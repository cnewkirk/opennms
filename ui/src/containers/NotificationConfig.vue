<template>
  <div class="notif-config-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <h2 class="headline4">Notification Configuration</h2>
      </div>
    </div>

    <div class="feather-row notif-config-page__cards">
      <!-- Global Status card -->
      <div class="feather-col-6">
        <div class="notif-card">
          <div class="notif-card__header">Global Notification Status</div>
          <div class="notif-card__body">
            <div v-if="statusLoading" class="notif-card__status-text">Loading…</div>
            <template v-else>
              <div class="notif-card__status-row">
                <span class="notif-card__status-label">Notifications are currently:</span>
                <span :class="['notif-card__status-badge', status === 'on' ? 'notif-card__status-badge--on' : 'notif-card__status-badge--off']">
                  {{ status === 'on' ? 'ON' : 'OFF' }}
                </span>
              </div>
              <div class="notif-card__actions">
                <Button severity="secondary" :disabled="toggling" @click="toggleStatus" :label="toggling ? 'Updating…' : (status === 'on' ? 'Turn Off' : 'Turn On')" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Navigation card -->
      <div class="feather-col-6">
        <div class="notif-card">
          <div class="notif-card__header">Manage</div>
          <div class="notif-card__body notif-card__body--nav">
            <Button label="Manage Notification Rules" @click="router.push('/notification-config/rules')" />
            <Button label="Manage Destination Paths" @click="router.push('/notification-config/paths')" />
            <a :href="baseHref + 'admin/notification/noticeWizard/buildPathOutage.jsp'" class="notif-legacy-link">
              Path Outage (legacy)
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import useSnackbar from '@/composables/useSnackbar'
import notifdConfigService from '@/services/notifdConfigService'
import { BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'

const router = useRouter()
const { showSnackBar } = useSnackbar()
const menuStore = useMenuStore()
const baseHref = computed<string>(() => menuStore.mainMenu.baseHref ?? '/opennms/')

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Notification Configuration', to: '#', position: 'last' }
]

const status = ref<'on' | 'off'>('off')
const statusLoading = ref(true)
const toggling = ref(false)

onMounted(async () => {
  const s = await notifdConfigService.getStatus()
  if (s) status.value = s.status
  statusLoading.value = false
})

async function toggleStatus() {
  toggling.value = true
  const newStatus = status.value === 'on' ? 'off' : 'on'
  const ok = await notifdConfigService.setStatus(newStatus)
  if (ok) {
    status.value = newStatus
    showSnackBar({ msg: `Notifications turned ${newStatus}.` })
  } else {
    showSnackBar({ msg: 'Failed to update notification status.' })
  }
  toggling.value = false
}
</script>

<style lang="scss" scoped>
.notif-config-page {
  padding: 1.5rem;

  &__cards {
    margin-top: 1rem;
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

    &--nav {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
    }
  }

  &__status-text {
    color: var(--feather-secondary-text-on-surface);
  }

  &__status-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  &__status-label {
    color: var(--feather-primary-text-on-surface);
    font-size: 0.95rem;
  }

  &__status-badge {
    font-weight: 700;
    font-size: 0.85rem;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;

    &--on {
      background: rgba(var(--feather-success), 0.08);
      color: var(--feather-success);
    }

    &--off {
      background: rgba(var(--feather-error), 0.08);
      color: var(--feather-error);
    }
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
  }
}

.notif-legacy-link {
  color: var(--feather-primary);
  font-size: 0.9rem;
  text-decoration: underline;
}
</style>
