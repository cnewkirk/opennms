<template>
  <div class="tge-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="tge-page__header feather-row">
      <div class="feather-col-8">
        <h2 class="headline4">Edit Threshold Group: {{ groupName }}</h2>
      </div>
      <div class="feather-col-4 tge-page__header-actions">
        <Button severity="secondary" label="Back" @click="router.push('/threshold-config')" />
        <Button :disabled="saving || loading" @click="saveGroup" :label="saving ? 'Saving…' : 'Save Group'" />
      </div>
    </div>

    <div v-if="loading" class="tge-status">Loading…</div>
    <div v-else-if="loadError" class="tge-status tge-status--error">Failed to load group.</div>

    <template v-if="!loading && !loadError && group">
      <!-- Group metadata -->
      <div class="tge-card">
        <div class="tge-card__header">Group Settings</div>
        <div class="tge-card__body">
          <div class="tge-form-row">
            <label class="tge-label">RRD Repository</label>
            <input v-model="group.rrdRepository" class="tge-input" type="text" />
          </div>
        </div>
      </div>

      <!-- Thresholds table -->
      <div class="tge-card">
        <div class="tge-card__header tge-card__header--with-action">
          <span>Thresholds</span>
          <Button label="+ Add Threshold" @click="addThreshold" />
        </div>
        <div class="tge-card__body">
          <div v-if="group.thresholds.length === 0" class="tge-empty">No thresholds defined.</div>
          <div v-for="(t, idx) in group.thresholds" :key="idx" class="tge-entry">
            <div class="tge-entry__header">
              <span class="tge-entry__title">Threshold {{ idx + 1 }}: {{ t.dsName || '(unnamed)' }}</span>
              <Button text label="Remove" @click="removeThreshold(idx)" />
            </div>
            <div class="tge-entry__body">
              <div class="tge-grid">
                <div class="tge-form-row">
                  <label class="tge-label">Type</label>
                  <select v-model="t.type" class="tge-select">
                    <option v-for="tt in thresholdTypes" :key="tt" :value="tt">{{ tt }}</option>
                  </select>
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">DS Name</label>
                  <input v-model="t.dsName" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">DS Type</label>
                  <select v-model="t.dsType" class="tge-select">
                    <option value="node">node</option>
                    <option value="if">if</option>
                    <option value="generic">generic</option>
                  </select>
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">DS Label</label>
                  <input v-model="t.dsLabel" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Value</label>
                  <input v-model="t.value" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Rearm</label>
                  <input v-model="t.rearm" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Trigger</label>
                  <input v-model="t.trigger" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Filter Operator</label>
                  <select v-model="t.filterOperator" class="tge-select">
                    <option value="or">or</option>
                    <option value="and">and</option>
                  </select>
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Triggered UEI</label>
                  <input v-model="t.triggeredUEI" class="tge-input" type="text" list="uei-list" />
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Rearmed UEI</label>
                  <input v-model="t.rearmedUEI" class="tge-input" type="text" list="uei-list" />
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Description</label>
                  <input v-model="t.description" class="tge-input" type="text" />
                </div>
              </div>
              <!-- Resource Filters -->
              <div class="tge-filters">
                <div class="tge-filters__header">
                  <span>Resource Filters</span>
                  <Button text label="+ Add Filter" @click="addFilter(t)" />
                </div>
                <div v-for="(rf, fi) in t.resourceFilters" :key="fi" class="tge-filter-row">
                  <input v-model="rf.field" class="tge-input tge-input--sm" type="text" placeholder="Field" />
                  <input v-model="rf.filter" class="tge-input tge-input--lg" type="text" placeholder="Regex" />
                  <Button text label="×" @click="t.resourceFilters.splice(fi, 1)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Expressions table -->
      <div class="tge-card">
        <div class="tge-card__header tge-card__header--with-action">
          <span>Expressions</span>
          <Button label="+ Add Expression" @click="addExpression" />
        </div>
        <div class="tge-card__body">
          <div v-if="group.expressions.length === 0" class="tge-empty">No expressions defined.</div>
          <div v-for="(e, idx) in group.expressions" :key="idx" class="tge-entry">
            <div class="tge-entry__header">
              <span class="tge-entry__title">Expression {{ idx + 1 }}: {{ e.exprLabel || e.expression || '(unnamed)' }}</span>
              <Button text label="Remove" @click="removeExpression(idx)" />
            </div>
            <div class="tge-entry__body">
              <div class="tge-grid">
                <div class="tge-form-row">
                  <label class="tge-label">Type</label>
                  <select v-model="e.type" class="tge-select">
                    <option v-for="tt in thresholdTypes" :key="tt" :value="tt">{{ tt }}</option>
                  </select>
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Expression</label>
                  <input v-model="e.expression" class="tge-input" type="text" placeholder="e.g. ifInErrors + ifOutErrors" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">DS Type</label>
                  <select v-model="e.dsType" class="tge-select">
                    <option value="node">node</option>
                    <option value="if">if</option>
                    <option value="generic">generic</option>
                  </select>
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Expression Label</label>
                  <input v-model="e.exprLabel" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">DS Label</label>
                  <input v-model="e.dsLabel" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Value</label>
                  <input v-model="e.value" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Rearm</label>
                  <input v-model="e.rearm" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Trigger</label>
                  <input v-model="e.trigger" class="tge-input" type="text" />
                </div>
                <div class="tge-form-row">
                  <label class="tge-label">Filter Operator</label>
                  <select v-model="e.filterOperator" class="tge-select">
                    <option value="or">or</option>
                    <option value="and">and</option>
                  </select>
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Triggered UEI</label>
                  <input v-model="e.triggeredUEI" class="tge-input" type="text" list="uei-list" />
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Rearmed UEI</label>
                  <input v-model="e.rearmedUEI" class="tge-input" type="text" list="uei-list" />
                </div>
                <div class="tge-form-row tge-form-row--full">
                  <label class="tge-label">Description</label>
                  <input v-model="e.description" class="tge-input" type="text" />
                </div>
              </div>
              <!-- Resource Filters -->
              <div class="tge-filters">
                <div class="tge-filters__header">
                  <span>Resource Filters</span>
                  <Button text label="+ Add Filter" @click="addFilter(e)" />
                </div>
                <div v-for="(rf, fi) in e.resourceFilters" :key="fi" class="tge-filter-row">
                  <input v-model="rf.field" class="tge-input tge-input--sm" type="text" placeholder="Field" />
                  <input v-model="rf.filter" class="tge-input tge-input--lg" type="text" placeholder="Regex" />
                  <Button text label="×" @click="e.resourceFilters.splice(fi, 1)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- UEI datalist for autocomplete -->
    <datalist id="uei-list">
      <option v-for="uei in ueis" :key="uei" :value="uei" />
    </datalist>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import useSnackbar from '@/composables/useSnackbar'
import { v2, rest } from '@/services/axiosInstances'
import { BreadCrumb } from '@/types'

const route = useRoute()
const router = useRouter()
const { showSnackBar } = useSnackbar()

const groupName = computed(() => route.params.groupName as string)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Threshold Configuration', to: '/threshold-config' },
  { label: groupName.value, to: '#', position: 'last' }
])

interface ResourceFilter {
  field: string
  filter: string
}

interface ThresholdEntry {
  type: string
  dsType: string
  dsName: string
  value: string
  rearm: string
  trigger: string
  dsLabel: string | null
  triggeredUEI: string | null
  rearmedUEI: string | null
  filterOperator: string
  resourceFilters: ResourceFilter[]
  description: string | null
  relaxed: boolean
}

interface ExpressionEntry {
  type: string
  dsType: string
  expression: string
  value: string
  rearm: string
  trigger: string
  dsLabel: string | null
  exprLabel: string | null
  triggeredUEI: string | null
  rearmedUEI: string | null
  filterOperator: string
  resourceFilters: ResourceFilter[]
  description: string | null
  relaxed: boolean
}

interface Group {
  name: string
  rrdRepository: string
  thresholds: ThresholdEntry[]
  expressions: ExpressionEntry[]
}

const group = ref<Group | null>(null)
const loading = ref(true)
const loadError = ref(false)
const saving = ref(false)
const ueis = ref<string[]>([])

const thresholdTypes = ['high', 'low', 'relativeChange', 'absoluteChange', 'rearmingAbsoluteChange']

function normalizeArray<T>(raw: T | T[] | undefined | null): T[] {
  if (Array.isArray(raw)) return raw
  if (raw) return [raw]
  return []
}

onMounted(async () => {
  try {
    const [groupResp, ueisResp] = await Promise.allSettled([
      v2.get(`/thresholds/${groupName.value}`),
      rest.get('/events/ueis')
    ])

    if (groupResp.status === 'fulfilled') {
      const d = groupResp.value.data
      group.value = {
        name: d.name,
        rrdRepository: d.rrdRepository,
        thresholds: normalizeArray<ThresholdEntry>(d.thresholds),
        expressions: normalizeArray<ExpressionEntry>(d.expressions)
      }
    } else {
      loadError.value = true
    }

    if (ueisResp.status === 'fulfilled') {
      const raw = ueisResp.value.data
      ueis.value = Array.isArray(raw) ? raw : []
    }
  } finally {
    loading.value = false
  }
})

function newThreshold(): ThresholdEntry {
  return {
    type: 'high',
    dsType: 'node',
    dsName: '',
    value: '0.0',
    rearm: '0.0',
    trigger: '1',
    dsLabel: null,
    triggeredUEI: null,
    rearmedUEI: null,
    filterOperator: 'or',
    resourceFilters: [],
    description: null,
    relaxed: false
  }
}

function newExpression(): ExpressionEntry {
  return {
    type: 'high',
    dsType: 'if',
    expression: '',
    value: '0.0',
    rearm: '0.0',
    trigger: '1',
    dsLabel: null,
    exprLabel: null,
    triggeredUEI: null,
    rearmedUEI: null,
    filterOperator: 'or',
    resourceFilters: [],
    description: null,
    relaxed: false
  }
}

function addThreshold() {
  group.value?.thresholds.push(newThreshold())
}

function removeThreshold(idx: number) {
  group.value?.thresholds.splice(idx, 1)
}

function addExpression() {
  group.value?.expressions.push(newExpression())
}

function removeExpression(idx: number) {
  group.value?.expressions.splice(idx, 1)
}

function addFilter(entry: ThresholdEntry | ExpressionEntry) {
  entry.resourceFilters.push({ field: '', filter: '' })
}

async function saveGroup() {
  if (!group.value) return
  saving.value = true
  try {
    await v2.put(`/thresholds/${groupName.value}`, group.value, {
      headers: { 'Content-Type': 'application/json' }
    })
    showSnackBar({ msg: `Group '${groupName.value}' saved successfully.` })
    router.push('/threshold-config')
  } catch (e) {
    showSnackBar({ msg: `Failed to save group '${groupName.value}'.` })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.tge-page {
  padding: 1.5rem;

  &__header {
    align-items: center;
    margin-bottom: 1.5rem;
  }

  &__header-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
  }
}

.tge-status {
  color: var(--feather-secondary-text-on-surface);
  padding: 1rem 0;

  &--error {
    color: var(--feather-error);
  }
}

.tge-card {
  background: var(--feather-surface);
  border-radius: 6px;
  border: 1px solid var(--feather-border-on-surface);
  margin-bottom: 1.5rem;

  &__header {
    font-weight: 600;
    font-size: 1rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--feather-border-on-surface);
    color: var(--feather-primary-text-on-surface);

    &--with-action {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  &__body {
    padding: 1.25rem;
  }
}

.tge-empty {
  color: var(--feather-secondary-text-on-surface);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.tge-entry {
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 6px;
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 1rem;
    background: var(--feather-state-text-color-on-surface-2);
    border-radius: 5px 5px 0 0;
    border-bottom: 1px solid var(--feather-border-on-surface);
  }

  &__title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--feather-primary-text-on-surface);
  }

  &__body {
    padding: 1rem;
  }
}

.tge-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.5rem;
  margin-bottom: 1rem;
}

.tge-form-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &--full {
    grid-column: 1 / -1;
  }
}

.tge-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--feather-secondary-text-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tge-input {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 4px;
  background: var(--feather-surface);
  color: var(--feather-primary-text-on-surface);
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;

  &--sm {
    width: 160px;
  }

  &--lg {
    flex: 1;
  }

  &:focus {
    outline: none;
    border-color: var(--feather-primary);
  }
}

.tge-select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 4px;
  background: var(--feather-surface);
  color: var(--feather-primary-text-on-surface);
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--feather-primary);
  }
}

.tge-filters {
  border-top: 1px solid var(--feather-border-on-surface);
  padding-top: 0.75rem;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--feather-secondary-text-on-surface);
    margin-bottom: 0.5rem;
  }
}

.tge-filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
</style>
