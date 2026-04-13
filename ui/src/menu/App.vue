<template>
  <TopBar />
  <SideNav />
</template>

<script setup lang="ts">

import { onMounted } from 'vue'
import TopBar from '@/components/Shell/TopBar.vue'
import SideNav from '@/components/Shell/SideNav.vue'

import { useMenuStore } from '@/stores/menuStore'
import { usePluginStore } from '@/stores/pluginStore'

const menuStore = useMenuStore()
const pluginStore = usePluginStore()

onMounted(() => {
  menuStore.getMainMenu()
  menuStore.getNotificationSummary()
  pluginStore.getPlugins()
})
</script>

<style scoped>
</style>
