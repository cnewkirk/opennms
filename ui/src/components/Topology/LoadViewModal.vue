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
  <div v-if="visible" class="lv-modal-backdrop" @click.self="emit('close')">
    <div class="lv-modal">
      <div class="lv-modal__header">
        <span>Load View</span>
        <button class="lv-modal__close" @click="emit('close')">✕</button>
      </div>

      <div v-if="viewStore.viewsLoading" class="lv-modal__loading">Loading…</div>
      <div v-else-if="viewStore.viewsError" class="lv-modal__error">{{ viewStore.viewsError }}</div>
      <div v-else-if="viewStore.serverViews.length === 0" class="lv-modal__empty">No saved views found.</div>
      <div v-else class="lv-modal__body">
        <template v-for="scope in ['global','shared','private']" :key="scope">
          <div
            v-if="viewsByScope(scope).length > 0"
            class="lv-modal__group"
          >
            <div class="lv-modal__group-label">{{ scopeLabel(scope) }}</div>
            <div
              v-for="view in viewsByScope(scope)"
              :key="view.id"
              class="lv-modal__row"
            >
              <div class="lv-modal__row-info">
                <span class="lv-modal__row-name">{{ view.name }}</span>
                <span v-if="view.description" class="lv-modal__row-desc">{{ view.description }}</span>
                <span class="lv-modal__row-owner">{{ view.owner }}</span>
              </div>
              <div class="lv-modal__row-actions">
                <button class="lv-modal__btn lv-modal__btn--primary" @click="emit('load', view)">Load</button>
                <button
                  v-if="canDelete(view)"
                  class="lv-modal__btn lv-modal__btn--danger"
                  @click="onDelete(view.id)"
                >Delete</button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { useAuthStore } from '@/stores/authStore'
import type { TopologyView } from '@/types/topology'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'load', view: TopologyView): void
}>()

const viewStore = useTopologyViewStore()
const authStore = useAuthStore()

const viewsByScope = (scope: string) =>
  viewStore.serverViews.filter(v => v.scope === scope)

const scopeLabel = (scope: string) =>
  ({ global: 'Global', shared: 'Shared', private: 'Private' } as Record<string, string>)[scope] ?? scope

const canDelete = (view: TopologyView) =>
  view.owner === authStore.whoAmI?.id || authStore.whoAmI?.roles?.includes('ROLE_ADMIN')

const onDelete = async (id: string) => {
  if (!confirm('Delete this view?')) return
  await viewStore.deleteServerView(id)
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.lv-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lv-modal {
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  width: 520px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var($border-on-surface);
    font-weight: 600;
    font-size: 0.95rem;
    color: var($primary-text-on-surface);
  }

  &__close {
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    font-size: 1rem;
    padding: 2px 6px;
    &:hover { color: var($primary-text-on-surface); }
  }

  &__loading, &__error, &__empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 0.85rem;
    color: var($secondary-text-on-surface);
  }

  &__error { color: var($error); }

  &__body {
    overflow-y: auto;
    padding: 8px 0;
  }

  &__group-label {
    padding: 8px 16px 4px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    gap: 12px;
    &:hover { background: var($background); }
  }

  &__row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__row-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var($primary-text-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__row-desc {
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
  }

  &__row-owner {
    font-size: 0.7rem;
    color: var($secondary-text-on-surface);
    opacity: 0.7;
  }

  &__row-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  &__btn {
    font-size: 0.78rem;
    padding: 4px 12px;
    border-radius: vars.$border-radius-xs;
    border: 1px solid transparent;
    cursor: pointer;
    font-weight: 500;

    &--primary {
      background: var($primary);
      color: var($primary-text-on-color);
      &:hover { opacity: 0.9; }
    }

    &--danger {
      background: none;
      border-color: var($error);
      color: var($error);
      &:hover { background: var($error); color: var($primary-text-on-color); }
    }
  }
}
</style>
