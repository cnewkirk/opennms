---
date: 2026-04-06
branch: feature/jmx-config-vue
status: Approved
---

# Wallboard (Ops Board) Config — Vue Migration Design

## Goal

Replace `admin/wallboardConfig.jsp` (Vaadin iframe) with a Vue SPA editor at
`#/wallboard-config`. The JSP becomes a redirect. No Spring/servlet changes.

## Approach

Load-edit-save: one `GET` loads the full config into Vue reactive state; one `PUT` replaces
it on save. Vue owns all in-memory editing. Admin-only (403 for non-admins).

---

## Backend

### JAXB Model Classes

The existing `Wallboard`/`Wallboards`/`DashletSpec` JAXB classes live in
`features/vaadin-dashboard` — outside the `opennms-webapp-rest` classpath. Rather than
adding a cross-module dependency to a Karaf feature, we define lightweight JAXB DTOs
directly in the REST webapp, same pattern as `org.opennms.web.rest.support.jmxconfig`.

**Package:** `org.opennms.web.rest.support.wallboardconfig`

**Classes:**
- `WallboardsConfig` — `@XmlRootElement(name="wallboards")`, holds `List<WallboardEntry>`
- `WallboardEntry` — `@XmlElement(name="wallboard")`, holds `title`, `default`, `List<DashletEntry>`
- `DashletEntry` — `@XmlElement(name="dashlet")`, holds `dashletName`, `title`, `duration`,
  `priority`, `boostDuration`, `boostPriority`, `Map<String,String> parameters`

These mirror the existing Vaadin model's XML structure so existing `dashboard-config.xml`
files unmarshal correctly without schema changes.

### REST Resource

**File:** `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/WallboardConfigRestService.java`

- `@Path("wallboard-config")`
- `@Component`, picked up by existing component-scan on `org.opennms.web.rest.v2`
- Reads/writes `$OPENNMS_HOME/etc/dashboard-config.xml` directly via `JaxbUtils.unmarshal`
  / `JaxbUtils.marshal`, same pattern as `JmxConfigResource`
- Admin gate: `securityContext.isUserInRole(Authentication.ROLE_ADMIN)` → 403 if not admin
- `opennms.home` system property used for file path; defaults to `/opt/opennms`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v2/wallboard-config` | Returns full config as JSON |
| `PUT` | `/api/v2/wallboard-config` | Replaces full config; returns 204 |

**GET behavior:** If `dashboard-config.xml` does not exist, returns `{ "wallboards": [] }`
(empty config) rather than 404 — first-time setup case.

**JSON shape:**

```json
{
  "wallboards": [
    {
      "title": "Main Board",
      "default": true,
      "dashlets": [
        {
          "dashletName": "Alarms",
          "title": "Active Alarms",
          "duration": 15,
          "priority": 5,
          "boostDuration": 0,
          "boostPriority": 0,
          "parameters": {
            "severity": "WARNING"
          }
        }
      ]
    }
  ]
}
```

**PUT behavior:** Validates that at most one wallboard has `default: true` (returns 400
otherwise). Writes file atomically (write to temp, then rename). Returns 204 on success.

### Component Scan

`WallboardConfigRestService` and the `wallboardconfig` support package are already covered
by the existing component-scan entry in `applicationContext-cxf-rest-v2.xml`:
```xml
<context:component-scan base-package="org.opennms.web.rest.v2,
    org.opennms.web.rest.support.jmxconfig, org.opennms.web.rest.support.mibcompiler" />
```
Add `org.opennms.web.rest.support.wallboardconfig` to this list.

---

## Frontend

### TypeScript Types

```ts
interface DashletEntry {
  dashletName: string
  title: string
  duration: number
  priority: number
  boostDuration: number
  boostPriority: number
  parameters: Record<string, string>
}

interface WallboardEntry {
  title: string
  default: boolean
  dashlets: DashletEntry[]
}

interface WallboardConfig {
  wallboards: WallboardEntry[]
}
```

### Dashlet Types Constant

```ts
export const DASHLET_TYPES = [
  'Alarms', 'BSM', 'Map', 'Summary', 'RTC', 'Topology', 'Charts', 'Undefined'
] as const
```

Parameters are free-form key-value pairs — no per-type schema enforcement in the UI,
consistent with how the Vaadin version worked.

### Service

**File:** `ui/src/services/wallboardConfigService.ts`

```ts
import { rest } from './axiosInstances'

const BASE = 'wallboard-config'

export const getConfig = (): Promise<WallboardConfig> =>
  rest.get(BASE).then(r => r.data)

export const saveConfig = (config: WallboardConfig): Promise<void> =>
  rest.put(BASE, config).then(() => undefined)
```

### Vue Components

```
ui/src/containers/WallboardConfig.vue               ← route component
ui/src/components/WallboardConfig/
  WallboardList.vue                                 ← left panel: list of wallboards
  WallboardEditor.vue                               ← right panel: dashlet list
  DashletRow.vue                                    ← single dashlet (collapsed/expanded)
  ParametersTable.vue                               ← key-value editor for parameters
```

**Container (`WallboardConfig.vue`):**
- Loads config on mount; shows spinner while loading
- Reactive `config` ref (deep clone of loaded data)
- Tracks `selectedIndex` (defaults to 0)
- `isDirty` computed — true when `config` differs from loaded snapshot
- Save button calls `saveConfig(config)`, shows snackbar on success/failure
- Breadcrumb: Admin → Ops Board Config

**Left panel (`WallboardList.vue`):**
- Lists wallboard titles; highlights selected; "default" badge if `wallboard.default`
- New Wallboard button — appends `{ title: 'New Board', default: false, dashlets: [] }`, selects it
- Delete button per row — removes wallboard; if deleted was default, no auto-promote (user must set a new default)
- Disabled during save

**Right panel (`WallboardEditor.vue`):**
- Title input
- "Set as Default" checkbox — toggling on clears `default` from all other wallboards
- Ordered list of `DashletRow` components (one per dashlet)
- "Add Dashlet" button — appends a dashlet with `dashletName: 'Alarms'` and default numeric values

**Dashlet row (`DashletRow.vue`):**
- Collapsed: shows `dashletName` type badge + title text, up/down arrows, delete button
- Expanded: full form with:
  - Dashlet type `<select>` (options from `DASHLET_TYPES`)
  - Title text input
  - Duration, Priority, Boost Duration, Boost Priority number inputs (min: 0)
  - `ParametersTable` component

**Parameters table (`ParametersTable.vue`):**
- Renders `Map<string,string>` as a two-column editable table (key | value)
- Add row button (appends `{ key: '', value: '' }`)
- Delete button per row
- Emits `update:modelValue` on any change (v-model compatible)

### Router

**File:** `ui/src/main/router/index.ts`

```ts
{
  path: '/wallboard-config',
  component: () => import('@/containers/WallboardConfig.vue')
}
```

### JSP Redirect

**File:** `opennms-webapp/src/main/webapp/admin/wallboardConfig.jsp`

Replace the Vaadin iframe contents with:
```java
response.sendRedirect(request.getContextPath() + "/ui/index.html#/wallboard-config");
```

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/WallboardConfigRestService.java` |
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/WallboardsConfig.java` |
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/WallboardEntry.java` |
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/DashletEntry.java` |
| **Create** | `ui/src/services/wallboardConfigService.ts` |
| **Create** | `ui/src/containers/WallboardConfig.vue` |
| **Create** | `ui/src/components/WallboardConfig/WallboardList.vue` |
| **Create** | `ui/src/components/WallboardConfig/WallboardEditor.vue` |
| **Create** | `ui/src/components/WallboardConfig/DashletRow.vue` |
| **Create** | `ui/src/components/WallboardConfig/ParametersTable.vue` |
| **Modify** | `ui/src/main/router/index.ts` — add route |
| **Modify** | `opennms-webapp/src/main/webapp/admin/wallboardConfig.jsp` — redirect |
| **Modify** | `opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml` — add wallboardconfig to component-scan |

---

## Error Handling

- Load failure: inline error + retry button
- Save failure: snackbar with error message; config stays editable
- 400 from PUT (multiple defaults): surface error message

## Security

- GET and PUT both require `ROLE_ADMIN`. Backend enforces independently of the menu link.

## Notes

- The `dashboard-config.xml` file may not exist on fresh installs. GET handles this by
  returning `{ "wallboards": [] }` rather than 404.
- Dashlet parameter schemas are not validated by the Vue UI — they are passed through
  as-is to the XML. This matches existing Vaadin behavior.
- The wallboard display runtime (the live slideshow at `vaadin-wallboard`) is out of scope.
  This spec covers only the configuration editor.
