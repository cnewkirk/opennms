# Alarm Detail Vue SPA — Design Spec

**Date:** 2026-04-05
**Branch:** feature/jmx-config-vue
**Phase:** Modern UI — Alarm Detail (list page is a follow-on)

## Overview

Replace the legacy `alarm/detail.htm` page with a Vue 3 SPA alarm detail page at `/#/alarm/:id`. The Spring MVC controller is not removed — a redirect block is prepended and gated by a system property so the legacy path remains fully intact and reversible. The alarm list (`alarm/index.htm`) is **not** redirected in this phase; that is a follow-on spec.

---

## Routing & Redirect

### Vue router (`ui/src/main/router/index.ts`)

```ts
{
  path: '/alarm/:id',
  name: 'Alarm Detail',
  component: () => import('@/containers/AlarmDetail.vue')
}
```

### `AlarmDetailController.java` redirect

Add at the top of `handleRequestInternal()`, before any DB queries:

```java
// Redirect to Vue SPA — remove this block (or set property to false) to revert
if (!"false".equals(System.getProperty("opennms.alarms.vueEnabled", "true"))) {
    String alarmId = WebSecurityUtils.safeParseInt(req.getParameter("id")) + "";
    response.sendRedirect(req.getContextPath() + "/ui/index.html#/alarm/" + alarmId);
    return null;
}
// ... all existing controller logic unchanged below
```

To revert: set `opennms.alarms.vueEnabled=false` in `opennms.conf`, or delete the block. The full legacy JSP path remains intact beneath it.

### Breadcrumbs

Home → Alarms (`/opennms/alarm/index.htm`, legacy link until list phase) → Alarm {id}

---

## Data Layer

### New types (`ui/src/types/index.ts`)

Extend the existing thin `Alarm` interface and add `AlarmMemo` and `AlarmAcknowledgment`:

```ts
interface AlarmMemo {
  body: string | null
  author: string | null
  created: number | null
  updated: number | null
}

interface AlarmAcknowledgment {
  ackUser: string
  ackAction: string
  ackTime: number
}

interface Alarm {
  // existing fields
  id: string
  severity: string
  nodeId: number
  nodeLabel: string
  uei: string
  count: number
  lastEventTime: number
  logMessage: string
  // new fields
  firstEventTime?: number
  ipAddress?: string
  serviceType?: { id: number; name: string }
  ackTime?: number
  ackUser?: string
  description?: string
  operInstruct?: string
  reductionKey?: string
  managedObjectType?: string
  managedObjectInstance?: string
  troubleTicketId?: string
  troubleTicketState?: string
  isSituation?: boolean
  isPartOfSituation?: boolean
  relatedAlarms?: Alarm[]       // populated when isSituation=true
  relatedSituations?: Alarm[]   // populated when isPartOfSituation=true — verify exact v2 field name against live API response before coding
  lastEvent?: { id: number }
  stickyMemo?: AlarmMemo
  reductionKeyMemo?: AlarmMemo
  location?: string
  nodeLocation?: string
}
```

### `alarmService.ts` additions

```ts
const getAlarmById = async (id: string | number): Promise<Alarm | false>
// GET /api/v2/alarms/{id}

const getAlarmAcknowledgments = async (id: string | number): Promise<AlarmAcknowledgment[]>
// GET /api/v2/alarms/{id}/acknowledgments

const saveStickyMemo = async (id: string | number, body: string): Promise<boolean>
// POST /api/v2/alarms/{id}/memo  (body as plain text)

const deleteStickyMemo = async (id: string | number): Promise<boolean>
// DELETE /api/v2/alarms/{id}/memo

const saveJournalMemo = async (id: string | number, body: string): Promise<boolean>
// POST /api/v2/alarms/{id}/journal

const deleteJournalMemo = async (id: string | number): Promise<boolean>
// DELETE /api/v2/alarms/{id}/journal
```

The existing `modifyAlarm` handles ack/unack/escalate/clear and is reused unchanged.

### `useAlarmDetail.ts` composable

Fetches alarm and acknowledgment history in parallel on mount:

```ts
const useAlarmDetail = (id: string) => {
  const alarm = ref<Alarm | null>(null)
  const acknowledgments = ref<AlarmAcknowledgment[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  // parallel fetch: getAlarmById + getAlarmAcknowledgments
  // sets error on 404 or failure
  return { alarm, acknowledgments, loading, error }
}
```

---

## UI — `AlarmDetail.vue`

Single container. No sub-components. All sections are `v-if`-guarded as appropriate.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  BreadCrumbs: Home → Alarms → Alarm {id}                │
├─────────────────────────────────────────────────────────┤
│  Header card (severity-colored, border-radius: 4px)     │
│  "Alarm {id}"  or  "Situation {id}" if isSituation      │
│  Severity badge                                         │
├─────────────────────────────────────────────────────────┤
│  Details card (key/value grid, 2 columns)               │
│  Severity       │ Node (→ /node/:id)                    │
│  Last Event     │ Interface (→ legacy JSP)              │
│  First Event    │ Service (→ legacy JSP)                │
│  Src Location   │ Node Location                         │
│  Count          │ UEI                                   │
│  Mgd Obj Type   │ Mgd Obj Instance                      │
│  Ticket ID      │ Ticket State                          │
│  Reduction Key  (full width)                            │
├─────────────────────────────────────────────────────────┤
│  Action bar (hidden for ROLE_READONLY)                  │
│  [Ack/Unack]  [Escalate?]  [Clear?]                     │
│  [Create Ticket] [Update Ticket] [Close Ticket]         │
│    ↑ only when appInfo.ticketerConfig.enabled = true    │
├─────────────────────────────────────────────────────────┤
│  Log Message card                                       │
├─────────────────────────────────────────────────────────┤
│  Description card                                       │
├─────────────────────────────────────────────────────────┤
│  Operator Instructions card  (v-if operInstruct)        │
├─────────────────────────────────────────────────────────┤
│  Parent Situation(s) card  (v-if isPartOfSituation)     │
│  Table: ID · Severity · Node · Count · Last · Log Msg   │
├─────────────────────────────────────────────────────────┤
│  Related Alarms card  (v-if isSituation)                │
│  Table: ID · Situation · Sev · Node · Count · Last · Msg│
├─────────────────────────────────────────────────────────┤
│  Related Events card                                    │
│  Table: Event ID (→ /event/:id) · Sev · Time · UEI · Msg│
├─────────────────────────────────────────────────────────┤
│  Acknowledgements card  (v-if acknowledgments.length)   │
│  Table: Ack'd By · Action · Time                        │
├─────────────────────────────────────────────────────────┤
│  [Sticky Memo card]     │  [Journal Memo card]          │
│  textarea               │  textarea                     │
│  [Save] [Delete]        │  [Save] [Delete]              │
│  Author / Updated / Created (shown when memo exists)    │
└─────────────────────────────────────────────────────────┘
```

### Link targets

| Field | Target |
|---|---|
| Node | `/#/node/:nodeId` (Vue SPA) |
| Last Event | `/#/event/:lastEvent.id` (Vue SPA) |
| Related alarm/situation IDs | `/#/alarm/:id` (Vue SPA, self-referential) |
| Related event IDs | `/#/event/:id` (Vue SPA) |
| Interface | `/opennms/element/interface.jsp?node=...&intf=...` (TODO: Vue) |
| Service | `/opennms/element/service.jsp?node=...&intf=...&service=...` (TODO: Vue) |

### Action button logic

**Ack/Unack:** Label and behavior toggle based on `alarm.ackTime != null`. Calls `modifyAlarm(id, { ack: true/false })`. Button re-enables on error; snackbar shown.

**Escalate:** Shown when severity is not CRITICAL and not INDETERMINATE. Calls `modifyAlarm(id, { escalate: true })`.

**Clear:** Shown when severity is NORMAL or above (not INDETERMINATE). Calls `modifyAlarm(id, { clear: true })`.

**Ticket buttons:** Entire section hidden when `appInfo.ticketerConfig.enabled !== true`. Individual button disabled states mirror the JSP logic:
- Create: disabled when `troubleTicketState` is set and not `CREATE_FAILED`
- Update: disabled when no `troubleTicketId`
- Close: disabled when state is not `OPEN` or `CLOSE_FAILED`

Ticket actions POST to legacy endpoints (`/opennms/alarm/ticket/create.htm`, etc.) — these remain as form submits for now; no REST API equivalent.

### Memo behavior

- Save calls `saveStickyMemo` / `saveJournalMemo`, then re-fetches the alarm to refresh metadata (author, timestamps).
- Delete calls the corresponding delete method, then re-fetches.
- Textarea and Save/Delete buttons are disabled (not hidden) when `ROLE_READONLY` — the memo content remains visible.
- Save/delete failures show a snackbar error; textarea retains its content.

### Error state

If alarm not found or fetch fails → full-page error (same pattern as `EventDetail.vue`).

### Styling

- All cards: `border-radius: 4px`, `@include elevation(2)`, `padding: 16px`, `margin-bottom: 16px`
- Severity header: `@import "@/styles/severities"` — use `-color` suffix class for low-opacity background
- No hardcoded colors — all via Feather DS theme variables
- Light and dark mode tested

---

## Files Changed / Created

| File | Change |
|---|---|
| `ui/src/types/index.ts` | Extend `Alarm`, add `AlarmMemo`, `AlarmAcknowledgment` |
| `ui/src/services/alarmService.ts` | Add `getAlarmById`, `getAlarmAcknowledgments`, memo CRUD |
| `ui/src/composables/useAlarmDetail.ts` | New composable |
| `ui/src/containers/AlarmDetail.vue` | New container |
| `ui/src/main/router/index.ts` | Add `/alarm/:id` route |
| `opennms-webapp/.../AlarmDetailController.java` | Prepend redirect block |

---

## TODOs (deferred to follow-on phases)

- Alarm list page: redirect `alarm/index.htm` → Vue `/alarms` route with filter/favorites/pagination
- Interface detail: `element/interface.jsp` → Vue route
- Service detail: `element/service.jsp` → Vue route
- Ticket action REST API: replace legacy form-post ticket endpoints with v2 REST calls

---

## Verification

1. Navigate to `/opennms/alarm/detail.htm?id=1` — confirm redirect to `/#/alarm/1`
2. Set `opennms.alarms.vueEnabled=false` — confirm legacy JSP renders
3. Header shows "Situation {id}" when `isSituation=true`; correct severity color
4. Node link → Vue node detail; Last Event link → Vue event detail
5. Ack button toggles label and calls correct `modifyAlarm` payload
6. Escalate hidden at CRITICAL; Clear hidden at INDETERMINATE
7. Ticket section absent when `ticketerConfig.enabled=false`; button states correct per ticket state
8. Sticky/journal memo save and delete round-trip correctly, metadata refreshes
9. Related alarms table shown only for situations; parent situations only when `isPartOfSituation=true`
10. Related events link to Vue event detail
11. Acknowledgements card hidden when no ack history
12. Operator instructions card hidden when null/empty
13. Light and dark mode — no hardcoded colors, no broken contrast
14. ROLE_READONLY: action bar and memo controls disabled/hidden
