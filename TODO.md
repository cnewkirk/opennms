# Flow Classification — Vue SPA Replacement

**Branch:** `feat/ui-refactor`
**JSP being replaced:** `admin/classification/index.jsp`
**Vue route:** `/flow-classification`
**Container:** `ui/src/containers/FlowClassification.vue`

---

## What this page does

Flow classification maps raw network flows (IP/port combinations) to human-readable application names. Rules are organized into **groups**. There are two built-in groups:

- **pre-defined** (id: 1, readOnly: true) — 6,248 OpenNMS-supplied rules. View-only.
- **user-defined** (id: 2, readOnly: false) — User's custom rules. Full CRUD.

Users can also create additional custom groups.

---

## REST API

**Base path:** `/rest/classifications` — use the `rest` axios instance (NOT `v2`).

### Groups

```
GET    /rest/classifications/groups            → Group[]  (plain array, no envelope)
POST   /rest/classifications/groups            → create group
PUT    /rest/classifications/groups/{id}       → update group (name, description, enabled)
DELETE /rest/classifications/groups/{id}       → delete group
GET    /rest/classifications/groups/{id}       → single group (add ?filename=foo.csv for CSV export)
POST   /rest/classifications/groups/{id}       → import rules (CSV/JSON body)
```

### Rules

```
GET    /rest/classifications                   → Rule[] (plain array, uses Content-Range header for total)
GET    /rest/classifications/{id}              → single rule
POST   /rest/classifications                   → create rule
PUT    /rest/classifications/{id}              → update rule
DELETE /rest/classifications/{id}              → delete rule
DELETE /rest/classifications?groupId=N         → delete all rules in a group
GET    /rest/classifications/protocols         → Protocol[] (for dropdown)
POST   /rest/classifications/classify          → test classify a flow
```

### Key query params for rule listing

| Param | Purpose |
|---|---|
| `groupId` | Filter rules to a specific group |
| `limit` | Page size |
| `offset` | Page offset |
| `query` | Substring search across name, ports, addresses, protocols |

**Pagination:** The rules endpoint returns a plain JSON array (no `{ count, totalCount }` wrapper). Pagination uses the `Content-Range: items start-end/total` response header. Parse it to get total count.

Example:
```bash
curl "http://localhost:8980/opennms/rest/classifications?limit=25&offset=0&groupId=2"
# Response header: Content-Range: items 0-24/6248
```

### Verified shapes

**Group:**
```json
{
  "id": 2,
  "position": 0,
  "name": "user-defined",
  "description": "Classification rules defined by the user",
  "enabled": true,
  "readOnly": false,
  "ruleCount": 0
}
```

**Rule:**
```json
{
  "id": 2053,
  "name": "dt-vra",
  "dstAddress": null,
  "dstPort": "6326",
  "srcAddress": null,
  "srcPort": null,
  "exporterFilter": null,
  "omnidirectional": true,
  "group": { "id": 1, "name": "pre-defined", "readOnly": true, "ruleCount": 6248, ... },
  "position": 2051,
  "protocols": ["tcp"]
}
```

---

## Recommended UX Design

Two-panel layout:

### Left panel — Groups
- List all groups (typically 2–5)
- Each group shows: name, rule count, enabled toggle, readOnly badge
- "Add Group" button (for custom groups)
- Selecting a group loads its rules in the right panel

### Right panel — Rules for selected group
- If group is `readOnly: true`: searchable paginated read-only table (pre-defined has 6248 rules — MUST paginate, e.g. 25/page)
- If group is `readOnly: false`: full CRUD table + "Add Rule" button
- Search box (uses `query` param — searches name, ports, addresses, protocols)
- Columns: Name, Protocol(s), Dst Port, Dst Address, Src Port, Src Address, Exporter Filter, Omnidirectional

### Rule form (modal for add/edit)
Fields:
- Name (required)
- Protocol(s) — multi-select from `/rest/classifications/protocols` (use keyword field, e.g. "TCP", "UDP")
- Destination Port
- Destination Address
- Source Port
- Source Address
- Exporter Filter
- Omnidirectional (checkbox)
- Group (select — for which group this rule belongs to, defaults to selected group)

---

## Files to create/modify

### New files
- `ui/src/services/classificationService.ts`
- `ui/src/containers/FlowClassification.vue`

### Modified files
- `ui/src/types/index.ts` — add `ClassificationGroup`, `ClassificationRule`, `Protocol` interfaces
- `ui/src/main/router/index.ts` — add `/flow-classification` route with admin guard
- `ui/src/containers/Admin.vue` — change `href:` to `to:` for 'Manage Flow Classification'
- `ui/src/components/Menu/SideMenu.vue` — add `'admin/classification/index.jsp': 'ui/flow-classification'` to `legacyToVueRoutes`
- `opennms-webapp/src/main/webapp/admin/classification/index.jsp` — replace with redirect

### JSP redirect content
```jsp
<%@ page contentType="text/html" %>
<%
  response.sendRedirect(request.getContextPath() + "/ui/flow-classification");
%>
```

---

## classificationService.ts skeleton

```ts
import { rest } from './axiosInstances'

// Groups
export const getGroups = async (): Promise<ClassificationGroup[]>
export const createGroup = async (g: Partial<ClassificationGroup>): Promise<boolean>
export const updateGroup = async (id: number, g: Partial<ClassificationGroup>): Promise<boolean>
export const deleteGroup = async (id: number): Promise<boolean>

// Rules (pagination via Content-Range header)
export const getRules = async (params: {
  groupId?: number
  limit?: number
  offset?: number
  query?: string
}): Promise<{ rules: ClassificationRule[]; total: number }>

export const createRule = async (rule: Partial<ClassificationRule>): Promise<boolean>
export const updateRule = async (id: number, rule: Partial<ClassificationRule>): Promise<boolean>
export const deleteRule = async (id: number): Promise<boolean>
export const deleteAllRulesInGroup = async (groupId: number): Promise<boolean>

// Protocols (for dropdown)
export const getProtocols = async (): Promise<Protocol[]>
```

**Content-Range parsing:**
```ts
const range = resp.headers['content-range'] // e.g. "items 0-24/6248"
const total = parseInt(range?.split('/')[1] ?? '0', 10)
```

---

## Types to add to types/index.ts

```ts
export interface ClassificationGroup {
  id: number
  position: number
  name: string
  description: string
  enabled: boolean
  readOnly: boolean
  ruleCount: number
}

export interface ClassificationRule {
  id: number
  name: string
  dstAddress: string | null
  dstPort: string | null
  srcAddress: string | null
  srcPort: string | null
  exporterFilter: string | null
  omnidirectional: boolean
  group: ClassificationGroup
  position: number
  protocols: string[]
}

export interface Protocol {
  decimal: number
  keyword: string
  description: string
}
```

---

## Existing patterns to follow

- Admin page pattern: `DiscoveryConfig.vue` or `SnmpConfig.vue` (cards, feather-row/col layout)
- CRUD table: `MonitoringLocations.vue` (just built this session)
- Delete confirm + edit modal: `BusinessServicesAdmin.vue`
- Service file: `discoveryConfigService.ts`
- Breadcrumbs last item: `{ label: 'Flow Classification', to: '#', position: 'last' }`
- Router guard: copy the `adminRole` + `whenever(rolesAreLoaded, ...)` pattern exactly
- Snackbar: `import useSnackbar from '@/composables/useSnackbar'` (default import)
- FeatherDialog for modals: `import { FeatherDialog } from '@featherds/dialog'`

## Critical Feather DS rules
- `--feather-success-subtle` / `--feather-error-subtle` do NOT exist — use `rgba(var(--feather-success), 0.12)` pattern
- SCSS vars: always `var($surface)` not `$surface` (bare breaks dark mode)
- Import at top of every `<style lang="scss">`: `@import "@featherds/styles/themes/variables"`
- Only `body-large` and `body-small` typography mixins (NOT `body1`/`body2`)

## Build + deploy sequence
```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
# verify ui/src/main/dist/index.html has correct src paths
./ui/deploy-to-container.sh test-opennms
# verify hash matches: podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
# tell user to hard refresh: Cmd+Option+R (Safari) or Shift+reload (Chrome)
```

## Admin.vue link to update (find and change)
```ts
// Current (search for this):
{ label: 'Manage Flow Classification', href: baseHref.value + 'admin/classification/index.jsp' }

// Change to:
{ label: 'Manage Flow Classification', to: '/flow-classification' }
```
