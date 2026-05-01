<template>
  <Dialog v-model:visible="open" :header="dialogLabels.title" modal :style="{ width: '560px' }" @hide="handleCancel">
    <div class="group-edit-dialog">
      <!-- Name -->
      <div class="group-edit-dialog__field">
        <template v-if="isNew">
          <label class="p-label">Group Name</label>
          <InputText v-model="form.name" :disabled="saving" class="w-full" />
        </template>
        <template v-else>
          <p class="body2 group-edit-dialog__readonly-label">Group Name</p>
          <p class="subtitle2">{{ form.name }}</p>
        </template>
      </div>

      <div class="group-edit-dialog__field">
        <label class="p-label">Comments</label>
        <InputText v-model="form.comments" :disabled="saving" class="w-full" />
      </div>

      <!-- Members section (edit mode only) -->
      <template v-if="!isNew">
        <div class="group-edit-dialog__section">
          <div class="group-edit-dialog__section-header">
            <span class="subtitle2">Members</span>
          </div>

          <div
            v-for="member in form.members"
            :key="member"
            class="group-edit-dialog__item-row"
          >
            <span class="body2">{{ member }}</span>
            <Button label="Remove" text @click="removeMember(member)" :disabled="saving" />
          </div>
          <p v-if="!form.members.length" class="body2 group-edit-dialog__empty">No members.</p>

          <div class="group-edit-dialog__add-row">
            <select class="group-edit-dialog__select" v-model="selectedUserToAdd" :disabled="saving">
              <option value="">— Add a user —</option>
              <option v-for="u in availableUsersToAdd" :key="u" :value="u">{{ u }}</option>
            </select>
            <Button label="Add" text @click="addMember" :disabled="saving || !selectedUserToAdd" />
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
import { OnmsGroup, OnmsUser } from '@/types'
import { createGroup, updateGroup, addGroupUser, removeGroupUser } from '@/services/userGroupService'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps<{
  modelValue: boolean
  group: OnmsGroup | null
  allUsers: OnmsUser[]
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

const isNew = computed(() => props.group === null)

const dialogLabels = computed(() => ({
  title: isNew.value ? 'New Group' : `Edit Group: ${props.group?.name ?? ''}`,
  close: 'Close'
}))

interface GroupForm {
  name: string
  comments: string
  members: string[]
}

const makeDefaultForm = (): GroupForm => ({
  name: '',
  comments: '',
  members: []
})

const form = ref<GroupForm>(makeDefaultForm())
const saving = ref(false)
const selectedUserToAdd = ref('')
const originalMembers = ref<string[]>([])

const availableUsersToAdd = computed(() => {
  const allUserIds = props.allUsers.map(u => u['user-id'])
  return allUserIds.filter(id => !form.value.members.includes(id))
})

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.group) {
        form.value = {
          name: props.group.name,
          comments: props.group.comments ?? '',
          members: [...(props.group.user ?? [])]
        }
        originalMembers.value = [...(props.group.user ?? [])]
      } else {
        form.value = makeDefaultForm()
        originalMembers.value = []
      }
      selectedUserToAdd.value = ''
    }
  }
)

const addMember = () => {
  if (selectedUserToAdd.value && !form.value.members.includes(selectedUserToAdd.value)) {
    form.value.members.push(selectedUserToAdd.value)
    selectedUserToAdd.value = ''
  }
}

const removeMember = (member: string) => {
  form.value.members = form.value.members.filter(m => m !== member)
}

const handleSave = async () => {
  if (!form.value.name.trim()) {
    showSnackBar({ msg: 'Group name is required.', error: true })
    return
  }

  saving.value = true

  if (isNew.value) {
    const ok = await createGroup(form.value.name.trim(), form.value.comments)
    if (!ok) {
      saving.value = false
      showSnackBar({ msg: 'Failed to create group.', error: true })
      return
    }
  } else {
    const groupName = form.value.name

    const updateOk = await updateGroup(groupName, form.value.comments)
    if (!updateOk) {
      saving.value = false
      showSnackBar({ msg: 'Failed to update group.', error: true })
      return
    }

    // Diff members
    const toAdd = form.value.members.filter(m => !originalMembers.value.includes(m))
    const toRemove = originalMembers.value.filter(m => !form.value.members.includes(m))

    const memberResults = await Promise.all([
      ...toAdd.map(u => addGroupUser(groupName, u)),
      ...toRemove.map(u => removeGroupUser(groupName, u))
    ])

    if (memberResults.some(r => r === false)) {
      saving.value = false
      showSnackBar({ msg: 'Some member changes could not be applied.', error: true })
      return
    }
  }

  saving.value = false
  emit('saved')
  open.value = false
}

const handleCancel = () => {
  open.value = false
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@featherds/styles/mixins/typography";

.group-edit-dialog {
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

  &__item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var($border-on-surface);

    &:last-of-type {
      border-bottom: none;
    }
  }

  &__add-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-top: 10px;

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
    margin: 4px 0;
  }
}
</style>
