<template>
  <transition name="fade">
    <PanelLoader
      v-if="isActive"
      class="app-spinner"
      :size="56"
      overlay
      background="var(--feather-background)"
    />
  </transition>
</template>

<script setup lang="ts">
import useSpinner from '@/composables/useSpinner'
import PanelLoader from '@/components/Common/PanelLoader.vue'
const { isActive } = useSpinner()
</script>

<style scoped lang="scss">
.app-spinner {
  z-index: 10;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
