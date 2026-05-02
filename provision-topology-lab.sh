#!/usr/bin/env bash
# provision-topology-lab.sh
#
# Ensures the `Topology-Lab` requisition is present in test-opennms so the
# 7 lab containers (started by ./start-topology-lab.sh) are actually monitored.
# Idempotent — safe to run any time test-opennms is up.
#
# WHY this exists separate from start-topology-lab.sh:
#   The lab containers persist across test-opennms rebuilds, but the test
#   container's /opt/opennms/etc/imports/Topology-Lab.xml does NOT — every
#   `podman rm -f test-opennms && podman run ...` cycle wipes the requisition,
#   leaving the lab orphaned (containers up, OpenNMS unaware). Running this
#   script after a test container rebuild reattaches the lab.
#
# WHAT it does:
#   1. Verifies test-opennms responds and lab containers are up
#   2. Copies .topology-lab/Topology-Lab.xml into test-opennms
#   3. Triggers import via REST
#   4. Patches snmpifspeed (provisiond's initial scan races snmpd's interface-
#      speed override and records 10 Gbps; we patch back to 1 Gbps)
#   5. Deletes any auto-discovered duplicate nodes EnLinkd may have created
#      from LLDP neighbors that didn't match a provisioned foreign-id
#   6. Reloads EnLinkd to start a fresh collection cycle

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REQ_FILE="${SCRIPT_DIR}/.topology-lab/Topology-Lab.xml"
REST="http://localhost:8980/opennms"
AUTH="admin:notdefault"

if [[ ! -f "${REQ_FILE}" ]]; then
  echo "ERROR: requisition file not found: ${REQ_FILE}" >&2
  exit 1
fi

# 1. Prereq: test-opennms responding
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -u "${AUTH}" "${REST}/rest/info" || true)
if [[ "${HTTP}" != "200" ]]; then
  echo "ERROR: test-opennms not responding (HTTP ${HTTP}). Start it first." >&2
  exit 1
fi

# 2. Prereq: lab containers up
LAB_COUNT=$(podman ps --filter name=topo- -q | wc -l | tr -d ' ')
if [[ "${LAB_COUNT}" -lt 7 ]]; then
  echo "ERROR: only ${LAB_COUNT}/7 topology lab containers running. Run ./start-topology-lab.sh first." >&2
  exit 1
fi

echo "==> Copying requisition into test-opennms..."
podman cp "${REQ_FILE}" test-opennms:/opt/opennms/etc/imports/Topology-Lab.xml

echo "==> Triggering import..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -u "${AUTH}" -X PUT \
  "${REST}/rest/requisitions/Topology-Lab/import?rescanExisting=true")
if [[ "${HTTP}" == "202" ]]; then
  echo "    Import triggered (HTTP 202)"
else
  echo "    WARNING: import REST call returned HTTP ${HTTP}"
fi

# 3. Wait for initial scan, then patch snmpifspeed
echo "==> Waiting 30s for initial SNMP scan..."
sleep 30
PGPASSWORD=notdefault psql -h localhost -p 5432 -U opennms opennms -q \
  -c "UPDATE snmpinterface SET snmpifspeed = 1000000000
      FROM node WHERE node.nodeid = snmpinterface.nodeid
        AND node.foreignsource = 'Topology-Lab'
        AND snmpinterface.snmpifname IN ('eth0','eth1','eth2','eth3','eth4')
        AND snmpinterface.snmpifspeed > 1000000000;" 2>/dev/null || true
echo "    patched snmpifspeed to 1 Gbps for topology interfaces"

# 4. Clean up EnLinkd auto-discovered duplicates
echo "==> Cleaning up EnLinkd auto-discovered duplicate nodes..."
AUTO_DISC=$(curl -s -u "${AUTH}" \
  "${REST}/rest/nodes?limit=500" 2>/dev/null | \
  python3 -c "
import sys, re
data = sys.stdin.read()
nodes = re.findall(r'<node[^>]+>', data)
stale = []
for tag in nodes:
    fs = re.search(r'foreignSource=\"([^\"]*)\"', tag)
    nid = re.search(r'\bid=\"([^\"]*)\"', tag)
    if not nid:
        continue
    fs_val = fs.group(1) if fs else ''
    if fs_val not in ('Topology-Lab', 'selfmonitor', 'Self'):
        stale.append(nid.group(1))
print(' '.join(stale))
" 2>/dev/null || true)
if [[ -n "${AUTO_DISC}" ]]; then
  for nid in ${AUTO_DISC}; do
    curl -s -o /dev/null -u "${AUTH}" -X DELETE "${REST}/rest/nodes/${nid}"
  done
  echo "    deleted: ${AUTO_DISC}"
else
  echo "    none found"
fi

# 5. Reload EnLinkd for clean collection
curl -s -u "${AUTH}" \
  -H "Content-Type: application/xml" \
  -X POST "${REST}/rest/events" \
  -d '<event><uei>uei.opennms.org/internal/reloadDaemonConfig</uei><parms><parm><parmName>daemonName</parmName><value>EnLinkd</value></parm></parms></event>' \
  >/dev/null
echo "==> EnLinkd reloaded. Topology lab provisioned."
