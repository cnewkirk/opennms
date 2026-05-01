<template>
  <div class="geocoder-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="geocoder-page__header feather-row">
      <div class="feather-col-12">
        <h2 class="headline4">Geocoder Service Configuration</h2>
      </div>
    </div>

    <div v-if="loading" class="geocoder-page__status">Loading…</div>
    <div v-else-if="loadError" class="geocoder-page__status geocoder-page__status--error">
      Failed to load geocoder configuration.
    </div>

    <template v-else>
      <div class="geocoder-active">
        <span class="geocoder-active__label">Active Geocoder:</span>
        <span class="geocoder-active__value">{{ activeGeocoderId || 'None' }}</span>
      </div>

      <div class="geocoder-cards">
        <div v-for="gc in geocoders" :key="gc.id" class="geocoder-card" :class="{ 'geocoder-card--active': gc.id === activeGeocoderId }">
          <div class="geocoder-card__header">
            <span class="geocoder-card__title">{{ capitalize(gc.id) }}</span>
            <div class="geocoder-card__header-actions">
              <span v-if="gc.id === activeGeocoderId" class="geocoder-card__badge">Active</span>
              <Button
                v-else
                label="Set as Active"
                severity="secondary"
                size="small"
                :disabled="!!gc.error"
                @click="activate(gc.id)"
              />
            </div>
          </div>

          <div class="geocoder-card__body">
            <!-- Google -->
            <template v-if="gc.id === 'google'">
              <div class="gc-form-row">
                <label class="gc-label">
                  <input type="checkbox" v-model="(gc.config as any).useEnterpriseCredentials" class="gc-checkbox" />
                  Use Enterprise Credentials (clientId + signature)
                </label>
              </div>
              <template v-if="!(gc.config as any).useEnterpriseCredentials">
                <div class="gc-form-row">
                  <label class="gc-label">API Key <span class="gc-required">*</span></label>
                  <input v-model="(gc.config as any).apiKey" type="text" class="gc-input" placeholder="Google API key" />
                </div>
              </template>
              <template v-else>
                <div class="gc-form-row">
                  <label class="gc-label">Client ID <span class="gc-required">*</span></label>
                  <input v-model="(gc.config as any).clientId" type="text" class="gc-input" />
                </div>
                <div class="gc-form-row">
                  <label class="gc-label">Signature <span class="gc-required">*</span></label>
                  <input v-model="(gc.config as any).signature" type="text" class="gc-input" />
                </div>
              </template>
              <div class="gc-form-row">
                <label class="gc-label">Timeout (ms)</label>
                <input v-model.number="(gc.config as any).timeout" type="number" min="0" class="gc-input" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">
                  <input type="checkbox" v-model="(gc.config as any).useSystemProxy" class="gc-checkbox" />
                  Use System Proxy
                </label>
              </div>
            </template>

            <!-- Nominatim -->
            <template v-else-if="gc.id === 'nominatim'">
              <div class="gc-form-row">
                <label class="gc-label">URL</label>
                <input v-model="(gc.config as any).url" type="text" class="gc-input" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">Email</label>
                <input v-model="(gc.config as any).email" type="text" class="gc-input" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">Referer</label>
                <input v-model="(gc.config as any).referer" type="text" class="gc-input" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">User Agent</label>
                <input v-model="(gc.config as any).userAgent" type="text" class="gc-input" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">
                  <input type="checkbox" v-model="(gc.config as any).acceptUsageTerms" class="gc-checkbox" />
                  Accept Nominatim Usage Terms
                </label>
              </div>
              <div class="gc-form-row">
                <label class="gc-label">
                  <input type="checkbox" v-model="(gc.config as any).useSystemProxy" class="gc-checkbox" />
                  Use System Proxy
                </label>
              </div>
            </template>

            <!-- MapQuest -->
            <template v-else-if="gc.id === 'mapquest'">
              <div class="gc-form-row">
                <label class="gc-label">API Key <span class="gc-required">*</span></label>
                <input v-model="(gc.config as any).apiKey" type="text" class="gc-input" placeholder="MapQuest API key" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">URL</label>
                <input v-model="(gc.config as any).url" type="text" class="gc-input" />
              </div>
              <div class="gc-form-row">
                <label class="gc-label">
                  <input type="checkbox" v-model="(gc.config as any).useSystemProxy" class="gc-checkbox" />
                  Use System Proxy
                </label>
              </div>
            </template>

            <!-- Unknown geocoder — show raw key/value fields -->
            <template v-else>
              <div v-for="(val, key) in gc.config" :key="String(key)" class="gc-form-row">
                <label class="gc-label">{{ key }}</label>
                <input v-model="(gc.config as any)[key]" type="text" class="gc-input" />
              </div>
            </template>

            <div v-if="saveErrors[gc.id]" class="gc-error">{{ saveErrors[gc.id] }}</div>
          </div>

          <div class="geocoder-card__footer">
            <Button
              :label="saving[gc.id] ? 'Saving…' : 'Save Configuration'"
              :disabled="saving[gc.id]"
              @click="saveConfig(gc)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import {
  getServiceConfig,
  setActiveGeocoder,
  listGeocoders,
  updateGeocoderSettings,
  type Geocoder
} from '@/services/geocoderService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Geocoder Service', to: '#', position: 'last' }
]

const loading = ref(true)
const loadError = ref(false)
const activeGeocoderId = ref('')
const geocoders = ref<Geocoder[]>([])
const saving = ref<Record<string, boolean>>({})
const saveErrors = ref<Record<string, string>>({})

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const load = async () => {
  loading.value = true
  loadError.value = false
  const [cfg, gcs] = await Promise.all([getServiceConfig(), listGeocoders()])
  if (!cfg && !gcs.length) {
    loadError.value = true
  } else {
    activeGeocoderId.value = cfg?.activeGeocoderId ?? ''
    geocoders.value = gcs
  }
  loading.value = false
}

const activate = async (id: string) => {
  const ok = await setActiveGeocoder(id)
  if (ok) {
    activeGeocoderId.value = id
    showSnackBar({ msg: `${capitalize(id)} set as active geocoder.` })
  } else {
    showSnackBar({ msg: 'Failed to update active geocoder.', error: true })
  }
}

const saveConfig = async (gc: Geocoder) => {
  saving.value = { ...saving.value, [gc.id]: true }
  saveErrors.value = { ...saveErrors.value, [gc.id]: '' }
  const result = await updateGeocoderSettings(gc.id, gc.config)
  saving.value = { ...saving.value, [gc.id]: false }
  if (result.ok) {
    showSnackBar({ msg: `${capitalize(gc.id)} configuration saved.` })
    gc.error = undefined
  } else {
    saveErrors.value = { ...saveErrors.value, [gc.id]: result.error?.message ?? 'Save failed.' }
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.geocoder-page {
  padding: 0 24px 40px;

  &__header {
    margin-bottom: 16px;
    .headline4 { margin: 0; }
  }

  &__status {
    color: var($secondary-text-on-surface);
    padding: 24px 0;

    &--error { color: var($error); }
  }
}

.geocoder-active {
  margin-bottom: 20px;
  font-size: 14px;

  &__label {
    font-weight: 600;
    color: var($secondary-text-on-surface);
    margin-right: 8px;
  }

  &__value {
    color: var($primary-text-on-surface);
  }
}

.geocoder-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
}

.geocoder-card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;

  &--active {
    border-color: var($clickable-normal);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__title {
    font-weight: 600;
    font-size: 14px;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__badge {
    font-size: 12px;
    font-weight: 600;
    color: var($clickable-normal);
    background: color-mix(in srgb, var($clickable-normal) 15%, transparent);
    padding: 2px 8px;
    border-radius: 10px;
  }

  &__body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__footer {
    padding: 12px 16px;
    border-top: 1px solid var($shade-3);
    background: var($shade-4);
    display: flex;
    justify-content: flex-end;
  }
}

.gc-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gc-label {
  font-size: 13px;
  font-weight: 500;
  color: var($secondary-text-on-surface);
  display: flex;
  align-items: center;
  gap: 6px;
}

.gc-required { color: var($error); }

.gc-input {
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

.gc-checkbox {
  margin: 0;
}

.gc-error {
  color: var($error);
  font-size: 13px;
}
</style>
