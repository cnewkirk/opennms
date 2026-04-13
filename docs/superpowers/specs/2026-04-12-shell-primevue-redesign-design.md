# Shell PrimeVue Redesign — Design Spec

**Date:** 2026-04-12
**Branch:** `feat/ui-refactor`
**Phase:** App Shell (Phase A of full Feather → PrimeVue migration)

---

## Goal

Replace the Feather DS app shell — `FeatherAppBar`, `FeatherAppLayout`, `Menubar.vue`, and `SideMenu.vue` — with a PrimeVue-based layout. This fixes three concrete UX problems (sidebar too wide, collapsed-mode dead clicks, scattered admin nav) while modernizing the underpinnings for all future work.

PrimeVue 4 with the Aura preset is already installed (`ecce896fb8a`) with a CSS bridge (`primevue-theme-bridge.scss`) that maps PrimeVue tokens to existing `--feather-*` CSS variables for automatic dark/light mode support.

---

## Context

The current shell uses:
- `FeatherAppBar` — top bar (logo, search, Add a Node, user menus, date/time, dark mode toggle)
- `FeatherAppLayout` — sidebar + content area layout; tightly coupled to the top bar
- `Menubar.vue` — wraps `FeatherAppBar`; owns the top bar interaction logic
- `SideMenu.vue` — wraps Feather sidebar components; owns nav items and `legacyToVueRoutes`

Pain points:
1. Sidebar is ~220px wide when expanded — more than needed
2. In collapsed mode, clicking a parent icon with sub-items does nothing
3. Distributed Monitoring (Minions, Monitoring Locations) is not under Administration
4. Config-related items scattered across sidebar sections with no clear grouping

---

## Layout Architecture

Replace the Feather layout with a CSS Grid owned by `App.vue`:

```
┌──────────────────────────────────────────┐
│  TopBar.vue  (full width, 56px tall)     │
├────────┬─────────────────────────────────┤
│ Side   │                                 │
│ Nav    │   <router-view />               │
│ .vue   │                                 │
│56-180px│                                 │
└────────┴─────────────────────────────────┘
```

**`App.vue` grid:**
```css
display: grid;
grid-template-rows: 56px 1fr;
grid-template-columns: var(--sidebar-width) 1fr;
height: 100dvh;
overflow: hidden;
```

`--sidebar-width` transitions between `56px` (collapsed) and `180px` (expanded) via:
```css
transition: width 200ms ease;
```

The top bar spans both columns (`grid-column: 1 / -1`). The content area (`<router-view />`) receives `height: calc(100dvh - 56px); overflow: hidden` — this resolves the topology height chain problem cleanly without the `calc(100dvh - 64px)` workaround in the topology component.

**Files deleted:**
- All `@featherds/app-bar`, `@featherds/app-layout` imports
- Feather DS layout wrappers from `App.vue`

---

## TopBar.vue

Replaces `Menubar.vue`. Thin orchestration component — delegates to sub-components.

**Layout (left → right):**
- Left: Logo (`<img>` or inline SVG) linking to home
- Center: `GlobalSearch.vue` (migrated off Feather inputs), "Add a Node" PrimeVue `Button`
- Right: Date/time display, `UserNotificationsMenu.vue`, `UserSelfServiceMenu.vue`, dark/light mode toggle icon

**PrimeVue components used:**
| Old (Feather) | New (PrimeVue) |
|---|---|
| `FeatherButton` | `Button` (PrimeVue) |
| `FeatherIcon` | PrimeVue icons or inline SVG |
| Feather dropdown overlays | `Popover` / `OverlayPanel` |
| Feather search input | `InputText` |

**"Add a Node" button:** Navigation target changes from `window.location.assign(provisionMenu.url)` (AngularJS JSP) to `router.push('/provision/quick-add')`. The route is stubbed in this phase; provisioning implementation is a separate phase.

**Sub-components migrated in this phase:**
- `UserNotificationsMenu.vue` — remove Feather imports, use PrimeVue `Popover` + `Button`
- `UserSelfServiceMenu.vue` — same pattern

**Sub-components deferred:**
- `GlobalSearch.vue` — internal search logic unchanged; only the input primitive is swapped

---

## SideNav.vue

Replaces `SideMenu.vue`. Owns nav structure, collapse state, and active route highlighting.

**Dimensions:**
- Expanded: `180px` (down from ~220px)
- Collapsed: `56px` (icon rail)
- Toggle button pinned to bottom of the rail

**Collapse behavior:**
- State persisted to `localStorage` key `onms.sidenav.collapsed`
- In **collapsed** mode: clicking a section icon expands the sidebar and opens that section — no dead clicks
- In **expanded** mode: standard accordion (one section open at a time)
- Item labels show PrimeVue `Tooltip` on hover when in collapsed/icon-only mode

**PrimeVue component:** `PanelMenu` drives the accordion sections. Active route highlighted via Vue Router's `useRoute()` — matched against each item's `to` prop.

**`legacyToVueRoutes`:** The intercept map moves from `SideMenu.vue` into a standalone `src/utils/legacyRoutes.ts` so it can be imported by both the router and the nav component without circular deps.

---

## Navigation Structure

Complete reorganization. Items under each section link to Vue SPA routes only — no `href` JSP links at the nav level (legacy JSP links remain in Admin.vue's card grid until those pages are replaced in subsequent phases).

```
MONITOR
  Dashboard             → /dashboard
  Alarms                → /alarms
  Outages               → /outages
  Surveillance Dashboard → /surveillance-dashboard
  Resource Graphs       → /resource-graphs

NETWORK
  Nodes                 → /nodes
  Geographical Map      → /map
  Topology              → /topology

ADMINISTRATION
  Provisioning
    Manage Requisitions       → /provision/requisitions  (stub; provisioning phase)
    External Requisitions     → /configuration
    Secure Credentials Vault  → /scv
  System
    System Configuration      → /system-config
    Users & Groups            → /users-groups
    Monitoring Locations      → /monitoring-locations
    Minions                   → /minions
  Monitoring Config
    Scheduled Outages         → /scheduled-outages
    Discovery                 → /discovery-config
    SNMP by IP                → /snmp-config
    SNMP Collections          → /snmp-collections-config
    Thresholds                → /threshold-config
  Notifications
    Notification Rules        → /notification-config/rules
    Destination Paths         → /notification-config/paths
    Event Configurations      → /event-config
  Tools
    JMX Config Generator      → /jmx-config-generator
    MIB Compiler              → /mib-compiler
    File Editor               → /file-editor
    BSM Admin                 → /bsm-admin
    Wallboard Config          → /wallboard-config
    Surveillance Views Config → /surveillance-views-config
    Usage Statistics          → /usage-statistics
    Device Config Backup      → /device-config-backup
    Flow Classification       → (legacy href until JSP phase)
    Open API                  → /open-api
```

**Nav architecture — hybrid model:**
The current sidebar is fully data-driven from the backend menu REST API (`menuStore.mainMenu`). The new `SideNav.vue` uses a **hardcoded core structure** for the three known sections (MONITOR, NETWORK, ADMINISTRATION) and appends any server-provided plugin items from `menuStore.mainMenu` below as a "Plugins" section. Role/feature guards (`zenithEnabled`, `dcbRole`, `adminRole`, etc.) remain identical to today. This eliminates the `legacyToVueRoutes` intercept map for core items — all core nav links are direct Vue route refs.

**Changes from current structure:**
- `Minions` and `Monitoring Locations` removed from top-level; now under Administration → System
- `Geographical Map` (was "Map") — label clarified
- `Administration` section replaces the old flat "Admin" items
- ZenithConnect: shown under Administration only when `zenithConnectEnabled` is true (same guard as today)
- DCB: shown only when `dcbRole` is active (same guard as today)

---

## Feather DS Removal Scope (This Phase)

This phase removes Feather DS from the **shell only**. Page-level components (tables, forms, cards inside `<router-view>`) are migrated in subsequent phases.

**Removed in this phase:**
- `@featherds/app-bar` — `FeatherAppBar`, `FeatherAppBarLink`
- `@featherds/app-layout` — `FeatherAppLayout`
- `@featherds/button` — `FeatherButton` (in TopBar only)
- `@featherds/icon` — `FeatherIcon` (in TopBar only; page-level uses deferred)
- `@featherds/composables/events/OutsideClick` — replaced by PrimeVue Popover's built-in dismiss

**Kept (deferred to content phase):**
- All Feather DS usage inside page containers and components under `ui/src/components/` and `ui/src/containers/`
- Feather CSS variables (`--feather-*`) — kept as the source of truth; PrimeVue tokens bridge to them

---

## Dark / Light Mode

The existing toggle logic in `Menubar.vue` (adding `open-dark` / `open-light` classes to `document.body`) moves unchanged into `TopBar.vue`. The early-paint FOUC prevention script (`<head>` inline script) is untouched.

---

## Files Affected

**Deleted:**
- `ui/src/components/Menu/Menubar.vue` (replaced by `TopBar.vue`)
- `ui/src/components/Menu/SideMenu.vue` (replaced by `SideNav.vue`)

**Created:**
- `ui/src/components/Shell/TopBar.vue`
- `ui/src/components/Shell/SideNav.vue`
- `ui/src/utils/legacyRoutes.ts` (extracted from SideMenu.vue)

**Modified:**
- `ui/src/App.vue` — swap layout; import `TopBar.vue` + `SideNav.vue`
- `ui/src/components/Menu/UserNotificationsMenuItem.vue` — Feather → PrimeVue primitives
- `ui/src/components/Menu/UserSelfServiceMenuItem.vue` — Feather → PrimeVue primitives
- `ui/src/components/Menu/Search.vue` — swap Feather input for PrimeVue `InputText`
- `ui/src/main/router/index.ts` — add `/provision/quick-add` stub route

---

## Completion Criteria

1. `FeatherAppBar`, `FeatherAppLayout` have zero imports in the codebase
2. Sidebar expanded width ≤ 180px; collapsed width = 56px
3. Clicking any collapsed-mode parent icon expands the sidebar and reveals children — no dead clicks
4. Minions and Monitoring Locations are under Administration → System in the nav
5. "Geographical Map" label in nav
6. "Add a Node" button navigates to `/provision/quick-add` (stub page acceptable)
7. Dark/light mode toggle works correctly
8. All existing Vue routes remain navigable
9. Topology page height fills correctly without the `calc(100dvh - 64px)` workaround
10. Tested in both light and dark mode
