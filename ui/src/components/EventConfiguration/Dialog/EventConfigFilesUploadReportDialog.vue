<template>
  <Dialog
    v-model:visible="store.uploadedEventConfigFilesReportDialogState.visible"
    header="Upload Report"
    modal
    :style="{ width: '480px' }"
    @hide="closeDialog"
  >
    <div>
      <h4>Message:</h4>
      <p>{{ getUploadReportStatus() }}</p>
      <h4>Details:</h4>
       <div class="upload-report-scroll">
    <ul>
      <li
        v-for="(file, index) in report.success"
        :key="'success-' + index"
      >
        <span class="text-success">{{ file.file }}</span> - Successfully uploaded
      </li>
      <li
        v-for="(file, index) in report.errors"
        :key="'error-' + index"
      >
        <span class="text-danger">{{ file.file }}</span> - Failed to upload
      </li>
    </ul>
  </div>
    </div>
    <template #footer>
      <Button label="Close" text @click="closeDialog" />
      <Button label="View Uploaded Files" @click="gotoViewTab" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useEventConfigStore } from '@/stores/eventConfigStore'
import { EventConfigFilesUploadResponse } from '@/types/eventConfig'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const store = useEventConfigStore()

const props = defineProps<{
  report: EventConfigFilesUploadResponse
}>()

const closeDialog = async () => {
  await store.fetchEventConfigs()
  store.uploadedEventConfigFilesReportDialogState.visible = false
}

const getUploadReportStatus = () => {
  const { success = [], errors = [] } = props.report

  if (success.length > 0 && errors.length === 0) {
    return 'All files uploaded successfully.'
  } else if (errors.length > 0 && success.length === 0) {
    return 'All files failed to upload.'
  } else if (success.length > 0 && errors.length > 0) {
    return 'Some files uploaded successfully, while others failed.'
  } else {
    return 'No files were uploaded.'
  }
}
const gotoViewTab = async () => {
  store.uploadedEventConfigFilesReportDialogState.visible = false
  await store.fetchEventConfigs()
  store.resetActiveTab()
}
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@use "@featherds/styles/themes/variables";

.text-danger {
  color: var(variables.$error);
}

.upload-report-scroll {
  max-height: 50vh;
  overflow-y: auto;
  padding: 10px;
  margin-top: 8px;
  border-radius: vars.$border-radius-sm;
  border: 1px solid var(variables.$border-on-surface);
}

:deep(.feather-dialog-content) {
  max-height: 70vh; 
  overflow-y: auto;
}

.text-danger {
  color: var(variables.$error);
}

.text-success {
  color: var(variables.$success);
}
</style>

