<template>
  <div class="group-file-editor">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <h3 class="file-title">{{ filename ?? 'No file selected' }}</h3>
      <div class="toolbar-actions">
        <FeatherButton
          primary
          :disabled="!filename || !isDirty || isSaving"
          @click="onSave"
        >
          {{ isSaving ? 'Saving…' : 'Save' }}
        </FeatherButton>
        <FeatherButton
          v-if="filename"
          text
          class="delete-btn"
          @click="showDeleteConfirm = true"
        >
          Delete
        </FeatherButton>
      </div>
    </div>

    <!-- Inline error banner -->
    <div v-if="saveError" class="error-banner" role="alert">
      <strong>Save failed:</strong> {{ saveError }}
    </div>

    <!-- Ace editor -->
    <div class="editor-area">
      <VAceEditor
        v-if="filename"
        v-model:value="localXml"
        lang="xml"
        :theme="aceTheme"
        :print-margin="false"
        :options="{ useWorker: true, fontSize: 14 }"
        @init="onEditorInit"
        style="height: 100%; width: 100%"
      />
      <div v-else class="placeholder">
        Select a file from the list or create a new one.
      </div>
    </div>

    <!-- Delete confirm dialog -->
    <FeatherDialog
      v-model="showDeleteConfirm"
      :labels="{ title: 'Delete group file?' }"
    >
      <p>Delete <strong>{{ filename }}</strong>?</p>
      <p>This will also remove all <code>include-collection</code> references to this group from the root config.</p>
      <template #footer>
        <FeatherButton text @click="showDeleteConfirm = false">Cancel</FeatherButton>
        <FeatherButton primary @click="onDelete">Delete</FeatherButton>
      </template>
    </FeatherDialog>
  </div>
</template>

<script setup lang="ts">
import { VAceEditor } from 'vue3-ace-editor'
import 'ace-builds/src-noconflict/mode-xml'
import 'ace-builds/src-noconflict/theme-xcode'
import 'ace-builds/src-noconflict/theme-dracula'
import 'ace-builds/src-noconflict/ext-searchbox'
import ace from 'ace-builds'
import workerXmlUrl from 'ace-builds/src-noconflict/worker-xml?url'
import { FeatherButton } from '@featherds/button'
import { FeatherDialog } from '@featherds/dialog'
import { useAppStore } from '@/stores/appStore'

ace.config.setModuleUrl('ace/mode/xml_worker', workerXmlUrl)

const props = defineProps<{
  filename: string | null
  xml: string
}>()

const emit = defineEmits<{
  (e: 'save', filename: string, xml: string): void
  (e: 'delete', filename: string): void
  (e: 'dirty-change', dirty: boolean): void
}>()

const appStore = useAppStore()
const localXml = ref(props.xml)
const isSaving = ref(false)
const saveError = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const isDirty = computed(() => localXml.value !== props.xml)
const aceTheme = computed(() => appStore.theme === 'open-dark' ? 'dracula' : 'xcode')

// Sync external xml changes (file switch) into local state
watch(() => props.xml, (newXml) => {
  localXml.value = newXml
  saveError.value = null
})

// Notify parent of dirty state
watch(isDirty, (dirty) => emit('dirty-change', dirty))

const onEditorInit = (editor: any) => {
  ace.config.loadModule('ace/ext/searchbox', (m: any) => m.Search(editor))
  editor.searchBox?.hide()
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => { if (isDirty.value && props.filename) onSave() }
  })
}

const onSave = async () => {
  if (!props.filename) return
  isSaving.value = true
  saveError.value = null
  try {
    emit('save', props.filename, localXml.value)
  } catch (e: any) {
    saveError.value = e?.response?.data?.error ?? e?.message ?? 'Unknown error'
  } finally {
    isSaving.value = false
  }
}

const onDelete = () => {
  showDeleteConfirm.value = false
  if (props.filename) emit('delete', props.filename)
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.group-file-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var($border-on-surface);
  gap: 1rem;
}

.file-title {
  @include subtitle1;
  margin: 0;
  color: var($primary-text-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.delete-btn {
  color: var($error) !important;
}

.error-banner {
  padding: 0.5rem 1rem;
  background: var($shade-4);
  color: var($error);
  @include body-small;
  border-bottom: 1px solid var($error);
}

.editor-area {
  flex: 1;
  overflow: hidden;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var($secondary-text-on-surface);
  @include body-large;
}
</style>
