<template>
  <div class="user-notifications" ref="containerRef">
    <Button
      text
      rounded
      class="user-notifications__btn"
      :title="noticeStatusDisplay?.title ?? 'Notifications'"
      @click="toggle"
    >
      <template #default>
        <span v-if="notificationSummary.userUnacknowledgedCount" class="notification-badge user-badge">
          {{ notificationSummary.userUnacknowledgedCount }}
        </span>
        <span v-if="notificationSummary.teamUnacknowledgedCount" class="notification-badge team-badge">
          {{ notificationSummary.teamUnacknowledgedCount }}
        </span>
        <i :class="['pi', noticeIconClass, 'notifications-icon']" />
        <i class="pi pi-angle-down notifications-chevron" />
      </template>
    </Button>

    <Popover ref="popoverRef" class="notifications-popover">
      <div class="notifications-menu">
        <a
          :href="computeLink(notificationConfigUrl)"
          class="notifications-menu-item"
          @click.prevent="onMenuItemClick(notificationConfigUrl)"
        >
          <i :class="['pi', noticeIconClass]" />
          <span>{{ noticeStatusDisplay?.title ?? 'Notification Status' }}</span>
        </a>

        <a
          v-for="item in userNotificationItems"
          :key="item.name ?? ''"
          :href="computeLink(item.url || '')"
          class="notifications-menu-item"
          @click.prevent="onMenuItemClick(item.url || '')"
        >
          <i class="pi pi-user" />
          <span>{{ notificationSummary.userUnacknowledgedCount ?? 0 }} notices assigned to you</span>
        </a>

        <a
          v-for="item in teamNotificationItems"
          :key="item.name ?? ''"
          :href="computeLink(item.url || '')"
          class="notifications-menu-item"
          @click.prevent="onMenuItemClick(item.url || '')"
        >
          <i class="pi pi-users" />
          <span>{{ notificationSummary.teamUnacknowledgedCount ?? 0 }} team notices</span>
        </a>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { useMenuStore } from '@/stores/menuStore'
import { MainMenu, MenuItem } from '@/types/mainMenu'

const menuStore = useMenuStore()
const mainMenu = computed<MainMenu>(() => menuStore.mainMenu)
const notificationSummary = computed(() => menuStore.notificationSummary)

const popoverRef = ref()
const toggle = (event: Event) => popoverRef.value?.toggle(event)

const notificationConfigUrl = computed(() => {
  const item = mainMenu.value?.userNotificationMenu?.items?.find(i => i.id === 'userNotificationConfiguration')
  return item?.url ?? ''
})

const userNotificationItems = computed(() =>
  mainMenu.value?.userNotificationMenu?.items?.filter((i: MenuItem) => i.id === 'userNotificationUser') ?? []
)
const teamNotificationItems = computed(() =>
  mainMenu.value?.userNotificationMenu?.items?.filter((i: MenuItem) => i.id === 'userNotificationTeam') ?? []
)

const noticeStatusDisplay = computed(() => {
  const userCount = notificationSummary.value?.userUnacknowledgedCount ?? 0
  const teamCount = notificationSummary.value?.teamUnacknowledgedCount ?? 0
  if (userCount > 0) return { title: 'You have unacknowledged notices', iconClass: 'pi-bell' }
  if (teamCount > 0) return { title: 'Team has unacknowledged notices', iconClass: 'pi-bell' }
  return { title: 'No unacknowledged notices', iconClass: 'pi-bell-slash' }
})

const noticeIconClass = computed(() => noticeStatusDisplay.value?.iconClass ?? 'pi-bell')

const computeLink = (url: string) => {
  const base = mainMenu.value?.baseHref ?? '/opennms/'
  return url.startsWith('http') ? url : `${base}${url}`
}

const onMenuItemClick = (url: string) => {
  window.location.assign(computeLink(url))
}
</script>

<style lang="scss" scoped>
.user-notifications {
  position: relative;

  &__btn {
    color: var(--feather-primary-text-on-primary) !important;
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.notification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;

  &.user-badge {
    background: var(--feather-error);
    color: #fff;
  }

  &.team-badge {
    background: var(--feather-caution);
    color: #000;
  }
}

.notifications-icon {
  font-size: 18px;
}

.notifications-chevron {
  font-size: 12px;
}

.notifications-popover {
  min-width: 220px;
}

.notifications-menu {
  display: flex;
  flex-direction: column;

  &-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    color: var(--feather-primary-text-on-surface);
    text-decoration: none;
    font-size: 13px;
    cursor: pointer;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
}
</style>
