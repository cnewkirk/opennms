<template>
  <div class="app-shell">
    <TopBar class="app-shell__topbar" />
    <SideNav class="app-shell__sidenav" />
    <main class="app-shell__content">
      <Spinner />
      <Snackbar />
      <router-view v-slot="{ Component }">
        <keep-alive include="MapKeepAlive">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import TopBar from '@/components/Shell/TopBar.vue'
import SideNav from '@/components/Shell/SideNav.vue'
import Spinner from '@/components/Common/Spinner.vue'
import Snackbar from '@/components/Common/Snackbar.vue'
import { useAuthStore } from '@/stores/authStore'
import { useInfoStore } from '@/stores/infoStore'
import { usePluginStore } from '@/stores/pluginStore'
import { useMenuStore } from '@/stores/menuStore'
import { useMonitoringSystemStore } from '@/stores/monitoringSystemStore'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'

const authStore = useAuthStore()
const infoStore = useInfoStore()
const menuStore = useMenuStore()
const monitoringSystemStore = useMonitoringSystemStore()
const nodeStructureStore = useNodeStructureStore()
const pluginStore = usePluginStore()

onMounted(() => {
  authStore.getWhoAmI()
  infoStore.getInfo()
  menuStore.getMainMenu()
  menuStore.getNotificationSummary()
  monitoringSystemStore.getMainMonitoringSystem()
  nodeStructureStore.getCategories()
  nodeStructureStore.getMonitoringLocations()
  pluginStore.getPlugins()
})
</script>

<style lang="scss">
:root {
  --topbar-height: 56px;
  --sidebar-width-expanded: 220px;
  --sidebar-width-collapsed: 56px;
  --sidebar-width: var(--sidebar-width-expanded);
}

html {
  overflow-x: hidden;
}

// Light theme — visibly off-white, not pure white. Like dark mode uses
// zinc-950/900 instead of black, we use clearly-colored values instead of
// white. opennms-feather-styles.scss carries the full token set.
html:not(.open-dark) {
  --feather-surface: #d4d8e4;
  --feather-background: #c8ccd8;
}

.app-shell {
  display: grid;
  grid-template-rows: var(--topbar-height) 1fr;
  grid-template-columns: var(--sidebar-width) 1fr;
  height: 100dvh;
  overflow: hidden;
  transition: grid-template-columns 200ms ease;

  &__topbar {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  &__sidenav {
    grid-column: 1;
    grid-row: 2;
    overflow: hidden;
  }

  &__content {
    grid-column: 2;
    grid-row: 2;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    background: var(--feather-background);
  }
}

// Collapsed sidebar: shrink the grid column
.app-shell.sidenav-collapsed {
  --sidebar-width: var(--sidebar-width-collapsed);
}

table {
  width: 100%;
}

.feather-row + .feather-row {
  margin-top: 12px;
}

a {
  text-decoration: none;
  color: var(--feather-clickable-normal);
  &:visited {
    color: var(--feather-clickable-normal) !important;
  }
}

.pointer {
  cursor: pointer !important;
}
</style>
