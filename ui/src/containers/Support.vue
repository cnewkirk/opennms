<template>
  <div class="support-page">
    <div class="breadcrumbs-row">
      <BreadCrumbs :items="breadcrumbs" />
    </div>

    <div class="page-header">
      <h1 class="page-title">Support</h1>
    </div>

    <div class="support-grid">
      <div class="support-card">
        <div class="support-card__header">
          <i class="pi pi-headphones" />
          Commercial Support
        </div>
        <div class="support-card__body">
          <p class="support-card__description">
            The OpenNMS Group offers professional support subscriptions for production deployments,
            including incident response, upgrade assistance, and architectural guidance.
          </p>
          <ul class="support-card__links">
            <li>
              <a href="https://support.opennms.com" target="_blank" rel="noopener noreferrer">
                <i class="pi pi-external-link" />
                Commercial Support Portal
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="support-card">
        <div class="support-card__header">
          <i class="pi pi-users" />
          Community Resources
        </div>
        <div class="support-card__body">
          <p class="support-card__description">
            OpenNMS has an active open-source community. Ask questions, share configurations,
            and find answers from experienced network engineers worldwide.
          </p>
          <ul class="support-card__links">
            <li>
              <a href="https://opennms.discourse.group" target="_blank" rel="noopener noreferrer">
                <i class="pi pi-external-link" />
                Discourse Community Forum
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Support', to: '#', position: 'last' }
])
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.support-page {
  padding: 0 20px 20px;
  min-height: 100%;
}

.breadcrumbs-row {
  padding-bottom: 4px;
}

.page-header {
  padding: 8px 0 16px;
}

.page-title {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.support-card {
  background: var($surface);
  border-radius: 6px;
  border: 1px solid var($border-light-on-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  &__header {
    background: var($primary);
    padding: 12px 16px;
    @include subtitle1;
    color: var($primary-text-on-color);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;

    .pi { font-size: 16px; }
  }

  &__body {
    padding: 16px;
  }

  &__description {
    @include body-small;
    color: var($secondary-text-on-surface);
    margin: 0 0 14px;
    line-height: 1.5;
  }

  &__links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    li a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var($clickable-normal);
      text-decoration: none;
      @include body-small;

      &:hover {
        text-decoration: underline;
      }

      .pi { font-size: 12px; }
    }
  }
}
</style>
