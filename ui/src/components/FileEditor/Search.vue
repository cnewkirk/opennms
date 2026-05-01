<template>
  <div class="search-bar">
    <div class="search">
      <InputText placeholder="Search etc" :modelValue="searchValue" @update:modelValue="search" />
    </div>
    <div class="save">
      <Button label="Save" :disabled="disableBtn" @click="save" />
    </div>
    <div class="reset">
      <Button label="Reset" :disabled="disableBtn" @click="reset" />
    </div>
  </div>
  <hr />
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useFileEditorStore } from '@/stores/fileEditorStore'
import { UpdateModelFunction } from '@/types'

const fileEditorStore = useFileEditorStore()

const contentModified = computed(() => fileEditorStore.contentModified)
const hasSelectedFile = computed(() => fileEditorStore.selectedFileName !== '')
const searchValue = computed(() => fileEditorStore.searchValue)
const disableBtn = computed(() => !contentModified.value || !hasSelectedFile.value)

const search: UpdateModelFunction = (val: string) => fileEditorStore.setSearchValue(val || '')
const reset = () => fileEditorStore.triggerFileReset()
const save = () => fileEditorStore.saveModifiedFile()
</script>

<style scoped lang="scss">
.search-bar {
  display: flex;
  .search {
    width: 100%;
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
