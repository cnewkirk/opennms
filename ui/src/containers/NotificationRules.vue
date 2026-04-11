<template>
  <div class="notif-rules-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="notif-rules-page__header feather-row">
      <div class="feather-col-8">
        <h2 class="headline4">Notification Rules</h2>
      </div>
      <div class="feather-col-4 notif-rules-page__header-actions">
        <FeatherButton secondary :disabled="reloading" @click="reloadNotifd">
          {{ reloading ? 'Reloading…' : 'Reload Notifd' }}
        </FeatherButton>
        <FeatherButton primary @click="router.push('/notification-config/rules/new')">
          + New Rule
        </FeatherButton>
      </div>
    </div>

    <div v-if="loading" class="notif-rules-page__status">Loading…</div>
    <div v-else-if="loadError" class="notif-rules-page__status notif-rules-page__status--error">
      Failed to load notification rules.
    </div>

    <template v-if="!loading && !loadError">
      <div class="notif-card">
        <div class="notif-card__header">Rules</div>
        <div class="notif-card__body">
          <table class="notif-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event UEI</th>
                <th>Destination Path</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in rules" :key="rule.name">
                <td>{{ rule.name }}</td>
                <td class="notif-table__uei">{{ rule.uei }}</td>
                <td>{{ rule.destinationPath }}</td>
                <td>
                  <span :class="['notif-status-badge', rule.status === 'on' ? 'notif-status-badge--on' : 'notif-status-badge--off']">
                    {{ rule.status === 'on' ? 'ON' : 'OFF' }}
                  </span>
                </td>
                <td class="notif-table__actions">
                  <FeatherButton text @click="toggleRule(rule)">
                    {{ rule.status === 'on' ? 'Disable' : 'Enable' }}
                  </FeatherButton>
                  <FeatherButton text @click="router.push(`/notification-config/rules/${encodeURIComponent(rule.name)}`)">
                    Edit
                  </FeatherButton>
                  <FeatherButton text @click="deleteRule(rule.name)">Delete</FeatherButton>
                </td>
              </tr>
              <tr v-if="rules.length === 0">
                <td colspan="5" class="notif-table__empty">No notification rules configured.</td>
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
import { FeatherButton } from '@featherds/button'
import useSnackbar from '@/composables/useSnackbar'
import notificationConfigService, { NotificationConfigDTO } from '@/services/notificationConfigService'
import { BreadCrumb } from '@/types'

const router = useRouter()
const { showSnackBar } = useSnackbar()

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Notification Configuration', to: '/notification-config' },
  { label: 'Rules', to: '#', position: 'last' }
]

const rules = ref<NotificationConfigDTO[]>([])
const loading = ref(true)
const loadError = ref(false)
const reloading = ref(false)

onMounted(async () => {
  await loadRules()
})

async function loadRules() {
  loading.value = true
  loadError.value = false
  try {
    rules.value = await notificationConfigService.getNotificationConfigs()
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function toggleRule(rule: NotificationConfigDTO) {
  const ok = await notificationConfigService.toggleNotificationConfig(rule.name)
  if (ok) {
    rule.status = rule.status === 'on' ? 'off' : 'on'
  } else {
    showSnackBar({ msg: `Failed to toggle rule "${rule.name}".` })
  }
}

async function deleteRule(name: string) {
  if (!window.confirm(`Delete notification rule "${name}"?`)) return
  const ok = await notificationConfigService.deleteNotificationConfig(name)
  if (ok) {
    rules.value = rules.value.filter(r => r.name !== name)
    showSnackBar({ msg: `Rule "${name}" deleted.` })
  } else {
    showSnackBar({ msg: `Failed to delete rule "${name}".` })
  }
}

async function reloadNotifd() {
  reloading.value = true
  const ok = await notificationConfigService.reloadNotifications()
  if (ok) {
    showSnackBar({ msg: 'Notifd reloaded.' })
  } else {
    showSnackBar({ msg: 'Failed to reload notifd.' })
  }
  reloading.value = false
}
</script>

<style lang="scss" scoped>
.notif-rules-page {
  padding: 1.5rem;

  &__header {
    align-items: center;
    margin-bottom: 1.5rem;
  }

  &__header-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
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

  &__uei {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--feather-secondary-text-on-surface);
    max-width: 300px;
    word-break: break-all;
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

.notif-status-badge {
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;

  &--on {
    background: rgba(var(--feather-success), 0.08);
    color: var(--feather-success);
  }

  &--off {
    background: rgba(var(--feather-error), 0.08);
    color: var(--feather-error);
  }
}
</style>
