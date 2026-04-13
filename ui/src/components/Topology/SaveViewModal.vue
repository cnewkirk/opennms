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
  <div v-if="visible" class="sv-modal-backdrop" @click.self="emit('cancel')">
    <div class="sv-modal">
      <div class="sv-modal__header">
        <span>Save as New View</span>
        <button class="sv-modal__close" @click="emit('cancel')">✕</button>
      </div>
      <div class="sv-modal__body">
        <label class="sv-modal__label">
          Name
          <input v-model="name" class="sv-modal__input" placeholder="My View" />
        </label>
        <label class="sv-modal__label">
          Description (optional)
          <input v-model="description" class="sv-modal__input" placeholder="" />
        </label>
        <label class="sv-modal__label">
          Scope
          <select v-model="scope" class="sv-modal__select">
            <option value="private">Private (only me)</option>
            <option value="shared">Shared (all users)</option>
            <option v-if="isAdmin" value="global">Global (admin-curated)</option>
          </select>
        </label>
      </div>
      <div class="sv-modal__footer">
        <button class="sv-modal__btn sv-modal__btn--secondary" @click="emit('cancel')">Cancel</button>
        <button class="sv-modal__btn sv-modal__btn--primary" :disabled="!name.trim()" @click="onSave">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'save', name: string, scope: 'private' | 'shared' | 'global', description: string): void
}>()

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.whoAmI?.roles?.includes('ROLE_ADMIN') ?? false)

const name        = ref('')
const description = ref('')
const scope       = ref<'private' | 'shared' | 'global'>('private')

const onSave = () => {
  if (!name.value.trim()) return
  emit('save', name.value.trim(), scope.value, description.value.trim())
  name.value        = ''
  description.value = ''
  scope.value       = 'private'
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.sv-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sv-modal {
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  width: 380px;
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

  &__body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var($primary-text-on-surface);
  }

  &__input, &__select {
    padding: 6px 10px;
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-xs;
    background: var($background);
    color: var($primary-text-on-surface);
    font-size: 0.85rem;
    &:focus { outline: 2px solid var($primary); outline-offset: -1px; }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var($border-on-surface);
  }

  &__btn {
    font-size: 0.82rem;
    padding: 6px 16px;
    border-radius: vars.$border-radius-xs;
    border: 1px solid transparent;
    cursor: pointer;
    font-weight: 500;

    &--primary {
      background: var($primary);
      color: var($primary-text-on-color);
      &:hover:not(:disabled) { opacity: 0.9; }
      &:disabled { opacity: 0.4; cursor: default; }
    }

    &--secondary {
      background: none;
      border-color: var($border-on-surface);
      color: var($primary-text-on-surface);
      &:hover { background: var($background); }
    }
  }
}
</style>
