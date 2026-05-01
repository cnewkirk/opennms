<template>
  <transition name="fade">
    <div class="spinner" v-if="isActive">
      <ProgressSpinner style="width: 48px; height: 48px" />
    </div>
  </transition>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import useSpinner from '@/composables/useSpinner'
const { isActive } = useSpinner()
</script>

<style scoped lang="scss">
.spinner {
  z-index: 10;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
