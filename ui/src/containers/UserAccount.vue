<template>
  <div class="account-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="account-layout">
      <div class="account-card" id="change-password">
        <div class="account-card__header">Change Password</div>
        <div class="account-card__body">
          <div v-if="!isInternal" class="account-notice">
            <i class="pi pi-info-circle" />
            This account uses external authentication (e.g. LDAP). Changing your password here may have no effect.
          </div>

          <form class="account-form" @submit.prevent="submit">
            <div class="account-form__row">
              <label class="account-form__label" for="new-password">New Password</label>
              <Password
                id="new-password"
                v-model="newPassword"
                :feedback="true"
                toggle-mask
                class="account-form__input"
                input-class="account-form__password-input"
                placeholder="Enter new password"
                autocomplete="new-password"
              />
            </div>
            <div class="account-form__row">
              <label class="account-form__label" for="confirm-password">Confirm Password</label>
              <Password
                id="confirm-password"
                v-model="confirmPassword"
                :feedback="false"
                toggle-mask
                class="account-form__input"
                input-class="account-form__password-input"
                placeholder="Confirm new password"
                autocomplete="new-password"
              />
            </div>

            <div v-if="errorMsg" class="account-form__error">
              <i class="pi pi-exclamation-triangle" /> {{ errorMsg }}
            </div>
            <div v-if="successMsg" class="account-form__success">
              <i class="pi pi-check-circle" /> {{ successMsg }}
            </div>

            <div class="account-form__actions">
              <Button
                type="submit"
                label="Change Password"
                icon="pi pi-lock"
                :loading="saving"
                :disabled="!newPassword || !confirmPassword"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Password from 'primevue/password'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { useMenuStore } from '@/stores/menuStore'
import { useAuthStore } from '@/stores/authStore'
import { changePassword } from '@/services/userGroupService'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const authStore = useAuthStore()

const homeUrl = computed(() => menuStore.mainMenu.homeUrl)
const username = computed(() => menuStore.mainMenu.username || authStore.whoAmI.id || '')
const isInternal = computed(() => authStore.whoAmI.internal !== false)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Account', to: '#', position: 'last' }
])

const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const submit = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match.'
    return
  }
  if (newPassword.value.length < 4) {
    errorMsg.value = 'Password must be at least 4 characters.'
    return
  }

  saving.value = true
  const ok = await changePassword(username.value, newPassword.value)
  saving.value = false

  if (ok) {
    successMsg.value = 'Password changed successfully.'
    newPassword.value = ''
    confirmPassword.value = ''
  } else {
    errorMsg.value = 'Failed to change password. Check your permissions.'
  }
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.account-page {
  padding: 0 20px 20px;
  min-height: 100%;
}

.account-layout {
  display: grid;
  grid-template-columns: minmax(0, 480px);
  gap: 16px;
  padding-top: 16px;
}

.account-card {
  background: var($surface);
  border-radius: 6px;
  border: 1px solid var($border-light-on-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  &__header {
    background: var($primary);
    padding: 12px 16px;
    @include subtitle1;
    color: var($primary-text-on-color);
    font-weight: 600;
  }

  &__body {
    padding: 20px 16px;
  }
}

.account-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(var(--feather-primary-r, 0), var(--feather-primary-g, 83), var(--feather-primary-b, 188), 0.08);
  color: var($secondary-text-on-surface);
  font-size: 0.8125rem;
  margin-bottom: 16px;

  .pi { margin-top: 2px; flex-shrink: 0; }
}

.account-form {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__label {
    @include body-small;
    font-weight: 500;
    color: var($secondary-text-on-surface);
  }

  &__input {
    width: 100%;
  }

  &__password-input {
    width: 100%;
  }

  &__error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #b71c1c;
    font-size: 0.8125rem;

    .pi { font-size: 14px; }
  }

  &__success {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #166534;
    font-size: 0.8125rem;

    .pi { font-size: 14px; }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 4px;
  }
}

:global(html.open-dark .account-form__error)   { color: #fca5a5; }
:global(html.open-dark .account-form__success) { color: #6ee7b7; }
</style>
