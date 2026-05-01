<template>
  <Transition name="snackbar-slide">
    <div
      v-if="isDisplayed"
      class="snackbar"
      :class="{ 'snackbar--error': hasError, 'snackbar--centered': isCentered }"
      role="status"
      aria-live="polite"
    >
      <span class="snackbar__message">{{ message }}</span>
      <button class="snackbar__dismiss" @click="hideSnackbar">Dismiss</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import useSnackbar from '@/composables/useSnackbar'

const { hideSnackbar, isDisplayed, isCentered, hasError, message } = useSnackbar()
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";

.snackbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 288px;
  max-width: 568px;
  padding: 12px 16px;
  border-radius: 4px;
  background: #323232;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 3px 8px rgba(0,0,0,0.35);

  &--error {
    background: #b00020;
  }

  &--centered {
    left: 50%;
    transform: translateX(-50%);
  }

  &__message {
    flex: 1;
    font-size: 14px;
  }

  &__dismiss {
    background: none;
    border: none;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;

    &:hover {
      background: rgba(255,255,255,0.1);
    }
  }
}

.snackbar-slide-enter-active,
.snackbar-slide-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.snackbar-slide-enter-from,
.snackbar-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
