<template>
  <Dialog :visible="props.visible" :header="dialogTitle" modal style="width: 620px" @update:visible="(v) => { if (!v) $emit('close') }">
    <div class="content">
      <slot name="content" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'

const props = defineProps({
  subtitle: {
    required: false,
    type: String
  },
  visible: {
    required: true,
    type: Boolean
  }
})

defineEmits(['close'])

const dialogTitle = computed(() =>
  props.subtitle ? `Usage Statistics: ${props.subtitle}` : 'Usage Statistics'
)
</script>

<style scoped lang="scss">
.content {
  min-height: 300px;
  max-height: 500px;
  min-width: 550px;
  overflow: auto;
  position: relative;
}
</style>
