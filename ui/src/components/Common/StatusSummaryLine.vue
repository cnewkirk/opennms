<!-- ui/src/components/Common/StatusSummaryLine.vue -->
<template>
  <div class="status-summary-line caption">
    Showing {{ shown }} of {{ total }} {{ noun }} with active problems
  </div>
</template>

<script setup lang="ts">
defineProps<{ shown: number; total: number; noun: string }>()
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.status-summary-line {
  color: var($secondary-text-on-surface);
  padding: 6px 0;
  font-style: italic;
}
</style>
