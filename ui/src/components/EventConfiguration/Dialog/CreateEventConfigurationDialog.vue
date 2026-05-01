<template>
  <Dialog
    v-model:visible="store.createEventConfigSourceDialogState.visible"
    header="Create New Event Source"
    modal
    :style="{ width: '480px' }"
    @hide="handleCancel"
  >
    <div
      v-if="!successMessage"
      class="modal-body-form"
    >
      <div>
        <label class="p-label">Event Configuration Source Name</label>
        <InputText
          v-model="configName"
          class="w-full"
          :invalid="!!error?.name"
        />
        <small v-if="error?.name" class="p-error">{{ error.name }}</small>
      </div>
      <div>
        <label class="p-label">Vendor</label>
        <InputText
          v-model="vendor"
          class="w-full"
          :invalid="!!error?.vendor"
        />
        <small v-if="error?.vendor" class="p-error">{{ error.vendor }}</small>
      </div>
      <div>
        <p>
          Please note that this source will be created with 0 event configurations. You can add event configurations
          after creation.
        </p>
      </div>
    </div>
    <div
      v-else
      class="modal-body-success"
    >
      <p>The event configuration source has been created successfully.</p>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="handleCancel" />
      <Button
        v-if="!successMessage"
        label="Create"
        :disabled="Object.keys(error || {}).length > 0"
        @click="handleSave"
      />
      <Button
        v-else
        label="View Source"
        @click="visitCreatedEventConfigSource"
      />
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import useSnackbar from '@/composables/useSnackbar'
import { addEventConfigSource } from '@/services/eventConfigService'
import { useEventConfigStore } from '@/stores/eventConfigStore'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const router = useRouter()
const configName = ref('')
const vendor = ref('')
const description = ref('')
const successMessage = ref(false)
const snackbar = useSnackbar()
const store = useEventConfigStore()
const newId: Ref<number> = ref(0)
const labels = {
  title: 'Create New Event Source'
}
const error = computed(() => {
  let error: any = {}
  if (configName.value.trim() === '') {
    error.name = 'Configuration name is required.'
  }
  if (vendor.value.trim() === '') {
    error.vendor = 'Vendor is required.'
  }
  return Object.keys(error).length > 0 ? error : null
})

const resetForm = () => {
  configName.value = ''
  description.value = ''
  vendor.value = ''
}

const handleSave = async () => {
  if (configName.value.trim() === '') {
    return
  }

  try {
    const response = await addEventConfigSource(
      configName.value,
      vendor.value,
      description.value
    )

    if (response && typeof response === 'object' && response.status === 201) {
      // Success: response contains { id, name, fileOrder, status: 201 }
      resetForm()
      successMessage.value = true
      newId.value = response.id
    } else if (response === 409) {
      // Conflict: duplicate name
      snackbar.showSnackBar({
        msg: 'An event configuration source with this name already exists.',
        error: true
      })
    } else if (response === 400) {
      // Bad request: validation error
      snackbar.showSnackBar({
        msg: 'Invalid request. Please check your input and try again.',
        error: true
      })
    } else {
      // 500 or any other error
      snackbar.showSnackBar({
        msg: 'Failed to create event configuration source. Please try again.',
        error: true
      })
    }
  } catch (error) {
    console.error('Error creating event configuration source:', error)
    snackbar.showSnackBar({
      msg: 'Failed to create event configuration source. Please try again.',
      error: true
    })
  }
}

const handleCancel = () => {
  resetForm()
  successMessage.value = false
  store.hideCreateEventConfigSourceDialog()
}

const visitCreatedEventConfigSource = () => {
  successMessage.value = false
  store.hideCreateEventConfigSourceDialog()
  if (newId.value > 0) {
    router.push({
      name: 'Event Configuration Detail',
      params: { id: newId.value }
    })
  } else {
    console.error('No new event configuration source ID available.')
    router.push({ name: 'Event Configuration' })
  }
}
</script>

<style lang="scss" scoped></style>

