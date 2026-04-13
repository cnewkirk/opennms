<template>
  <nav
    class="sidenav"
    :class="{ 'sidenav--collapsed': collapsed }"
  >
    <div class="sidenav__resize-handle" @mousedown.prevent="startResize" />
    <div class="sidenav__sections">
      <div
        v-for="section in visibleSections"
        :key="section.id"
        class="nav-section"
        :class="{ 'nav-section--open': openSection === section.id }"
      >
        <!-- Section header -->
        <button
          class="nav-section__header"
          :title="section.label"
          @click="onSectionClick(section.id)"
        >
          <i :class="['pi', section.icon, 'nav-section__icon']" />
          <span class="nav-section__label">{{ section.label }}</span>
          <i
            class="pi nav-section__chevron"
            :class="openSection === section.id ? 'pi-angle-down' : 'pi-angle-right'"
          />
        </button>

        <!-- Section items -->
        <div class="nav-section__items">
          <template v-for="item in section.items" :key="item.to || item.label">
            <router-link
              v-if="item.to && item.visible !== false"
              :to="item.to"
              class="nav-item"
              active-class="nav-item--active"
              :title="item.label"
            >
              <i :class="['pi', item.icon, 'nav-item__icon']" />
              <span class="nav-item__label">{{ item.label }}</span>
            </router-link>

            <!-- Sub-section header (e.g. Provisioning, System) -->
            <div v-else-if="item.header && item.visible !== false" class="nav-subheader">
              {{ item.label }}
            </div>
          </template>
        </div>
      </div>

      <!-- Plugin items from server -->
      <div v-if="pluginItems.length" class="nav-section" :class="{ 'nav-section--open': openSection === 'plugins' }">
        <button class="nav-section__header" title="Plugins" @click="onSectionClick('plugins')">
          <i class="pi pi-puzzle nav-section__icon" />
          <span class="nav-section__label">Plugins</span>
          <i class="pi nav-section__chevron" :class="openSection === 'plugins' ? 'pi-angle-down' : 'pi-angle-right'" />
        </button>
        <div class="nav-section__items">
          <a
            v-for="item in pluginItems"
            :key="item.href"
            :href="item.href"
            class="nav-item"
            :title="item.label"
          >
            <i class="pi pi-external-link nav-item__icon" />
            <span class="nav-item__label">{{ item.label }}</span>
          </a>
        </div>
      </div>
    </div>

    <button
      class="sidenav__toggle"
      :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      :aria-expanded="!collapsed"
      @click="toggle"
      aria-label="Toggle sidebar"
    >
      <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useMenuStore } from '@/stores/menuStore'
import { usePluginStore } from '@/stores/pluginStore'
import useRole from '@/composables/useRole'
import type { Plugin } from '@/types'

const STORAGE_KEY = 'onms.sidenav.collapsed'
const OPEN_SECTION_KEY = 'onms.sidenav.openSection'

const route = useRoute()
const menuStore = useMenuStore()
const pluginStore = usePluginStore()
const { adminRole, dcbRole } = useRole()

const collapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')
const openSection = ref<string>(localStorage.getItem(OPEN_SECTION_KEY) ?? 'monitor')

const zenithEnabled = computed<boolean>(() => menuStore.mainMenu?.zenithConnectEnabled ?? false)
const baseHref = computed<string>(() => menuStore.mainMenu?.baseHref ?? '/opennms/')

interface NavItem {
  label: string
  to?: string
  icon?: string
  header?: boolean
  visible?: boolean
}

interface NavSection {
  id: string
  label: string
  icon: string
  items: NavItem[]
  visible?: boolean
}

const sections = computed<NavSection[]>(() => [
  {
    id: 'monitor',
    label: 'Monitor',
    icon: 'pi-chart-bar',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'pi-th-large' },
      { label: 'Alarms', to: '/alarms', icon: 'pi-bell' },
      { label: 'Events', to: '/events', icon: 'pi-list' },
      { label: 'Outages', to: '/outages', icon: 'pi-exclamation-triangle' },
      { label: 'Surveillance Dashboard', to: '/surveillance-dashboard', icon: 'pi-table' },
      { label: 'Resource Graphs', to: '/resource-graphs', icon: 'pi-chart-line' },
    ]
  },
  {
    id: 'network',
    label: 'Network',
    icon: 'pi-sitemap',
    items: [
      { label: 'Nodes', to: '/nodes', icon: 'pi-server' },
      { label: 'Geographical Map', to: '/map', icon: 'pi-map' },
      { label: 'Topology', to: '/topology', icon: 'pi-share-alt' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'pi-cog',
    items: [
      // Provisioning sub-group
      { label: 'Provisioning', header: true },
      { label: 'Manage Requisitions', to: '/provision/requisitions', icon: 'pi-database' },
      { label: 'External Requisitions', to: '/configuration', icon: 'pi-cloud-download' },
      { label: 'Secure Credentials Vault', to: '/scv', icon: 'pi-lock', visible: adminRole.value },
      // System sub-group
      { label: 'System', header: true, visible: adminRole.value },
      { label: 'System Configuration', to: '/system-config', icon: 'pi-sliders-h', visible: adminRole.value },
      { label: 'Users & Groups', to: '/users-groups', icon: 'pi-users', visible: adminRole.value },
      { label: 'Monitoring Locations', to: '/monitoring-locations', icon: 'pi-map-marker', visible: adminRole.value },
      { label: 'Minions', to: '/minions', icon: 'pi-server', visible: adminRole.value },
      ...(zenithEnabled.value ? [{ label: 'Zenith Connect', to: '/zenith-connect', icon: 'pi-link' }] : []),
      // Monitoring Config sub-group
      { label: 'Monitoring Config', header: true, visible: adminRole.value },
      { label: 'Scheduled Outages', to: '/scheduled-outages', icon: 'pi-calendar-times', visible: adminRole.value },
      { label: 'Discovery', to: '/discovery-config', icon: 'pi-search', visible: adminRole.value },
      { label: 'SNMP by IP', to: '/snmp-config', icon: 'pi-sitemap', visible: adminRole.value },
      { label: 'SNMP Collections', to: '/snmp-collections-config', icon: 'pi-database', visible: adminRole.value },
      { label: 'Thresholds', to: '/threshold-config', icon: 'pi-filter', visible: adminRole.value },
      // Notifications sub-group
      { label: 'Notifications', header: true, visible: adminRole.value },
      { label: 'Notification Rules', to: '/notification-config/rules', icon: 'pi-envelope', visible: adminRole.value },
      { label: 'Destination Paths', to: '/notification-config/paths', icon: 'pi-directions', visible: adminRole.value },
      { label: 'Event Configurations', to: '/event-config', icon: 'pi-bolt', visible: adminRole.value },
      // Tools sub-group
      { label: 'Tools', header: true, visible: adminRole.value || dcbRole.value },
      { label: 'JMX Config Generator', to: '/jmx-config-generator', icon: 'pi-wrench', visible: adminRole.value },
      { label: 'MIB Compiler', to: '/mib-compiler', icon: 'pi-file-edit', visible: adminRole.value },
      { label: 'File Editor', to: '/file-editor', icon: 'pi-file', visible: adminRole.value },
      { label: 'BSM Admin', to: '/bsm-admin', icon: 'pi-briefcase', visible: adminRole.value },
      { label: 'Wallboard Config', to: '/wallboard-config', icon: 'pi-desktop', visible: adminRole.value },
      { label: 'Surveillance Views Config', to: '/surveillance-views-config', icon: 'pi-eye', visible: adminRole.value },
      { label: 'Usage Statistics', to: '/usage-statistics', icon: 'pi-chart-pie', visible: adminRole.value },
      { label: 'Device Config Backup', to: '/device-config-backup', icon: 'pi-save', visible: dcbRole.value },
      { label: 'Open API', to: '/open-api', icon: 'pi-code', visible: adminRole.value },
    ]
  }
])

const visibleSections = computed(() => sections.value.filter(s => s.visible !== false))

// Plugin items from server-side menu
const pluginItems = computed(() => {
  const plugins: Plugin[] = pluginStore.plugins ?? []
  return plugins
    .filter(p => p.menuEntry && p.extensionId)
    .map(p => ({
      label: p.menuEntry ?? '',
      href: `${baseHref.value}plugins/${p.extensionId}/${p.resourceRootPath}/${p.moduleFileName}`
    }))
})

// Auto-open section that contains the active route on load
const autoOpenSection = () => {
  for (const section of sections.value) {
    const hasActive = section.items.some(
      item => item.to && (route.path === item.to || route.path.startsWith(item.to + '/'))
    )
    if (hasActive) {
      openSection.value = section.id
      return
    }
  }
}

onMounted(() => {
  document.querySelector('.app-shell')?.classList.toggle('sidenav-collapsed', collapsed.value)
  autoOpenSection()
})

const toggle = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(STORAGE_KEY, String(collapsed.value))
  document.querySelector('.app-shell')?.classList.toggle('sidenav-collapsed', collapsed.value)
}

const onSectionClick = (id: string) => {
  if (collapsed.value) {
    // Expand sidebar, then open this section — no dead clicks
    collapsed.value = false
    localStorage.setItem(STORAGE_KEY, 'false')
    document.querySelector('.app-shell')?.classList.remove('sidenav-collapsed')
  }
  openSection.value = openSection.value === id ? '' : id
  localStorage.setItem(OPEN_SECTION_KEY, openSection.value)
}

const startResize = (e: MouseEvent) => {
  const nav = (e.currentTarget as HTMLElement).closest('nav') as HTMLElement | null
  if (!nav) return
  const startX = e.clientX
  const startWidth = nav.offsetWidth

  const onMove = (ev: MouseEvent) => {
    const newWidth = Math.max(48, Math.min(400, startWidth + (ev.clientX - startX)))
    nav.style.width = `${newWidth}px`
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<style lang="scss" scoped>
.sidenav {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--feather-surface);
  border-right: 1px solid var(--feather-border-light-on-surface);
  overflow: hidden;
  // NOTE: no width transition here — the CSS Grid handles the animation in App.vue

  &__sections {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 40px;
    border: none;
    border-top: 1px solid var(--feather-border-light-on-surface);
    background: transparent;
    cursor: pointer;
    color: var(--feather-secondary-text-on-surface);
    flex-shrink: 0;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }

    &:focus-visible {
      outline: 2px solid var(--feather-primary);
      outline-offset: -2px;
    }
  }
}

.nav-section {
  &__header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    gap: 10px;
    color: var(--feather-secondary-text-on-surface);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    overflow: hidden;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
      color: var(--feather-primary-text-on-surface);
    }

    &:focus-visible {
      outline: 2px solid var(--feather-primary);
      outline-offset: -2px;
    }
  }

  &__icon {
    font-size: 16px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  &__label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  &__chevron {
    font-size: 12px;
    flex-shrink: 0;
    transition: transform 200ms ease;
  }

  &__items {
    max-height: 0;
    overflow: hidden;
    transition: max-height 200ms ease;
  }

  &--open &__items {
    max-height: 2000px;
  }
}

.nav-subheader {
  padding: 8px 16px 2px 42px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--feather-secondary-text-on-surface);
  white-space: nowrap;
  overflow: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 24px;
  color: var(--feather-primary-text-on-surface);
  text-decoration: none;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;

  &__icon {
    font-size: 14px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  &:focus-visible {
    outline: 2px solid var(--feather-primary);
    outline-offset: -2px;
  }

  &--active {
    background: var(--feather-primary-container-on-surface);
    color: var(--feather-primary-text-on-primary-container);
    font-weight: 600;
  }
}

// Collapsed mode: hide labels and chevrons; show only icons in section headers
.sidenav--collapsed {
  .nav-section__label,
  .nav-section__chevron,
  .nav-item__label,
  .nav-subheader {
    display: none;
  }

  .nav-section__items {
    display: none;
  }

  .nav-section__header {
    justify-content: center;
    padding: 12px;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }
}
</style>
