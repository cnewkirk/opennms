<template>
  <Dialog :visible="visible" :header="dialogTitle" modal :style="{ minWidth: '550px' }" @update:visible="(v) => !v && $emit('close')">
    <div class="content">
      <slot name="content" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { useDeviceStore } from '@/stores/deviceStore'

const deviceStore = useDeviceStore()

defineProps({
  visible: {
    required: true,
    type: Boolean
  }
})

defineEmits(['close'])

const dialogTitle = computed(() => `Device Name: ${deviceStore.modalDeviceConfigBackup.deviceName}`)
</script>

<style scoped lang="scss">
.content {
  min-height: 300px;
  min-width: 550px;
  position: relative;
}
</style>
