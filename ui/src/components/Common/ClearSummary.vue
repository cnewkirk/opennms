<!-- ui/src/components/Common/ClearSummary.vue -->
<template>
  <div class="clear-summary">
    <span class="clear-summary__icon">✓</span>
    <span class="clear-summary__message">{{ message }}</span>
    <button v-if="expandable" class="clear-summary__expand" @click="$emit('expand')">
      Show all ›
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string; expandable?: boolean }>()
defineEmits<{ expand: [] }>()
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/styles/themes/variables";

.clear-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: vars.$border-radius-xs;
  background: utils.alpha(fvars.$success, 0.08);
  border: 1px solid utils.alpha(fvars.$success, 0.25);
  font-size: 0.875rem;
  color: var($secondary-text-on-surface);

  &__icon {
    color: var(--feather-success);
    font-weight: 700;
  }

  &__message {
    flex: 1;
  }

  &__expand {
    background: none;
    border: none;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    &:hover { text-decoration: underline; }
  }
}
</style>
