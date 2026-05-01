<template>
  <Dialog v-model:visible="open" :header="dialogLabels.title" modal :style="{ width: '560px' }" @hide="handleCancel">
    <div class="user-edit-dialog">
      <!-- User ID -->
      <div class="user-edit-dialog__field">
        <template v-if="isNew">
          <label class="p-label">User ID</label>
          <InputText v-model="form.userId" :disabled="saving" class="w-full" />
        </template>
        <template v-else>
          <p class="body2 user-edit-dialog__readonly-label">User ID</p>
          <p class="subtitle2">{{ form.userId }}</p>
        </template>
      </div>

      <div class="user-edit-dialog__field">
        <label class="p-label">Full Name</label>
        <InputText v-model="form.fullName" :disabled="saving" class="w-full" />
      </div>

      <div class="user-edit-dialog__field">
        <label class="p-label">Email</label>
        <InputText v-model="form.email" type="email" :disabled="saving" class="w-full" />
      </div>

      <div class="user-edit-dialog__field">
        <label class="p-label">Comments</label>
        <InputText v-model="form.comments" :disabled="saving" class="w-full" />
      </div>

      <!-- Password section -->
      <template v-if="isNew">
        <div class="user-edit-dialog__field">
          <label class="p-label">Password</label>
          <InputText v-model="form.password" type="password" :disabled="saving" class="w-full" />
        </div>
        <div class="user-edit-dialog__field">
          <label class="p-label">Confirm Password</label>
          <InputText v-model="form.confirmPassword" type="password" :disabled="saving" class="w-full" />
        </div>
      </template>
      <template v-else>
        <div class="user-edit-dialog__section">
          <div class="user-edit-dialog__section-header">
            <span class="subtitle2">Password</span>
            <Button text @click="showChangePassword = !showChangePassword" :disabled="saving"
              :label="showChangePassword ? 'Cancel' : 'Change Password'" />
          </div>
          <template v-if="showChangePassword">
            <div class="user-edit-dialog__field">
              <label class="p-label">New Password</label>
              <InputText v-model="form.password" type="password" :disabled="saving" class="w-full" />
            </div>
            <div class="user-edit-dialog__field">
              <label class="p-label">Confirm New Password</label>
              <InputText v-model="form.confirmPassword" type="password" :disabled="saving" class="w-full" />
            </div>
          </template>
        </div>

        <!-- Roles section -->
        <div class="user-edit-dialog__section">
          <div class="user-edit-dialog__section-header">
            <span class="subtitle2">Roles</span>
          </div>
          <div class="user-edit-dialog__roles">
            <span
              v-for="role in form.roles"
              :key="role"
              class="user-edit-dialog__role-chip"
            >
              {{ role }}
              <button
                class="user-edit-dialog__role-remove"
                @click="removeRole(role)"
                :disabled="saving"
                :aria-label="`Remove ${role}`"
              >×</button>
            </span>
            <span v-if="!form.roles.length" class="body2 user-edit-dialog__empty">No roles assigned.</span>
          </div>
          <div class="user-edit-dialog__add-row">
            <select class="user-edit-dialog__select" v-model="selectedRoleToAdd" :disabled="saving">
              <option value="">— Add a role —</option>
              <option v-for="r in availableRolesToAdd" :key="r" :value="r">{{ r }}</option>
            </select>
            <Button label="Add" text @click="addRole" :disabled="saving || !selectedRoleToAdd" />
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="handleCancel" :disabled="saving" />
      <Button :label="saving ? 'Saving…' : 'Save'" @click="handleSave" :disabled="saving" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { OnmsUser } from '@/types'
import { createUser, updateUser, changePassword, addUserRole, removeUserRole } from '@/services/userGroupService'
import useSnackbar from '@/composables/useSnackbar'

const AVAILABLE_ROLES = [
  'ROLE_USER', 'ROLE_ADMIN', 'ROLE_READONLY', 'ROLE_DASHBOARD', 'ROLE_DELEGATE',
  'ROLE_RTC', 'ROLE_PROVISION', 'ROLE_REST', 'ROLE_ASSET_EDITOR', 'ROLE_FILESYSTEM_EDITOR',
  'ROLE_MOBILE', 'ROLE_JMX', 'ROLE_MINION', 'ROLE_REPORT_DESIGNER', 'ROLE_FLOW_MANAGER',
  'ROLE_DEVICE_CONFIG_BACKUP'
]

const props = defineProps<{
  modelValue: boolean
  user: OnmsUser | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved'): void
}>()

const { showSnackBar } = useSnackbar()

const open = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isNew = computed(() => props.user === null)

const dialogLabels = computed(() => ({
  title: isNew.value ? 'New User' : `Edit User: ${props.user?.['user-id'] ?? ''}`,
  close: 'Close'
}))

interface UserForm {
  userId: string
  fullName: string
  email: string
  comments: string
  password: string
  confirmPassword: string
  roles: string[]
}

const makeDefaultForm = (): UserForm => ({
  userId: '',
  fullName: '',
  email: '',
  comments: '',
  password: '',
  confirmPassword: '',
  roles: []
})

const form = ref<UserForm>(makeDefaultForm())
const saving = ref(false)
const showChangePassword = ref(false)
const selectedRoleToAdd = ref('')
const originalRoles = ref<string[]>([])

const availableRolesToAdd = computed(() =>
  AVAILABLE_ROLES.filter(r => !form.value.roles.includes(r))
)

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.user) {
        const u = props.user
        form.value = {
          userId: u['user-id'],
          fullName: u['full-name'] ?? '',
          email: u.email ?? '',
          comments: u['user-comments'] ?? '',
          password: '',
          confirmPassword: '',
          roles: [...(u.role ?? [])]
        }
        originalRoles.value = [...(u.role ?? [])]
      } else {
        form.value = makeDefaultForm()
        originalRoles.value = []
      }
      showChangePassword.value = false
      selectedRoleToAdd.value = ''
    }
  }
)

const addRole = () => {
  if (selectedRoleToAdd.value && !form.value.roles.includes(selectedRoleToAdd.value)) {
    form.value.roles.push(selectedRoleToAdd.value)
    selectedRoleToAdd.value = ''
  }
}

const removeRole = (role: string) => {
  form.value.roles = form.value.roles.filter(r => r !== role)
}

const handleSave = async () => {
  if (!form.value.userId.trim()) {
    showSnackBar({ msg: 'User ID is required.', error: true })
    return
  }

  if (isNew.value) {
    if (!form.value.password) {
      showSnackBar({ msg: 'Password is required.', error: true })
      return
    }
    if (form.value.password !== form.value.confirmPassword) {
      showSnackBar({ msg: 'Passwords do not match.', error: true })
      return
    }
    saving.value = true
    const ok = await createUser({
      userId: form.value.userId.trim(),
      fullName: form.value.fullName,
      email: form.value.email,
      comments: form.value.comments,
      password: form.value.password
    })
    saving.value = false
    if (!ok) {
      showSnackBar({ msg: 'Failed to create user.', error: true })
      return
    }
  } else {
    const username = form.value.userId

    if (showChangePassword.value) {
      if (!form.value.password) {
        showSnackBar({ msg: 'Password cannot be empty.', error: true })
        return
      }
      if (form.value.password !== form.value.confirmPassword) {
        showSnackBar({ msg: 'Passwords do not match.', error: true })
        return
      }
    }

    saving.value = true

    const updateOk = await updateUser(username, {
      fullName: form.value.fullName,
      email: form.value.email,
      userComments: form.value.comments
    })

    if (!updateOk) {
      saving.value = false
      showSnackBar({ msg: 'Failed to update user.', error: true })
      return
    }

    if (showChangePassword.value && form.value.password) {
      const pwOk = await changePassword(username, form.value.password)
      if (!pwOk) {
        saving.value = false
        showSnackBar({ msg: 'Failed to change password.', error: true })
        return
      }
    }

    // Diff roles
    const toAdd = form.value.roles.filter(r => !originalRoles.value.includes(r))
    const toRemove = originalRoles.value.filter(r => !form.value.roles.includes(r))

    const roleResults = await Promise.all([
      ...toAdd.map(r => addUserRole(username, r)),
      ...toRemove.map(r => removeUserRole(username, r))
    ])

    saving.value = false

    if (roleResults.some(r => r === false)) {
      showSnackBar({ msg: 'Some role changes could not be applied.', error: true })
      return
    }
  }

  emit('saved')
  open.value = false
}

const handleCancel = () => {
  open.value = false
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.user-edit-dialog {
  min-width: 480px;
  max-width: 560px;

  &__field {
    margin-bottom: 16px;
  }

  &__readonly-label {
    color: var($secondary-text-on-surface);
    margin-bottom: 2px;
  }

  &__section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var($border-on-surface);
  }

  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  &__roles {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
    min-height: 28px;
  }

  &__role-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    background: var($primary);
    color: var($primary-text-on-color);
    font-size: 12px;
  }

  &__role-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    opacity: 0.8;

    &:hover {
      opacity: 1;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  }

  &__add-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;

    > select {
      flex: 1;
    }

    > :last-child {
      flex: 0 0 auto;
    }
  }

  &__select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 14px;
  }

  &__empty {
    color: var($secondary-text-on-surface);
    font-style: italic;
  }
}
</style>
