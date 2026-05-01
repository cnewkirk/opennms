<template>
  <div class="delete-event-config-event-dialog">
    <Dialog
      v-model:visible="store.deleteEventConfigEventDialogState.visible"
      header="Delete Event Configuration Event"
      modal
      :style="{ width: '480px' }"
      @hide="store.hideDeleteEventConfigEventDialog()"
    >
      <div class="modal-body">
        <p>
          This will delete the event configuration event:
          <strong>{{ store.deleteEventConfigEventDialogState.eventConfigEvent?.eventLabel }}</strong>
          with source name:
          <strong>{{ store.selectedSource?.name }}</strong>
        </p>
        <p><strong>Are you sure you want to proceed?</strong></p>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="store.hideDeleteEventConfigEventDialog()" />
        <Button label="Delete" @click="deleteEventConfigEvent(store.deleteEventConfigEventDialogState?.eventConfigEvent?.id)" />
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
import useSnackbar from '@/composables/useSnackbar'
import { deleteEventConfigEventBySourceId } from '@/services/eventConfigService'
import { useEventConfigDetailStore } from '@/stores/eventConfigDetailStore'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const store = useEventConfigDetailStore()
const router = useRouter()
const { showSnackBar } = useSnackbar()
const labels = {
  title: 'Delete Event Configuration Event'
}

const deleteEventConfigEvent = async (id?: number) => {
  if (!id || !store.selectedSource?.id) {
    showSnackBar({ msg: 'Missing source or event ID', error: true })
    return
  }

  try {
    const result = await deleteEventConfigEventBySourceId(store.selectedSource.id, [id])
    if (result) {
      showSnackBar({ msg: 'Event configuration event deleted successfully', error: false })
      store.resetEventConfigEvents()
      store.hideDeleteEventConfigEventDialog()
      if (store.selectedSource.eventCount === 0) {
        router.push({ name: 'Event Configuration' })
      } else {
        await store.fetchEventsBySourceId()
      }
    } else {
      showSnackBar({ msg: 'Failed to delete event configuration event', error: true })
    }
  } catch (error) {
    console.error('Error deleting event configuration event:', error)
    showSnackBar({ msg: 'Failed to delete event configuration event', error: true })
  }
}
</script>

<style scoped lang="scss"></style>

