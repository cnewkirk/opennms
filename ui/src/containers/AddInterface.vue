<template>
  <div class="add-interface-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="add-interface-form">
      <h2 class="add-interface-form__title">Manually Add an Interface</h2>

      <Message severity="warn" :closable="false" class="add-interface-form__warning">
        Adding an interface manually does not prevent OpenNMS from removing it during the next
        node rescan if the address is not found in the node's active configuration. For a
        persistent interface, add it via a provisioning requisition instead.
      </Message>

      <div class="add-interface-form__field">
        <label for="ai-node">Node ID <span class="required">*</span></label>
        <InputText
          id="ai-node"
          v-model="form.nodeId"
          placeholder="Enter node ID"
          @blur="lookupNodeLabel"
        />
        <span v-if="nodeLabel" class="add-interface-form__node-label">Node: {{ nodeLabel }}</span>
        <span v-if="nodeLookupError" class="add-interface-form__error">{{ nodeLookupError }}</span>
      </div>

      <div class="add-interface-form__field">
        <label for="ai-ip">IP Address <span class="required">*</span></label>
        <InputText id="ai-ip" v-model="form.ipAddress" placeholder="e.g. 192.168.1.100" />
      </div>

      <div class="add-interface-form__field">
        <label for="ai-managed">Managed Status</label>
        <Select
          id="ai-managed"
          v-model="form.isManaged"
          :options="managedOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="add-interface-form__actions">
        <Button
          label="Add Interface"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Message from 'primevue/message'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { addInterface } from '@/services/addInterfaceService'
import { rest } from '@/services/axiosInstances'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Add Interface', to: '#', position: 'last' }
])

const managedOptions = [
  { label: 'Managed (M)', value: 'M' },
  { label: 'Unmanaged (U)', value: 'U' }
]

const form = reactive({ nodeId: '', ipAddress: '', isManaged: 'M' as 'M' | 'U' })
const saving = ref(false)
const nodeLabel = ref('')
const nodeLookupError = ref('')

const canSubmit = computed(() =>
  form.nodeId.trim() !== '' && form.ipAddress.trim() !== '' && !nodeLookupError.value
)

const lookupNodeLabel = async () => {
  const id = parseInt(form.nodeId.trim(), 10)
  if (isNaN(id) || id <= 0) {
    nodeLabel.value = ''
    nodeLookupError.value = form.nodeId.trim() ? 'Node ID must be a positive integer.' : ''
    return
  }
  nodeLookupError.value = ''
  nodeLabel.value = ''
  try {
    const resp = await rest.get(`/nodes/${id}`, { headers: { Accept: 'application/json' } })
    nodeLabel.value = resp.data?.label ?? `Node ${id}`
  } catch {
    nodeLookupError.value = `Node ${id} not found.`
  }
}

const submit = async () => {
  const id = parseInt(form.nodeId.trim(), 10)
  if (isNaN(id) || !form.ipAddress.trim()) return
  saving.value = true
  const ok = await addInterface(id, form.ipAddress.trim(), form.isManaged)
  saving.value = false
  if (ok) {
    showSnackBar({ msg: `Interface ${form.ipAddress} added to node ${nodeLabel.value || id}.` })
    form.nodeId = ''
    form.ipAddress = ''
    form.isManaged = 'M'
    nodeLabel.value = ''
  } else {
    showSnackBar({ msg: 'Failed to add interface. Check that the IP address is valid and not already assigned.', error: true })
  }
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.add-interface-page { padding: 16px 20px; }

.add-interface-form {
  max-width: 520px;
  background: var($surface);
  border-radius: 6px;
  padding: 24px;

  &__title { margin: 0 0 16px; font-size: 18px; font-weight: 600; }

  &__warning { margin-bottom: 20px; }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;

    label { font-size: 13px; font-weight: 500; }

    .p-inputtext, .p-select { width: 100%; }
  }

  &__node-label {
    font-size: 12px;
    color: var($secondary-text-on-surface);
  }

  &__error {
    font-size: 12px;
    color: var(--feather-error);
  }

  &__actions { margin-top: 8px; }
}

.required { color: var(--feather-error); }
</style>
