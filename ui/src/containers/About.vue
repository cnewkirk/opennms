<template>
  <div class="about-page">
    <div class="breadcrumbs-row">
      <BreadCrumbs :items="breadcrumbs" />
    </div>

    <div class="page-header">
      <h1 class="page-title">About OpenNMS</h1>
    </div>

    <div v-if="loading" class="loading-state">
      <PanelLoader :size="40" />
    </div>

    <div v-else-if="error" class="error-state">
      <i class="pi pi-exclamation-triangle" />
      {{ error }}
    </div>

    <template v-else-if="about">
      <div class="about-card">
        <div class="about-card__header">
          <i class="pi pi-info-circle" />
          System Information
        </div>
        <div class="about-card__body">
          <table class="about-table">
            <tbody>
              <tr v-for="row in infoRows" :key="row.label">
                <td class="about-table__label">{{ row.label }}</td>
                <td class="about-table__value">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>

          <div class="release-notes-link">
            <a :href="releaseNotesUrl" target="_blank" rel="noopener noreferrer">
              <i class="pi pi-external-link" />
              Release Notes for {{ about.displayVersion }}
            </a>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import { getSystemAbout, type SystemAbout } from '@/services/systemInfoService'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'About', to: '#', position: 'last' }
])

const loading = ref(true)
const error = ref<string | null>(null)
const about = ref<SystemAbout | null>(null)

interface InfoRow {
  label: string
  value: string
}

const infoRows = computed<InfoRow[]>(() => {
  if (!about.value) return []
  const a = about.value
  return [
    { label: 'OpenNMS Version', value: a.displayVersion },
    { label: 'Package',         value: a.packageName },
    { label: 'Database',        value: `${a.dbProductName} ${a.dbVersion}` },
    { label: 'Java',            value: `${a.javaVersion} (${a.javaVendor})` },
    { label: 'Runtime',         value: a.javaRuntimeName },
    { label: 'OS',              value: `${a.osName} ${a.osVersion} (${a.osArch})` },
    { label: 'Server Time',     value: new Date(a.serverTimeMs).toISOString() }
  ]
})

const releaseNotesUrl = computed(() =>
  about.value
    ? `https://docs.opennms.com/horizon/${about.value.displayVersion}/releasenotes/whatsnew.html`
    : '#'
)

onMounted(async () => {
  const data = await getSystemAbout()
  if (!data) {
    error.value = 'Failed to load system information.'
  } else {
    about.value = data
  }
  loading.value = false
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.about-page {
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

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var($error);
  @include body-large;

  .pi { font-size: 18px; }
}

.about-card {
  background: var($surface);
  border-radius: 6px;
  border: 1px solid var($border-light-on-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  max-width: 640px;

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
    padding: 4px 0 16px;
  }
}

.about-table {
  width: 100%;
  border-collapse: collapse;

  tr {
    border-bottom: 1px solid var($border-light-on-surface);

    &:last-child { border-bottom: none; }
  }

  &__label {
    padding: 10px 16px;
    @include body-small;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    width: 35%;
  }

  &__value {
    padding: 10px 16px;
    @include body-small;
    color: var($primary-text-on-surface);
    font-family: monospace;
    font-size: 0.8125rem;
    word-break: break-all;
  }
}

.release-notes-link {
  padding: 12px 16px 0;

  a {
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
</style>
