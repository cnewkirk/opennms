<template>
  <div class="admin-card">
    <div class="admin-card__header">
      <span class="admin-card__title">{{ title }}</span>
    </div>
    <ul class="admin-card__list">
      <li v-for="link in links" :key="link.label" class="admin-card__item">
        <a
          v-if="link.href"
          :href="link.href"
          :target="link.external ? '_blank' : '_self'"
          :rel="link.external ? 'noopener noreferrer' : undefined"
          class="admin-card__link"
        >{{ link.label }}</a>
        <router-link
          v-else-if="link.to"
          :to="link.to"
          class="admin-card__link"
        >{{ link.label }}</router-link>
        <span v-else class="admin-card__link">{{ link.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  links: Array<{ label: string; href?: string; to?: string; external?: boolean }>
}>()
</script>

<style lang="scss" scoped>
@import "@/styles/typography";
@import "@/styles/tokens";

.admin-card {
  background: var($surface);
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  &__header {
    background: var($primary);
    padding: 12px 16px;
  }

  &__title {
    @include subtitle1;
    color: var($primary-text-on-color);
    font-weight: 600;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 8px 0;
  }

  &__item {
    padding: 0;
  }

  &__link {
    @include body-large;
    display: block;
    padding: 6px 16px;
    color: var($primary);
    text-decoration: none;
    transition: background 0.15s ease;

    &:hover {
      background: var($shade-4);
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var($primary);
      outline-offset: -2px;
    }
  }
}
</style>
