<template>
  <div class="top-bar">
    <div class="icon subtitle2 pointer" @click="triggerHelp">
      Files<i class="pi pi-chevron-right" />
    </div>
    <div class="save">
      <Button label="Save" :disabled="disableBtn" @click="save" />
    </div>
    <div class="reset">
      <Button label="Reset" :disabled="disableBtn" @click="reset" />
    </div>
    <div class="filename headline3">{{ filename }}</div>
  </div>
  <hr />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useFileEditorStore } from '@/stores/fileEditorStore'

const fileEditorStore = useFileEditorStore()

const filename = computed(() => fileEditorStore.selectedFileName)
const contentModified = computed(() => fileEditorStore.contentModified)
const hasSelectedFile = computed(() => fileEditorStore.selectedFileName !== '')
const disableBtn = computed(() => !contentModified.value || !hasSelectedFile.value)

const reset = () => fileEditorStore.triggerFileReset()
const save = () => fileEditorStore.saveModifiedFile()
const triggerHelp = () => fileEditorStore.setIsHelpOpen(false)
</script>

<style scoped lang="scss">
.top-bar {
  display: flex;
  .icon {
    line-height: 3.6;
    margin-bottom: -5px;
    margin-right: 10px;
  }
  .filename {
    margin-left: 23px;
    line-height: 2.5;
    margin-bottom: -8px;
  }
  .save,
  .reset {
    margin-left: 10px;
    button {
      margin-top: 5px;
      margin-bottom: 0px;
    }
  }
}
</style>
