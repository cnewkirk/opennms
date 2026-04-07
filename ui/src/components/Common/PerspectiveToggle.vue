<!-- ui/src/components/Common/PerspectiveToggle.vue -->
<template>
  <div class="perspective-toggle" role="group" aria-label="View perspective">
    <button
      class="perspective-toggle__btn"
      :class="{ 'perspective-toggle__btn--active': store.perspective === 'problems' }"
      @click="store.setPerspective('problems')"
    >Problems</button>
    <button
      class="perspective-toggle__btn"
      :class="{ 'perspective-toggle__btn--active': store.perspective === 'full' }"
      @click="store.setPerspective('full')"
    >Full</button>
  </div>
</template>

<script setup lang="ts">
import { usePerspectiveStore } from '@/stores/perspectiveStore'
const store = usePerspectiveStore()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.perspective-toggle {
  display: inline-flex;
  border: 1px solid var($border-on-surface);
  border-radius: 20px;
  overflow: hidden;

  &__btn {
    padding: 4px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    transition: background 0.12s, color 0.12s;

    &--active {
      background: #0081ad;
      color: #fff;
    }

    &:not(.perspective-toggle__btn--active):hover {
      background: var($shade-4);
    }
  }
}
</style>
