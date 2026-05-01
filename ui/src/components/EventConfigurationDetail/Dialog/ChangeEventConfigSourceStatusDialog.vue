<template>
  <div class="change-event-conf-event-status-dialog">
    <Dialog
      v-model:visible="store.changeEventConfigSourceStatusDialogState.visible"
      header="Change Event Configuration Source Status"
      modal
      :style="{ width: '480px' }"
      data-test="feather-dialog"
      @hide="store.hideChangeEventConfigSourceStatusDialog()"
    >
      <div class="modal-body">
        <p v-html="getMessage()"></p>
        <p v-if="store.changeEventConfigSourceStatusDialogState.eventConfigSource?.vendor === VENDOR_OPENNMS">
          <strong>Note: Changing the status of an OpenNMS event configuration source may effect the OpenNMS system functionality. </strong>
        </p>
        <p><strong>Are you sure you want to proceed?</strong></p>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="store.hideChangeEventConfigSourceStatusDialog()" />
        <Button label="Save" @click="changeStatus()" />
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
import useSnackbar from '@/composables/useSnackbar'
import { VENDOR_OPENNMS } from '@/lib/utils'
import { useEventConfigDetailStore } from '@/stores/eventConfigDetailStore'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const store = useEventConfigDetailStore()
const { showSnackBar } = useSnackbar()
const labels = {
  title: 'Change Event Configuration Source Status'
}

const getMessage = () => {
  const isEnabled = store.changeEventConfigSourceStatusDialogState.eventConfigSource?.enabled
  const filename = store.changeEventConfigSourceStatusDialogState.eventConfigSource?.name || ''
  const action = isEnabled ? 'disable' : 'enable'
  return `This will ${action} the event configuration source: <strong>${filename}</strong> and ${action} all events associated with it.`
}

const changeStatus = async () => {
  try {
    if (store.changeEventConfigSourceStatusDialogState.eventConfigSource) {
      const sourceId = store.changeEventConfigSourceStatusDialogState.eventConfigSource.id
      if (store.changeEventConfigSourceStatusDialogState.eventConfigSource.enabled) {
        await store.disableEventConfigSource(sourceId)
      } else {
        await store.enableEventConfigSource(sourceId)
      }
      store.hideChangeEventConfigSourceStatusDialog()
    } else {
      console.error('No event configuration event selected')
      showSnackBar({ msg: 'No event configuration source selected', error: true })
    }
  } catch (error) {
    console.error('Error changing event configuration event status:', error)
    showSnackBar({ msg: 'Error changing event configuration source status', error: true })
  }
}
</script>

<style scoped lang="scss"></style>

