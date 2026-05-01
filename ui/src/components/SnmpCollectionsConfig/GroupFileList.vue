<template>
  <div class="group-file-list">
    <div class="search-row">
      <span class="p-input-icon-left search-input">
        <i class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          placeholder="Search files"
          class="search-input-field"
        />
      </span>
    </div>

    <ul class="file-list" role="listbox">
      <li
        v-for="file in filteredFiles"
        :key="file.filename"
        :class="['file-item', { selected: file.filename === selectedFilename }]"
        role="option"
        :aria-selected="file.filename === selectedFilename"
        @click="emit('select', file.filename)"
      >
        <span class="group-name">{{ file.groupName ?? file.filename }}</span>
        <span class="file-name">{{ file.filename }}</span>
        <span v-if="file.filename === selectedFilename && isDirty" class="dirty-dot" title="Unsaved changes" />
      </li>

      <li v-if="filteredFiles.length === 0" class="empty">
        No files match "{{ searchQuery }}"
      </li>
    </ul>

    <div class="list-footer">
      <Button text label="+ New File" @click="emit('new-file')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { GroupFileMeta } from '@/services/snmpCollectionsService'

const props = defineProps<{
  files: GroupFileMeta[]
  selectedFilename: string | null
  isDirty: boolean
}>()

const emit = defineEmits<{
  (e: 'select', filename: string): void
  (e: 'new-file'): void
}>()

const searchQuery = ref('')

const filteredFiles = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.files
  return props.files.filter(f =>
    f.filename.toLowerCase().includes(q) ||
    (f.groupName?.toLowerCase().includes(q) ?? false)
  )
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@/styles/typography";

.group-file-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var($border-on-surface);
}

.search-row {
  padding: 0.5rem;
  border-bottom: 1px solid var($border-on-surface);
}

.search-input {
  width: 100%;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

.file-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  position: relative;
  border-bottom: 1px solid var($border-light-on-surface);

  &:hover {
    background: var($shade-4);
  }

  &.selected {
    background: var($shade-3);
  }
}

.group-name {
  @include body-large;
  font-weight: 600;
  color: var($primary-text-on-surface);
}

.file-name {
  @include caption;
  color: var($secondary-text-on-surface);
}

.dirty-dot {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 8px;
  height: 8px;
  border-radius: vars.$border-radius-round;
  background: var($warning);
}

.empty {
  padding: 1rem;
  color: var($secondary-text-on-surface);
  font-style: italic;
}

.list-footer {
  padding: 0.5rem;
  border-top: 1px solid var($border-on-surface);
}
</style>
