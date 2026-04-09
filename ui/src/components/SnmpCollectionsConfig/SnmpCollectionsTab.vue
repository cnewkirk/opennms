<template>
  <div class="snmp-collections-tab">
    <div class="tab-header">
      <h3 class="tab-title">SNMP Collections</h3>
      <FeatherButton primary @click="onAdd">+ Add</FeatherButton>
    </div>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="loadError" class="load-error">{{ loadError }}</div>
    <template v-else>
      <table class="collections-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Storage Flag</th>
            <th>RRD Step</th>
            <th>Include Collections</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="col in collections" :key="col.name">
            <td>{{ col.name }}</td>
            <td>{{ col.snmpStorageFlag }}</td>
            <td>{{ col.rrdStep }}s</td>
            <td class="includes-cell">{{ col.includeCollections.join(', ') || '—' }}</td>
            <td class="actions-cell">
              <FeatherButton text @click="onEdit(col)">Edit</FeatherButton>
              <FeatherButton text class="delete-btn" @click="onDelete(col)">Delete</FeatherButton>
            </td>
          </tr>
          <tr v-if="collections.length === 0">
            <td colspan="5" class="empty-row">No SNMP collections configured.</td>
          </tr>
        </tbody>
      </table>

      <!-- Inline form (shown below table when adding/editing) -->
      <div v-if="editingEntry" class="form-area">
        <SnmpCollectionForm
          :entry="editingEntry"
          :all-entry-names="allNames"
          :group-files="groupFiles"
          @save="onFormSave"
          @cancel="editingEntry = null"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import useSnackbar from '@/composables/useSnackbar'
import SnmpCollectionForm from './SnmpCollectionForm.vue'
import {
  getSnmpCollections,
  saveSnmpCollections,
  listGroupFiles,
  makeDefaultSnmpCollection,
  type SnmpCollectionEntry,
  type GroupFileMeta
} from '@/services/snmpCollectionsService'

const { showSnackBar } = useSnackbar()

const collections = ref<SnmpCollectionEntry[]>([])
const groupFiles = ref<GroupFileMeta[]>([])
const editingEntry = ref<SnmpCollectionEntry | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

const allNames = computed(() => collections.value.map(c => c.name))

onMounted(async () => {
  await Promise.all([loadCollections(), loadGroupFiles()])
})

const loadCollections = async () => {
  loading.value = true
  loadError.value = null
  try {
    const cfg = await getSnmpCollections()
    collections.value = cfg.snmpCollections
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load SNMP collections'
  } finally {
    loading.value = false
  }
}

const loadGroupFiles = async () => {
  try {
    groupFiles.value = await listGroupFiles()
  } catch {
    // non-fatal — include collections selector will just be empty
  }
}

const onAdd = () => {
  editingEntry.value = makeDefaultSnmpCollection()
}

const onEdit = (col: SnmpCollectionEntry) => {
  editingEntry.value = { ...col, rras: [...col.rras], includeCollections: [...col.includeCollections] }
}

const onDelete = async (col: SnmpCollectionEntry) => {
  if (!confirm(`Delete collection "${col.name}"?`)) return
  const updated = collections.value.filter(c => c.name !== col.name)
  try {
    await saveSnmpCollections(updated)
    collections.value = updated
    showSnackBar({ msg: `Deleted collection "${col.name}"` })
  } catch (e: any) {
    showSnackBar({ msg: `Delete failed: ${e?.message ?? 'Unknown error'}` })
  }
}

const onFormSave = async (entry: SnmpCollectionEntry) => {
  const existing = collections.value.findIndex(c => c.name === entry.name)
  const updated = existing >= 0
    ? collections.value.map((c, i) => i === existing ? entry : c)
    : [...collections.value, entry]
  try {
    await saveSnmpCollections(updated)
    collections.value = updated
    editingEntry.value = null
    showSnackBar({ msg: `Saved collection "${entry.name}"` })
  } catch (e: any) {
    showSnackBar({ msg: `Save failed: ${e?.message ?? 'Unknown error'}` })
  }
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.snmp-collections-tab {
  padding: 1.5rem;
}

.tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.tab-title {
  @include headline4;
  margin: 0;
}

.collections-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;

  th, td {
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var($border-on-surface);
    @include body-small;
  }

  th {
    @include subtitle2;
    background: var($surface-dark);
    color: var($secondary-text-on-surface);
  }

  tr:hover td {
    background: var($shade-4);
  }
}

.includes-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-cell {
  white-space: nowrap;
}

.delete-btn {
  color: var($error) !important;
}

.empty-row {
  text-align: center;
  color: var($secondary-text-on-surface);
}

.loading, .load-error {
  padding: 1rem;
  color: var($secondary-text-on-surface);
}

.load-error {
  color: var($error);
}

.form-area {
  margin-top: 1rem;
}
</style>
