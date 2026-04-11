<template>
  <div class="services-table card">
    <div class="headline4 services-table__title">Monitored Services</div>

    <div v-if="loading" class="services-table__loading">Loading services…</div>
    <div v-else-if="!services.length" class="services-table__empty">No monitored services</div>
    <table v-else class="tl1 tl2 tl3 tl4">
      <thead>
        <tr>
          <th scope="col">Service</th>
          <th scope="col">Status</th>
          <th scope="col">Last Good</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="svc in services"
          :key="svc.id"
          :class="{ 'services-table__row--down': svc.down }"
        >
          <td>{{ svc.serviceType.name }}</td>
          <td>
            <span :class="['services-table__status', statusClass(svc)]">
              {{ svc.statusLong || (svc.down ? 'Down' : 'Up') }}
            </span>
          </td>
          <td>{{ formatTime(svc.lastGood) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { NodeIfService } from '@/types'

defineProps<{
  services: NodeIfService[]
  loading: boolean
}>()

const statusClass = (svc: NodeIfService) => {
  if (svc.down) return 'services-table__status--down'
  if (svc.status === 'N' || svc.status === 'U') return 'services-table__status--unmonitored'
  return 'services-table__status--up'
}

const formatTime = (ts: number | null) => {
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleString()
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.services-table {
  padding: 16px 20px;
  height: 100%;

  &__title { margin-bottom: 12px; }
  &__empty { color: var($secondary-text-on-surface); padding: 8px 0; }
  &__loading { color: var($secondary-text-on-surface); padding: 8px 0; }

  &__row--down {
    td { background: rgba(var(--feather-error-rgb, 176, 0, 32), 0.08); }
  }

  &__status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;

    &--up           { background: var($success); color: var($primary-text-on-color); }
    &--down         { background: var($error);   color: var($primary-text-on-color); }
    &--unmonitored  { background: var($shade-4); color: var($primary-text-on-surface); }
  }
}
</style>
