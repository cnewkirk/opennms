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
  z-index: 2;
  position: absolute;
  width: 95%;
  height: 90%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
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
