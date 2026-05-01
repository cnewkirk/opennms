<template>
  <Menu ref="menu" :model="menuItems" popup class="node-download-dropdown" />
  <Button
    text
    severity="secondary"
    @click="(e: Event) => menu?.toggle(e)"
    aria-label="Download"
  >
    <i class="pi pi-download download-actions-icon" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { PropType, ref } from 'vue'

const props = defineProps({
  onCsvDownload: {
    required: true,
    type: Function as PropType<() => void>
  },
  onJsonDownload: {
    required: true,
    type: Function as PropType<() => void>
  }
})

const menu = ref()

const menuItems = [
  { label: 'Download CSV...', command: () => props.onCsvDownload() },
  { label: 'Download JSON...', command: () => props.onJsonDownload() }
]
</script>

<style lang="scss" scoped>
.download-actions-icon {
  font-size: 1.1rem;
}
</style>
