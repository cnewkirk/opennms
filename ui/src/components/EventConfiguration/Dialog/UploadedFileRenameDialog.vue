<template>
  <div class="uploaded-file-rename-dialog">
    <Dialog
      v-model:visible="dialogVisible"
      header="Rename Uploaded File"
      modal
      :style="{ width: '480px' }"
      data-test="dialog-title"
      @hide="handleDialogHidden"
    >
      <div class="modal-body">
        <p>
          The file name '<strong> {{ originalFileName }} </strong>' already exists in the system.
        </p>
        <p>Choose one of the following options:</p>
        <div class="checkbox-group">
          <div class="checkbox-row">
            <Checkbox
              v-model="overwriteFile"
              :binary="true"
              inputId="overwrite-cb"
              @update:model-value="onChangeOverwriteFile"
            />
            <label for="overwrite-cb">
              Keep Original File Name: <strong>{{ originalFileName }}</strong> and Overwrite Existing File.
            </label>
          </div>
          <div class="checkbox-row">
            <Checkbox
              v-model="renameFile"
              :binary="true"
              inputId="rename-cb"
              @update:model-value="onChangeRenameFile"
            />
            <label for="rename-cb">Rename Uploaded File to:</label>
          </div>
        </div>
        <div v-if="renameFile" class="new-file-name-input">
          <label class="p-label">New File Name</label>
          <InputText
            v-model.trim="newFileName"
            class="w-full"
            :invalid="!!error"
            placeholder="Enter new file name (must end with .xml)"
            data-test="file-name"
            @update:model-value="onChangeFileName"
          />
          <small v-if="error" class="p-error">{{ error }}</small>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="handleDialogHidden" />
        <Button
          label="Save Changes"
          :disabled="shouldRemainDisabled"
          @click="saveChanges"
          data-test="save-button"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { UploadedSourceNamesResponse, UploadEventFileType } from '@/types/eventConfig'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  visible: boolean,
  fileBucket: UploadEventFileType[],
  alreadyExistsNames: UploadedSourceNamesResponse[],
  index: number
}>()

const emits = defineEmits<{
  (e: 'close'): void
  (e: 'rename', newFileName: string): void
  (e: 'overwrite'): void
}>()
const labels = {
  title: 'Rename Uploaded File'
}
const dialogVisible = ref(props.visible)
const renameFile = ref<boolean>(false)
const overwriteFile = ref<boolean>(false)
const error = ref<string | undefined>()
const newFileName = ref('')
const originalFileName = ref('')
const shouldRemainDisabled = computed(() => (
  (!renameFile.value && !overwriteFile.value) ||
  (renameFile.value && !!error.value)
))

const validateName = () => {
  let isValid = false
  if (newFileName.value === '') {
    error.value = 'File name cannot be empty.'
  } else if (!newFileName.value.endsWith('.xml')) {
    error.value = 'File name must end with .xml'
  } else if (newFileName.value === originalFileName.value) {
    error.value = 'New file name must be different from the original name.'
  } else if (props.fileBucket.map(f => f.file.name.toLowerCase()).includes(newFileName.value.trim().toLowerCase())) {
    error.value = 'A file with this name already exists in the current upload list.'
  } else if (props.alreadyExistsNames.map(s => s.name.replace('.xml', '').toLowerCase()).includes(newFileName.value.trim().replace('.xml', '').toLowerCase())) {
    error.value = 'A file with this name already exists in the system.'
  } else {
    error.value = undefined
    isValid = true
  }

  return isValid
}

const onChangeFileName = (value: any) => {
  if (value) {
    newFileName.value = value.trim()
    validateName()
  }
}

const saveChanges = () => {
  if (overwriteFile.value) {
    emits('overwrite')
  } else if (renameFile.value && validateName() && props.index >= 0 && props.index < props.fileBucket.length) {
    emits('rename', newFileName.value)
  }
}

const handleDialogHidden = () => {
  renameFile.value = false
  overwriteFile.value = false
  newFileName.value = ''
  originalFileName.value = ''
  error.value = undefined
  emits('close')
}

const onChangeRenameFile = (value: boolean | undefined) => {
  renameFile.value = !!value
  if (value) {
    overwriteFile.value = false
  }
}

const onChangeOverwriteFile = (value: boolean | undefined) => {
  overwriteFile.value = !!value
  if (value) {
    renameFile.value = false
    newFileName.value = originalFileName.value
    error.value = undefined
  }
}

watch(() => props.visible, (val) => {
  dialogVisible.value = val
  if (val && props.index >= 0 && props.index < props.fileBucket.length) {
    originalFileName.value = props.fileBucket[props.index].file.name
    newFileName.value = originalFileName.value
    error.value = undefined
  } else {
    renameFile.value = false
    overwriteFile.value = false
    newFileName.value = ''
    originalFileName.value = ''
    error.value = undefined
  }
})
</script>

<style scoped lang="scss">
.modal-body {
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  .new-file-name-input {
    margin-top: 15px;

    .p-label {
      display: block;
      margin-bottom: 4px;
      font-size: 0.875rem;
    }
  }
}
</style>

