# SNMP Collections Config — Vue Replacement Design

**Date:** 2026-04-06
**Route:** `/snmp-collections-config`
**Replaces:** `admin/manageSnmpCollections.jsp` (Vaadin iframe to `admin/admin-snmp-collections`)

---

## Context

The Vaadin SNMP Collections admin app has two tabs:

1. **SNMP Collections** — CRUD for entries in `datacollection-config.xml` (the root config: collection name, storage flag, RRD schedule, and which group files each collection includes)
2. **Data Collection Groups** — manages individual XML files in `etc/datacollection/` (84 files in a standard install: resource types, MIB groups with OIDs, system definitions)

Rather than reproducing the Vaadin form-per-field approach, this replacement uses an **XML editor** for group files (the dominant use case) and a clean form UI for SNMP Collections. Both tabs are modern, Feather DS-consistent, and admin-only.

---

## REST API — New Java Endpoints

Two new resource classes in `opennms-webapp-rest`, deployed via the overlay JAR (`opennms-webapp-rest-35.0.4.jar`).

### `DataCollectionGroupsResource` — `/api/v2/datacollection-groups`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all files in `$OPENNMS_HOME/etc/datacollection/` |
| GET | `/{filename}` | Read raw XML content of one file |
| PUT | `/{filename}` | Validate + write file (create or overwrite) |
| DELETE | `/{filename}` | Delete file + remove `include-collection` refs from root config |

**GET `/`** response:
```json
[
  { "filename": "cisco.xml", "groupName": "Cisco" },
  { "filename": "mib2.xml",  "groupName": "MIB-2" }
]
```
Group name is extracted from the `name` attribute of the root `<datacollection-group>` element. Files that cannot be parsed return `groupName: null`.

**GET `/{filename}`** response: `text/xml` — raw file content as string.

**PUT `/{filename}`** body: `text/xml` raw XML string.
- Sanitizes filename (no path traversal: no `/`, `..`, only `[a-zA-Z0-9._-]+`)
- Attempts JAXB unmarshal to `DatacollectionGroup` — returns 400 with error message if invalid
- Writes to `$OPENNMS_HOME/etc/datacollection/{filename}`
- Returns 200 `{ "savedPath": "..." }`
- Requires `ROLE_ADMIN`

**DELETE `/{filename}`** — deletes the file, then opens `datacollection-config.xml`, removes any `<include-collection dataCollectionGroup="..."/>` entries whose `dataCollectionGroup` value matches the deleted file's group name, and saves the root config. Returns 204. Requires `ROLE_ADMIN`.

### `SnmpCollectionConfigResource` — `/api/v2/datacollection-config`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Read SNMP collection entries from root config |
| PUT | `/` | Write updated SNMP collection entries to root config |

**GET `/`** response:
```json
{
  "snmpCollections": [
    {
      "name": "default",
      "snmpStorageFlag": "select",
      "rrdStep": 300,
      "rras": [
        "RRA:AVERAGE:0.5:1:2016",
        "RRA:AVERAGE:0.5:12:1488",
        "RRA:AVERAGE:0.5:288:366",
        "RRA:MAX:0.5:288:366",
        "RRA:MIN:0.5:288:366"
      ],
      "includeCollections": ["default-all", "Cisco", "Net-SNMP"]
    }
  ]
}
```

**PUT `/`** body: same shape as GET response. Reads current `datacollection-config.xml`, replaces the `<snmp-collection>` list, preserves all other content, writes back. Returns 200. Requires `ROLE_ADMIN`.

Both resources use `ConfigFileConstants.getFile(ConfigFileConstants.DATA_COLLECTION_CONF_FILE_NAME)` for the root config path (same as the Vaadin app).

---

## Component Architecture

```
ui/src/
  containers/
    SnmpCollectionsConfig.vue           ← page: breadcrumbs, tab switcher, admin guard

  components/
    SnmpCollectionsConfig/
      DataCollectionGroupsTab.vue       ← split-pane: file list left, editor right
      GroupFileList.vue                 ← searchable file list sidebar
      GroupFileEditor.vue               ← Ace XML editor + toolbar (save, delete, new)
      SnmpCollectionsTab.vue            ← collections table + add/edit/delete
      SnmpCollectionForm.vue            ← form for one SNMP collection entry

  services/
    snmpCollectionsService.ts           ← all HTTP calls + TypeScript types
```

---

## Tab 1: Data Collection Groups

### Layout — Split-pane

```
┌─────────────────────────────────────────────────────┐
│ Data Collection Groups                              │
├──────────────────┬──────────────────────────────────┤
│  🔍 Search...    │  cisco.xml                       │
│                  │  ┌───────────────────────────┐   │
│  3com.xml        │  │ <datacollection-group      │   │
│  acmepacket.xml  │  │   name="Cisco">            │   │
│▶ cisco.xml       │  │   <resourceType ...>       │   │
│  mib2.xml        │  │   ...                      │   │
│  netsnmp.xml     │  │ </datacollection-group>    │   │
│  ...             │  └───────────────────────────┘   │
│                  │  [Save]  [Delete]                 │
│  [+ New File]    │                                   │
└──────────────────┴──────────────────────────────────┘
```

### `GroupFileList.vue`

- Searchable list (filters on filename and group name)
- Each row: group name (bold) + filename (muted)
- Selected file highlighted
- "New File" button at bottom → prompts for filename (appends `.xml` if missing) → creates empty `<datacollection-group name="">` template in editor
- Unsaved changes on current file show a dot indicator; navigating away prompts confirmation

### `GroupFileEditor.vue`

- `VAceEditor` with `lang="xml"` and `theme="chrome"` (light) / `"tomorrow_night"` (dark)
- Toolbar above editor: filename as heading, **Save** button (primary), **Delete** button (danger, with confirm dialog)
- Save: PUT to `/api/v2/datacollection-groups/{filename}` — shows inline error if XML is invalid (the server returns the JAXB parse error message)
- Delete: DELETE to `/api/v2/datacollection-groups/{filename}` — confirm dialog warns "This will remove all include-collection references to this group"
- Dirty state tracked; **Save** disabled if content unchanged

---

## Tab 2: SNMP Collections

### Layout

Full-width table of SNMP collections with an add/edit form below (or in a modal on small screens).

```
┌─────────────────────────────────────────────────────┐
│ SNMP Collections                       [+ Add]      │
├──────────────────┬──────────┬──────────┬────────────┤
│ Name             │ Storage  │ RRD Step │ Actions    │
├──────────────────┼──────────┼──────────┼────────────┤
│ default          │ select   │ 300s     │ Edit Delete │
└──────────────────┴──────────┴──────────┴────────────┘
```

### `SnmpCollectionForm.vue`

Fields:
- **Name** — text input (required, must be unique)
- **SNMP Storage Flag** — `FeatherSelect` with options: `primary`, `all`, `select`, `other`
- **RRD Step** — number input in seconds (default 300)
- **RRAs** — editable list of RRA strings; add/remove rows; pre-populated with sensible defaults on new collection
- **Include Collections** — multi-select of available group names (sourced from the group files list); shows group names with filenames as subtitles

Save: PUT to `/api/v2/datacollection-config` with the full updated collections array.

---

## Service — `snmpCollectionsService.ts`

```typescript
export interface GroupFileMeta { filename: string; groupName: string | null }
export interface SnmpCollectionEntry {
  name: string
  snmpStorageFlag: string
  rrdStep: number
  rras: string[]
  includeCollections: string[]
}

export const listGroupFiles = (): Promise<GroupFileMeta[]>
export const getGroupFileXml = (filename: string): Promise<string>
export const saveGroupFileXml = (filename: string, xml: string): Promise<void>
export const deleteGroupFile = (filename: string): Promise<void>
export const getSnmpCollections = (): Promise<{ snmpCollections: SnmpCollectionEntry[] }>
export const saveSnmpCollections = (collections: SnmpCollectionEntry[]): Promise<void>
```

All calls use the `v2` axios instance. Errors surface via `useSnackbar`.

---

## Dark Mode

- Ace editor: `theme="chrome"` in light mode, `"tomorrow_night"` in dark mode — detect via `document.documentElement.classList.contains('open-dark')`
- Feather DS variables for all borders, backgrounds, text colors
- Split-pane divider: `var($border-light-on-surface)`

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Invalid XML on save | 400 from server → show error message inline below editor (JAXB parse error) |
| File not found on load | Show "File could not be loaded" in editor area |
| Concurrent edit conflict | Last writer wins (no locking); warn in docs |
| Delete fails | Toast via `useSnackbar` |
| Non-admin access | Admin guard on container redirects to home with snackbar message |

---

## Routing and Redirects

**New route in `router/index.ts`:**
```typescript
{
  path: '/snmp-collections-config',
  name: 'SNMP Collections Config',
  component: () => import('@/containers/SnmpCollectionsConfig.vue')
}
```

**JSP redirect** — replace `opennms-webapp/src/main/webapp/admin/manageSnmpCollections.jsp` with:
```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/snmp-collections-config"); %>
```

**`legacyToVueRoutes`** in `SideMenu.vue`:
```typescript
'admin/manageSnmpCollections.jsp': 'ui/index.html#/snmp-collections-config',
```

---

## What This Is NOT

- No inline editing of mibObj OIDs in form fields — the XML editor IS the editor for group content
- No system definition management UI beyond editing the XML — the full `systemDef` form hierarchy from Vaadin is deferred (XML editor covers it)
- No import/upload of external XML files beyond typing in the editor
- No live reload notification to collectd after saving (a manual restart or collection reload is out of scope)
