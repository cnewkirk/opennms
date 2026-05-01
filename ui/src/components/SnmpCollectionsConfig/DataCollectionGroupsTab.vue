<template>
  <div class="dcg-tab">
    <div v-if="loading" class="loading">Loading group files…</div>
    <div v-else-if="loadError" class="load-error">{{ loadError }}</div>
    <div v-else class="split-pane">
      <div class="pane-left">
        <GroupFileList
          :files="files"
          :selected-filename="selectedFilename"
          :is-dirty="isDirty"
          @select="onSelectFile"
          @new-file="onNewFile"
        />
      </div>
      <div class="pane-right">
        <GroupFileEditor
          :filename="selectedFilename"
          :xml="currentXml"
          @save="onSaveFile"
          @delete="onDeleteFile"
          @dirty-change="isDirty = $event"
        />
      </div>
    </div>

    <!-- New file name prompt -->
    <Dialog
      v-model:visible="showNewFileDialog"
      header="New group file"
      modal
    >
      <div class="p-float-label">
        <InputText id="new-filename" v-model="newFilename" />
        <label for="new-filename">Filename (e.g. mygroup.xml)</label>
      </div>
      <template #footer>
        <Button text label="Cancel" @click="showNewFileDialog = false" />
        <Button label="Create" :disabled="!newFilename.trim()" @click="onConfirmNewFile" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import useSnackbar from '@/composables/useSnackbar'
import GroupFileList from './GroupFileList.vue'
import GroupFileEditor from './GroupFileEditor.vue'
import {
  listGroupFiles,
  getGroupFileXml,
  saveGroupFileXml,
  deleteGroupFile,
  makeNewGroupXml,
  type GroupFileMeta
} from '@/services/snmpCollectionsService'

const { showSnackBar } = useSnackbar()

const files = ref<GroupFileMeta[]>([])
const selectedFilename = ref<string | null>(null)
const currentXml = ref('')
const isDirty = ref(false)
const loading = ref(true)
const loadError = ref<string | null>(null)
const showNewFileDialog = ref(false)
const newFilename = ref('')

onMounted(async () => {
  await loadFileList()
})

const loadFileList = async () => {
  loading.value = true
  loadError.value = null
  try {
    files.value = await listGroupFiles()
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load group files'
  } finally {
    loading.value = false
  }
}

const onSelectFile = async (filename: string) => {
  if (isDirty.value && selectedFilename.value) {
    if (!confirm(`Discard unsaved changes to ${selectedFilename.value}?`)) return
  }
  selectedFilename.value = filename
  isDirty.value = false
  try {
    currentXml.value = await getGroupFileXml(filename)
  } catch {
    currentXml.value = '<!-- File could not be loaded -->'
    showSnackBar({ msg: `Could not load ${filename}` })
  }
}

const onNewFile = () => {
  newFilename.value = ''
  showNewFileDialog.value = true
}

const onConfirmNewFile = () => {
  let name = newFilename.value.trim()
  if (!name.endsWith('.xml')) name = name + '.xml'
  showNewFileDialog.value = false
  // Pre-populate editor with empty template; no server call yet (save creates it)
  const entry: GroupFileMeta = { filename: name, groupName: null }
  if (!files.value.find(f => f.filename === name)) {
    files.value = [...files.value, entry].sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    )
  }
  selectedFilename.value = name
  currentXml.value = makeNewGroupXml()
  isDirty.value = true
}

const onSaveFile = async (filename: string, xml: string) => {
  try {
    await saveGroupFileXml(filename, xml)
    showSnackBar({ msg: `Saved ${filename}` })
    // Refresh the list (groupName may have changed if user edited the name attribute)
    await loadFileList()
    // Keep selected
    selectedFilename.value = filename
    currentXml.value = xml
    isDirty.value = false
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? 'Save failed'
    throw new Error(msg)  // Let GroupFileEditor show inline error
  }
}

const onDeleteFile = async (filename: string) => {
  try {
    await deleteGroupFile(filename)
    showSnackBar({ msg: `Deleted ${filename}` })
    files.value = files.value.filter(f => f.filename !== filename)
    selectedFilename.value = null
    currentXml.value = ''
    isDirty.value = false
  } catch (e: any) {
    showSnackBar({ msg: `Delete failed: ${e?.message ?? 'Unknown error'}` })
  }
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.dcg-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.split-pane {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pane-left {
  width: 280px;
  flex-shrink: 0;
  overflow: hidden;
}

.pane-right {
  flex: 1;
  overflow: hidden;
}

.loading, .load-error {
  padding: 2rem;
  color: var($secondary-text-on-surface);
}

.load-error {
  color: var($error);
}
</style>
