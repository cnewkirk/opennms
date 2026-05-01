<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="mib-tree">
    <!-- Pending folder -->
    <div class="tree-folder">
      <div class="folder-header" @click="pendingExpanded = !pendingExpanded">
        <span class="folder-icon">{{ pendingExpanded ? '&#9660;' : '&#9654;' }}</span>
        <span class="folder-name">pending</span>
        <span class="folder-count">({{ store.pendingMibs.length }})</span>
      </div>
      <div v-show="pendingExpanded" class="folder-children">
        <div
          v-for="file in store.pendingMibs"
          :key="'p-' + file"
          class="tree-item"
          @contextmenu.prevent="showContextMenu($event, 'pending', file)"
          @click="selectItem('pending', file)"
        >
          {{ file }}
        </div>
        <div v-if="store.pendingMibs.length === 0" class="tree-empty">No files</div>
      </div>
    </div>

    <!-- Compiled folder -->
    <div class="tree-folder">
      <div class="folder-header" @click="compiledExpanded = !compiledExpanded">
        <span class="folder-icon">{{ compiledExpanded ? '&#9660;' : '&#9654;' }}</span>
        <span class="folder-name">compiled</span>
        <span class="folder-count">({{ store.compiledMibs.length }})</span>
      </div>
      <div v-show="compiledExpanded" class="folder-children">
        <div
          v-for="file in store.compiledMibs"
          :key="'c-' + file"
          class="tree-item"
          @contextmenu.prevent="showContextMenu($event, 'compiled', file)"
          @click="selectItem('compiled', file)"
        >
          {{ file }}
        </div>
        <div v-if="store.compiledMibs.length === 0" class="tree-empty">No files</div>
      </div>
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click="contextMenu.visible = false"
      >
        <template v-if="contextMenu.folder === 'pending'">
          <div class="context-item" @click="$emit('edit', contextMenu.folder, contextMenu.filename)">Edit MIB</div>
          <div class="context-item" @click="$emit('compile', contextMenu.filename)">Compile MIB</div>
          <div class="context-item danger" @click="$emit('delete', contextMenu.folder, contextMenu.filename)">Delete MIB</div>
        </template>
        <template v-else>
          <div class="context-item" @click="$emit('view', contextMenu.filename)">View MIB</div>
          <div class="context-item" @click="$emit('generate-events', contextMenu.filename)">Generate Events</div>
          <div class="context-item" @click="$emit('generate-datacollection', contextMenu.filename)">Generate Data Collection</div>
          <div class="context-item danger" @click="$emit('delete', contextMenu.folder, contextMenu.filename)">Delete MIB</div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useMibCompilerStore } from '@/stores/mibCompilerStore'

defineEmits<{
  (e: 'edit', folder: string, filename: string): void
  (e: 'view', filename: string): void
  (e: 'compile', filename: string): void
  (e: 'delete', folder: string, filename: string): void
  (e: 'generate-events', filename: string): void
  (e: 'generate-datacollection', filename: string): void
}>()

const store = useMibCompilerStore()
const pendingExpanded = ref(true)
const compiledExpanded = ref(true)

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  folder: '',
  filename: ''
})

const showContextMenu = (event: MouseEvent, folder: string, filename: string) => {
  contextMenu.visible = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.folder = folder
  contextMenu.filename = filename
}

const selectItem = (folder: string, filename: string) => {
  // Close context menu on regular click
  contextMenu.visible = false
}

// Close context menu when clicking outside
onMounted(() => {
  document.addEventListener('click', () => {
    contextMenu.visible = false
  })
})

onUnmounted(() => {
  document.removeEventListener('click', () => {
    contextMenu.visible = false
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/mixins/typography";
@import "@/styles/tokens";

.mib-tree {
  flex: 1;
  overflow-y: auto;
}

.tree-folder {
  margin-bottom: 0.25rem;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  @include body-large();

  &:hover {
    background: var($shade-4);
  }
}

.folder-icon {
  font-size: 0.65rem;
  width: 1rem;
  text-align: center;
}

.folder-count {
  color: var($secondary-text-on-surface);
  font-weight: normal;
  margin-left: 0.25rem;
}

.folder-children {
  padding-left: 1.25rem;
}

.tree-item {
  @include body-small();
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  user-select: none;
  border-radius: vars.$border-radius-surface;

  &:hover {
    background: var($shade-4);
  }
}

.tree-empty {
  @include body-small();
  color: var($secondary-text-on-surface);
  font-style: italic;
  padding: 0.25rem 0.5rem;
}

.context-menu {
  position: fixed;
  z-index: 10000;
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  padding: 0.25rem 0;
}

.context-item {
  @include body-small();
  padding: 0.5rem 1rem;
  cursor: pointer;

  &:hover {
    background: var($shade-4);
  }

  &.danger {
    color: #d32f2f;
  }
}
</style>
