<template>
  <div class="search-bar">
    <div class="search">
      <InputText placeholder="Search logs" v-model="searchValue" @update:modelValue="search" />
    </div>
  </div>
  <hr />
</template>

<script setup lang="ts">
import { useLogStore } from '@/stores/logStore'
import InputText from 'primevue/inputtext'

const logStore = useLogStore()
const searchValue = ref('')
const search = () => logStore.setSearchValue(searchValue.value)
</script>

<style scoped lang="scss">
.search-bar {
  display: flex;
  .search {
    width: 100%;
  }
}
</style>
