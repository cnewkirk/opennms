<template>
  <div class="asset-edit-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div v-if="loading" class="feather-row">
      <div class="feather-col-12 asset-edit-page__status">Loading…</div>
    </div>

    <div v-else-if="!record" class="feather-row">
      <div class="feather-col-12 asset-edit-page__status">Asset record not found.</div>
    </div>

    <template v-else>
      <div class="feather-row">
        <div class="feather-col-12">
          <form class="asset-form" @submit.prevent="save">
            <!-- Identity -->
            <div class="asset-card">
              <div class="asset-card__header">Identity</div>
              <div class="asset-card__body">
                <div class="field-row">
                  <label class="field-label">Category</label>
                  <InputText v-model="form.category" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Manufacturer</label>
                  <InputText v-model="form.manufacturer" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Model Number</label>
                  <InputText v-model="form.modelNumber" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Serial Number</label>
                  <InputText v-model="form.serialNumber" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Description</label>
                  <InputText v-model="form.description" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Operating System</label>
                  <InputText v-model="form.operatingSystem" class="field-input" />
                </div>
              </div>
            </div>

            <!-- Location -->
            <div class="asset-card">
              <div class="asset-card__header">Location</div>
              <div class="asset-card__body">
                <div class="field-row">
                  <label class="field-label">Building</label>
                  <InputText v-model="form.building" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Floor</label>
                  <InputText v-model="form.floor" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Room</label>
                  <InputText v-model="form.room" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Rack</label>
                  <InputText v-model="form.rack" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Address Line 1</label>
                  <InputText v-model="form.address1" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Address Line 2</label>
                  <InputText v-model="form.address2" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">City</label>
                  <InputText v-model="form.city" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">State</label>
                  <InputText v-model="form.state" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Zip</label>
                  <InputText v-model="form.zip" class="field-input" />
                </div>
                <div class="field-row">
                  <label class="field-label">Country</label>
                  <InputText v-model="form.country" class="field-input" />
                </div>
              </div>
            </div>

            <div class="asset-form__actions">
              <router-link to="/assets">
                <Button label="Cancel" text type="button" />
              </router-link>
              <Button
                label="Save"
                type="submit"
                :disabled="saving"
              />
            </div>
          </form>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useMenuStore } from '@/stores/menuStore'
import { getAssetRecord, updateAssetRecord, type AssetRecord } from '@/services/assetService'
import { v2 } from '@/services/axiosInstances'
import useSnackbar from '@/composables/useSnackbar'
import { type BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const nodeId = route.params.nodeId as string
const record = ref<AssetRecord | null>(null)
const loading = ref(true)
const saving = ref(false)
const nodeLabel = ref<string>(`Node ${nodeId}`)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Assets', to: '/assets' },
  { label: `Edit Asset: ${nodeLabel.value}`, to: '#', position: 'last' }
])

const form = reactive<Partial<AssetRecord>>({
  category: '',
  manufacturer: '',
  modelNumber: '',
  serialNumber: '',
  description: '',
  operatingSystem: '',
  building: '',
  floor: '',
  room: '',
  rack: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: ''
})

const populateForm = (r: AssetRecord) => {
  form.category = r.category ?? ''
  form.manufacturer = r.manufacturer ?? ''
  form.modelNumber = r.modelNumber ?? ''
  form.serialNumber = r.serialNumber ?? ''
  form.description = r.description ?? ''
  form.operatingSystem = r.operatingSystem ?? ''
  form.building = r.building ?? ''
  form.floor = r.floor ?? ''
  form.room = r.room ?? ''
  form.rack = r.rack ?? ''
  form.address1 = r.address1 ?? ''
  form.address2 = r.address2 ?? ''
  form.city = r.city ?? ''
  form.state = r.state ?? ''
  form.zip = r.zip ?? ''
  form.country = r.country ?? ''
}

const save = async () => {
  saving.value = true
  const ok = await updateAssetRecord(nodeId, form)
  if (ok) {
    showSnackBar({ msg: 'Asset record saved.' })
  } else {
    showSnackBar({ msg: 'Failed to save asset record.' })
  }
  saving.value = false
}

onMounted(async () => {
  try {
    // Load node label for breadcrumb
    try {
      const resp = await v2.get(`/nodes/${nodeId}`)
      if (resp.data?.label) nodeLabel.value = resp.data.label
    } catch {
      // label fallback is fine
    }

    const r = await getAssetRecord(nodeId)
    record.value = r
    if (r) populateForm(r)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.asset-edit-page {
  padding: 0 0 40px;

  &__status {
    padding: 24px;
    color: var($secondary-text-on-surface);
  }
}

.asset-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 680px;

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}

.asset-card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;

  &__header {
    padding: 10px 16px;
    font-weight: 600;
    font-size: 13px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

.field-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  align-items: center;
  gap: 12px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var($secondary-text-on-surface);
  text-align: right;
}

.field-input {
  width: 100%;
}
</style>
