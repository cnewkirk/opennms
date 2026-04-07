<!-- ui/src/components/Common/PerspectiveToggle.vue -->
<template>
  <div class="perspective-toggle-wrap">
    <div class="perspective-toggle" role="group" aria-label="View perspective">
      <button
        class="perspective-toggle__btn"
        :class="{ 'perspective-toggle__btn--active': store.perspective === 'problems' }"
        :title="'Problems mode: shows only active issues'"
        @click="store.setPerspective('problems')"
      >
        <span class="perspective-toggle__filter-icon" aria-hidden="true">⊘</span>
        Problems
      </button>
      <button
        class="perspective-toggle__btn"
        :class="{ 'perspective-toggle__btn--active': store.perspective === 'all' }"
        :title="'All mode: shows complete data'"
        @click="store.setPerspective('all')"
      >All</button>
    </div>
    <span v-if="store.isProblems" class="perspective-toggle__hint">Filtered — active issues only</span>
  </div>
</template>

<script setup lang="ts">
import { usePerspectiveStore } from '@/stores/perspectiveStore'
const store = usePerspectiveStore()
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.perspective-toggle-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.perspective-toggle {
  display: inline-flex;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-pill;
  overflow: hidden;

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
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

  &__filter-icon {
    font-size: 0.7rem;
    opacity: 0.8;
    line-height: 1;
  }

  &__hint {
    font-size: 0.7rem;
    color: var($secondary-text-on-surface);
    padding-left: 10px;
    white-space: nowrap;
  }
}
</style>
