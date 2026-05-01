<template>
  <div class="breadcrumbs subtitle2">
    <template v-for="item,index of items" :key="item.label">
      <div class="link">
        <a v-if="item.isAbsoluteLink" :href="item.to">{{ item.label }}</a>
        <router-link v-else :to="item.to">{{ item.label }}</router-link>
        <span v-if="index !== items.length - 1" class="slash">&sol;</span>
      </div>
    </template>
  </div>
</template>
  
<script setup lang="ts">
import { BreadCrumb } from '@/types'
import { PropType } from 'vue'

defineProps({
  items: {
    required: true,
    type: Array as PropType<BreadCrumb[]>
  }
})
</script>
  
<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.breadcrumbs {
  width: 100%;
  display: flex;
  margin-bottom: 15px;
  background: var($background);
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-surface;

  .link {
    color: var($clickable-normal);
    a {
      font-weight:400;
      color: var($clickable-normal);
    }
    a:visited {
      color: var($clickable-normal);
    }

    padding:8px 0;
  }

  .link:first-child {
    margin-left: 8px;
  }

  .link-icon {
    margin: 0px 10px -3px 10px;
    font-size: 20px;
  }

  .last {
    display: none;
  }

  .slash {
    color: var($secondary-text-on-surface);
    padding: 0 8px;
    font-weight:400;
  }
}
</style>
