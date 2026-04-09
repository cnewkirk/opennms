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
    INSERT INTO node (nodeid, nodelabel, foreignsource, foreignid, nodetype, location, nodecreatetime)
    VALUES (v_nodeid, 'UI-Test-Node', 'UI-Test', 'test-node-01', 'A', 'Default', NOW());
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
