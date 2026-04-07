<template>
  <div class="group-file-list">
    <div class="search-row">
      <FeatherInput
        v-model="searchQuery"
        label="Search files"
        hide-label
        :background="true"
        class="search-input"
      >
        <template #pre><FeatherIcon :icon="SearchIcon" /></template>
      </FeatherInput>
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
      <FeatherButton text @click="emit('new-file')">+ New File</FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import SearchIcon from '@featherds/icon/action/Search'
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
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

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
  border-radius: 50%;
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
