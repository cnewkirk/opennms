<template>
  <div class="delete-event-config-source-modal">
    <Dialog
      v-model:visible="store.deleteEventConfigSourceDialogState.visible"
      header="Delete Event Configuration Source"
      modal
      :style="{ width: '480px' }"
      @hide="store.hideDeleteEventConfigSourceModal()"
    >
      <div class="modal-body">
        <p>
          This will delete the event configuration source:
          <strong>{{ store.deleteEventConfigSourceDialogState.eventConfigSource?.name }}</strong>
        </p>
        <p>
          <strong>Note:</strong> This event configuration source has
          <strong>{{ store.deleteEventConfigSourceDialogState.eventConfigSource?.eventCount }}</strong> events associated
          with it and will be deleted.
        </p>
        <p><strong>Are you sure you want to proceed?</strong></p>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="store.hideDeleteEventConfigSourceModal()" />
        <Button label="Delete" @click="deleteEventConfigSource()" />
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
import useSnackbar from '@/composables/useSnackbar'
import { deleteEventConfigSourceById } from '@/services/eventConfigService'
import { useEventConfigStore } from '@/stores/eventConfigStore'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const store = useEventConfigStore()
const { showSnackBar } = useSnackbar()
const labels = {
  title: 'Delete Event Configuration Source'
}

const deleteEventConfigSource = async () => {
  if (store.deleteEventConfigSourceDialogState.eventConfigSource === null) {
    return
  }
  try {
    const response = await deleteEventConfigSourceById(store.deleteEventConfigSourceDialogState.eventConfigSource.id)
    if (!response) {
      console.error('Failed to delete event configuration source')
      showSnackBar({ msg: 'Failed to delete event configuration source', error: true })
      return
    }
    store.refreshSourcesFilters()
    store.hideDeleteEventConfigSourceModal()
  } catch (error) {
    console.error('Error deleting event configuration source:', error)
    showSnackBar({ msg: 'Failed to delete event configuration source', error: true })
  }
}
</script>

<style scoped lang="scss"></style>

