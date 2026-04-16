<template>
  <Teleport to="body">
    <div v-if="visible" class="create-link-overlay" @click.self="cancel">
      <div class="create-link-modal">
        <div class="create-link-modal__header">
          <span class="create-link-modal__title">Create Link</span>
          <button type="button" class="create-link-modal__close" @click="cancel">&times;</button>
        </div>

        <div v-if="loadingInterfaces" class="create-link-modal__loading">
          <FeatherSpinner />
          <span>Loading interfaces…</span>
        </div>

        <form v-else class="create-link-modal__body" @submit.prevent="submit">
          <!-- Source node -->
          <div class="create-link-modal__node-section">
            <label class="create-link-modal__node-label">{{ sourceLabel }}</label>
            <select v-model="sourceInterfaceIdx" class="create-link-modal__select">
              <option :value="-1" disabled>Select interface…</option>
              <option v-for="(iface, i) in sourceInterfaces" :key="i" :value="i">
                {{ iface.label }}
              </option>
            </select>
          </div>

          <!-- Target node -->
          <div class="create-link-modal__node-section">
            <label class="create-link-modal__node-label">{{ targetLabel }}</label>
            <select v-model="targetInterfaceIdx" class="create-link-modal__select">
              <option :value="-1" disabled>Select interface…</option>
              <option v-for="(iface, i) in targetInterfaces" :key="i" :value="i">
                {{ iface.label }}
              </option>
            </select>
          </div>

          <!-- Link label -->
          <FeatherInput
            v-model="linkLabel"
            label="Link Label"
            class="create-link-modal__input"
          />

          <div class="create-link-modal__actions">
            <FeatherButton secondary @click="cancel">Cancel</FeatherButton>
            <FeatherButton
              primary
              type="submit"
              :disabled="!canSubmit"
            >Create</FeatherButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherSpinner } from '@featherds/progress'
import { getNodeIpInterfaces, getNodeSnmpInterfaces } from '@/services/nodeService'
import { TopologyVertex } from '@/types/topology'
import { IpInterface, SnmpInterface } from '@/types'

interface InterfaceOption {
  label: string
  componentLabel: string
}

const props = defineProps<{
  visible: boolean
  sourceVertex: TopologyVertex | null
  targetVertex: TopologyVertex | null
}>()

const emit = defineEmits<{
  cancel: []
  create: [nodeIdA: number, componentLabelA: string, nodeIdZ: number, componentLabelZ: string, linkLabel: string]
}>()

const sourceInterfaceIdx = ref(-1)
const targetInterfaceIdx = ref(-1)
const linkLabel = ref('')
const loadingInterfaces = ref(false)
const sourceInterfaces = ref<InterfaceOption[]>([])
const targetInterfaces = ref<InterfaceOption[]>([])

const sourceLabel = computed(() => props.sourceVertex?.label ?? 'Source')
const targetLabel = computed(() => props.targetVertex?.label ?? 'Target')

const canSubmit = computed(() =>
  sourceInterfaceIdx.value >= 0 &&
  targetInterfaceIdx.value >= 0 &&
  linkLabel.value.trim().length > 0
)

const buildInterfaceList = async (nodeId: string): Promise<InterfaceOption[]> => {
  const [ipResp, snmpResp] = await Promise.all([
    getNodeIpInterfaces(nodeId, { limit: 100, offset: 0 }),
    getNodeSnmpInterfaces(nodeId, { limit: 100, offset: 0 })
  ])

  const ipInterfaces: IpInterface[] = ipResp ? ipResp.ipInterface : []
  const snmpInterfaces: SnmpInterface[] = snmpResp ? snmpResp.snmpInterface : []

  // Build a map of ifIndex -> IP addresses for joining
  const ifIndexToIp = new Map<number, string>()
  for (const ip of ipInterfaces) {
    const idx = parseInt(ip.ifIndex, 10)
    if (!isNaN(idx) && idx > 0) ifIndexToIp.set(idx, ip.ipAddress)
  }

  const options: InterfaceOption[] = []
  const coveredIfIndices = new Set<number>()

  // SNMP interfaces first — these are the physical/logical ports
  for (const snmp of snmpInterfaces) {
    const name = snmp.ifName || snmp.ifDescr || `ifIndex ${snmp.ifIndex}`
    const ip = ifIndexToIp.get(snmp.ifIndex)
    const label = ip ? `${name} (${ip})` : name
    options.push({ label, componentLabel: name })
    coveredIfIndices.add(snmp.ifIndex)
  }

  // IP-only interfaces (no matching SNMP record)
  for (const ip of ipInterfaces) {
    const idx = parseInt(ip.ifIndex, 10)
    if (!isNaN(idx) && coveredIfIndices.has(idx)) continue
    const label = ip.hostName && ip.hostName !== ip.ipAddress
      ? `${ip.ipAddress} (${ip.hostName})`
      : ip.ipAddress
    options.push({ label, componentLabel: ip.ipAddress })
  }

  options.sort((a, b) => a.label.localeCompare(b.label))
  return options
}

watch(() => [props.visible, props.sourceVertex, props.targetVertex], async ([vis]) => {
  if (!vis || !props.sourceVertex?.id || !props.targetVertex?.id) return

  sourceInterfaceIdx.value = -1
  targetInterfaceIdx.value = -1
  linkLabel.value = ''
  loadingInterfaces.value = true

  const [srcList, tgtList] = await Promise.all([
    buildInterfaceList(props.sourceVertex.id),
    buildInterfaceList(props.targetVertex.id)
  ])

  sourceInterfaces.value = srcList
  targetInterfaces.value = tgtList
  loadingInterfaces.value = false
}, { immediate: true })

const cancel = () => emit('cancel')

const submit = () => {
  if (!canSubmit.value || !props.sourceVertex || !props.targetVertex) return

  const nodeIdA = parseInt(props.sourceVertex.id, 10)
  const nodeIdZ = parseInt(props.targetVertex.id, 10)
  if (isNaN(nodeIdA) || isNaN(nodeIdZ)) return

  emit('create',
    nodeIdA, sourceInterfaces.value[sourceInterfaceIdx.value].componentLabel,
    nodeIdZ, targetInterfaces.value[targetInterfaceIdx.value].componentLabel,
    linkLabel.value.trim()
  )
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.create-link-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.create-link-modal {
  background: var($surface);
  border-radius: vars.$border-radius-sm;
  width: 440px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var($border-on-surface);
  }

  &__title {
    font-weight: 600;
    font-size: 1.1rem;
  }

  &__close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.4rem;
    color: var($secondary-text-on-surface);
    padding: 2px 8px;
    border-radius: vars.$border-radius-surface;
    line-height: 1;

    &:hover {
      background: var($shade-2);
    }
  }

  &__body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 32px 20px;
    font-size: 0.9rem;
    color: var($secondary-text-on-surface);
  }

  &__node-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__node-label {
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
  }

  &__select {
    appearance: auto;
    padding: 8px 12px;
    border-radius: vars.$border-radius-surface;
    border: 1px solid var($border-on-surface);
    background: var($background);
    color: var($primary-text-on-surface);
    font-size: 0.9rem;
    cursor: pointer;

    &:focus {
      outline: 2px solid var($primary);
      outline-offset: -1px;
    }
  }

  &__input {
    width: 100%;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 8px;
  }
}
</style>
