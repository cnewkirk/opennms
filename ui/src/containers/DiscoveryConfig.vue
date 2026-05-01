<template>
  <div class="discovery-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="discovery-page__header feather-row">
      <div class="feather-col-6">
        <h2 class="headline4">Discovery Configuration</h2>
      </div>
      <div class="feather-col-6 discovery-page__header-actions">
        <Button :disabled="saving || loading" @click="saveConfig" :label="saving ? 'Saving…' : 'Save and Restart Discovery'" />
      </div>
    </div>

    <div v-if="loading" class="discovery-page__status">Loading…</div>
    <div v-else-if="loadError" class="discovery-page__status discovery-page__status--error">
      Failed to load discovery configuration.
    </div>

    <template v-if="!loading && !loadError && config">
      <!-- General Settings -->
      <div class="discovery-card">
        <div class="discovery-card__header">General Settings</div>
        <div class="discovery-card__body">
          <div class="discovery-form-row">
            <label class="discovery-label">Initial sleep time (seconds)</label>
            <select v-model="config.initialSleepTime" class="discovery-select">
              <option :value="30000">30</option>
              <option :value="60000">60</option>
              <option :value="90000">90</option>
              <option :value="120000">120</option>
              <option :value="150000">150</option>
              <option :value="300000">300</option>
              <option :value="600000">600</option>
            </select>
          </div>
          <div class="discovery-form-row">
            <label class="discovery-label">Restart sleep time (hours)</label>
            <select v-model="config.restartSleepTime" class="discovery-select">
              <option :value="3600000">1</option>
              <option :value="7200000">2</option>
              <option :value="10800000">3</option>
              <option :value="14400000">4</option>
              <option :value="18000000">5</option>
              <option :value="21600000">6</option>
              <option :value="43200000">12</option>
              <option :value="86400000">24</option>
              <option :value="129600000">36</option>
              <option :value="259200000">72</option>
            </select>
          </div>
          <div class="discovery-form-row">
            <label class="discovery-label">Timeout (milliseconds)</label>
            <input v-model.number="config.timeout" type="number" class="discovery-input" />
          </div>
          <div class="discovery-form-row">
            <label class="discovery-label">Retries</label>
            <input v-model.number="config.retries" type="number" class="discovery-input" />
          </div>
          <div class="discovery-form-row">
            <label class="discovery-label">Requisition</label>
            <select v-model="config.foreignSource" class="discovery-select">
              <option value="">None selected</option>
              <option v-for="fs in foreignSources" :key="fs" :value="fs">{{ fs }}</option>
            </select>
          </div>
          <div class="discovery-form-row">
            <label class="discovery-label">Location</label>
            <select v-model="config.location" class="discovery-select">
              <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>
          <div class="discovery-form-row">
            <label class="discovery-label">Task chunk size</label>
            <input v-model.number="config.chunkSize" type="number" class="discovery-input" />
          </div>
        </div>
      </div>

      <!-- Specific Addresses -->
      <EntryTable
        title="Specific Addresses"
        :rows="config.specifics"
        :columns="specificColumns"
        add-label="Add Specific"
        :fields="specificFields"
        :defaults="specificDefaults"
        @add="addEntry('specifics', $event)"
        @remove="removeEntry('specifics', $event)"
      />

      <!-- Include URLs -->
      <EntryTable
        title="Include URLs"
        :rows="config.includeUrls"
        :columns="urlColumns"
        add-label="Add Include URL"
        :fields="includeUrlFields"
        :defaults="urlDefaults"
        @add="addEntry('includeUrls', $event)"
        @remove="removeEntry('includeUrls', $event)"
      />

      <!-- Exclude URLs -->
      <EntryTable
        title="Exclude URLs"
        :rows="config.excludeUrls"
        :columns="excludeUrlColumns"
        add-label="Add Exclude URL"
        :fields="excludeUrlFields"
        :defaults="excludeUrlDefaults"
        @add="addEntry('excludeUrls', $event)"
        @remove="removeEntry('excludeUrls', $event)"
      />

      <!-- Include Ranges -->
      <EntryTable
        title="Include Ranges"
        :rows="config.includeRanges"
        :columns="rangeColumns"
        add-label="Add Include Range"
        :fields="includeRangeFields"
        :defaults="rangeDefaults"
        @add="addEntry('includeRanges', $event)"
        @remove="removeEntry('includeRanges', $event)"
      />

      <!-- Exclude Ranges -->
      <EntryTable
        title="Exclude Ranges"
        :rows="config.excludeRanges"
        :columns="excludeRangeColumns"
        add-label="Add Exclude Range"
        :fields="excludeRangeFields"
        :defaults="excludeRangeDefaults"
        @add="addEntry('excludeRanges', $event)"
        @remove="removeEntry('excludeRanges', $event)"
      />

      <div class="discovery-page__footer">
        <Button :disabled="saving" @click="saveConfig" :label="saving ? 'Saving…' : 'Save and Restart Discovery'" />
      </div>
    </template>

    <!-- Add Entry Modal -->
    <DiscoveryEntryModal
      v-if="modal.visible"
      :title="modal.title"
      :fields="modal.fields"
      :initial="modal.initial"
      :locations="locations"
      :foreign-sources="foreignSources"
      @save="onModalSave"
      @close="modal.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import EntryTable from '@/components/DiscoveryConfig/EntryTable.vue'
import DiscoveryEntryModal from '@/components/DiscoveryConfig/DiscoveryEntryModal.vue'
import { getDiscoveryConfig, saveDiscoveryConfig, getLocations, getForeignSources } from '@/services/discoveryConfigService'
import { DiscoveryConfig, BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Discovery Configuration', to: '#', position: 'last' }
])

const config = ref<DiscoveryConfig | null>(null)
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const locations = ref<string[]>(['Default'])
const foreignSources = ref<string[]>([])

// ---- Column/field definitions ----
const specificColumns = ['IP Address', 'Timeout (ms)', 'Retries', 'Foreign Source', 'Location']
const specificFields = ['content', 'timeout', 'retries', 'foreignSource', 'location']
const specificDefaults = { content: '', timeout: null, retries: null, foreignSource: null, location: null }

const urlColumns = ['URL', 'Timeout (ms)', 'Retries', 'Foreign Source', 'Location']
const includeUrlFields = ['content', 'timeout', 'retries', 'foreignSource', 'location']
const urlDefaults = { content: '', timeout: null, retries: null, foreignSource: null, location: null }

const excludeUrlColumns = ['URL', 'Foreign Source', 'Location']
const excludeUrlFields = ['content', 'foreignSource', 'location']
const excludeUrlDefaults = { content: '', foreignSource: null, location: null }

const rangeColumns = ['Begin Address', 'End Address', 'Timeout (ms)', 'Retries', 'Foreign Source', 'Location']
const includeRangeFields = ['begin', 'end', 'timeout', 'retries', 'foreignSource', 'location']
const rangeDefaults = { begin: '', end: '', timeout: null, retries: null, foreignSource: null, location: null }

const excludeRangeColumns = ['Begin', 'End', 'Location']
const excludeRangeFields = ['begin', 'end', 'location']
const excludeRangeDefaults = { begin: '', end: '', location: null }

// ---- Modal state ----
const modal = reactive({
  visible: false,
  title: '',
  fields: [] as string[],
  initial: {} as Record<string, any>,
  listKey: '' as keyof DiscoveryConfig,
  editIndex: -1
})

const addEntry = (listKey: string, fields: string[]) => {
  const defaults: Record<string, any> = getDefaultsFor(listKey)
  modal.listKey = listKey as keyof DiscoveryConfig
  modal.title = `Add ${titleFor(listKey)}`
  modal.fields = fields
  modal.initial = { ...defaults }
  modal.editIndex = -1
  modal.visible = true
}

const removeEntry = (listKey: string, index: number) => {
  if (!config.value) return
  const list = config.value[listKey as keyof DiscoveryConfig] as any[]
  list.splice(index, 1)
}

const onModalSave = (entry: Record<string, any>) => {
  if (!config.value) return
  const list = config.value[modal.listKey] as any[]
  list.push(entry)
  modal.visible = false
}

function getDefaultsFor(key: string): Record<string, any> {
  const map: Record<string, Record<string, any>> = {
    specifics: specificDefaults,
    includeUrls: urlDefaults,
    excludeUrls: excludeUrlDefaults,
    includeRanges: rangeDefaults,
    excludeRanges: excludeRangeDefaults,
  }
  return map[key] ?? {}
}

function titleFor(key: string): string {
  const map: Record<string, string> = {
    specifics: 'Specific Address',
    includeUrls: 'Include URL',
    excludeUrls: 'Exclude URL',
    includeRanges: 'Include Range',
    excludeRanges: 'Exclude Range',
  }
  return map[key] ?? key
}

// ---- Load and save ----
const load = async () => {
  loading.value = true
  loadError.value = false
  const [cfg, locs, fss] = await Promise.all([
    getDiscoveryConfig(),
    getLocations(),
    getForeignSources()
  ])
  loading.value = false
  if (!cfg) {
    loadError.value = true
    return
  }
  config.value = cfg
  locations.value = locs
  foreignSources.value = fss
}

const saveConfig = async () => {
  if (!config.value) return
  saving.value = true
  const ok = await saveDiscoveryConfig(config.value)
  saving.value = false
  if (ok) {
    showSnackBar({ msg: 'Discovery configuration saved.' })
  } else {
    showSnackBar({ msg: 'Failed to save discovery configuration.', error: true })
  }
}

onMounted(() => load())
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.discovery-page {
  padding: 0 20px 40px;
  background: var($surface);
  min-height: 100%;

  &__header {
    display: flex;
    align-items: center;
    padding: 16px 0 8px;

    &-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
  }

  &__status {
    padding: 24px 0;
    color: var($secondary-text-on-surface);

    &--error {
      color: var($error);
    }
  }

  &__footer {
    margin-top: 24px;
  }
}

.discovery-card {
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  margin-bottom: 20px;

  &__header {
    padding: 12px 16px;
    border-bottom: 1px solid var($border-on-surface);
    @include subtitle1();
    font-weight: 600;
  }

  &__body {
    padding: 16px;
  }
}

.discovery-form-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;

  &:last-child {
    margin-bottom: 0;
  }
}

.discovery-label {
  flex: 0 0 260px;
  color: var($secondary-text-on-surface);
}

.discovery-select,
.discovery-input {
  flex: 1;
  max-width: 340px;
  padding: 6px 10px;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  background: var($surface);
  color: var($primary-text-on-surface);

  &:focus {
    outline: 2px solid var($primary);
    outline-offset: 1px;
  }
}
</style>
