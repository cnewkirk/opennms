<template>
  <div class="snmp-collection-form">
    <h3 class="form-title">{{ isNew ? 'New SNMP Collection' : `Edit: ${localEntry.name}` }}</h3>

    <div class="form-grid">
      <div class="p-float-label">
        <InputText
          id="snmp-col-name"
          v-model="localEntry.name"
          :invalid="!!nameError"
          required
        />
        <label for="snmp-col-name">Name</label>
        <small v-if="nameError" class="p-error">{{ nameError }}</small>
      </div>

      <div class="p-float-label">
        <Select
          inputId="snmp-storage-flag"
          v-model="storageOption"
          :options="storageOptions"
          optionLabel="title"
        />
        <label for="snmp-storage-flag">SNMP Storage Flag</label>
      </div>

      <div class="p-float-label">
        <InputNumber
          inputId="snmp-rrd-step"
          v-model="localEntry.rrdStep"
          :min="1"
        />
        <label for="snmp-rrd-step">RRD Step (seconds)</label>
      </div>
    </div>

    <!-- RRAs -->
    <div class="rra-section">
      <label class="section-label">RRA Definitions</label>
      <div
        v-for="(rra, i) in localEntry.rras"
        :key="i"
        class="rra-row"
      >
        <InputText
          :model-value="rra"
          :placeholder="`RRA ${i + 1}`"
          @update:model-value="updateRra(i, $event as string)"
        />
        <Button text @click="removeRra(i)" :aria-label="`Remove RRA ${i + 1}`">
          <i class="pi pi-times" />
        </Button>
      </div>
      <Button text label="+ Add RRA" @click="addRra" />
    </div>

    <!-- Include Collections -->
    <div class="include-section">
      <label class="section-label">Include Collections</label>
      <div class="include-chips">
        <div
          v-for="groupName in localEntry.includeCollections"
          :key="groupName"
          class="chip"
        >
          {{ groupName }}
          <button class="chip-remove" @click="removeInclude(groupName)" :aria-label="`Remove ${groupName}`">×</button>
        </div>
      </div>
      <div class="p-float-label">
        <Select
          inputId="add-include-collection"
          v-model="selectedGroupToAdd"
          :options="availableGroups"
          optionLabel="title"
          @update:model-value="onAddInclude"
        />
        <label for="add-include-collection">Add include collection</label>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <Button text label="Cancel" @click="emit('cancel')" />
      <Button label="Save" :disabled="!!nameError" @click="onSave" />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'
import type { SnmpCollectionEntry, GroupFileMeta } from '@/services/snmpCollectionsService'

interface SelectOption {
  title: string
  value: string
}

const props = defineProps<{
  entry: SnmpCollectionEntry
  allEntryNames: string[]
  groupFiles: GroupFileMeta[]
}>()

const emit = defineEmits<{
  (e: 'save', entry: SnmpCollectionEntry): void
  (e: 'cancel'): void
}>()

const isNew = computed(() => !props.allEntryNames.includes(props.entry.name) || props.entry.name === '')

const localEntry = ref<SnmpCollectionEntry>({
  ...props.entry,
  rras: [...props.entry.rras],
  includeCollections: [...props.entry.includeCollections]
})
const selectedGroupToAdd = ref<SelectOption | undefined>(undefined)

const storageOptions: SelectOption[] = [
  { title: 'primary', value: 'primary' },
  { title: 'all', value: 'all' },
  { title: 'select', value: 'select' },
  { title: 'other', value: 'other' }
]

const storageOption = computed({
  get: (): SelectOption | undefined => storageOptions.find(o => o.value === localEntry.value.snmpStorageFlag) ?? storageOptions[2],
  set: (opt: SelectOption | undefined) => {
    if (opt) localEntry.value.snmpStorageFlag = opt.value
  }
})

const nameError = computed(() => {
  if (!localEntry.value.name.trim()) return 'Name is required'
  if (isNew.value && props.allEntryNames.includes(localEntry.value.name)) return 'Name already in use'
  return ''
})

const availableGroups = computed((): SelectOption[] => {
  const already = new Set(localEntry.value.includeCollections)
  return props.groupFiles
    .filter(f => f.groupName && !already.has(f.groupName))
    .map(f => ({ title: `${f.groupName} (${f.filename})`, value: f.groupName! }))
})

const updateRra = (i: number, val: string) => {
  const arr = [...localEntry.value.rras]
  arr[i] = val
  localEntry.value.rras = arr
}

const addRra = () => {
  localEntry.value.rras = [...localEntry.value.rras, '']
}

const removeRra = (i: number) => {
  localEntry.value.rras = localEntry.value.rras.filter((_, idx) => idx !== i)
}

const onAddInclude = (opt: SelectOption | undefined) => {
  if (!opt) return
  const val = opt.value
  if (!localEntry.value.includeCollections.includes(val)) {
    localEntry.value.includeCollections = [...localEntry.value.includeCollections, val]
  }
  nextTick(() => { selectedGroupToAdd.value = undefined })
}

const removeInclude = (groupName: string) => {
  localEntry.value.includeCollections = localEntry.value.includeCollections.filter(n => n !== groupName)
}

const onSave = () => {
  if (nameError.value) return
  emit('save', { ...localEntry.value })
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@featherds/styles/mixins/typography";

.snmp-collection-form {
  padding: 1.5rem;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  background: var($surface);
}

.form-title {
  @include headline4;
  margin: 0 0 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.section-label {
  @include subtitle1;
  display: block;
  margin-bottom: 0.5rem;
  color: var($secondary-text-on-surface);
}

.rra-section, .include-section {
  margin-bottom: 1.5rem;
}

.rra-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.include-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: vars.$border-radius-pill;
  background: var($shade-3);
  color: var($primary-text-on-surface);
  @include caption;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var($border-light-on-surface);
}
</style>
