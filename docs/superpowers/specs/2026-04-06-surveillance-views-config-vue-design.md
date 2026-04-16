---
date: 2026-04-06
branch: feature/jmx-config-vue
status: Approved
---

# Surveillance Views Config — Vue Migration Design

## Goal

Replace `admin/surveillanceViewsConfig.jsp` (Vaadin iframe) with a Vue SPA editor at
`#/surveillance-views-config`. The JSP becomes a redirect. No Spring/servlet changes.

## Approach

Load-edit-save: one `GET` loads the full config into Vue reactive state; one `PUT` replaces
it on save. Vue owns all in-memory editing. Admin-only (403 for non-admins).

---

## Backend

### REST Resource

**File:** `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestService.java`

- `@Path("surveillance-view-config")`
- `@Component`, picked up by existing component-scan on `org.opennms.web.rest.v2`
- Injects `SurveillanceViewConfigDao` (already a Spring bean in the webapp context via
  `opennms-dao` → `DefaultSurveillanceViewConfigDao`)
- Admin gate: `securityContext.isUserInRole(Authentication.ROLE_ADMIN)` → 403 if not admin

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v2/surveillance-view-config` | Returns full config as JSON |
| `PUT` | `/api/v2/surveillance-view-config` | Replaces full config; returns 204 |

**JSON DTO (response and request body):**

```json
{
  "defaultView": "default",
  "views": [
    {
      "name": "default",
      "refreshSeconds": 300,
      "rows": [
        { "label": "Routers", "categories": ["Routers", "Switches"] }
      ],
      "columns": [
        { "label": "PROD", "categories": ["Production"] },
        { "label": "TEST", "categories": ["Test"] }
      ]
    }
  ]
}
```

The resource maps between this DTO and the existing JAXB model
(`SurveillanceViewConfiguration`, `View`, `RowDef`, `ColumnDef`, `Category`) from
`opennms-config-model`. On PUT, validates that `defaultView` matches an existing view name
(returns 400 if not), then calls `dao.save(config)`.

### DAO Injection

`DefaultSurveillanceViewConfigDao` is already wired in the Spring app context. The REST
resource injects it with `@Autowired SurveillanceViewConfigDao surveillanceViewConfigDao`.

No new Spring XML needed — component-scan handles registration.

---

## Frontend

### TypeScript Types

```ts
interface SurveillanceViewRowOrColumn {
  label: string
  categories: string[]
}

interface SurveillanceView {
  name: string
  refreshSeconds: number
  rows: SurveillanceViewRowOrColumn[]
  columns: SurveillanceViewRowOrColumn[]
}

interface SurveillanceViewConfig {
  defaultView: string
  views: SurveillanceView[]
}
```

### Service

**File:** `ui/src/services/surveillanceViewConfigService.ts`

```ts
import { rest } from './axiosInstances'

const BASE = 'surveillance-view-config'

export const getConfig = (): Promise<SurveillanceViewConfig> =>
  rest.get(BASE).then(r => r.data)

export const saveConfig = (config: SurveillanceViewConfig): Promise<void> =>
  rest.put(BASE, config).then(() => undefined)
```

### Categories Lookup

Categories for the row/column multi-select come from the existing `GET /rest/categories`
endpoint (returns `{ category: [{ name, id, ... }] }`). Fetched once on mount and cached
in a local `ref<string[]>`.

### Vue Components

```
ui/src/containers/SurveillanceViewsConfig.vue          ← route component
ui/src/components/SurveillanceViewsConfig/
  SurveillanceViewList.vue                             ← left panel: list of views
  SurveillanceViewEditor.vue                           ← right panel: edit selected view
  SurveillanceViewRowColumnEditor.vue                  ← shared rows/columns list editor
```

**Container (`SurveillanceViewsConfig.vue`):**
- Loads config on mount; shows spinner while loading
- Reactive `config` ref (deep clone of loaded data)
- Tracks `selectedViewIndex` (defaults to 0)
- `isDirty` computed — true when `config` differs from loaded snapshot
- Save button calls `saveConfig(config)`, shows snackbar on success/failure
- Breadcrumb: Admin → Surveillance Views Config

**Left panel (`SurveillanceViewList.vue`):**
- Lists view names; highlights selected; "default" badge if `config.defaultView === view.name`
- New View button — appends a view with a generated name (`view-N`), selects it
- Delete button (per row) — removes view; if deleted was default, clears `defaultView`
- Disabled during save

**Right panel (`SurveillanceViewEditor.vue`):**
- View name input (blur → updates key in `config.views`)
- Refresh seconds number input (min: 30)
- "Set as Default" button — sets `config.defaultView = view.name`
- Two columns: **Rows** | **Columns**, each rendered by `SurveillanceViewRowColumnEditor`

**Row/Column editor (`SurveillanceViewRowColumnEditor.vue`):**
- List of `{ label, categories[] }` items
- Each item: label text input + FeatherSelect multi (populated from category list)
- Add item button (appends `{ label: '', categories: [] }`)
- Delete button per item

### Router

**File:** `ui/src/main/router/index.ts`

```ts
{
  path: '/surveillance-views-config',
  component: () => import('@/containers/SurveillanceViewsConfig.vue')
}
```

### JSP Redirect

**File:** `opennms-webapp/src/main/webapp/admin/surveillanceViewsConfig.jsp`

Replace the Vaadin iframe contents with:
```java
response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-views-config");
```

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestService.java` |
| **Create** | `ui/src/services/surveillanceViewConfigService.ts` |
| **Create** | `ui/src/containers/SurveillanceViewsConfig.vue` |
| **Create** | `ui/src/components/SurveillanceViewsConfig/SurveillanceViewList.vue` |
| **Create** | `ui/src/components/SurveillanceViewsConfig/SurveillanceViewEditor.vue` |
| **Create** | `ui/src/components/SurveillanceViewsConfig/SurveillanceViewRowColumnEditor.vue` |
| **Modify** | `ui/src/main/router/index.ts` — add route |
| **Modify** | `opennms-webapp/src/main/webapp/admin/surveillanceViewsConfig.jsp` — redirect |

---

## Error Handling

- Load failure: show inline error with retry button (no spinner indefinitely)
- Save failure: snackbar with error message; config stays editable
- 400 from PUT (invalid defaultView): surface error message from response body

## Security

- GET and PUT both require `ROLE_ADMIN`. The Vue page is only linked from Admin pages; the
  backend enforces the role independently.
