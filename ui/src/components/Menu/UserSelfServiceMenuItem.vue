<template>
  <div class="self-service">
    <Button
      text
      rounded
      class="self-service__btn"
      title="User menu"
      @click="toggle"
    >
      <template #default>
        <i class="pi pi-user self-service__icon" />
        <i class="pi pi-angle-down self-service__chevron" />
      </template>
    </Button>

    <Popover ref="popoverRef" class="self-service-popover">
      <div class="self-service-menu">
        <a
          href="#"
          class="self-service-menu__item self-service-menu__item--username"
          @click.prevent="onUserProfileMenuClick"
        >
          <i class="pi pi-user" />
          <span class="self-service-menu__username">{{ ellipsify(mainMenu.username || '', 40) }}</span>
        </a>

        <div class="self-service-menu__divider" />

        <a
          v-for="item in menuItems"
          :key="item?.id || ''"
          :href="computeLink(item?.url || '')"
          class="self-service-menu__item"
          @click.prevent="onMenuItemClick(item)"
        >
          <i :class="['pi', getItemIcon(item)]" />
          <span>{{ item?.name || '' }}</span>
        </a>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { ellipsify } from '@/lib/utils'
import { performLogout } from '@/services/logoutService'
import { useMenuStore } from '@/stores/menuStore'
import { MainMenu, MenuItem } from '@/types/mainMenu'

const menuStore = useMenuStore()
const mainMenu = computed<MainMenu>(() => menuStore.mainMenu)

const popoverRef = ref()
const toggle = (event: Event) => popoverRef.value?.toggle(event)

const menuItems = computed<MenuItem[]>(() =>
  mainMenu.value?.selfServiceMenu?.items ?? []
)

const computeLink = (url: string) => {
  const base = mainMenu.value?.baseHref ?? '/opennms/'
  return url ? (url.startsWith('http') ? url : `${base}${url}`) : '#'
}

const getItemIcon = (item: MenuItem): string => {
  if (item.action === 'logout') return 'pi-sign-out'
  if (item.id === 'selfServicePassword' || item.id === 'changePassword') return 'pi-lock'
  if (item.id === 'apiTokens') return 'pi-key'
  return 'pi-external-link'
}

const onUserProfileMenuClick = () => {
  const url = mainMenu.value?.selfServiceMenu?.url ?? ''
  if (url) window.location.assign(computeLink(url))
}

const onMenuItemClick = async (item: MenuItem) => {
  if (item.action === 'logout') {
    await performLogout()
    return
  }
  window.location.assign(computeLink(item.url || ''))
}
</script>

<style lang="scss" scoped>
.self-service {
  position: relative;

  &__btn {
    color: inherit !important;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__icon {
    font-size: 20px;
  }

  &__chevron {
    font-size: 12px;
  }
}

.self-service-popover {
  min-width: 200px;
}

.self-service-menu {
  display: flex;
  flex-direction: column;

  &__divider {
    height: 1px;
    background: var(--feather-border-light-on-surface);
    margin: 4px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    color: var(--feather-primary-text-on-surface);
    text-decoration: none;
    font-size: 13px;
    cursor: pointer;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }

    &--username {
      font-weight: 600;
    }
  }

  &__username {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }
}
</style>
