<template>
  <span class="p-input-icon-right">
    <InputText
      :modelValue="searchVal ?? ''"
      @update:modelValue="searchFilterHandler"
      placeholder="Search device"
    />
    <i class="pi pi-search" />
  </span>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { useDebounceFn } from '@vueuse/core'
import { useDeviceStore } from '@/stores/deviceStore'
import { DeviceConfigQueryParams } from '@/types/deviceConfig'
import { UpdateModelFunction } from '@/types'

const deviceStore = useDeviceStore()
const searchVal = ref<string | undefined>(undefined)

const searchFilterHandler: UpdateModelFunction = (val = '') => {
  if (searchVal.value === undefined && val === '') return // prevents dup mounted call from feather
  searchVal.value = val

  const newQueryParams: DeviceConfigQueryParams = {
    limit: 20,
    offset: 0,
    search: val
  }

  deviceStore.updateDeviceConfigBackupQueryParams(newQueryParams)
  getDeviceConfigBackupsOnDebounce()
}


// TODO: return scroll bar to top before running, so infinite scroll won't trigger after search
const getDeviceConfigBackupsOnDebounce = useDebounceFn(() => deviceStore.getDeviceConfigBackups(), 1000)
</script>

<style scoped lang="scss">
</style>
