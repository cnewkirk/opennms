<template>
  <div class="entry-table-card">
    <div class="entry-table-card__header">{{ title }}</div>
    <table v-if="rows.length" class="entry-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col">{{ col }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td v-for="field in fields" :key="field">
            <span v-if="row[field] != null && row[field] !== ''">{{ row[field] }}</span>
            <em v-else class="entry-table__default">Use Default</em>
          </td>
          <td class="entry-table__actions">
            <FeatherButton text @click="$emit('remove', i)">Delete</FeatherButton>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="entry-table-card__empty">No entries configured.</div>
    <div class="entry-table-card__footer">
      <FeatherButton secondary @click="$emit('add', fields)">{{ addLabel }}</FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'

defineProps<{
  title: string
  rows: Record<string, any>[]
  columns: string[]
  fields: string[]
  addLabel: string
  defaults?: Record<string, any>
}>()

defineEmits<{
  (e: 'add', fields: string[]): void
  (e: 'remove', index: number): void
}>()
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.entry-table-card {
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  margin-bottom: 20px;

  &__header {
    padding: 12px 16px;
    border-bottom: 1px solid var($border-on-surface);
    @include subtitle1();
    font-weight: 600;
  }

  &__empty {
    padding: 16px;
    color: var($secondary-text-on-surface);
  }

  &__footer {
    padding: 10px 16px;
    border-top: 1px solid var($border-on-surface);
    display: flex;
    justify-content: flex-end;
  }
}

.entry-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 8px 14px;
    text-align: left;
    border-bottom: 1px solid var($border-on-surface);
  }

  th {
    @include subtitle2();
    background: var($surface);
    color: var($secondary-text-on-surface);
  }

  &__default {
    color: var($secondary-text-on-surface);
  }

  &__actions {
    white-space: nowrap;
    text-align: right;
  }
}
</style>
