<template>
  <div class="asset-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="asset-page__header feather-row">
      <div class="feather-col-12">
        <h2 class="headline4">Import and Export Asset Information</h2>
      </div>
    </div>

    <div class="asset-layout">
      <!-- Export -->
      <div class="asset-card">
        <div class="asset-card__header">Export Assets</div>
        <div class="asset-card__body">
          <p class="asset-card__desc">
            Export all asset records to a comma-separated values (.csv) file suitable for use in a spreadsheet application.
          </p>
          <Button label="Download Assets CSV" @click="exportCsv" />
        </div>
      </div>

      <!-- Import -->
      <div class="asset-card">
        <div class="asset-card__header">Import Assets</div>
        <div class="asset-card__body">
          <p class="asset-card__desc">
            Paste comma-separated asset data below and click Import. One record per line; fields delimited by commas.
            Use the Export button above to see the expected column order.
          </p>
          <textarea
            v-model="csvText"
            class="asset-textarea"
            rows="12"
            placeholder="Paste CSV asset data here…"
          />
          <div v-if="importError" class="asset-error">{{ importError }}</div>
        </div>
        <div class="asset-card__footer">
          <Button
            :label="importing ? 'Importing…' : 'Import'"
            :disabled="importing || !csvText.trim()"
            @click="doImport"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'
import axios from 'axios'

const { showSnackBar } = useSnackbar()
const menuStore = useMenuStore()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Asset Import/Export', to: '#', position: 'last' }
]

const csvText = ref('')
const importing = ref(false)
const importError = ref('')

const baseHref = () => menuStore.mainMenu.baseHref ?? '/opennms/'

const exportCsv = () => {
  const link = document.createElement('a')
  link.href = `${baseHref()}admin/asset/assets.csv`
  link.download = 'assets.csv'
  link.click()
}

const doImport = async () => {
  importing.value = true
  importError.value = ''
  try {
    const resp = await axios.post(
      `${baseHref()}admin/asset/import`,
      new URLSearchParams({ assetsText: csvText.value }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    const url: string = resp.request?.responseURL ?? ''
    if (url.includes('nodelist.jsp')) {
      showSnackBar({ msg: 'Assets imported successfully.' })
      csvText.value = ''
    } else {
      importError.value = 'Import failed. Check that the CSV format matches the exported file.'
    }
  } catch {
    importError.value = 'Import request failed. The server may be unavailable.'
  }
  importing.value = false
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.asset-page {
  padding: 0 24px 40px;

  &__header {
    margin-bottom: 20px;
    .headline4 { margin: 0; }
  }
}

.asset-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
}

.asset-card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;

  &__header {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__desc {
    margin: 0;
    color: var($secondary-text-on-surface);
    font-size: 14px;
    line-height: 1.5;
  }

  &__footer {
    padding: 12px 16px;
    border-top: 1px solid var($shade-3);
    background: var($shade-4);
    display: flex;
    justify-content: flex-end;
  }
}

.asset-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var($shade-3);
  border-radius: 4px;
  background: var($surface);
  color: var($primary-text-on-surface);
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
  min-height: 200px;

  &:focus {
    outline: none;
    border-color: var($clickable-normal);
  }
}

.asset-error {
  color: var($error);
  font-size: 13px;
}
</style>
