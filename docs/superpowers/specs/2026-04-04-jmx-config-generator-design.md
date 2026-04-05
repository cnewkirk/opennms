# JMX Config Generator — Vue SPA + REST API Design

**Date:** 2026-04-04  
**Phase:** Modern UI Phase 2a  
**Branch:** `feature/dark-mode-modern-ui-35x`

## Summary

Replace the Vaadin-based JMX Config Generator (`admin/jmxConfigGenerator.jsp` + `features/vaadin-jmxconfiggenerator/`) with a Vue 3 SPA wizard backed by three new JAX-RS endpoints. Also redirect `index.jsp` to the Vue dashboard and update the side-menu template.

This is the first Phase 2 Vaadin replacement and establishes the template for subsequent tool migrations (Event Admin, SNMP Collection Editor, MIB Compiler).

---

## Scope

### In scope
- Vue 3 wizard at `/jmx-config-generator` (4 steps)
- Three new REST endpoints under `/rest/jmx-config/`
- `index.jsp` redirect to Vue dashboard
- `admin/jmxConfigGenerator.jsp` redirect to Vue route
- `menu-template.json` updates (dashboard link + JMX tool link)
- Vue router + `adminRole` guard

### Out of scope
- Removing the Vaadin JMX module from the Maven build (deferred — do after full validation)
- Event Admin, SNMP Collection Editor, MIB Compiler (Phase 2b+)

---

## Landing Page Change

**`opennms-webapp/src/main/webapp/index.jsp`** — replace body with:
```jsp
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboard"); %>
```

**`menu-template.json`** — add to `dashboardsMenu.items` (first position):
```json
{
  "id": "vueDashboard",
  "name": "Dashboard",
  "url": "ui/index.html#/dashboard",
  "locationMatch": "dashboard",
  "roles": null
}
```

---

## Frontend Architecture

### Route
`/jmx-config-generator` — lazy-loaded, `adminRole` guard (same pattern as `/scv`, `/logs`, `/usage-statistics`)

### Wizard Steps

| Step | Component | Description |
|---|---|---|
| 1 | `ConnectionForm.vue` | Service name, JMX URL, optional auth, skip options |
| 2 | `MBeanDetection.vue` | Indeterminate progress bar, 2s poll, inline error + Back on failure |
| 3 | `MBeanTree.vue` | MBean tree with checkboxes; expand for attribute rows (alias fields dimmed/optional) |
| 4 | `ReviewSave.vue` | Output filename, read-only XML preview, Save to Server + Download buttons |

### New Files

```
ui/src/
├── containers/
│   └── JmxConfigGenerator.vue        ← wizard shell, owns step state
├── components/JmxConfig/
│   ├── ConnectionForm.vue
│   ├── MBeanDetection.vue
│   ├── MBeanTree.vue
│   └── ReviewSave.vue
├── stores/
│   └── jmxConfigStore.ts             ← Pinia: connectionConfig, jobId, mbeans, selections, xml
└── services/
    └── jmxConfigService.ts           ← detect(), pollDetect(), generate()
```

### Modified Files

- `ui/src/main/router/index.ts` — add `/jmx-config-generator` route with `adminRole` guard
- `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json` — two entries updated
- `opennms-webapp/src/main/webapp/index.jsp` — redirect to Vue dashboard
- `opennms-webapp/src/main/webapp/admin/jmxConfigGenerator.jsp` — redirect to Vue route

### Store Shape (`jmxConfigStore.ts`)

```typescript
interface JmxConnectionConfig {
  serviceName: string        // default: "anyservice"
  connection: string         // default: "service:jmx:rmi://localhost:18980"
  authenticate: boolean
  user: string | null
  password: string | null
  skipDefaultVM: boolean     // default: true
  skipNonNumber: boolean
}

interface MBeanAttribute {
  name: string
  alias: string              // pre-filled, editable
  type: string               // gauge|counter|timeticks|string|hexstring
  include: boolean           // default: true
}

interface MBeanEntry {
  objectName: string
  name: string
  include: boolean           // default: true
  attributes: MBeanAttribute[]
}

// Store state
connectionConfig: JmxConnectionConfig
jobId: string | null
jobStatus: 'idle' | 'pending' | 'running' | 'done' | 'error'
jobError: string | null
mbeans: MBeanEntry[]
outputFileName: string       // default: "{serviceName}-jmx.xml"
generatedXml: string | null
savedPath: string | null
currentStep: 1 | 2 | 3 | 4
```

---

## Backend Architecture

### New Resource
`opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/JmxConfigResource.java`  
Annotated `@Path("jmx-config")`, `@RolesAllowed({"ROLE_ADMIN"})`.

### Endpoints

#### `POST /rest/jmx-config/detect`
Validates connection params, submits `JmxDetectJob` to thread pool, returns job ID.

Request:
```json
{
  "serviceName": "anyservice",
  "connection": "service:jmx:rmi://localhost:18980",
  "authenticate": false,
  "user": null,
  "password": null,
  "skipDefaultVM": true,
  "skipNonNumber": false
}
```
Response `202 Accepted`:
```json
{ "jobId": "550e8400-e29b-41d4-a716-446655440000" }
```

#### `GET /rest/jmx-config/detect/{jobId}`
Returns current job state. Returns `404` if job expired or unknown.

Response:
```json
{
  "status": "PENDING|RUNNING|DONE|ERROR",
  "mbeans": [ ... ],
  "error": null
}
```

MBean shape in response:
```json
{
  "objectName": "java.lang:type=Memory",
  "name": "JVM Memory",
  "attributes": [
    { "name": "HeapMemoryUsage", "alias": "jvmHeapMemUsage", "type": "gauge" }
  ]
}
```

#### `POST /rest/jmx-config/generate`
Builds `JmxDatacollectionConfig` XML from user selections. If `saveToServer=true`, writes to `/opt/opennms/etc/jmx-datacollection-config.d/{outputFileName}`. Returns `409` if file exists (frontend shows overwrite confirmation).

Request:
```json
{
  "serviceName": "anyservice",
  "outputFileName": "anyservice-jmx.xml",
  "saveToServer": true,
  "overwrite": false,
  "mbeans": [
    {
      "objectName": "java.lang:type=Memory",
      "attributes": [
        { "name": "HeapMemoryUsage", "alias": "jvmHeapMemUsage", "include": true }
      ]
    }
  ]
}
```

Response `200 OK`:
```json
{
  "xml": "<?xml version=\"1.0\"...>",
  "savedPath": "/opt/opennms/etc/jmx-datacollection-config.d/anyservice-jmx.xml"
}
```

### Supporting Classes

All in `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/`:

| Class | Purpose |
|---|---|
| `JmxDetectJobManager.java` | `ConcurrentHashMap<String, JmxDetectJob>`, bounded thread pool (max 4), 5-min TTL cleanup via `ScheduledExecutorService` |
| `JmxDetectJob.java` | Runnable wrapping `JmxDatacollectionConfiggenerator` + `DefaultJmxConnector`; tracks `status`, `result`, `error` |
| `DetectRequest.java` | Jackson POJO for detect request body |
| `DetectJobStatus.java` | Jackson POJO for poll response |
| `GenerateRequest.java` | Jackson POJO for generate request body |
| `GenerateResponse.java` | Jackson POJO for generate response |

`JmxDetectJob` reuses `JmxDatacollectionConfiggenerator` and `DefaultJmxConnector` from `features/jmx-config-generator` — no logic duplication.

`JmxDetectJobManager` is a Spring `@Component` autowired into `JmxConfigResource`.

---

## Data Flow

```
[Step 1: ConnectionForm]
  └─ user submits → POST /rest/jmx-config/detect → store.jobId = uuid → advance to step 2

[Step 2: MBeanDetection]
  └─ poll GET /rest/jmx-config/detect/{jobId} every 2s
       ├─ PENDING/RUNNING → indeterminate progress bar continues
       ├─ DONE → load mbeans into store → advance to step 3
       └─ ERROR → show error message inline + "Back" button (no snackbar)
       └─ network fail → retry up to 3x silently → then show error

[Step 3: MBeanTree]
  └─ user selects mbeans/attributes, optionally edits aliases → "Next"

[Step 4: ReviewSave]
  └─ user confirms filename
  └─ POST /rest/jmx-config/generate
       ├─ 200 → show XML preview, enable Download button, show snackbar "Saved to <path>"
       ├─ 409 → show "File already exists — overwrite?" inline confirmation
       │         └─ confirm → re-POST with overwrite: true
       └─ 4xx/5xx → inline error on step 4, wizard stays put
```

---

## Error Handling Summary

| Scenario | Handling |
|---|---|
| JMX connection refused / unknown host | `ERROR` status from poll; inline message on step 2 |
| Job expired (5-min TTL) | `404` from poll → treated as error, inline message on step 2 |
| Network failure during poll | Retry 3x silently, then inline error |
| Output file already exists | `409` → overwrite confirmation dialog inline on step 4 |
| Generate fails (permissions, bad XML) | Inline error on step 4 |
| Not admin | `adminRole` guard → snackbar + redirect |

---

## Menu Template Changes (`menu-template.json`)

1. **`dashboardsMenu`** — prepend Vue dashboard entry:
```json
{
  "id": "vueDashboard",
  "name": "Dashboard",
  "url": "ui/index.html#/dashboard",
  "locationMatch": "dashboard",
  "roles": null
}
```

2. **`toolsMenu` → `jmxMetricConfigurationGenerator`** — update url:
```json
"url": "ui/index.html#/jmx-config-generator"
```

---

## Testing Approach

- Manual E2E in running container (podman overlay image)
- Verify step progression: connection form → detection spinner → MBean tree → XML preview → save
- Verify overwrite conflict (409) flow
- Verify `adminRole` guard redirects non-admin users
- Verify saved file appears in container at correct path
- Verify download button produces valid XML
- Verify landing page redirect (`/opennms/` → Vue dashboard)
- Verify side-menu JMX link navigates to Vue wizard (not JSP iframe)
