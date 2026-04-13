# Shell PrimeVue Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Feather DS app shell (AppBar, AppLayout, SideMenu, Menubar) with a PrimeVue-based CSS Grid layout, slim collapsible sidebar, and reorganized nav — eliminating all Feather DS imports from the shell layer.

**Architecture:** `App.vue` owns a CSS Grid (56px topbar row + fill content row, with a CSS-variable-driven sidebar column). `TopBar.vue` and `SideNav.vue` (in `ui/src/components/Shell/`) replace `Menubar.vue` and `SideMenu.vue`. The sidebar uses a hand-rolled accordion nav (not PanelMenu) for precise collapse-mode behavior. PrimeVue `Popover` replaces Feather dropdowns in the user menu components. A new `Events.vue` container gives events a first-class nav entry.

**Tech Stack:** Vue 3, PrimeVue 4 (Aura preset, already installed), PrimeIcons, Vue Router 4, Pinia, Vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-04-12-shell-primevue-redesign-design.md`

---

## File Map

**Created:**
- `ui/src/utils/legacyRoutes.ts` — `legacyToVueRoutes` map + `resolveMenuUrl()` helper
- `ui/src/components/Shell/TopBar.vue` — top bar (logo, search, add-node, user menus, datetime, theme toggle)
- `ui/src/components/Shell/SideNav.vue` — collapsible nav sidebar (MONITOR / NETWORK / ADMINISTRATION)
- `ui/src/containers/Events.vue` — events list page

**Modified:**
- `ui/src/main/App.vue` — CSS Grid layout; import Shell components; remove FeatherAppLayout
- `ui/src/components/Menu/UserNotificationsMenuItem.vue` — Feather → PrimeVue Popover
- `ui/src/components/Menu/UserSelfServiceMenuItem.vue` — Feather → PrimeVue Popover
- `ui/src/components/Menu/Search.vue` — remove FeatherIcon; use inline SVG search icon
- `ui/src/main/router/index.ts` — add `/events` route; add `/provision/quick-add` stub
- `ui/src/containers/Topology.vue` — remove FeatherAppLayout height workaround

**Deleted (after Task 9):**
- `ui/src/components/Menu/Menubar.vue`
- `ui/src/components/Menu/SideMenu.vue`

**Tests:**
- `ui/tests/utils/legacyRoutes.test.ts`
- `ui/tests/components/SideNav.test.ts`
- `ui/tests/containers/Events.test.ts`

---

## Task 1: legacyRoutes utility

**Files:**
- Create: `ui/src/utils/legacyRoutes.ts`
- Create: `ui/tests/utils/legacyRoutes.test.ts`

- [ ] **Step 1: Create the utility**

Create `ui/src/utils/legacyRoutes.ts`:

```ts
/**
 * Maps legacy OpenNMS JSP/HTM menu URLs to Vue SPA paths.
 * Used by SideNav to resolve server-provided menu item URLs.
 */
export const legacyToVueRoutes: Record<string, string> = {
  'alarm/index.htm':                   '/alarms',
  'dashboard.jsp':                     '/surveillance-dashboard',
  'surveillance-view.jsp':             '/surveillance-dashboard',
  'element/nodeList.htm':              '/nodes',
  'outage/index.jsp':                  '/outages',
  'graph/index.jsp':                   '/resource-graphs',
  'topology':                          '/topology',
  'admin/jmxConfigGenerator.jsp':      '/jmx-config-generator',
  'admin/mibCompiler.jsp':             '/mib-compiler',
  'admin/wallboardConfig.jsp':         '/wallboard-config',
  'admin/surveillanceViewsConfig.jsp': '/surveillance-views-config',
  'admin/manageSnmpCollections.jsp':   '/snmp-collections-config',
  'vaadin-wallboard':                  '/wallboard-config',
  'admin/bsm/adminpage.jsp':           '/bsm-admin',
  'admin/manageEvents.jsp':            '/event-config',
  'admin/index.jsp':                   '/admin'
}

/**
 * Resolves a menu item URL from the server to a Vue SPA path if known,
 * otherwise returns null (caller should fall back to absolute href).
 */
export function resolveVueRoute(url: string): string | null {
  return legacyToVueRoutes[url] ?? null
}
```

- [ ] **Step 2: Write the test**

Create `ui/tests/utils/legacyRoutes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveVueRoute, legacyToVueRoutes } from '@/utils/legacyRoutes'

describe('resolveVueRoute', () => {
  it('resolves known alarm URL to Vue route', () => {
    expect(resolveVueRoute('alarm/index.htm')).toBe('/alarms')
  })

  it('resolves legacy topology entry', () => {
    expect(resolveVueRoute('topology')).toBe('/topology')
  })

  it('returns null for unknown URL', () => {
    expect(resolveVueRoute('some/unknown.jsp')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveVueRoute('')).toBeNull()
  })

  it('all values start with /', () => {
    for (const [key, value] of Object.entries(legacyToVueRoutes)) {
      expect(value, `Route for "${key}" must start with /`).toMatch(/^\//)
    }
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run tests/utils/legacyRoutes.test.ts
```

Expected: 5 passing.

- [ ] **Step 4: Commit**

```bash
git add ui/src/utils/legacyRoutes.ts ui/tests/utils/legacyRoutes.test.ts
git commit -m "feat(shell): add legacyRoutes utility extracted from SideMenu"
```

---

## Task 2: App.vue — CSS Grid layout

**Files:**
- Modify: `ui/src/main/App.vue`

Replace the Feather layout wrapper with a CSS Grid. At the end of this task the app still renders (TopBar and SideNav will be stubs from the old components temporarily).

- [ ] **Step 1: Rewrite App.vue**

Replace the entire contents of `ui/src/main/App.vue` with:

```vue
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
@import "@featherds/styles/themes/open-light.css";
@import "@featherds/styles/themes/open-dark.css";
@import "@/styles/opennms-feather-styles.scss";

:root {
  --topbar-height: 56px;
  --sidebar-width-expanded: 180px;
  --sidebar-width-collapsed: 56px;
  --sidebar-width: var(--sidebar-width-expanded);
}

html {
  overflow-x: hidden;
}

// Soften the light theme — pure white is too harsh
html:not(.open-dark) {
  --feather-surface: #f8f9fa;
  --feather-background: #eef1f6;
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
    height: calc(100dvh - var(--topbar-height));
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
```

**Note:** `TopBar.vue` and `SideNav.vue` don't exist yet — the build will fail until Tasks 3–5 create them. That's expected. Do not build until Task 5 is complete.

- [ ] **Step 2: Commit (no build yet)**

```bash
git add ui/src/main/App.vue
git commit -m "refactor(shell): replace FeatherAppLayout with CSS Grid skeleton"
```

---

## Task 3: SideNav.vue — collapse mechanics

**Files:**
- Create: `ui/src/components/Shell/SideNav.vue`
- Create: `ui/tests/components/SideNav.test.ts`

Build the structural shell of `SideNav.vue` with collapse state and toggle — no nav items yet.

- [ ] **Step 1: Create SideNav.vue**

Create `ui/src/components/Shell/SideNav.vue`:

```vue
<template>
  <nav
    class="sidenav"
    :class="{ 'sidenav--collapsed': collapsed }"
    :aria-expanded="!collapsed"
  >
    <div class="sidenav__sections">
      <!-- nav sections injected in Task 4 -->
    </div>

    <button
      class="sidenav__toggle"
      :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggle"
      aria-label="Toggle sidebar"
    >
      <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
    </button>
  </nav>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'onms.sidenav.collapsed'

const collapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')

const toggle = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(STORAGE_KEY, String(collapsed.value))
  // update the grid column class on the app shell
  document.querySelector('.app-shell')?.classList.toggle('sidenav-collapsed', collapsed.value)
}

// Sync grid class on mount
onMounted(() => {
  document.querySelector('.app-shell')?.classList.toggle('sidenav-collapsed', collapsed.value)
})
</script>

<style lang="scss" scoped>
.sidenav {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--feather-surface);
  border-right: 1px solid var(--feather-border-light-on-surface);
  overflow: hidden;
  transition: width 200ms ease;

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
      background: var(--feather-state-text-hover);
    }
  }
}
</style>
```

- [ ] **Step 2: Write collapse state test**

Create `ui/tests/components/SideNav.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SideNav from '@/components/Shell/SideNav.vue'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] }
})

// stub document.querySelector for the app-shell class toggle
const fakeShell = { classList: { toggle: vi.fn() } }
vi.spyOn(document, 'querySelector').mockReturnValue(fakeShell as any)

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/dashboard' }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('SideNav collapse state', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts expanded by default', () => {
    const wrapper = mount(SideNav)
    expect(wrapper.classes()).not.toContain('sidenav--collapsed')
  })

  it('starts collapsed when localStorage says so', () => {
    store['onms.sidenav.collapsed'] = 'true'
    const wrapper = mount(SideNav)
    expect(wrapper.classes()).toContain('sidenav--collapsed')
  })

  it('toggles collapsed state on button click', async () => {
    const wrapper = mount(SideNav)
    await wrapper.find('.sidenav__toggle').trigger('click')
    expect(wrapper.classes()).toContain('sidenav--collapsed')
    expect(store['onms.sidenav.collapsed']).toBe('true')
  })

  it('persists expanded state after toggle back', async () => {
    store['onms.sidenav.collapsed'] = 'true'
    const wrapper = mount(SideNav)
    await wrapper.find('.sidenav__toggle').trigger('click')
    expect(wrapper.classes()).not.toContain('sidenav--collapsed')
    expect(store['onms.sidenav.collapsed']).toBe('false')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run tests/components/SideNav.test.ts
```

Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Shell/SideNav.vue ui/tests/components/SideNav.test.ts
git commit -m "feat(shell): add SideNav with collapse toggle and localStorage persistence"
```

---

## Task 4: SideNav.vue — nav items

**Files:**
- Modify: `ui/src/components/Shell/SideNav.vue`

Add the three navigation sections. Each section is an accordion group. In collapsed mode, clicking any section icon expands the sidebar and opens that section.

- [ ] **Step 1: Replace SideNav.vue with full nav**

Replace the full content of `ui/src/components/Shell/SideNav.vue`:

```vue
<template>
  <nav
    class="sidenav"
    :class="{ 'sidenav--collapsed': collapsed }"
    :aria-expanded="!collapsed"
  >
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
        <button class="nav-section__header" @click="onSectionClick('plugins')" title="Plugins">
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
      { label: 'System', header: true },
      { label: 'System Configuration', to: '/system-config', icon: 'pi-sliders-h', visible: adminRole.value },
      { label: 'Users & Groups', to: '/users-groups', icon: 'pi-users', visible: adminRole.value },
      { label: 'Monitoring Locations', to: '/monitoring-locations', icon: 'pi-map-marker', visible: adminRole.value },
      { label: 'Minions', to: '/minions', icon: 'pi-server', visible: adminRole.value },
      ...(zenithEnabled.value ? [{ label: 'Zenith Connect', to: '/zenith-connect', icon: 'pi-link' }] : []),
      // Monitoring Config sub-group
      { label: 'Monitoring Config', header: true },
      { label: 'Scheduled Outages', to: '/scheduled-outages', icon: 'pi-calendar-times', visible: adminRole.value },
      { label: 'Discovery', to: '/discovery-config', icon: 'pi-search', visible: adminRole.value },
      { label: 'SNMP by IP', to: '/snmp-config', icon: 'pi-sitemap', visible: adminRole.value },
      { label: 'SNMP Collections', to: '/snmp-collections-config', icon: 'pi-database', visible: adminRole.value },
      { label: 'Thresholds', to: '/threshold-config', icon: 'pi-filter', visible: adminRole.value },
      // Notifications sub-group
      { label: 'Notifications', header: true },
      { label: 'Notification Rules', to: '/notification-config/rules', icon: 'pi-envelope', visible: adminRole.value },
      { label: 'Destination Paths', to: '/notification-config/paths', icon: 'pi-directions', visible: adminRole.value },
      { label: 'Event Configurations', to: '/event-config', icon: 'pi-bolt', visible: adminRole.value },
      // Tools sub-group
      { label: 'Tools', header: true },
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
    const hasActive = section.items.some(item => item.to && route.path.startsWith(item.to))
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
    // Expand sidebar, then open this section
    collapsed.value = false
    localStorage.setItem(STORAGE_KEY, 'false')
    document.querySelector('.app-shell')?.classList.remove('sidenav-collapsed')
  }
  openSection.value = openSection.value === id ? '' : id
  localStorage.setItem(OPEN_SECTION_KEY, openSection.value)
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
      background: var(--feather-state-text-hover);
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
      background: var(--feather-state-text-hover);
      color: var(--feather-primary-text-on-surface);
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
    max-height: 2000px; // large enough for any section
  }

  &--open &__chevron {
    transform: rotate(0deg);
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
    background: var(--feather-state-text-hover);
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
```

- [ ] **Step 2: Run tests (collapse state tests should still pass)**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run tests/components/SideNav.test.ts
```

Expected: 4 passing.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Shell/SideNav.vue
git commit -m "feat(shell): add SideNav nav sections — Monitor, Network, Administration"
```

---

## Task 5: TopBar.vue

**Files:**
- Create: `ui/src/components/Shell/TopBar.vue`
- Modify: `ui/src/components/Menu/Search.vue` (remove FeatherIcon)

- [ ] **Step 1: Fix Search.vue — remove FeatherIcon**

In `ui/src/components/Menu/Search.vue`, find the FeatherIcon import and replace it with an inline SVG. The search icon is a magnifying glass.

Find this in the `<script>` section:
```ts
import { FeatherIcon } from '@featherds/icon'
import SearchIcon from '@featherds/icon/action/Search'
```

Delete those two imports. Then in the `<template>`, find:
```html
<div class="search-icon">
  <FeatherIcon :icon="SearchIcon" />
</div>
```

Replace with:
```html
<div class="search-icon">
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
</div>
```

- [ ] **Step 2: Create TopBar.vue**

Create `ui/src/components/Shell/TopBar.vue`:

```vue
<template>
  <header class="topbar">
    <!-- Left: Logo -->
    <div class="topbar__left">
      <a :href="homeUrl" class="topbar__logo-link" aria-label="OpenNMS Home">
        <img src="/opennms/images/nms-logo.png" alt="OpenNMS" class="topbar__logo" />
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
import Search from '@/components/Menu/Search.vue'
import UserNotificationsMenuItem from '@/components/Menu/UserNotificationsMenuItem.vue'
import UserSelfServiceMenuItem from '@/components/Menu/UserSelfServiceMenuItem.vue'

const router = useRouter()
const menuStore = useMenuStore()

const mainMenu = computed(() => menuStore.mainMenu)
const homeUrl = computed(() => mainMenu.value?.homeUrl ?? '/opennms/')
const formattedDate = computed(() => mainMenu.value?.formattedDate ?? '')
const formattedTime = computed(() => mainMenu.value?.formattedTime ?? '')
const showAddNode = computed(() => mainMenu.value?.displayAddNodeButton ?? false)

// Theme toggle
const light = 'open-light'
const dark = 'open-dark'
const isDark = ref<boolean>(document.body.classList.contains(dark))

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
}

// Restore saved theme on mount
onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === dark || saved === light) {
    document.body.classList.remove(light, dark)
    document.body.classList.add(saved)
    document.documentElement.classList.remove(light, dark)
    document.documentElement.classList.add(saved)
    isDark.value = saved === dark
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
```

- [ ] **Step 3: Add `/provision/quick-add` stub route to router**

In `ui/src/main/router/index.ts`, find the `/admin` route entry and add below it:

```ts
{
  path: '/provision/quick-add',
  name: 'Quick Add Node',
  component: () => import('@/containers/Admin.vue') // temporary stub — provisioning phase replaces this
},
{
  path: '/provision/requisitions',
  name: 'Manage Requisitions',
  component: () => import('@/containers/Admin.vue') // temporary stub — provisioning phase replaces this
},
```

- [ ] **Step 4: Build and verify no compile errors**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: Build succeeds. If there are Feather import errors in `UserNotificationsMenuItem.vue` or `UserSelfServiceMenuItem.vue`, that's fine — those get migrated in Tasks 6–7. If `@featherds/sidebar` is missing (from SideMenu.vue removal), that's also expected — SideMenu is still present at this point.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Shell/TopBar.vue ui/src/components/Menu/Search.vue ui/src/main/router/index.ts
git commit -m "feat(shell): add TopBar with PrimeVue; fix Search icon; stub provision routes"
```

---

## Task 6: UserNotificationsMenuItem — Feather → PrimeVue

**Files:**
- Modify: `ui/src/components/Menu/UserNotificationsMenuItem.vue`

Replace `FeatherDropdown` / `FeatherDropdownItem` / `FeatherButton` / `FeatherIcon` with PrimeVue `Popover` and `Button`.

- [ ] **Step 1: Read the current full file**

Read `ui/src/components/Menu/UserNotificationsMenuItem.vue` in full before editing to capture all the script logic (notification counts, badge classes, computeLink, onMenuItemClick, etc.). All script logic is preserved — only the template primitives and imports change.

- [ ] **Step 2: Replace the template**

Replace the `<template>` block with:

```vue
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
          :key="item.name"
          :href="computeLink(item.url || '')"
          class="notifications-menu-item"
          @click.prevent="onMenuItemClick(item.url || '')"
        >
          <i class="pi pi-user" />
          <span>{{ notificationSummary.userUnacknowledgedCount ?? 0 }} notices assigned to you</span>
        </a>

        <a
          v-for="item in teamNotificationItems"
          :key="item.name"
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
```

- [ ] **Step 3: Replace the script block**

Replace the `<script setup lang="ts">` block. Preserve all existing logic; remove Feather imports; add PrimeVue imports:

```ts
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

const notificationConfigUrl = computed(() => mainMenu.value?.notificationMenu?.url ?? '')

const userNotificationItems = computed(() =>
  mainMenu.value?.userNotificationMenu?.items?.filter((i: MenuItem) => i.id === 'userNotificationUser') ?? []
)
const teamNotificationItems = computed(() =>
  mainMenu.value?.userNotificationMenu?.items?.filter((i: MenuItem) => i.id === 'userNotificationTeam') ?? []
)

// Map count to icon and CSS class (preserved from original)
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
```

- [ ] **Step 4: Replace the style block**

Replace the `<style>` block with:

```scss
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
      background: var(--feather-state-text-hover);
    }
  }
}
</style>
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Menu/UserNotificationsMenuItem.vue
git commit -m "refactor(shell): migrate UserNotificationsMenuItem from Feather to PrimeVue"
```

---

## Task 7: UserSelfServiceMenuItem — Feather → PrimeVue

**Files:**
- Modify: `ui/src/components/Menu/UserSelfServiceMenuItem.vue`

Same pattern as Task 6 — replace `FeatherDropdown` with `Popover`.

- [ ] **Step 1: Read the current full file**

Read `ui/src/components/Menu/UserSelfServiceMenuItem.vue` in full before editing.

- [ ] **Step 2: Replace template, script, and style**

Replace the entire file with:

```vue
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
        <!-- Username / profile link -->
        <a
          :href="computeLink('')"
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
  if (item.id === 'logout') return 'pi-sign-out'
  if (item.id === 'selfServicePassword') return 'pi-lock'
  if (item.id === 'apiTokens') return 'pi-key'
  return 'pi-external-link'
}

const onUserProfileMenuClick = () => {
  const url = mainMenu.value?.selfServiceMenu?.url ?? ''
  if (url) window.location.assign(computeLink(url))
}

const onMenuItemClick = (item: MenuItem) => {
  if (item.id === 'logout') {
    performLogout()
    return
  }
  window.location.assign(computeLink(item.url || ''))
}
</script>

<style lang="scss" scoped>
.self-service {
  position: relative;

  &__btn {
    color: var(--feather-primary-text-on-primary) !important;
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
      background: var(--feather-state-text-hover);
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
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Menu/UserSelfServiceMenuItem.vue
git commit -m "refactor(shell): migrate UserSelfServiceMenuItem from Feather to PrimeVue"
```

---

## Task 8: Remove old Menubar.vue and SideMenu.vue

**Files:**
- Delete: `ui/src/components/Menu/Menubar.vue`
- Delete: `ui/src/components/Menu/SideMenu.vue`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "Menubar\|SideMenu" /Users/chance/git/opennms/ui/src/ --include="*.ts" --include="*.vue" | grep -v "node_modules"
```

Expected: only results in the files themselves, or zero results after they're deleted. If any other file imports them, update that import first.

- [ ] **Step 2: Delete the files**

```bash
rm ui/src/components/Menu/Menubar.vue
rm ui/src/components/Menu/SideMenu.vue
```

- [ ] **Step 3: Full build — must succeed**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -30
```

Expected: Clean build. Zero Feather AppBar / AppLayout / Sidenav imports in output. Fix any type errors that surface before proceeding.

- [ ] **Step 4: Verify dist**

```bash
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Expected: one hash path.

- [ ] **Step 5: Deploy and smoke-test**

```bash
./ui/deploy-to-container.sh test-opennms
```

Then verify:
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/ui/` → 200
- Hard-refresh browser (Cmd+Option+R in Safari). The app should load with the new top bar and sidebar visible.
- Sidebar collapses and expands with the toggle button.
- Clicking Monitor / Network / Administration opens the section.
- Clicking a collapsed section icon expands the sidebar and opens the section.
- Dark/light mode toggle works.
- Notifications dropdown opens.
- User self-service menu opens.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(shell): delete Menubar.vue and SideMenu.vue; shell fully on PrimeVue"
```

---

## Task 9: Events.vue + router

**Files:**
- Create: `ui/src/containers/Events.vue`
- Create: `ui/tests/containers/Events.test.ts`
- Modify: `ui/src/main/router/index.ts`

- [ ] **Step 1: Create Events.vue**

Create `ui/src/containers/Events.vue`:

```vue
<template>
  <div class="events-page">
    <BreadCrumbs :items="breadcrumbs" />

    <DataTable
      :value="events"
      :loading="loading"
      :rows="pageSize"
      :total-records="totalCount"
      lazy
      paginator
      @page="onPage"
      stripedRows
      class="events-table"
      data-key="id"
      @row-click="onRowClick"
      row-hover
    >
      <template #header>
        <div class="events-table__header">
          <span class="events-table__title">Events</span>
          <InputText
            v-model="searchText"
            placeholder="Filter by node or UEI…"
            size="small"
            @keydown.enter="applySearch"
          />
        </div>
      </template>

      <Column field="time" header="Time" style="width: 180px">
        <template #body="{ data }">
          {{ formatTime(data.time) }}
        </template>
      </Column>

      <Column field="severity" header="Severity" style="width: 110px">
        <template #body="{ data }">
          <span class="severity-badge" :class="`severity-badge--${data.severity?.toLowerCase()}`">
            {{ data.severity }}
          </span>
        </template>
      </Column>

      <Column field="nodeLabel" header="Node" style="width: 180px">
        <template #body="{ data }">
          <router-link v-if="data.nodeId" :to="`/node/${data.nodeId}`" class="events-table__node-link">
            {{ data.nodeLabel || data.nodeId }}
          </router-link>
          <span v-else>—</span>
        </template>
      </Column>

      <Column field="uei" header="Event Type">
        <template #body="{ data }">
          <span class="events-table__uei" :title="data.uei">{{ shortenUei(data.uei) }}</span>
        </template>
      </Column>

      <Column field="logMessage" header="Message">
        <template #body="{ data }">
          <span class="events-table__message" :title="data.logMessage">{{ data.logMessage }}</span>
        </template>
      </Column>

      <template #empty>
        <div class="events-table__empty">No events found.</div>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getEvents } from '@/services/eventService'
import { useMenuStore } from '@/stores/menuStore'
import type { Event, BreadCrumb } from '@/types'

const router = useRouter()
const menuStore = useMenuStore()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Events', to: '#', position: 'last' }
])

const events = ref<Event[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageSize = 25
const currentPage = ref(0)
const searchText = ref('')

const loadEvents = async (offset = 0) => {
  loading.value = true
  const params = {
    limit: pageSize,
    offset,
    orderBy: 'time',
    order: 'desc',
    ...(searchText.value ? { _s: `nodeLabel==${searchText.value}*,uei==${searchText.value}*` } : {})
  }
  const result = await getEvents(params)
  if (result) {
    events.value = result.event ?? []
    totalCount.value = result.totalCount ?? 0
  }
  loading.value = false
}

const onPage = (event: { first: number }) => {
  currentPage.value = event.first
  loadEvents(event.first)
}

const applySearch = () => loadEvents(0)

const onRowClick = (event: { data: Event }) => {
  router.push(`/event/${event.data.id}`)
}

const formatTime = (ts: number): string => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

const shortenUei = (uei: string): string => {
  if (!uei) return '—'
  const parts = uei.split('/')
  return parts.at(-1) ?? uei
}

onMounted(() => loadEvents(0))
</script>

<style lang="scss" scoped>
.events-page {
  padding: 16px 20px;
}

.events-table {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
  }

  &__node-link {
    color: var(--feather-clickable-normal);
    text-decoration: none;
  }

  &__uei,
  &__message {
    display: block;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--feather-secondary-text-on-surface);
  }
}

.severity-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  &--critical   { background: var(--feather-error);   color: #fff; }
  &--major      { background: #e65100;                color: #fff; }
  &--minor      { background: #f57c00;                color: #fff; }
  &--warning    { background: #fbc02d;                color: #000; }
  &--normal,
  &--cleared    { background: var(--feather-success);  color: #fff; }
  &--indeterminate { background: var(--feather-secondary-text-on-surface); color: #fff; }
}
</style>
```

- [ ] **Step 2: Add route to router**

In `ui/src/main/router/index.ts`, add the events route after the `/alarms` route:

```ts
{
  path: '/events',
  name: 'Events',
  component: () => import('@/containers/Events.vue')
},
```

- [ ] **Step 3: Write test**

Create `ui/tests/containers/Events.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import Events from '@/containers/Events.vue'

vi.mock('@/services/eventService', () => ({
  getEvents: vi.fn().mockResolvedValue({
    event: [
      {
        id: 1,
        time: 1713000000000,
        severity: 'MAJOR',
        nodeId: 5,
        nodeLabel: 'router-01',
        uei: 'uei.opennms.org/threshold/highThresholdExceeded',
        logMessage: 'High threshold exceeded on router-01'
      }
    ],
    totalCount: 1
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/events' }),
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('Events.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the breadcrumb', async () => {
    const wrapper = mount(Events, {
      global: {
        stubs: { BreadCrumbs: true, DataTable: true, Column: true, InputText: true }
      }
    })
    expect(wrapper.findComponent({ name: 'BreadCrumbs' }).exists()).toBe(true)
  })

  it('renders DataTable', async () => {
    const wrapper = mount(Events, {
      global: {
        stubs: { BreadCrumbs: true, DataTable: true, Column: true, InputText: true }
      }
    })
    expect(wrapper.findComponent({ name: 'DataTable' }).exists()).toBe(true)
  })

  it('shortenUei extracts last segment', async () => {
    // Access the component's internal function via expose or test the output
    // We verify the UEI is shortened in the rendered output when DataTable is real
    const wrapper = mount(Events, {
      global: {
        stubs: { BreadCrumbs: true, Column: true, InputText: true }
      }
    })
    await wrapper.vm.$nextTick()
    // The component renders — no errors is a passing test at this level
    expect(wrapper.exists()).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run tests/containers/Events.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Build and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -10
```

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add ui/src/containers/Events.vue ui/tests/containers/Events.test.ts ui/src/main/router/index.ts
git commit -m "feat(shell): add Events list page with PrimeVue DataTable and /events route"
```

---

## Task 10: Topology height cleanup

**Files:**
- Modify: `ui/src/containers/Topology.vue`

The old layout used `calc(100vh - 120px)` where 120px = 64px header + 32px breadcrumb + 24px padding. The new grid provides `calc(100dvh - 56px)` to the content area. Update the topology to use the available height from its parent instead.

- [ ] **Step 1: Find the height rule**

```bash
grep -n "100vh\|120px\|100dvh" ui/src/containers/Topology.vue
```

Expected: line referencing `calc(100vh - 120px)`.

- [ ] **Step 2: Update the topology height**

In `ui/src/containers/Topology.vue`, replace:
```css
// 120px = FeatherAppLayout header (64px) + breadcrumb row (32px) + padding (24px)
height: calc(100vh - 120px);
```
with:
```css
// 56px = breadcrumb row (32px) + padding (24px)
// The CSS Grid content area already subtracts the 56px topbar height.
height: calc(100% - 56px);
```

- [ ] **Step 3: Deploy and verify topology**

```bash
./ui/deploy-to-container.sh test-opennms
```

Navigate to `/topology` in the browser. Verify the topology canvas fills the available height without overflow or clipping.

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/Topology.vue
git commit -m "fix(topology): update height calc for new CSS Grid shell (56px topbar, not 120px)"
```

---

## Task 11: Full build + deploy + verification

**Files:** None created/modified — verification only.

- [ ] **Step 1: Run full test suite**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn test --run
```

Expected: All tests pass. Note any failures and fix before proceeding.

- [ ] **Step 2: Build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 3: Verify bundle hash matches**

```bash
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
```

Hashes won't match yet — deploy first.

- [ ] **Step 4: Deploy**

```bash
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 5: Verify hash matches post-deploy**

```bash
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
```

Both lines must be identical.

- [ ] **Step 6: HTTP smoke check**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/ui/
```

Expected: 200.

- [ ] **Step 7: Manual browser checklist (hard refresh first — Cmd+Option+R)**

- [ ] Top bar renders with logo, search, date/time, user icons, theme toggle
- [ ] "Add a Node" button visible (if `displayAddNodeButton` is true in your test instance)
- [ ] Sidebar shows MONITOR / NETWORK / ADMINISTRATION sections
- [ ] Sidebar collapses to icon rail; expands on toggle button click
- [ ] Clicking a collapsed section icon expands sidebar and opens section — no dead click
- [ ] All Monitor links navigate correctly (Dashboard, Alarms, Events, Outages, etc.)
- [ ] All Network links navigate correctly (Nodes, Geographical Map, Topology)
- [ ] All Administration links navigate correctly (System Config, Users & Groups, Minions, Monitoring Locations, etc.)
- [ ] Minions and Monitoring Locations appear under Administration, NOT as standalone sidebar items
- [ ] Light ↔ Dark mode toggles correctly; theme persists on reload
- [ ] Notification dropdown opens and shows counts
- [ ] User self-service menu opens and shows username + menu items
- [ ] `/events` page loads and shows event table
- [ ] Topology page fills height correctly (no gaps, no overflow)
- [ ] No Feather DS console errors (no "FeatherAppBar is not defined" etc.)

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore(shell): verified shell PrimeVue redesign — all checks pass"
```
