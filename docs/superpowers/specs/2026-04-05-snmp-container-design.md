# SNMP Self-Monitoring in Test Container

**Date:** 2026-04-05  
**Branch:** feature/jmx-config-vue  
**Status:** Approved

## Context

The test container (`localhost/opennms/horizon:35.0.5-dark-mode`) is built via `build-dark-mode-overlay.sh` and used for manual E2E verification of Vue UI work. Currently no SNMP daemon runs in the container, so the OpenNMS UI components that display SNMP interface data (`SnmpInterfacesTable.vue`, `IpInterfacesTable.vue`) have nothing to show.

The goal is to make the container expose its own real network interfaces (lo, eth0, etc.) via SNMP, and have OpenNMS discover and provision itself as a node — so the SNMP Interfaces tab on the node detail page shows real data.

## Approach

Two-sided: install and start `snmpd` (net-snmp) inside the container, and configure OpenNMS to discover and poll it.

### Side 1: snmpd in the container image

Changes to the generated Dockerfile inside `build-dark-mode-overlay.sh`:

```dockerfile
RUN dnf install -y net-snmp && dnf clean all
COPY snmpd.conf /etc/snmp/snmpd.conf
COPY entrypoint-wrapper.sh /entrypoint-wrapper.sh
RUN chmod +x /entrypoint-wrapper.sh
COPY --chown=10001:10001 etc/snmp-config.xml /opt/opennms/etc/snmp-config.xml
RUN mkdir -p /opt/opennms/etc/imports
COPY --chown=10001:10001 etc/imports/Self.xml /opt/opennms/etc/imports/Self.xml
ENTRYPOINT ["/entrypoint-wrapper.sh"]
```

**`snmpd.conf`** — minimal, exposes full MIB-II ifTable by default:
```
rocommunity public 127.0.0.1
syslocation "OpenNMS Test Container"
syscontact "admin@localhost"
```

**`entrypoint-wrapper.sh`** — starts snmpd (daemonizes itself) then hands off:
```bash
#!/bin/bash
set -e
snmpd -c /etc/snmp/snmpd.conf
exec /entrypoint.sh "$@"
```

snmpd is started as root before the OpenNMS entrypoint drops to UID 10001. `--privileged` podman provides the capability to read interface stats.

### Side 2: OpenNMS configuration (overlay files)

Two config files staged into `${OVERLAY_DIR}/etc/` and COPYed into `/opt/opennms/etc/` in the Dockerfile.

**`etc/snmp-config.xml`** — tells OpenNMS how to poll the daemon:
```xml
<snmp-config xmlns="http://xmlns.opennms.org/xsd/config/snmp"
    version="v2c" read-community="public" port="161" timeout="1800" retry="1">
  <definition version="v2c" read-community="public" port="161">
    <specific>127.0.0.1</specific>
  </definition>
</snmp-config>
```

**`etc/imports/Self.xml`** — requisition provisiond auto-imports on startup:
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<model-import xmlns="http://xmlns.opennms.org/xsd/config/model-import"
    date-stamp="2026-04-05T00:00:00.000Z"
    foreign-source="Self"
    last-import="2026-04-05T00:00:00.000Z">
  <node node-label="OpenNMS-Self" foreign-id="self-01">
    <interface ip-addr="127.0.0.1" snmp-primary="P" status="1">
      <monitored-service service-name="SNMP"/>
      <monitored-service service-name="ICMP"/>
    </interface>
    <category name="Test"/>
  </node>
</model-import>
```

provisiond watches `etc/imports/` and imports requisitions at startup. The SNMP scan populates the `snmpinterfaces` and `ipinterfaces` tables — this is what `SnmpInterfacesTable.vue` reads via the REST API. No collectd changes are needed (interface table data comes from provisioning, not metrics collection).

## Files Modified

- `build-dark-mode-overlay.sh` — new staging section + Dockerfile additions

## Files Created (staged at build time, not committed to repo)

- `${OVERLAY_DIR}/snmpd.conf`
- `${OVERLAY_DIR}/entrypoint-wrapper.sh`
- `${OVERLAY_DIR}/etc/snmp-config.xml`
- `${OVERLAY_DIR}/etc/imports/Self.xml`

## Verification

1. `podman exec test-opennms snmpwalk -v2c -c public 127.0.0.1 IF-MIB::ifTable` — confirms snmpd is up and reporting real interfaces
2. Wait ~2–3 min for provisiond to finish import and SNMP scan
3. Navigate to `http://localhost:8980/opennms/` → node `OpenNMS-Self` → SNMP Interfaces tab shows lo, eth0 with ifIndex, ifDescr, ifName, ifSpeed
4. IP Interfaces tab shows 127.0.0.1 linked to the SNMP interface entry
