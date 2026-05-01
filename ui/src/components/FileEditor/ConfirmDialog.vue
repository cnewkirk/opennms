<template>
  <Dialog v-model:visible="open" header="Delete confirmation" modal style="width: 380px" @update:visible="(v) => { if (!v) cancel() }">
    <p class="subtitle2 dialog">Delete {{ file?.name }}?</p>

    <template #footer>
      <Button label="Cancel" text @click="cancel" />
      <Button label="Confirm" text class="btn-delete" @click="deleteFile" />
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useFileEditorStore } from '@/stores/fileEditorStore'

const fileEditorStore = useFileEditorStore()

const labels = {
  title: 'Delete confirmation',
  close: 'Close'
}

const open = ref(false)
const file = computed(() => fileEditorStore.fileToDelete)

watchEffect(() => open.value = Boolean(file.value))

const deleteFile = () => fileEditorStore.deleteFile(file.value?.fullPath || '')
const cancel = () => fileEditorStore.setFileToDelete(null)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
.dialog {
  width: 300px;
}
.btn-delete {
  color: var($error);
}
</style>
