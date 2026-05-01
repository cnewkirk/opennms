<template>
  <td :class="text ? 'pointer' : ''">
    <span
      v-if="text"
      v-tooltip.top="text"
    >{{ ellipsify(text, 30) }}</span>
  </td>
</template>

<script setup lang="ts">
import { ellipsify } from '@/lib/utils'

defineProps({
  text: {
    required: true,
    type: String
  }
})
</script>
