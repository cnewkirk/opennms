# Test Fixture Seed Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `ui/seed-test-fixtures.sh` — an idempotent shell script that inserts a stable `UI-Test-Node` with one active and two resolved ICMP outages into the `test-opennms` container's PostgreSQL database.

**Architecture:** Pure SQL via `psql` against the exposed port 5432. All inserts are wrapped in a single `DO $$ … $$ LANGUAGE plpgsql` block with `IF NOT EXISTS` guards. A `--reset` flag deletes all `UI-Test` rows before re-inserting. No provisioning pipeline, no polling, no fake events.

**Tech Stack:** Bash, PostgreSQL 14 (psql client on macOS host), OpenNMS 35.x schema.

---

## Schema Reference (confirmed from live container)

| Table | PK column | Sequence | Notes |
|---|---|---|---|
| `node` | `nodeid` | `nodenxtid` | `location NOT NULL`, no `createtime` column |
| `ipinterface` | `id` | `opennmsnxtid` | `ipaddr TEXT NOT NULL`, `nodeid NOT NULL` |
| `ifservices` | `id` | `opennmsnxtid` | `serviceid=3` is ICMP |
| `outages` | `outageid` | `outagenxtid` | `ifserviceid NOT NULL`, `svclosteventid` nullable |

DB credentials (host-side): `PGPASSWORD=opennms psql -h localhost -p 5432 -U opennms -d opennms`

> **Note:** The spec listed PGUSER=postgres/PGPASSWORD=postgres — these are wrong. The correct credentials are PGUSER=opennms / PGPASSWORD=opennms.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `ui/seed-test-fixtures.sh` | **Create** | Idempotent SQL seed script |

No other files are created or modified.

---

### Task 1: Write and verify the seed script

**Files:**
- Create: `ui/seed-test-fixtures.sh`

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
# seed-test-fixtures.sh
# Inserts a stable UI-Test-Node with 1 active + 2 resolved ICMP outages
# into the running test-opennms container's PostgreSQL database.
#
# Usage:
#   ./seed-test-fixtures.sh           # no-op if already seeded
#   ./seed-test-fixtures.sh --reset   # drop UI-Test rows and re-insert
#
# DB connection env vars (all have defaults):
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-opennms}"
PGPASSWORD="${PGPASSWORD:-opennms}"
PGDATABASE="${PGDATABASE:-opennms}"
export PGPASSWORD

RESET=false
if [[ "${1:-}" == "--reset" ]]; then
  RESET=true
fi

# Verify psql is available
if ! command -v psql &>/dev/null; then
  echo "ERROR: psql not found. Install postgresql client (brew install libpq)." >&2
  exit 1
fi

# Verify DB is reachable
if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
      -c "SELECT 1;" &>/dev/null; then
  echo "ERROR: Cannot connect to PostgreSQL at $PGHOST:$PGPORT as $PGUSER." >&2
  exit 1
fi

echo "Connected to $PGDATABASE at $PGHOST:$PGPORT"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<'SQL'
DO $$
DECLARE
  v_nodeid      INTEGER;
  v_ifid        INTEGER;
  v_svcid       INTEGER;
BEGIN

  -- ── Reset (optional) ──────────────────────────────────────────────────────
  -- Cascades: node → ipinterface → ifservices → outages
  IF current_setting('app.reset', true) = 'true' THEN
    DELETE FROM node WHERE foreignsource = 'UI-Test';
    RAISE NOTICE 'UI-Test rows deleted (reset).';
  END IF;

  -- ── Node ──────────────────────────────────────────────────────────────────
  SELECT nodeid INTO v_nodeid
    FROM node
   WHERE foreignsource = 'UI-Test' AND foreignid = 'test-node-01';

  IF v_nodeid IS NULL THEN
    v_nodeid := nextval('nodenxtid');
    INSERT INTO node (nodeid, nodelabel, foreignsource, foreignid, nodetype, location)
    VALUES (v_nodeid, 'UI-Test-Node', 'UI-Test', 'test-node-01', 'A', 'Default');
    RAISE NOTICE 'Inserted node id=% (UI-Test-Node)', v_nodeid;
  ELSE
    RAISE NOTICE 'Node already exists id=% — skipping inserts.', v_nodeid;
    RETURN;
  END IF;

  -- ── IP Interface ──────────────────────────────────────────────────────────
  v_ifid := nextval('opennmsnxtid');
  INSERT INTO ipinterface (id, nodeid, ipaddr, ismanaged, ipstatus, issnmpprimary)
  VALUES (v_ifid, v_nodeid, '192.0.2.1', 'M', 1, 'P');
  RAISE NOTICE 'Inserted ipinterface id=% (192.0.2.1)', v_ifid;

  -- ── ifservices (ICMP = serviceid 3) ───────────────────────────────────────
  v_svcid := nextval('opennmsnxtid');
  INSERT INTO ifservices (id, ipinterfaceid, serviceid, status, source)
  VALUES (v_svcid, v_ifid, 3, 'A', 'P');
  RAISE NOTICE 'Inserted ifservice id=% (ICMP)', v_svcid;

  -- ── Outages ───────────────────────────────────────────────────────────────
  -- Outage 1: Active (no ifregainedservice)
  INSERT INTO outages (outageid, ifserviceid, iflostservice, ifregainedservice)
  VALUES (
    nextval('outagenxtid'),
    v_svcid,
    NOW() - INTERVAL '2 hours',
    NULL
  );
  RAISE NOTICE 'Inserted active outage (lost 2h ago)';

  -- Outage 2: Resolved ~10 min outage, 1 day ago
  INSERT INTO outages (outageid, ifserviceid, iflostservice, ifregainedservice)
  VALUES (
    nextval('outagenxtid'),
    v_svcid,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '23 hours 50 minutes'
  );
  RAISE NOTICE 'Inserted resolved outage (1 day ago)';

  -- Outage 3: Resolved ~30 min outage, 2 days ago
  INSERT INTO outages (outageid, ifserviceid, iflostservice, ifregainedservice)
  VALUES (
    nextval('outagenxtid'),
    v_svcid,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day 23 hours 30 minutes'
  );
  RAISE NOTICE 'Inserted resolved outage (2 days ago)';

END;
$$ LANGUAGE plpgsql;
SQL
```

The `--reset` flag cannot pass a variable into the heredoc `DO $$` block directly, so we use a PostgreSQL session-level setting. Replace the heredoc invocation with a two-step approach:

```bash
# Set session var before the DO block based on $RESET
RESET_SETTING="SET app.reset = '$( [[ "$RESET" == "true" ]] && echo true || echo false )';"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  -c "$RESET_SETTING" \
  -f - <<'SQL'
DO $$
...
SQL
```

> That `-c ... -f -` pattern won't work cleanly. Use a temp file approach instead — see full script below.

Write the complete final script to `ui/seed-test-fixtures.sh`:

```bash
#!/usr/bin/env bash
# seed-test-fixtures.sh
# Inserts UI-Test-Node with 1 active + 2 resolved ICMP outages into
# the running test-opennms container's PostgreSQL database.
#
# Usage:
#   ./seed-test-fixtures.sh           # no-op if already seeded
#   ./seed-test-fixtures.sh --reset   # drop UI-Test rows and re-insert
#
# DB connection (all overridable via env):
#   PGHOST=localhost  PGPORT=5432  PGUSER=opennms  PGPASSWORD=opennms  PGDATABASE=opennms

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-opennms}"
PGPASSWORD="${PGPASSWORD:-opennms}"
PGDATABASE="${PGDATABASE:-opennms}"
export PGPASSWORD

RESET=false
if [[ "${1:-}" == "--reset" ]]; then
  RESET=true
fi

if ! command -v psql &>/dev/null; then
  echo "ERROR: psql not found. Install with: brew install libpq" >&2
  exit 1
fi

if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" &>/dev/null; then
  echo "ERROR: Cannot connect to PostgreSQL at $PGHOST:$PGPORT as $PGUSER" >&2
  exit 1
fi

echo "Connected to $PGDATABASE at $PGHOST:$PGPORT (reset=$RESET)"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<SQL
DO \$\$
DECLARE
  v_reset   BOOLEAN := ${RESET};
  v_nodeid  INTEGER;
  v_ifid    INTEGER;
  v_svcid   INTEGER;
BEGIN

  IF v_reset THEN
    DELETE FROM node WHERE foreignsource = 'UI-Test';
    RAISE NOTICE 'UI-Test rows deleted (reset).';
  END IF;

  SELECT nodeid INTO v_nodeid
    FROM node
   WHERE foreignsource = 'UI-Test' AND foreignid = 'test-node-01';

  IF v_nodeid IS NULL THEN
    v_nodeid := nextval('nodenxtid');
    INSERT INTO node (nodeid, nodelabel, foreignsource, foreignid, nodetype, location)
    VALUES (v_nodeid, 'UI-Test-Node', 'UI-Test', 'test-node-01', 'A', 'Default');
    RAISE NOTICE 'Inserted node id=% (UI-Test-Node)', v_nodeid;
  ELSE
    RAISE NOTICE 'Node already exists id=% -- no-op.', v_nodeid;
    RETURN;
  END IF;

  v_ifid := nextval('opennmsnxtid');
  INSERT INTO ipinterface (id, nodeid, ipaddr, ismanaged, ipstatus, issnmpprimary)
  VALUES (v_ifid, v_nodeid, '192.0.2.1', 'M', 1, 'P');
  RAISE NOTICE 'Inserted ipinterface id=% (192.0.2.1)', v_ifid;

  v_svcid := nextval('opennmsnxtid');
  INSERT INTO ifservices (id, ipinterfaceid, serviceid, status, source)
  VALUES (v_svcid, v_ifid, 3, 'A', 'P');
  RAISE NOTICE 'Inserted ifservice id=% (ICMP)', v_svcid;

  INSERT INTO outages (outageid, ifserviceid, iflostservice, ifregainedservice)
  VALUES (nextval('outagenxtid'), v_svcid, NOW() - INTERVAL '2 hours', NULL);
  RAISE NOTICE 'Inserted active outage (lost 2h ago)';

  INSERT INTO outages (outageid, ifserviceid, iflostservice, ifregainedservice)
  VALUES (nextval('outagenxtid'), v_svcid, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours 50 minutes');
  RAISE NOTICE 'Inserted resolved outage (1 day ago)';

  INSERT INTO outages (outageid, ifserviceid, iflostservice, ifregainedservice)
  VALUES (nextval('outagenxtid'), v_svcid, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 23 hours 30 minutes');
  RAISE NOTICE 'Inserted resolved outage (2 days ago)';

END;
\$\$ LANGUAGE plpgsql;
SQL

echo "Done."
```

The key detail: `$RESET` is a Bash variable interpolated *outside* the `DO $$` block body (it appears in the DECLARE section as a literal `true` or `false`), so the `\$\$` escaping in the heredoc prevents the inner `$$` from being consumed by Bash while still letting `$RESET` expand.

- [ ] **Step 2: Make it executable and run it (first-time seed)**

```bash
chmod +x ui/seed-test-fixtures.sh
cd /Users/chance/git/opennms/ui && ./seed-test-fixtures.sh
```

Expected output:
```
Connected to opennms at localhost:5432 (reset=false)
NOTICE:  Inserted node id=N (UI-Test-Node)
NOTICE:  Inserted ipinterface id=M (192.0.2.1)
NOTICE:  Inserted ifservice id=K (ICMP)
NOTICE:  Inserted active outage (lost 2h ago)
NOTICE:  Inserted resolved outage (1 day ago)
NOTICE:  Inserted resolved outage (2 days ago)
DO
Done.
```

- [ ] **Step 3: Run it again to verify idempotency**

```bash
./seed-test-fixtures.sh
```

Expected output:
```
Connected to opennms at localhost:5432 (reset=false)
NOTICE:  Node already exists id=N -- no-op.
DO
Done.
```

No duplicate inserts, no errors.

- [ ] **Step 4: Verify the data via the v2 API**

```bash
# Node exists
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes?_s=foreignSource==UI-Test" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['totalCount'], 'node(s)')"
# Expected: 1 node(s)

# Active outage visible
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/outages?_s=ifRegainedService==null;node.foreignSource==UI-Test" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['totalCount'], 'active outage(s)')"
# Expected: 1 active outage(s)
```

- [ ] **Step 5: Test --reset flag**

```bash
./seed-test-fixtures.sh --reset
```

Expected output:
```
Connected to opennms at localhost:5432 (reset=true)
NOTICE:  UI-Test rows deleted (reset).
NOTICE:  Inserted node id=N2 (UI-Test-Node)
...
Done.
```

Run `./seed-test-fixtures.sh` again immediately after — must produce the no-op notice.

- [ ] **Step 6: Commit**

```bash
git add ui/seed-test-fixtures.sh
git commit -m "feat(test): add idempotent SQL fixture seed script for UI-Test-Node

Inserts UI-Test-Node (192.0.2.1, ICMP) with 1 active + 2 resolved
outages. Safe to re-run; --reset drops and re-inserts. Exercises the
OutagesWidget, OutagesTable, and useNodeAvailability outage display paths."
```

---

## Verification Summary

After the script runs, these three checks must all pass:

```bash
# 1. Node exists in OpenNMS
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes?_s=foreignSource==UI-Test" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['totalCount'], 'node(s)')"
# → 1 node(s)

# 2. Active outage in v2 API
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/outages?_s=ifRegainedService==null;node.foreignSource==UI-Test" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['totalCount'], 'active outage(s)')"
# → 1 active outage(s)

# 3. All 3 outages in node detail (replace NODE_ID with actual nodeid)
NODE_ID=$(curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes?_s=foreignSource==UI-Test" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['node'][0]['id'])")
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/rest/outages/forNode/$NODE_ID" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('outage',[])), 'outage(s)')"
# → 3 outage(s)
```
