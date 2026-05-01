<template>
  <div class="help-bar">
    <i class="pi pi-times pointer" @click="triggerHelp" />
    <div class="snippets" v-html="snippets"></div>
  </div>
</template>

<script setup lang="ts">
import { useFileEditorStore } from '@/stores/fileEditorStore'

const fileEditorStore = useFileEditorStore()
const snippets = computed(() => fileEditorStore.snippets)
const triggerHelp = () => fileEditorStore.setIsHelpOpen(false)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
.help-bar {
  height: calc(100vh - 200px);
  border: 1px solid var($border-on-surface);
  padding: 10px;
  overflow: auto;
  .pi {
    position: absolute;
    right: 35px;
    color: var($primary-text-on-surface)
  }
  .snippets {
    padding: 15px;
    color: var($primary-text-on-surface);
  }
}
</style>
