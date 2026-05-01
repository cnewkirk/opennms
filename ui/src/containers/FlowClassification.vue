<template>
  <div class="flow-classification-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="classification-layout">
      <!-- Groups panel -->
      <div class="groups-panel">
        <div class="groups-panel__header">
          <span class="groups-panel__title">Groups</span>
          <Button icon="pi pi-plus" text size="small" aria-label="Add group" @click="startAddGroup" />
        </div>
        <div v-if="groupsLoading" class="groups-panel__status">Loading…</div>
        <div
          v-for="group in groups"
          :key="group.id"
          class="group-item"
          :class="{ 'group-item--active': selectedGroup?.id === group.id }"
          @click="selectGroup(group)"
        >
          <div class="group-item__top">
            <span class="group-item__name">{{ group.name }}</span>
            <span v-if="group.readOnly" class="group-item__readonly-badge">Read Only</span>
          </div>
          <div class="group-item__meta">
            <span class="group-item__count">{{ group.ruleCount.toLocaleString() }} rules</span>
            <ToggleSwitch
              v-if="!group.readOnly"
              :modelValue="group.enabled"
              size="small"
              @update:modelValue="toggleGroup(group, $event)"
              @click.stop
            />
          </div>
        </div>
      </div>

      <!-- Rules panel -->
      <div class="rules-panel">
        <div v-if="!selectedGroup" class="rules-panel__placeholder">
          <i class="pi pi-list" />
          <p>Select a group to view its rules.</p>
        </div>
        <template v-else>
          <div class="rules-panel__header">
            <span class="rules-panel__title">{{ selectedGroup.name }}</span>
            <div class="rules-panel__controls">
              <InputText
                v-model="ruleSearch"
                placeholder="Search rules…"
                size="small"
                @keydown.enter="loadRules(0)"
              />
              <Button
                v-if="!selectedGroup.readOnly"
                label="Add Rule"
                icon="pi pi-plus"
                size="small"
                @click="startAddRule"
              />
            </div>
          </div>

          <DataTable
            :value="rules"
            :loading="rulesLoading"
            :rows="pageSize"
            :total-records="totalRules"
            lazy
            paginator
            @page="onPage"
            stripedRows
            rowHover
            dataKey="id"
            class="rules-table"
          >
            <Column field="name" header="Name" />
            <Column field="protocols" header="Protocol" style="width: 100px">
              <template #body="{ data }">
                {{ data.protocols?.join(', ') || '—' }}
              </template>
            </Column>
            <Column field="dstPort" header="Dst Port" style="width: 90px">
              <template #body="{ data }">{{ data.dstPort || '—' }}</template>
            </Column>
            <Column field="dstAddress" header="Dst Address" style="width: 130px">
              <template #body="{ data }">{{ data.dstAddress || '—' }}</template>
            </Column>
            <Column field="srcPort" header="Src Port" style="width: 90px">
              <template #body="{ data }">{{ data.srcPort || '—' }}</template>
            </Column>
            <Column field="srcAddress" header="Src Address" style="width: 130px">
              <template #body="{ data }">{{ data.srcAddress || '—' }}</template>
            </Column>
            <Column field="omnidirectional" header="Omni" style="width: 65px">
              <template #body="{ data }">
                <i v-if="data.omnidirectional" class="pi pi-check" style="color: var(--feather-success)" />
              </template>
            </Column>
            <Column v-if="!selectedGroup.readOnly" header="" style="width: 80px">
              <template #body="{ data }">
                <div class="rules-table__actions">
                  <Button icon="pi pi-pencil" text size="small" @click="startEditRule(data)" aria-label="Edit" />
                  <Button icon="pi pi-trash" text severity="danger" size="small" @click="confirmDeleteRule(data)" aria-label="Delete" />
                </div>
              </template>
            </Column>
            <template #empty>
              <span v-if="!rulesLoading">No rules found{{ ruleSearch ? ' matching your search' : '' }}.</span>
            </template>
          </DataTable>
        </template>
      </div>
    </div>

    <!-- Group dialog -->
    <Dialog v-model:visible="groupDialogVisible" :header="editingGroupId ? 'Edit Group' : 'Add Group'" modal style="width: 400px">
      <div class="form-stack">
        <div class="form-field">
          <label for="g-name">Name</label>
          <InputText id="g-name" v-model="groupForm.name" class="w-full" @keydown.enter="saveGroup" />
        </div>
        <div class="form-field">
          <label for="g-desc">Description</label>
          <Textarea id="g-desc" v-model="groupForm.description" rows="2" class="w-full" />
        </div>
        <div class="form-field form-field--row">
          <label for="g-enabled">Enabled</label>
          <ToggleSwitch id="g-enabled" v-model="groupForm.enabled" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="groupDialogVisible = false" />
        <Button label="Save" :loading="saving" @click="saveGroup" />
      </template>
    </Dialog>

    <!-- Rule dialog -->
    <Dialog v-model:visible="ruleDialogVisible" :header="editingRuleId ? 'Edit Rule' : 'Add Rule'" modal style="width: 540px">
      <div class="form-stack">
        <div class="form-field">
          <label for="r-name">Name <span class="required">*</span></label>
          <InputText id="r-name" v-model="ruleForm.name" class="w-full" />
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label for="r-protocol">Protocol(s)</label>
            <MultiSelect
              id="r-protocol"
              v-model="ruleForm.protocols"
              :options="protocolOptions"
              placeholder="Any"
              class="w-full"
              display="chip"
            />
          </div>
          <div class="form-field">
            <label for="r-omni">Omnidirectional</label>
            <div class="form-field--row">
              <Checkbox id="r-omni" v-model="ruleForm.omnidirectional" binary />
            </div>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label for="r-dstport">Dst Port</label>
            <InputText id="r-dstport" v-model="ruleForm.dstPort" placeholder="80, 443" />
          </div>
          <div class="form-field">
            <label for="r-dstaddr">Dst Address</label>
            <InputText id="r-dstaddr" v-model="ruleForm.dstAddress" placeholder="10.0.0.0/8" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label for="r-srcport">Src Port</label>
            <InputText id="r-srcport" v-model="ruleForm.srcPort" placeholder="Any" />
          </div>
          <div class="form-field">
            <label for="r-srcaddr">Src Address</label>
            <InputText id="r-srcaddr" v-model="ruleForm.srcAddress" placeholder="Any" />
          </div>
        </div>
        <div class="form-field">
          <label for="r-exporter">Exporter Filter</label>
          <InputText id="r-exporter" v-model="ruleForm.exporterFilter" class="w-full" placeholder="Optional IPQL filter" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="ruleDialogVisible = false" />
        <Button label="Save" :loading="saving" :disabled="!ruleForm.name.trim()" @click="saveRule" />
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'
import ConfirmDialog from 'primevue/confirmdialog'
import Checkbox from 'primevue/checkbox'
import ToggleSwitch from 'primevue/toggleswitch'
import MultiSelect from 'primevue/multiselect'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import {
  getGroups, createGroup, updateGroup, deleteGroup,
  getRules, createRule, updateRule, deleteRule,
  getProtocols,
} from '@/services/classificationService'
import type { ClassificationGroup, ClassificationRule } from '@/types'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()
const confirm = useConfirm()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Flow Classification', to: '#', position: 'last' },
])

// Groups
const groups = ref<ClassificationGroup[]>([])
const groupsLoading = ref(false)
const selectedGroup = ref<ClassificationGroup | null>(null)

const loadGroups = async () => {
  groupsLoading.value = true
  try {
    const result = await getGroups()
    if (result !== false) groups.value = result
    else showSnackBar({ msg: 'Failed to load classification groups.' })
  } finally {
    groupsLoading.value = false
  }
}

const selectGroup = (group: ClassificationGroup) => {
  selectedGroup.value = group
  ruleSearch.value = ''
  loadRules(0)
}

const toggleGroup = async (group: ClassificationGroup, enabled: boolean) => {
  const ok = await updateGroup(group.id, { enabled })
  if (ok) {
    group.enabled = enabled
  } else {
    showSnackBar({ msg: 'Failed to update group.' })
  }
}

// Rules
const rules = ref<ClassificationRule[]>([])
const rulesLoading = ref(false)
const totalRules = ref(0)
const pageSize = 25
const ruleSearch = ref('')
let currentOffset = 0

const loadRules = async (offset: number) => {
  if (!selectedGroup.value) return
  currentOffset = offset
  rulesLoading.value = true
  try {
    const result = await getRules({
      groupId: selectedGroup.value.id,
      limit: pageSize,
      offset,
      query: ruleSearch.value || undefined,
    })
    rules.value = result.rules
    totalRules.value = result.total
  } finally {
    rulesLoading.value = false
  }
}

const onPage = (e: { first: number }) => loadRules(e.first)

// Protocols for multi-select
const protocolOptions = ref<string[]>([])
const loadProtocols = async () => {
  const result = await getProtocols()
  if (result !== false) {
    protocolOptions.value = result.map(p => p.keyword.toUpperCase())
  }
}

// Group dialog
const groupDialogVisible = ref(false)
const editingGroupId = ref<number | null>(null)
const saving = ref(false)
const groupForm = ref({ name: '', description: '', enabled: true })

const startAddGroup = () => {
  editingGroupId.value = null
  groupForm.value = { name: '', description: '', enabled: true }
  groupDialogVisible.value = true
}

const saveGroup = async () => {
  if (!groupForm.value.name.trim()) return
  saving.value = true
  const ok = editingGroupId.value
    ? await updateGroup(editingGroupId.value, groupForm.value)
    : await createGroup(groupForm.value)
  saving.value = false
  if (ok) {
    groupDialogVisible.value = false
    showSnackBar({ msg: editingGroupId.value ? 'Group updated.' : 'Group created.' })
    loadGroups()
  } else {
    showSnackBar({ msg: 'Failed to save group.' })
  }
}

// Rule dialog
const ruleDialogVisible = ref(false)
const editingRuleId = ref<number | null>(null)
const ruleForm = ref({
  name: '',
  protocols: [] as string[],
  dstPort: '',
  dstAddress: '',
  srcPort: '',
  srcAddress: '',
  exporterFilter: '',
  omnidirectional: false,
})

const startAddRule = () => {
  editingRuleId.value = null
  ruleForm.value = {
    name: '', protocols: [],
    dstPort: '', dstAddress: '',
    srcPort: '', srcAddress: '',
    exporterFilter: '', omnidirectional: false,
  }
  ruleDialogVisible.value = true
}

const startEditRule = (rule: ClassificationRule) => {
  editingRuleId.value = rule.id
  ruleForm.value = {
    name: rule.name,
    protocols: rule.protocols?.map(p => p.toUpperCase()) ?? [],
    dstPort: rule.dstPort ?? '',
    dstAddress: rule.dstAddress ?? '',
    srcPort: rule.srcPort ?? '',
    srcAddress: rule.srcAddress ?? '',
    exporterFilter: rule.exporterFilter ?? '',
    omnidirectional: rule.omnidirectional,
  }
  ruleDialogVisible.value = true
}

const saveRule = async () => {
  if (!ruleForm.value.name.trim() || !selectedGroup.value) return
  saving.value = true
  const payload = {
    name: ruleForm.value.name.trim(),
    protocols: ruleForm.value.protocols.map(p => p.toLowerCase()),
    dstPort: ruleForm.value.dstPort || null,
    dstAddress: ruleForm.value.dstAddress || null,
    srcPort: ruleForm.value.srcPort || null,
    srcAddress: ruleForm.value.srcAddress || null,
    exporterFilter: ruleForm.value.exporterFilter || null,
    omnidirectional: ruleForm.value.omnidirectional,
    group: selectedGroup.value as ClassificationGroup,
  }
  const ok = editingRuleId.value
    ? await updateRule(editingRuleId.value, payload)
    : await createRule(payload)
  saving.value = false
  if (ok) {
    ruleDialogVisible.value = false
    showSnackBar({ msg: editingRuleId.value ? 'Rule updated.' : 'Rule created.' })
    loadRules(currentOffset)
  } else {
    showSnackBar({ msg: 'Failed to save rule.' })
  }
}

const confirmDeleteRule = (rule: ClassificationRule) => {
  confirm.require({
    message: `Delete rule "${rule.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    accept: async () => {
      const ok = await deleteRule(rule.id)
      if (ok) { showSnackBar({ msg: 'Rule deleted.' }); loadRules(currentOffset) }
      else showSnackBar({ msg: 'Failed to delete rule.' })
    },
  })
}

onMounted(() => {
  loadGroups()
  loadProtocols()
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.flow-classification-page {
  padding: 16px 20px;
}

.classification-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  align-items: start;
}

.groups-panel {
  background: var($surface);
  border-radius: 6px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
  }

  &__status {
    padding: 16px;
    color: var($secondary-text-on-surface);
    font-size: 13px;
  }
}

.group-item {
  padding: 10px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var($border-light-on-surface);
  transition: background 0.1s;

  &:last-child { border-bottom: none; }

  &:hover { background: var($background); }

  &--active {
    border-left-color: var($clickable-normal);
    background: var($background);
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__name {
    font-size: 14px;
    font-weight: 500;
  }

  &__readonly-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    background: var($border-light-on-surface);
    border-radius: 3px;
    padding: 1px 5px;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__count {
    font-size: 12px;
    color: var($secondary-text-on-surface);
  }
}

.rules-panel {
  background: var($surface);
  border-radius: 6px;
  min-height: 300px;

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 8px;
    color: var($secondary-text-on-surface);

    .pi { font-size: 32px; }
    p { margin: 0; font-size: 14px; }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
  }

  &__controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.rules-table {
  &__actions {
    display: flex;
    gap: 2px;
  }
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 13px;
    font-weight: 500;
  }

  &--row {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
}

.w-full { width: 100%; }

.required { color: var(--feather-error); }
</style>
