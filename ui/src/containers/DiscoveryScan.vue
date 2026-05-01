<template>
  <div class="scan-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="scan-page__header feather-row">
      <div class="feather-col-12">
        <h2 class="headline4">Run Single Discovery Scan</h2>
      </div>
    </div>

    <div class="scan-layout">
      <!-- General Settings -->
      <div class="scan-card">
        <div class="scan-card__header">General Settings</div>
        <div class="scan-card__body">
          <div class="scan-form-row">
            <label class="scan-label">Timeout (milliseconds)</label>
            <input v-model.number="config.timeout" type="number" class="scan-input" min="0" />
          </div>
          <div class="scan-form-row">
            <label class="scan-label">Retries</label>
            <input v-model.number="config.retries" type="number" class="scan-input" min="0" />
          </div>
          <div class="scan-form-row">
            <label class="scan-label">Location</label>
            <select v-model="config.location" class="scan-select">
              <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>
          <div class="scan-form-row">
            <label class="scan-label">Foreign Source</label>
            <select v-model="config.foreignSource" class="scan-select">
              <option value="">None</option>
              <option v-for="fs in foreignSources" :key="fs" :value="fs">{{ fs }}</option>
            </select>
          </div>
          <div class="scan-form-row">
            <label class="scan-label">Task Chunk Size</label>
            <input v-model.number="config.chunkSize" type="number" class="scan-input" min="1" />
          </div>
        </div>
      </div>

      <!-- Specific Addresses -->
      <div class="scan-card">
        <div class="scan-card__header">Specific Addresses</div>
        <div class="scan-card__body">
          <table v-if="config.specifics.length" class="scan-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Location</th>
                <th>Timeout (ms)</th>
                <th>Retries</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in config.specifics" :key="i">
                <td>{{ s.content }}</td>
                <td>{{ s.location || '—' }}</td>
                <td>{{ s.timeout ?? '—' }}</td>
                <td>{{ s.retries ?? '—' }}</td>
                <td><Button text label="Remove" class="scan-remove" @click="removeSpecific(i)" /></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="scan-empty">No specific addresses added.</p>
        </div>
        <div class="scan-card__footer">
          <Button label="Add Specific Address" severity="secondary" @click="showSpecificDialog = true" />
        </div>
      </div>

      <!-- Include Ranges -->
      <div class="scan-card">
        <div class="scan-card__header">Include Ranges</div>
        <div class="scan-card__body">
          <table v-if="config.includeRanges.length" class="scan-table">
            <thead>
              <tr>
                <th>Begin</th>
                <th>End</th>
                <th>Location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in config.includeRanges" :key="i">
                <td>{{ r.begin }}</td>
                <td>{{ r.end }}</td>
                <td>{{ r.location || '—' }}</td>
                <td><Button text label="Remove" class="scan-remove" @click="removeIncludeRange(i)" /></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="scan-empty">No include ranges added.</p>
        </div>
        <div class="scan-card__footer">
          <Button label="Add Include Range" severity="secondary" @click="showRangeDialog = true; rangeMode = 'include'" />
        </div>
      </div>

      <!-- Exclude Ranges -->
      <div class="scan-card">
        <div class="scan-card__header">Exclude Ranges</div>
        <div class="scan-card__body">
          <table v-if="config.excludeRanges.length" class="scan-table">
            <thead>
              <tr>
                <th>Begin</th>
                <th>End</th>
                <th>Location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in config.excludeRanges" :key="i">
                <td>{{ r.begin }}</td>
                <td>{{ r.end }}</td>
                <td>{{ r.location || '—' }}</td>
                <td><Button text label="Remove" class="scan-remove" @click="removeExcludeRange(i)" /></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="scan-empty">No exclude ranges added.</p>
        </div>
        <div class="scan-card__footer">
          <Button label="Add Exclude Range" severity="secondary" @click="showRangeDialog = true; rangeMode = 'exclude'" />
        </div>
      </div>

      <div class="scan-actions">
        <Button
          :label="scanning ? 'Starting Scan…' : 'Start Discovery Scan'"
          :disabled="scanning"
          @click="runScan"
        />
      </div>
    </div>

    <!-- Add Specific Address dialog -->
    <Dialog v-model:visible="showSpecificDialog" header="Add Specific Address" :modal="true" :closable="true">
      <div class="scan-dialog-form">
        <div class="scan-form-row">
          <label class="scan-label">IP Address <span class="scan-required">*</span></label>
          <input v-model="newSpecific.content" type="text" class="scan-input" placeholder="e.g. 192.168.1.1" />
        </div>
        <div class="scan-form-row">
          <label class="scan-label">Location</label>
          <select v-model="newSpecific.location" class="scan-select">
            <option value="">Use Default</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
        <div class="scan-form-row">
          <label class="scan-label">Timeout (ms)</label>
          <input v-model.number="newSpecific.timeout" type="number" class="scan-input" min="0" placeholder="Use Default" />
        </div>
        <div class="scan-form-row">
          <label class="scan-label">Retries</label>
          <input v-model.number="newSpecific.retries" type="number" class="scan-input" min="0" placeholder="Use Default" />
        </div>
      </div>
      <template #footer>
        <Button label="Add" :disabled="!newSpecific.content" @click="addSpecific" />
        <Button text label="Cancel" @click="showSpecificDialog = false" />
      </template>
    </Dialog>

    <!-- Add Range dialog -->
    <Dialog v-model:visible="showRangeDialog" :header="rangeMode === 'include' ? 'Add Include Range' : 'Add Exclude Range'" :modal="true" :closable="true">
      <div class="scan-dialog-form">
        <div class="scan-form-row">
          <label class="scan-label">Begin Address <span class="scan-required">*</span></label>
          <input v-model="newRange.begin" type="text" class="scan-input" placeholder="e.g. 192.168.1.1" />
        </div>
        <div class="scan-form-row">
          <label class="scan-label">End Address <span class="scan-required">*</span></label>
          <input v-model="newRange.end" type="text" class="scan-input" placeholder="e.g. 192.168.1.254" />
        </div>
        <div class="scan-form-row">
          <label class="scan-label">Location</label>
          <select v-model="newRange.location" class="scan-select">
            <option value="">Use Default</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <Button label="Add" :disabled="!newRange.begin || !newRange.end" @click="addRange" />
        <Button text label="Cancel" @click="showRangeDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getLocations, getForeignSources, runDiscoveryScan } from '@/services/discoveryConfigService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Run Single Discovery Scan', to: '#', position: 'last' }
]

const locations = ref<string[]>(['Default'])
const foreignSources = ref<string[]>([])

const config = ref({
  timeout: 2000,
  retries: 1,
  location: 'Default',
  foreignSource: '',
  chunkSize: 100,
  specifics: [] as { content: string; location?: string; timeout?: number; retries?: number }[],
  includeRanges: [] as { begin: string; end: string; location?: string }[],
  excludeRanges: [] as { begin: string; end: string; location?: string }[]
})

const scanning = ref(false)

const showSpecificDialog = ref(false)
const newSpecific = ref({ content: '', location: '', timeout: undefined as number | undefined, retries: undefined as number | undefined })

const showRangeDialog = ref(false)
const rangeMode = ref<'include' | 'exclude'>('include')
const newRange = ref({ begin: '', end: '', location: '' })

const addSpecific = () => {
  const s: { content: string; location?: string; timeout?: number; retries?: number } = { content: newSpecific.value.content }
  if (newSpecific.value.location) s.location = newSpecific.value.location
  if (newSpecific.value.timeout != null) s.timeout = newSpecific.value.timeout
  if (newSpecific.value.retries != null) s.retries = newSpecific.value.retries
  config.value.specifics.push(s)
  newSpecific.value = { content: '', location: '', timeout: undefined, retries: undefined }
  showSpecificDialog.value = false
}

const removeSpecific = (i: number) => config.value.specifics.splice(i, 1)

const addRange = () => {
  const r: { begin: string; end: string; location?: string } = { begin: newRange.value.begin, end: newRange.value.end }
  if (newRange.value.location) r.location = newRange.value.location
  if (rangeMode.value === 'include') config.value.includeRanges.push(r)
  else config.value.excludeRanges.push(r)
  newRange.value = { begin: '', end: '', location: '' }
  showRangeDialog.value = false
}

const removeIncludeRange = (i: number) => config.value.includeRanges.splice(i, 1)
const removeExcludeRange = (i: number) => config.value.excludeRanges.splice(i, 1)

const runScan = async () => {
  scanning.value = true
  const payload: Record<string, unknown> = {
    timeout: config.value.timeout,
    retries: config.value.retries,
    location: config.value.location,
    chunkSize: config.value.chunkSize
  }
  if (config.value.foreignSource) payload.foreignSource = config.value.foreignSource
  if (config.value.specifics.length) payload.specifics = config.value.specifics
  if (config.value.includeRanges.length) payload.includeRanges = config.value.includeRanges
  if (config.value.excludeRanges.length) payload.excludeRanges = config.value.excludeRanges

  const ok = await runDiscoveryScan(payload as never)
  scanning.value = false
  if (ok) {
    showSnackBar({ msg: 'Discovery scan started.' })
  } else {
    showSnackBar({ msg: 'Failed to start discovery scan.', error: true })
  }
}

onMounted(async () => {
  const [locs, fss] = await Promise.all([getLocations(), getForeignSources()])
  if (locs.length) locations.value = locs
  foreignSources.value = fss
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.scan-page {
  padding: 0 24px 40px;

  &__header {
    margin-bottom: 20px;
    .headline4 { margin: 0; }
  }
}

.scan-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
}

.scan-card {
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
  }

  &__footer {
    padding: 12px 16px;
    border-top: 1px solid var($shade-3);
    background: var($shade-4);
    display: flex;
    justify-content: flex-end;
  }
}

.scan-form-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  &:last-child { margin-bottom: 0; }
}

.scan-label {
  font-size: 13px;
  font-weight: 500;
  color: var($secondary-text-on-surface);
}

.scan-required { color: var($error); }

.scan-input,
.scan-select {
  padding: 7px 10px;
  border: 1px solid var($shade-3);
  border-radius: 4px;
  background: var($surface);
  color: var($primary-text-on-surface);
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var($clickable-normal);
  }
}

.scan-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    text-align: left;
    padding: 8px 10px;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    border-bottom: 1px solid var($shade-3);
  }

  td {
    padding: 8px 10px;
    border-bottom: 1px solid var($shade-3);
    vertical-align: middle;
  }
}

.scan-empty {
  color: var($secondary-text-on-surface);
  font-size: 13px;
  margin: 0;
}

.scan-remove {
  color: var($error) !important;
}

.scan-actions {
  padding-top: 8px;
}

.scan-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 360px;
  padding-bottom: 8px;
}
</style>
