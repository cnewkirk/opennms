<template>
  <span class="pointer dcb-table-status-dropdown">
    <Button
      label="Backup Status"
      icon="pi pi-chevron-down"
      iconPos="right"
      text
      @click="(e) => menu?.toggle(e)"
    />
    <Menu ref="menu" :model="menuItems" :popup="true" />
  </span>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { useDeviceStore } from '@/stores/deviceStore'
import { DeviceConfigQueryParams, status } from '@/types/deviceConfig'

const menu = ref<InstanceType<typeof Menu> | null>(null)

const deviceStore = useDeviceStore()

const menuItems = computed(() =>
  deviceStore.backupStatusOptions.map((option: string) => ({
    label: option === 'NONE' ? 'No Backup' : option.toLowerCase(),
    command: () => filterByStatus(option as status)
  }))
)

const filterByStatus = (value: status) => {
  const newQueryParams: DeviceConfigQueryParams = {
    limit: 20,
    offset: 0,
    status: value
  }

  deviceStore.updateDeviceConfigBackupQueryParams(newQueryParams)
  deviceStore.getDeviceConfigBackups()
}
</script>

<style scoped lang="scss">
@import "@/styles/tokens";

.option {
  height: 36px;
  line-height: 2.5;
  padding-left: 15px;
  text-transform: capitalize;
}
</style>

<style lang="scss">
.dcb-table-status-dropdown {
  .feather-dropdown {
    li {
      a {
        padding-left: 5px;
      }
    }
  }
}
</style>
