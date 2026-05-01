<template>
  <div class="group-filters-container">
    <p class="title">Group By</p>

    <div class="dropdown">
      <Button
        label="Vendor"
        icon="pi pi-chevron-down"
        iconPos="right"
        outlined
        class="w-full"
        @click="(e) => vendorMenu?.toggle(e)"
      />
      <Menu ref="vendorMenu" :model="vendorMenuItems" :popup="true" />
    </div>

    <div class="dropdown dcb-group-filters-status-dropdown">
      <Button
        label="Backup Status"
        icon="pi pi-chevron-down"
        iconPos="right"
        outlined
        class="w-full"
        @click="(e) => statusMenu?.toggle(e)"
      />
      <Menu ref="statusMenu" :model="statusMenuItems" :popup="true" />
    </div>

    <div class="dropdown">
      <Button
        label="OS Image"
        icon="pi pi-chevron-down"
        iconPos="right"
        outlined
        class="w-full"
        @click="(e) => osMenu?.toggle(e)"
      />
      <Menu ref="osMenu" :model="osMenuItems" :popup="true" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { useDeviceStore } from '@/stores/deviceStore'
import { DeviceConfigQueryParams } from '@/types/deviceConfig'

const vendorMenu = ref<InstanceType<typeof Menu> | null>(null)
const statusMenu = ref<InstanceType<typeof Menu> | null>(null)
const osMenu = ref<InstanceType<typeof Menu> | null>(null)

const deviceStore = useDeviceStore()

const vendorMenuItems = computed(() =>
  deviceStore.vendorOptions.map((option: string) => ({
    label: option,
    command: () => onGroupByOptionClick('vendor', option)
  }))
)
const statusMenuItems = computed(() =>
  deviceStore.backupStatusOptions.map((option: string) => ({
    label: option,
    command: () => onGroupByOptionClick('status', option)
  }))
)
const osMenuItems = computed(() =>
  deviceStore.osImageOptions.map((option: string) => ({
    label: option,
    command: () => onGroupByOptionClick('osImage', option)
  }))
)

const onGroupByOptionClick = (groupBy: string, value: string) => {
  const newQueryParams: DeviceConfigQueryParams = {
    limit: 20,
    offset: 0,
    groupBy: groupBy,
    groupByValue: value
  }

  deviceStore.updateDeviceConfigBackupQueryParams(newQueryParams)
  deviceStore.getDeviceConfigBackups()
}
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@featherds/styles/mixins/typography";
@import "@/styles/tokens";

.group-filters-container {
  display: flex;
  flex-direction: column;
  margin-left: 20px;
  margin-top: 63px;
  border: 1px solid var($shade-4);
  border-radius: vars.$border-radius-xs;
  padding: 15px;

  .title {
    @include headline4;
    margin-top: 0px;
  }

  .dropdown {
    margin-bottom: 15px;

    .option {
      height: 36px;
      line-height: 2.5;
      padding-left: 15px;
      text-transform: capitalize;
    }
    .btn {
      width: 100%;
    }
  }
}
</style>

<style lang="scss">
.dcb-group-filters-status-dropdown {
  .feather-dropdown {
    li {
      a {
        padding-left: 5px;
      }
    }
  }
}
</style>
