<template>
  <div class="send-event-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="send-event-form">
      <div class="send-event-form__header">
        <span class="send-event-form__title">Send Event</span>
      </div>

      <div class="send-event-form__body">
        <div class="form-field form-field--full">
          <label for="se-uei">Event UEI <span class="required">*</span></label>
          <AutoComplete
            id="se-uei"
            v-model="form.uei"
            :suggestions="ueiSuggestions"
            @complete="searchUei"
            placeholder="uei.opennms.org/..."
            class="w-full"
          />
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label for="se-severity">Severity</label>
            <Select id="se-severity" v-model="form.severity" :options="severities" class="w-full" />
          </div>
          <div class="form-field">
            <label for="se-node">Node ID (optional)</label>
            <InputText id="se-node" v-model="form.nodeId" placeholder="1" class="w-full" />
          </div>
          <div class="form-field">
            <label for="se-interface">Interface (optional)</label>
            <InputText id="se-interface" v-model="form.iface" placeholder="10.0.0.1" class="w-full" />
          </div>
          <div class="form-field">
            <label for="se-service">Service (optional)</label>
            <InputText id="se-service" v-model="form.service" placeholder="ICMP" class="w-full" />
          </div>
        </div>

        <div class="form-field form-field--full">
          <label for="se-descr">Description (optional)</label>
          <Textarea id="se-descr" v-model="form.descr" rows="3" class="w-full" />
        </div>

        <div class="send-event-form__footer">
          <Button label="Send Event" :loading="sending" :disabled="!form.uei.trim()" @click="sendEvent" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
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
  { label: 'Send Event', to: '#', position: 'last' },
])

const COMMON_UEIS = [
  'uei.opennms.org/internal/test',
  'uei.opennms.org/nodes/nodeDown',
  'uei.opennms.org/nodes/nodeUp',
  'uei.opennms.org/nodes/interfaceDown',
  'uei.opennms.org/nodes/interfaceUp',
  'uei.opennms.org/nodes/serviceDown',
  'uei.opennms.org/nodes/serviceUp',
]

const severities = ['Normal', 'Warning', 'Minor', 'Major', 'Critical', 'Indeterminate']

const form = reactive({ uei: '', nodeId: '', iface: '', service: '', severity: 'Normal', descr: '' })
const sending = ref(false)
const ueiSuggestions = ref<string[]>([])

const searchUei = (e: { query: string }) => {
  ueiSuggestions.value = COMMON_UEIS.filter(u => u.includes(e.query))
}

const sendEvent = async () => {
  if (!form.uei.trim()) return
  sending.value = true
  try {
    const body: Record<string, unknown> = {
      uei: form.uei.trim(),
      source: 'Vue Admin UI',
      time: new Date().toISOString(),
      severity: form.severity,
    }
    if (form.nodeId) body.nodeId = parseInt(form.nodeId)
    if (form.iface) body.interface = form.iface
    if (form.service) body.service = form.service
    if (form.descr) body.descr = form.descr

    await rest.post('/events', body, { headers: { 'Content-Type': 'application/json' } })
    showSnackBar({ msg: 'Event sent successfully.' })
    form.uei = ''; form.nodeId = ''; form.iface = ''
    form.service = ''; form.severity = 'Normal'; form.descr = ''
  } catch {
    showSnackBar({ msg: 'Failed to send event.' })
  }
  sending.value = false
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.send-event-page { padding: 16px 20px; }

.send-event-form {
  max-width: 680px;
  background: var($surface);
  border-radius: 6px;

  &__header {
    padding: 14px 16px;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title { font-size: 16px; font-weight: 600; }

  &__body {
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__footer { padding-top: 4px; }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  label { font-size: 13px; font-weight: 500; }

  &--full { grid-column: 1 / -1; }
}

.w-full { width: 100%; }
.required { color: var(--feather-error); }
</style>
