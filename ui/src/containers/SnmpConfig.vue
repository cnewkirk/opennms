<template>
  <div class="snmp-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="snmp-page__header feather-row">
      <div class="feather-col-12">
        <h2 class="headline4">Configure SNMP by IP</h2>
      </div>
    </div>

    <!-- Top row: Lookup + Descriptions -->
    <div class="feather-row snmp-top-row">
      <div class="feather-col-6">
        <div class="snmp-card">
          <div class="snmp-card__header">SNMP Config Lookup</div>
          <div class="snmp-card__body">
            <div class="snmp-form-row">
              <label class="snmp-label">IP Address</label>
              <input v-model="lookup.ip" type="text" class="snmp-input" placeholder="e.g. 192.168.1.1" />
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Location</label>
              <select v-model="lookup.location" class="snmp-select">
                <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
              </select>
            </div>
            <div class="snmp-form-row snmp-form-row--actions">
              <Button severity="secondary" :disabled="!lookup.ip || lookingUp" @click="doLookup" :label="lookingUp ? 'Looking up…' : 'Look up'" />
            </div>
            <div v-if="lookupError" class="snmp-message snmp-message--error">
              Could not look up SNMP config for {{ lookup.ip }}.
            </div>
            <div v-else-if="lookupSuccess" class="snmp-message snmp-message--success">
              SNMP config loaded into form below.
            </div>
          </div>
        </div>
      </div>

      <div class="feather-col-6">
        <div class="snmp-card">
          <div class="snmp-card__header">Descriptions</div>
          <div class="snmp-card__body snmp-descriptions">
            <p><strong>SNMP Config Lookup:</strong> Enter an IP address and location to look up the current SNMP configuration. The result will be loaded into the update form below.</p>
            <p><strong>Updating SNMP Configuration:</strong> Enter a first IP address (and optional last IP address for a range) along with community strings or SNMPv3 parameters, then click Save Config.</p>
            <p>OpenNMS will optimize this list — enter the most generic config first (largest range), and specific IP addresses last. If a range overlaps a specific address, the range's community string takes precedence.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Update form -->
    <div class="feather-row">
      <div class="feather-col-6">
        <div class="snmp-card">
          <div class="snmp-card__header">Updating SNMP Configuration</div>
          <div class="snmp-card__body">
            <div class="snmp-section-title">General Parameters</div>

            <div class="snmp-form-row">
              <label class="snmp-label">Version</label>
              <select v-model="form.version" class="snmp-select" @change="onVersionChange">
                <option value="v1">v1</option>
                <option value="v2c">v2c</option>
                <option value="v3">v3</option>
              </select>
              <span class="snmp-hint">Default: v2c</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">First IP Address</label>
              <input v-model="form.firstIp" type="text" class="snmp-input" placeholder="Required" />
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Last IP Address</label>
              <input v-model="form.lastIp" type="text" class="snmp-input" placeholder="Optional — leave blank for single IP" />
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Location</label>
              <select v-model="form.location" class="snmp-select">
                <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
              </select>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Timeout (ms)</label>
              <input v-model.number="form.timeout" type="number" class="snmp-input" placeholder="Use default" />
              <span class="snmp-hint">Default: 1800 ms</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Retries</label>
              <input v-model.number="form.retries" type="number" class="snmp-input" placeholder="Use default" />
              <span class="snmp-hint">Default: 1</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Port</label>
              <input v-model.number="form.port" type="number" class="snmp-input" placeholder="Use default" />
              <span class="snmp-hint">Default: 161</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Proxy Host</label>
              <input v-model="form.proxyHost" type="text" class="snmp-input" />
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Max Request Size</label>
              <input v-model.number="form.maxRequestSize" type="number" class="snmp-input" placeholder="Use default" />
              <span class="snmp-hint">Default: 65535 (min 484)</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Max Vars Per PDU</label>
              <input v-model.number="form.maxVarsPerPdu" type="number" class="snmp-input" placeholder="Use default" />
              <span class="snmp-hint">Default: 10</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">Max Repetitions</label>
              <input v-model.number="form.maxRepetitions" type="number" class="snmp-input" placeholder="Use default" />
              <span class="snmp-hint">Default: 2</span>
            </div>

            <div class="snmp-form-row">
              <label class="snmp-label">TTL (ms)</label>
              <input v-model.number="form.ttl" type="number" class="snmp-input" placeholder="Use default" />
            </div>
          </div>
        </div>
      </div>

      <!-- v1/v2c params -->
      <div v-if="isV1V2c" class="feather-col-6">
        <div class="snmp-card">
          <div class="snmp-card__header">v1/v2c Specific Parameters</div>
          <div class="snmp-card__body">
            <div class="snmp-form-row">
              <label class="snmp-label">Read Community</label>
              <input v-model="form.readCommunity" type="text" class="snmp-input" />
              <span class="snmp-hint">Default: public</span>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Write Community</label>
              <input v-model="form.writeCommunity" type="text" class="snmp-input" />
              <span class="snmp-hint">Default: private</span>
            </div>
          </div>
        </div>
      </div>

      <!-- v3 params -->
      <div v-if="isV3" class="feather-col-6">
        <div class="snmp-card">
          <div class="snmp-card__header">v3 Specific Parameters</div>
          <div class="snmp-card__body">
            <div class="snmp-form-row">
              <label class="snmp-label">Security Name</label>
              <input v-model="form.securityName" type="text" class="snmp-input" />
              <span class="snmp-hint">Default: opennmsUser</span>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Security Level</label>
              <select v-model="form.securityLevel" class="snmp-select">
                <option value="">— use default —</option>
                <option value="1">noAuthNoPriv</option>
                <option value="2">authNoPriv</option>
                <option value="3">authPriv</option>
              </select>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Auth Passphrase</label>
              <input v-model="form.authPassPhrase" type="text" class="snmp-input" />
              <span class="snmp-hint">Default: 0p3nNMSv3</span>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Auth Protocol</label>
              <select v-model="form.authProtocol" class="snmp-select">
                <option value="">— none —</option>
                <option>MD5</option>
                <option>SHA</option>
                <option>SHA-224</option>
                <option>SHA-256</option>
                <option>SHA-512</option>
              </select>
              <span class="snmp-hint">Default: MD5</span>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Privacy Passphrase</label>
              <input v-model="form.privPassPhrase" type="text" class="snmp-input" />
              <span class="snmp-hint">Default: 0p3nNMSv3</span>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Privacy Protocol</label>
              <select v-model="form.privProtocol" class="snmp-select">
                <option value="">— none —</option>
                <option>DES</option>
                <option>AES</option>
                <option>AES192</option>
                <option>AES256</option>
              </select>
              <span class="snmp-hint">Default: DES</span>
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Engine ID</label>
              <input v-model="form.engineId" type="text" class="snmp-input" />
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Context Engine ID</label>
              <input v-model="form.contextEngineId" type="text" class="snmp-input" />
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Context Name</label>
              <input v-model="form.contextName" type="text" class="snmp-input" />
            </div>
            <div class="snmp-form-row">
              <label class="snmp-label">Enterprise ID</label>
              <input v-model="form.enterpriseId" type="text" class="snmp-input" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save button row -->
    <div class="snmp-page__footer feather-row">
      <Button :disabled="!form.firstIp || saving" @click="doSave" :label="saving ? 'Saving…' : 'Save Config'" />
      <Button text label="Cancel" @click="resetForm" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getSnmpConfig, saveSnmpConfig } from '@/services/snmpConfigService'
import { getLocations } from '@/services/discoveryConfigService'
import { SnmpInfo, BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Configure SNMP by IP', to: '#', position: 'last' }
])

const locations = ref<string[]>(['Default'])
const lookingUp = ref(false)
const lookupError = ref(false)
const lookupSuccess = ref(false)
const saving = ref(false)

const lookup = reactive({ ip: '', location: 'Default' })

const emptyForm = () => ({
  version: 'v2c',
  firstIp: '',
  lastIp: '',
  location: 'Default',
  timeout: null as number | null,
  retries: null as number | null,
  port: null as number | null,
  proxyHost: '',
  maxRequestSize: null as number | null,
  maxVarsPerPdu: null as number | null,
  maxRepetitions: null as number | null,
  ttl: null as number | null,
  readCommunity: '',
  writeCommunity: '',
  securityName: '',
  securityLevel: '',
  authPassPhrase: '',
  authProtocol: '',
  privPassPhrase: '',
  privProtocol: '',
  engineId: '',
  contextEngineId: '',
  contextName: '',
  enterpriseId: '',
})

const form = reactive(emptyForm())

const isV1V2c = computed(() => form.version === 'v1' || form.version === 'v2c')
const isV3 = computed(() => form.version === 'v3')

const onVersionChange = () => {
  // version switch handled reactively via isV1V2c / isV3
}

const populateForm = (ip: string, info: SnmpInfo) => {
  form.firstIp = ip
  form.lastIp = ''
  form.version = info.version ?? 'v2c'
  form.location = info.location ?? 'Default'
  form.timeout = info.timeout
  form.retries = info.retries
  form.port = info.port
  form.proxyHost = info.proxyHost ?? ''
  form.maxRequestSize = info.maxRequestSize
  form.maxVarsPerPdu = info.maxVarsPerPdu
  form.maxRepetitions = info.maxRepetitions
  form.ttl = info.ttl
  form.readCommunity = info.readCommunity ?? ''
  form.writeCommunity = info.writeCommunity ?? ''
  form.securityName = info.securityName ?? ''
  form.securityLevel = info.securityLevel ?? ''
  form.authPassPhrase = info.authPassPhrase ?? ''
  form.authProtocol = info.authProtocol ?? ''
  form.privPassPhrase = info.privPassPhrase ?? ''
  form.privProtocol = info.privProtocol ?? ''
  form.engineId = info.engineId ?? ''
  form.contextEngineId = info.contextEngineId ?? ''
  form.contextName = info.contextName ?? ''
  form.enterpriseId = info.enterpriseId ?? ''
}

const doLookup = async () => {
  if (!lookup.ip) return
  lookingUp.value = true
  lookupError.value = false
  lookupSuccess.value = false
  const result = await getSnmpConfig(lookup.ip, lookup.location)
  lookingUp.value = false
  if (!result) {
    lookupError.value = true
    return
  }
  populateForm(lookup.ip, result)
  if (lookup.location && lookup.location !== 'Default') {
    form.location = lookup.location
  }
  lookupSuccess.value = true
}

const buildSnmpInfo = (): SnmpInfo => {
  const nullIfEmpty = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
  const info: SnmpInfo = {
    version: form.version || null,
    location: form.location !== 'Default' ? form.location : null,
    port: form.port || null,
    retries: form.retries != null ? form.retries : null,
    timeout: form.timeout != null ? form.timeout : null,
    proxyHost: nullIfEmpty(form.proxyHost),
    maxRequestSize: form.maxRequestSize || null,
    maxVarsPerPdu: form.maxVarsPerPdu || null,
    maxRepetitions: form.maxRepetitions || null,
    ttl: form.ttl || null,
    readCommunity: null,
    writeCommunity: null,
    securityName: null,
    securityLevel: null,
    authPassPhrase: null,
    authProtocol: null,
    privPassPhrase: null,
    privProtocol: null,
    engineId: null,
    contextEngineId: null,
    contextName: null,
    enterpriseId: null,
  }
  if (isV1V2c.value) {
    info.readCommunity = nullIfEmpty(form.readCommunity)
    info.writeCommunity = nullIfEmpty(form.writeCommunity)
  } else {
    info.securityName = nullIfEmpty(form.securityName)
    info.securityLevel = nullIfEmpty(form.securityLevel)
    info.authPassPhrase = nullIfEmpty(form.authPassPhrase)
    info.authProtocol = nullIfEmpty(form.authProtocol)
    info.privPassPhrase = nullIfEmpty(form.privPassPhrase)
    info.privProtocol = nullIfEmpty(form.privProtocol)
    info.engineId = nullIfEmpty(form.engineId)
    info.contextEngineId = nullIfEmpty(form.contextEngineId)
    info.contextName = nullIfEmpty(form.contextName)
    info.enterpriseId = nullIfEmpty(form.enterpriseId)
  }
  return info
}

const doSave = async () => {
  if (!form.firstIp) return
  saving.value = true
  const ok = await saveSnmpConfig(form.firstIp, form.lastIp, buildSnmpInfo())
  saving.value = false
  if (ok) {
    showSnackBar({ msg: 'SNMP configuration saved.' })
  } else {
    showSnackBar({ msg: 'Failed to save SNMP configuration.', error: true })
  }
}

const resetForm = () => {
  Object.assign(form, emptyForm())
  lookupError.value = false
  lookupSuccess.value = false
}

onMounted(async () => {
  locations.value = await getLocations()
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@featherds/styles/mixins/typography";

.snmp-page {
  padding: 0 20px 40px;
  background: var($surface);
  min-height: 100%;

  &__header {
    padding: 16px 0 8px;
  }

  &__footer {
    margin-top: 8px;
    padding: 16px 0;
    display: flex;
    gap: 8px;
  }
}

.snmp-top-row {
  margin-bottom: 0;
}

.snmp-card {
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

.snmp-descriptions {
  p {
    margin-bottom: 12px;
    color: var($secondary-text-on-surface);

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.snmp-section-title {
  @include subtitle2();
  color: var($secondary-text-on-surface);
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var($border-on-surface);
}

.snmp-form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  &--actions {
    justify-content: flex-start;
    margin-top: 4px;
  }
}

.snmp-label {
  flex: 0 0 180px;
  color: var($secondary-text-on-surface);
  font-size: 14px;
}

.snmp-input,
.snmp-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  background: var($surface);
  color: var($primary-text-on-surface);
  min-width: 0;

  &:focus {
    outline: 2px solid var($primary);
    outline-offset: 1px;
  }
}

.snmp-hint {
  flex: 0 0 auto;
  font-size: 12px;
  color: var($secondary-text-on-surface);
  white-space: nowrap;
}

.snmp-message {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;

  &--success {
    background: rgba(var(--feather-success), 0.08);
    color: var($success);
    border: 1px solid var($success);
  }

  &--error {
    background: rgba(var(--feather-error), 0.08);
    color: var($error);
    border: 1px solid var($error);
  }
}
</style>
