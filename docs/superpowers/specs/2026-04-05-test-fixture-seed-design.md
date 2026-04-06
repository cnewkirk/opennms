# Test Fixture Seed Script — Design Spec

**Date:** 2026-04-05  
**Status:** Approved  
**Branch:** `feature/jmx-config-vue`

---

## Problem

The `test-opennms` container currently has no node with outage history that consistently exercises the outage display paths in the Vue SPA. Validating the following fixes requires live data:

- `OutagesWidget.vue` — `:key` fix (`outage.id ?? outage.outageId`)
- `OutagesTable.vue` — service name from `monitoredService.serviceType.name`
- `useNodeAvailability.ts` — serviceName resolved from v2 API nested path

Existing outages on Topology-Lab nodes are intermittent and currently resolved, so they only appear in node detail history, not the active-outages widget.

---

## Goal

A single idempotent shell script that seeds a stable test node with known outage data into the running `test-opennms` container's database. Re-running the script must be safe (no-op if data already exists, or full reset with `--reset`).

---

## Approach: Pure SQL Seed (Option A)

Insert directly into PostgreSQL via `psql`. No provisioning pipeline, no polling wait. The Topology-Lab nodes already prove that SQL-inserted nodes render correctly in the Vue SPA. The fixture node does not need RRD data or availability history — only outage records.

**Why not requisition-based (Option B)?**  
Requisition import is async and requires OpenNMS to be fully booted/healthy. For a developer reset workflow (run script, hard-refresh, validate) the 5–15s async wait is friction. SQL is instant and deterministic.

---

## Fixture Contents

### Node

| Field | Value |
|---|---|
| `nodelabel` | `UI-Test-Node` |
| `foreignsource` | `UI-Test` |
| `foreignid` | `test-node-01` |
| `location` | `Default` |
| `nodetype` | `A` (active) |

### IP Interface

| Field | Value |
|---|---|
| `ipaddr` | `192.0.2.1` |
| Notes | RFC 5737 TEST-NET — guaranteed unreachable, never conflicts with real monitoring |

### Service

Reuse the existing `ICMP` row from the `service` table (`serviceid = 3` in this container). Do not insert a duplicate.

### Outages

Three outages on the ICMP service at `192.0.2.1`:

| # | `iflostservice` | `ifregainedservice` | Purpose |
|---|---|---|---|
| 1 | `NOW() - interval '2 hours'` | `NULL` | **Active** — appears in Dashboard OutagesWidget |
| 2 | `NOW() - interval '1 day'` | `NOW() - interval '23 hours 50 minutes'` | Resolved — appears in Node Detail OutagesTable |
| 3 | `NOW() - interval '2 days'` | `NOW() - interval '1 day 23 hours 30 minutes'` | Resolved — second row in OutagesTable |

`svclosteventid` and `svcregainedeventid` are both `NULL` (these columns are nullable in the schema).

---

## Idempotency

The script wraps all inserts in a `DO $$ … $$ LANGUAGE plpgsql` block. Each insert is guarded:

```sql
IF NOT EXISTS (SELECT 1 FROM node WHERE foreignsource = 'UI-Test' AND foreignid = 'test-node-01') THEN
  INSERT INTO node (...) VALUES (...);
END IF;
```

**`--reset` flag:** Deletes all rows with `foreignsource = 'UI-Test'` before re-inserting. Cascade deletes on foreign keys remove the associated ipinterface → ifservices → outages automatically.

---

## Script Interface

**Location:** `ui/seed-test-fixtures.sh`  
(alongside `deploy-to-container.sh`)

```bash
# Seed if not already seeded (default, safe to re-run)
./seed-test-fixtures.sh

# Full reset — drop UI-Test rows and re-insert fresh
./seed-test-fixtures.sh --reset
```

**DB connection defaults:**

| Variable | Default |
|---|---|
| `PGHOST` | `localhost` |
| `PGPORT` | `5432` |
| `PGUSER` | `postgres` |
| `PGPASSWORD` | `postgres` |
| `PGDATABASE` | `opennms` |

All overridable via environment variables.

**Exit codes:**  
`0` — success (seeded or already present)  
`1` — psql not found, DB unreachable, or unexpected SQL error

---

## Sequence IDs

OpenNMS uses sequences for primary keys. The script must use `nextval()`:

| Table | PK column | Sequence |
|---|---|---|
| `node` | `nodeid` | `nodenxtid` |
| `ipinterface` | `id` | `opennmsnxtid` |
| `ifservices` | `id` | `opennmsnxtid` |
| `outages` | `outageid` | `outagenxtid` |

`ipinterface` and `ifservices` share the `opennmsnxtid` sequence. All sequence names confirmed from the live schema.

---

## Verification

After running the script, the following should hold:

```bash
# Node exists
curl -s -u admin:notdefault http://localhost:8980/opennms/api/v2/nodes?_s=foreignSource==UI-Test \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['totalCount'], 'node(s)')"
# Expected: 1 node(s)

# Active outage visible in v2 API
curl -s -u admin:notdefault "http://localhost:8980/opennms/api/v2/outages?_s=ifRegainedService==null;node.foreignSource==UI-Test" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['totalCount'], 'active outage(s)')"
# Expected: 1 active outage(s)

# Node detail outages
curl -s -u admin:notdefault "http://localhost:8980/opennms/rest/outages/forNode/<id>" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('outage',[])), 'outage(s)')"
# Expected: 3 outage(s)
```

---

## What This Validates

| Fix | How this fixture exercises it |
|---|---|
| `OutagesWidget.vue` `:key="outage.id ?? outage.outageId"` | Active outage shows in widget; key stability verified by no Vue warning |
| `OutagesTable.vue` service name | Node detail shows "ICMP" in service column (not blank) |
| `useNodeAvailability.ts` serviceName | Availability chart correctly matches outage to ICMP service |
| `GraphDataTable.vue` `visibleMetrics` | Not exercised by this fixture (needs netsnmp node) |

---

## Out of Scope

- RRD/metric data for the test node (requires a separate fixture)
- Automated integration into CI (future work)
- Creating a netsnmp node for Data tab CDEF validation (separate fixture, separate spec)
