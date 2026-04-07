<!-- ui/src/components/Common/CollapsibleSection.vue -->
<template>
  <div class="collapsible-section card">
    <button class="collapsible-section__header" @click="isOpen = !isOpen">
      <span class="headline4 collapsible-section__title">{{ title }}</span>
      <span class="collapsible-section__chevron" :class="{ 'collapsible-section__chevron--open': isOpen }">›</span>
    </button>
    <div v-show="isOpen" class="collapsible-section__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ title: string; collapsed: boolean }>()
const isOpen = ref(!props.collapsed)
watch(() => props.collapsed, (v) => { isOpen.value = !v })
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.collapsible-section {
  @include elevation(2);
  border-radius: 4px;
  padding: 0;
  margin-bottom: 16px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;

    &:hover { background: var($shade-4); }
  }

  &__title {
    margin: 0;
  }

  &__chevron {
    font-size: 1.1rem;
    color: var($secondary-text-on-surface);
    transition: transform 0.15s;
    display: inline-block;

    &--open { transform: rotate(90deg); }
  }

  &__body {
    padding: 0 16px 16px;
  }
}
</style>
