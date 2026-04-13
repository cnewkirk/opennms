<template>
  <header class="topbar">
    <!-- Left: Logo -->
    <div class="topbar__left">
      <a :href="homeUrl" class="topbar__logo-link" aria-label="OpenNMS Home">
        <IconLogo class="topbar__logo" />
      </a>
    </div>

    <!-- Center: Search + Add Node -->
    <div class="topbar__center">
      <Search id="onms-central-search-control" class="topbar__search" />
      <Button
        v-if="showAddNode"
        label="Add a Node"
        icon="pi pi-plus"
        class="topbar__add-node"
        @click="onAddNode"
        size="small"
      />
    </div>

    <!-- Right: Date/time, notifications, user menu, theme toggle -->
    <div class="topbar__right">
      <div class="topbar__datetime" aria-label="Current date and time">
        <span class="topbar__time">{{ formattedTime }}</span>
        <span class="topbar__date">{{ formattedDate }}</span>
      </div>
      <UserNotificationsMenuItem />
      <UserSelfServiceMenuItem />
      <Button
        :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
        text
        rounded
        size="small"
        class="topbar__theme-toggle"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'
import { useMenuStore } from '@/stores/menuStore'
import { useAppStore } from '@/stores/appStore'
import Search from '@/components/Menu/Search.vue'
import UserNotificationsMenuItem from '@/components/Menu/UserNotificationsMenuItem.vue'
import UserSelfServiceMenuItem from '@/components/Menu/UserSelfServiceMenuItem.vue'
// see vite.config.ts, resolve.alias for the actual logo file that is imported
import IconLogo from './src/assets/ProductLogo.vue'

const router = useRouter()
const menuStore = useMenuStore()
const appStore = useAppStore()

const mainMenu = computed(() => menuStore.mainMenu)
const homeUrl = computed(() => mainMenu.value?.homeUrl ?? '/opennms/')
const formattedDate = computed(() => mainMenu.value?.formattedDate ?? '')
const formattedTime = computed(() => mainMenu.value?.formattedTime ?? '')
const showAddNode = computed(() => mainMenu.value?.displayAddNodeButton ?? false)

// Theme toggle
const light = 'open-light'
const dark = 'open-dark'
const isDark = ref<boolean>(localStorage.getItem('theme') === dark)

const toggleTheme = () => {
  const el = document.body
  const htmlEl = document.documentElement
  const newTheme = isDark.value ? light : dark
  const oldTheme = isDark.value ? dark : light

  el.classList.remove(oldTheme)
  el.classList.add(newTheme)
  htmlEl.classList.remove(light, dark)
  htmlEl.classList.add(newTheme)
  isDark.value = newTheme === dark

  localStorage.setItem('theme', newTheme)
  appStore.setTheme(newTheme)
}

// Restore saved theme on mount
onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === dark || saved === light) {
    document.body.classList.remove(light, dark)
    document.body.classList.add(saved)
    document.documentElement.classList.remove(light, dark)
    document.documentElement.classList.add(saved)
    appStore.setTheme(saved)
  }
})

const onAddNode = () => {
  router.push('/provision/quick-add')
}
</script>

<style lang="scss" scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--feather-primary);
  color: var(--feather-primary-text-on-primary);
  height: var(--topbar-height, 56px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);

  &__left {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  &__logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  &__logo {
    height: 32px;
    width: auto;
    display: flex;
    align-items: center;
  }

  &__center {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  &__search {
    flex: 1;
    max-width: 480px;
  }

  &__add-node {
    flex-shrink: 0;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__datetime {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.2;
    font-size: 11px;
    opacity: 0.85;
  }

  &__time {
    font-weight: 600;
  }

  &__date {
    font-size: 10px;
  }

  &__theme-toggle {
    color: var(--feather-primary-text-on-primary) !important;
    opacity: 0.85;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
