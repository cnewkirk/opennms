<template>
  <Teleport to="body">
    <div class="dem-overlay" @mousedown.self="$emit('close')">
      <div class="dem-modal" role="dialog" :aria-label="title">
        <div class="dem-modal__header">
          <span class="dem-modal__title">{{ title }}</span>
          <button class="dem-modal__close" @click="$emit('close')" aria-label="Close">&times;</button>
        </div>
        <div class="dem-modal__body">
          <div v-for="field in fields" :key="field" class="dem-field">
            <label class="dem-label">{{ labelFor(field) }}</label>
            <select v-if="field === 'location'" v-model="form[field]" class="dem-select">
              <option :value="null">Use Default</option>
              <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
            <select v-else-if="field === 'foreignSource'" v-model="form[field]" class="dem-select">
              <option :value="null">Use Default</option>
              <option v-for="fs in foreignSources" :key="fs" :value="fs">{{ fs }}</option>
            </select>
            <input
              v-else-if="field === 'timeout' || field === 'retries'"
              v-model.number="form[field]"
              type="number"
              :placeholder="`Use Default`"
              class="dem-input"
            />
            <input v-else v-model="form[field]" type="text" class="dem-input" />
          </div>
        </div>
        <div class="dem-modal__footer">
          <Button text label="Cancel" @click="$emit('close')" />
          <Button label="Add" @click="submit" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import Button from 'primevue/button'

const props = defineProps<{
  title: string
  fields: string[]
  initial: Record<string, any>
  locations: string[]
  foreignSources: string[]
}>()

const emit = defineEmits<{
  (e: 'save', entry: Record<string, any>): void
  (e: 'close'): void
}>()

const form = reactive<Record<string, any>>({})

watch(() => props.initial, (val) => {
  Object.keys(form).forEach(k => delete form[k])
  Object.assign(form, { ...val })
}, { immediate: true })

const fieldLabels: Record<string, string> = {
  content: 'IP Address / URL',
  begin: 'Begin Address',
  end: 'End Address',
  timeout: 'Timeout (ms)',
  retries: 'Retries',
  foreignSource: 'Foreign Source',
  location: 'Location',
}

const labelFor = (field: string) => fieldLabels[field] ?? field

const submit = () => {
  // trim empty strings to null for optional fields
  const entry: Record<string, any> = {}
  for (const field of props.fields) {
    const v = form[field]
    if (v === '' || v === undefined) {
      entry[field] = null
    } else {
      entry[field] = v
    }
  }
  emit('save', entry)
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.dem-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dem-modal {
  background: var($surface);
  border-radius: 6px;
  min-width: 400px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var($border-on-surface);
  }

  &__title {
    @include subtitle1();
    font-weight: 600;
  }

  &__close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    line-height: 1;
    padding: 0 4px;

    &:hover {
      color: var($primary-text-on-surface);
    }
  }

  &__body {
    padding: 20px;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var($border-on-surface);
  }
}

.dem-field {
  display: flex;
  align-items: center;
  margin-bottom: 14px;

  &:last-child {
    margin-bottom: 0;
  }
}

.dem-label {
  flex: 0 0 160px;
  color: var($secondary-text-on-surface);
}

.dem-select,
.dem-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  background: var($surface);
  color: var($primary-text-on-surface);

  &:focus {
    outline: 2px solid var($primary);
    outline-offset: 1px;
  }
}
</style>
