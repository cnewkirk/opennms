#!/usr/bin/env bash
# build-dark-mode-overlay.sh
# Builds the dark-mode/modern-ui overlay image for container testing.
# Compiles web-assets (webpack) and the Vue menu (vite), then assembles
# a minimal Dockerfile overlay on top of the released 35.0.4 image.
#
# Using 35.0.4 as base (not 35.0.5-api-tokens) avoids a Karaf feature
# resolution crash in the api-tokens overlay.  Our vite build already
# includes the LightDarkMode toggle, so we don't need the api-tokens
# base for dark mode functionality.
#
# Usage:  ./build-dark-mode-overlay.sh
# Result: podman image tagged  localhost/opennms/horizon:35.0.5-dark-mode
#         Run + password setup instructions printed at the end.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OVERLAY_DIR="$(mktemp -d)"
IMAGE_TAG="localhost/opennms/horizon:35.0.5-dark-mode"
ONMS_BASE_IMAGE="docker.io/opennms/horizon:35.0.4"

echo "==> overlay staging dir: ${OVERLAY_DIR}"

# ---------------------------------------------------------------------------
# 1. Build web-assets (webpack) — produces dark-mode.css + modern-ui.css
# ---------------------------------------------------------------------------
echo ""
echo "==> [1/4] Building core/web-assets (webpack)..."
cd "${SCRIPT_DIR}/core/web-assets"
# pnpm is used by this module.
# Exit code 2 from webpack means there were errors in OTHER scss files (pre-existing
# vaadin-theme import issues in the codebase). Our new bundles are still emitted.
# We verify success by checking for the output files explicitly.
pnpm run webpack || true
# Output lands in target/dist/assets/
WEBASSETS_DIST="${SCRIPT_DIR}/core/web-assets/target/dist/assets"

if [[ ! -f "${WEBASSETS_DIST}/dark-mode.css" ]]; then
  echo "ERROR: dark-mode.css not found in ${WEBASSETS_DIST} — webpack build failed" >&2
  exit 1
fi
if [[ ! -f "${WEBASSETS_DIST}/modern-ui.css" ]]; then
  echo "ERROR: modern-ui.css not found in ${WEBASSETS_DIST} — webpack build failed" >&2
  exit 1
fi
if [[ ! -f "${WEBASSETS_DIST}/assets.json" ]]; then
  echo "ERROR: assets.json not found in ${WEBASSETS_DIST} — webpack build failed" >&2
  exit 1
fi
echo "    dark-mode.css: OK"
echo "    modern-ui.css: OK"

# ---------------------------------------------------------------------------
# 2. Build Vue menu (vite) — produces updated index.js with dark mode toggle
# ---------------------------------------------------------------------------
echo ""
echo "==> [2/4] Building ui/ menu (vite build:menu)..."
cd "${SCRIPT_DIR}/ui"
pnpm run build:menu
# vite.config.menu.ts sets root='./src/menu' and outDir='./dist-menu'
# so output lands in ui/src/menu/dist-menu/
UI_DIST="${SCRIPT_DIR}/ui/src/menu/dist-menu"

if [[ ! -f "${UI_DIST}/assets/index.js" ]]; then
  echo "ERROR: ui dist-menu/assets/index.js not found" >&2
  exit 1
fi
echo "    index.js: OK"

# ---------------------------------------------------------------------------
# 3a. Build opennms-webapp (Spring MVC controllers: CategoryController, SendEventController, etc.)
# ---------------------------------------------------------------------------
echo ""
echo "==> [3a/4] Building opennms-webapp..."
cd "${SCRIPT_DIR}"
./compile.pl -DskipTests -Ddisable.checkstyle --projects :opennms-webapp install 2>&1 | tail -5
# JAR artifact is inside the exploded WAR directory (same pattern as opennms-webapp-rest)
WEBAPP_JAR=$(find "${SCRIPT_DIR}/opennms-webapp/target" -path '*/WEB-INF/lib/opennms-webapp-*.jar' -newer "${SCRIPT_DIR}/opennms-webapp/pom.xml" -print0 | xargs -0 ls -t 2>/dev/null | head -1)
if [[ -z "${WEBAPP_JAR}" || ! -f "${WEBAPP_JAR}" ]]; then
  echo "ERROR: opennms-webapp jar not found in target/" >&2
  exit 1
fi
echo "    opennms-webapp.jar: OK ($(basename "${WEBAPP_JAR}"))"

# ---------------------------------------------------------------------------
# 3b. Build opennms-webapp-rest (needed for JMX Config Generator backend)
# ---------------------------------------------------------------------------
echo ""
echo "==> [3b/4] Building opennms-webapp-rest..."
cd "${SCRIPT_DIR}"
./compile.pl -DskipTests -Ddisable.checkstyle --projects :opennms-webapp-rest install 2>&1 | tail -5
# Find the built jar dynamically — version may differ from base image
WEBAPP_REST_JAR=$(find "${SCRIPT_DIR}/opennms-webapp-rest/target" -path '*/WEB-INF/lib/opennms-webapp-rest-*.jar' -newer "${SCRIPT_DIR}/opennms-webapp-rest/pom.xml" -print0 | xargs -0 ls -t 2>/dev/null | head -1)
if [[ -z "${WEBAPP_REST_JAR}" || ! -f "${WEBAPP_REST_JAR}" ]]; then
  echo "ERROR: opennms-webapp-rest jar not found in target/" >&2
  exit 1
fi
echo "    opennms-webapp-rest.jar: OK ($(basename "${WEBAPP_REST_JAR}"))"

# ---------------------------------------------------------------------------
# 3c. Pre-hash admin password (notdefault) so image starts with correct creds
# Use the base image's own Java + jasypt to avoid any host-Java dependency.
# ---------------------------------------------------------------------------
echo "==> [3c/4] Pre-hashing admin password..."
ADMIN_HASH=$(podman run --rm --privileged --entrypoint java "${ONMS_BASE_IMAGE}" \
  -cp /opt/opennms/lib/jasypt-1.9.3.jar \
  org.jasypt.intf.cli.JasyptStringDigestCLI \
  input='notdefault' algorithm=SHA-256 saltSizeBytes=16 iterations=100000 2>/dev/null \
  | grep -A2 'OUTPUT' | tail -1 | tr -d '[:space:]')
if [[ -z "$ADMIN_HASH" ]]; then
  echo "ERROR: failed to compute admin password hash — jasypt run in base image produced no output" >&2
  exit 1
fi
echo "    admin hash: OK"

# ---------------------------------------------------------------------------
# 4. Stage overlay directory
# ---------------------------------------------------------------------------
echo ""
echo "==> [4/4] Staging overlay..."

# web-assets CSS: copy the two new bundles + their sourcemaps if present.
mkdir -p "${OVERLAY_DIR}/assets"
cp "${WEBASSETS_DIST}/dark-mode.css"   "${OVERLAY_DIR}/assets/"
cp "${WEBASSETS_DIST}/modern-ui.css"   "${OVERLAY_DIR}/assets/"
[[ -f "${WEBASSETS_DIST}/dark-mode.css.map"  ]] && cp "${WEBASSETS_DIST}/dark-mode.css.map"  "${OVERLAY_DIR}/assets/"
[[ -f "${WEBASSETS_DIST}/modern-ui.css.map"  ]] && cp "${WEBASSETS_DIST}/modern-ui.css.map"  "${OVERLAY_DIR}/assets/"

# Patch the base image's assets.json to add only the two new bundle entries.
# We CANNOT replace assets.json wholesale — the manifest entry contains inline
# webpack JS that must match the bundle files already in the base image.
# Extract the new entries from our build and inject them into the base image's copy.
podman run --rm --entrypoint cat "${ONMS_BASE_IMAGE}" \
  /opt/opennms/jetty-webapps/opennms/assets/assets.json \
  > "${OVERLAY_DIR}/assets/assets-base.json"

python3 - "${OVERLAY_DIR}/assets/assets-base.json" \
           "${WEBASSETS_DIST}/assets.json" \
           "${OVERLAY_DIR}/assets/assets.json" \
           "${OVERLAY_DIR}/assets/assets.min.json" <<'PYEOF'
import json, sys

base_path, new_path, out_path, out_min_path = sys.argv[1:]

with open(base_path) as f:
    base = json.load(f)
with open(new_path) as f:
    new_build = json.load(f)

base['dark-mode'] = new_build['dark-mode']
base['modern-ui']  = new_build['modern-ui']

for p in (out_path, out_min_path):
    with open(p, 'w') as f:
        json.dump(base, f, indent=2)
PYEOF
echo "    assets.json: patched (added dark-mode + modern-ui to base image entries)"

# Vue menu assets (full replacement — we changed index.js)
mkdir -p "${OVERLAY_DIR}/ui-components/assets"
cp -r "${UI_DIST}/assets/." "${OVERLAY_DIR}/ui-components/assets/"

# JSPs (need full container rebuild — Jetty caches compiled JSPs)
mkdir -p "${OVERLAY_DIR}/includes"
cp "${SCRIPT_DIR}/opennms-webapp/src/main/webapp/includes/bootstrap.jsp" \
   "${OVERLAY_DIR}/includes/bootstrap.jsp"

# All sendRedirect JSPs — collected dynamically so future additions are automatic.
# Preserves directory structure; WEB-INF/jsp/ files land at the correct container path.
WEBAPP_SRC="${SCRIPT_DIR}/opennms-webapp/src/main/webapp"
echo "    Collecting sendRedirect JSPs from source tree..."
while IFS= read -r file; do
  rel="${file#${WEBAPP_SRC}/}"
  mkdir -p "${OVERLAY_DIR}/$(dirname "${rel}")"
  cp "${file}" "${OVERLAY_DIR}/${rel}"
done < <(grep -rl "sendRedirect" "${WEBAPP_SRC}" --include="*.jsp" --include="*.htm" 2>/dev/null)
JSP_COUNT=$(grep -rl "sendRedirect" "${WEBAPP_SRC}" --include="*.jsp" --include="*.htm" 2>/dev/null | wc -l | tr -d ' ')
echo "    sendRedirect JSPs staged: ${JSP_COUNT}"


# opennms-webapp jar — rename to match base image version so COPY replaces it
# Contains updated Spring MVC controllers (CategoryController → /ui/surveillance-categories,
# SendEventController → /ui/send-event).
WEBAPP_BASENAME="opennms-webapp-35.0.4.jar"
mkdir -p "${OVERLAY_DIR}/webapp-lib"
cp "${WEBAPP_JAR}" "${OVERLAY_DIR}/webapp-lib/${WEBAPP_BASENAME}"
echo "    opennms-webapp.jar: staged ($(basename "${WEBAPP_JAR}") → ${WEBAPP_BASENAME})"

# opennms-webapp-rest jar — rename to match base image version so COPY replaces it
# DashboardRestService references OnmsDashboard (not in 35.0.4 base model jar), and the
# 35.0.5-SNAPSHOT model jar requires core packages at version 36.x (not available in the
# 35.0.4 Karaf feature repo).  Strip DashboardRestService from the jar to avoid the entire
# cascade — we don't need it for JMX Config Generator or MIB Compiler testing.
WEBAPP_REST_BASENAME="opennms-webapp-rest-35.0.4.jar"
mkdir -p "${OVERLAY_DIR}/webapp-rest-lib"
cp "${WEBAPP_REST_JAR}" "${OVERLAY_DIR}/webapp-rest-lib/${WEBAPP_REST_BASENAME}"
zip -d "${OVERLAY_DIR}/webapp-rest-lib/${WEBAPP_REST_BASENAME}" \
  'org/opennms/web/rest/v2/DashboardRestService.class' \
  'org/opennms/web/rest/v2/DashboardRestService$*.class' \
  'org/opennms/web/rest/v2/TopologyViewsRestService.class' \
  'org/opennms/web/rest/v2/TopologyViewsRestService$*.class' 2>/dev/null || true
echo "    opennms-webapp-rest.jar: OK (DashboardRestService + TopologyViewsRestService stripped)"

# Spring context XML — base image doesn't have jmxconfig in component-scan
mkdir -p "${OVERLAY_DIR}/spring-context"
cp "${SCRIPT_DIR}/opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml" \
   "${OVERLAY_DIR}/spring-context/"
# Spring Security XML — topology/views intercept rules must precede REST catch-all
cp "${SCRIPT_DIR}/opennms-webapp/src/main/webapp/WEB-INF/applicationContext-spring-security.xml" \
   "${OVERLAY_DIR}/spring-context/"

# Also copy .js stubs so the entry is resolvable if anything tries to load them
cp "${WEBASSETS_DIST}/dark-mode.js"    "${OVERLAY_DIR}/assets/"
cp "${WEBASSETS_DIST}/modern-ui.js"    "${OVERLAY_DIR}/assets/"
[[ -f "${WEBASSETS_DIST}/dark-mode.js.map"  ]] && cp "${WEBASSETS_DIST}/dark-mode.js.map"  "${OVERLAY_DIR}/assets/"
[[ -f "${WEBASSETS_DIST}/modern-ui.js.map"  ]] && cp "${WEBASSETS_DIST}/modern-ui.js.map"  "${OVERLAY_DIR}/assets/"

# ---------------------------------------------------------------------------
# SNMP: snmpd daemon config + entrypoint wrapper + OpenNMS client config
# ---------------------------------------------------------------------------
cat > "${OVERLAY_DIR}/snmpd.conf" <<'SNMPD'
rocommunity public 127.0.0.1
syslocation "OpenNMS Test Container"
syscontact "admin@localhost"
SNMPD

cat > "${OVERLAY_DIR}/entrypoint-wrapper.sh" <<'WRAPPER'
#!/bin/bash
# Start snmpd on port 1161 (no root required) in background, log to stdout.
# Don't use set -e here — snmpd failure is non-fatal; OpenNMS should still start.
snmpd -Lo -p /tmp/snmpd.pid -c /etc/snmp/snmpd.conf udp:1161 &
exec /entrypoint.sh "$@"
WRAPPER
chmod +x "${OVERLAY_DIR}/entrypoint-wrapper.sh"

mkdir -p "${OVERLAY_DIR}/etc/imports"

cat > "${OVERLAY_DIR}/etc/snmp-config.xml" <<'SNMPCFG'
<snmp-config xmlns="http://xmlns.opennms.org/xsd/config/snmp"
    version="v2c" read-community="public" port="1161" timeout="1800" retry="1">
  <definition version="v2c" read-community="public" port="1161">
    <specific>127.0.0.1</specific>
  </definition>
  <definition version="v2c" read-community="public" port="161">
    <range begin="10.100.0.10" end="10.100.0.25"/>
  </definition>
</snmp-config>
SNMPCFG

cat > "${OVERLAY_DIR}/etc/enlinkd-configuration.xml" <<'ENLINKD'
<?xml version="1.0" encoding="ISO-8859-1"?>
<enlinkd-configuration threads="3"
                     executor-queue-size="100"
                     executor-threads="5"
                     discovery-bridge-threads="1"
                     initial_sleep_time="30000"
                     bridge_topology_interval="30000"
                     topology_interval="30000"
                     cdp_rescan_interval="30000"
                     lldp_rescan_interval="30000"
                     bridge_rescan_interval="30000"
                     ospf_rescan_interval="30000"
                     isis_rescan_interval="30000"
                     cdp-priority="1000"
                     lldp-priority="2000"
                     bridge-priority="10000"
                     ospf-priority="3000"
                     isis-priority="4000"
                     use-cdp-discovery="true"
                     use-bridge-discovery="true"
                     use-lldp-discovery="true"
                     use-ospf-discovery="true"
                     use-isis-discovery="true"
                     disable-bridge-vlan-discovery="false"
                     max_bft="100"
                     />
ENLINKD

cat > "${OVERLAY_DIR}/etc/collectd-configuration.xml" <<'COLLECTD'
<?xml version="1.0"?>
<collectd-configuration xmlns="http://xmlns.opennms.org/xsd/config/collectd"
    threads="50">
  <package name="example1" remote="false">
    <filter>IPADDR != '0.0.0.0'</filter>
    <include-range begin="1.1.1.1" end="254.254.254.254"/>
    <include-range begin="::1" end="ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"/>
    <service name="SNMP" interval="30000" user-defined="false" status="on">
      <parameter key="collection" value="${requisition:collection|detector:collection|default}"/>
      <parameter key="thresholding-enabled" value="true"/>
    </service>
  </package>
  <collector service="SNMP" class-name="org.opennms.netmgt.collectd.SnmpCollector"/>
</collectd-configuration>
COLLECTD

cat > "${OVERLAY_DIR}/etc/imports/Self.xml" <<'REQUISITION'
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
REQUISITION

echo "    snmpd.conf + entrypoint-wrapper.sh + snmp-config.xml + enlinkd-configuration.xml + collectd-configuration.xml + imports/Self.xml: staged"

# ---------------------------------------------------------------------------
# 4. Write Dockerfile
# ---------------------------------------------------------------------------
# NOTE: The container's entrypoint (/entrypoint.sh) builds the JVM command
# directly and does NOT source opennms.conf.  The only way to pass extra
# JVM system properties is through the JAVA_OPTS environment variable,
# which is appended verbatim to the exec call:
#   exec java ${OPENNMS_JAVA_OPTS} ${JAVA_OPTS} -jar opennms_bootstrap.jar start
#
# AssetLocatorImpl reads assets.json from CLASSPATH by default (from the
# web-assets-*.jar).  Setting org.opennms.web.assets.path overrides that
# to the filesystem path, which is where our patched assets.json lives.
cat > "${OVERLAY_DIR}/Dockerfile" <<DOCKERFILE
FROM ${ONMS_BASE_IMAGE}

USER root

# New CSS bundles (dark-mode + modern-ui) + JS stubs + patched assets.json
COPY --chown=10001:10001 assets/ /opt/opennms/jetty-webapps/opennms/assets/

# Updated Vue menu with dark mode toggle icon
COPY --chown=10001:10001 ui-components/assets/ /opt/opennms/jetty-webapps/opennms/ui-components/assets/

# bootstrap.jsp with CSS loads + theme init script + Vaadin iframe injection
COPY --chown=10001:10001 includes/bootstrap.jsp /opt/opennms/jetty-webapps/opennms/includes/bootstrap.jsp

# sendRedirect JSPs — all collected dynamically in the shell phase above.
# Includes admin/*, element/*, account/*, alarm/*, asset/*, notification/*, etc.
# WEB-INF/jsp/ files land at the correct container path automatically.
$(find "${OVERLAY_DIR}" \( -name "*.jsp" -o -name "*.htm" \) \
    ! -path "*/includes/bootstrap.jsp" 2>/dev/null | sort | \
  while IFS= read -r file; do
    rel="${file#${OVERLAY_DIR}/}"
    echo "COPY --chown=10001:10001 ${rel} /opt/opennms/jetty-webapps/opennms/${rel}"
  done)

# Patch welcome-file to index.jsp (Vue dashboard redirect) — single-line sed because
# full web.xml overlay breaks CXF servlet mappings (source version != base image version)
RUN sed -i 's|<welcome-file>frontPage.jsp</welcome-file>|<welcome-file>index.jsp</welcome-file>|' /opt/opennms/jetty-webapps/opennms/WEB-INF/web.xml

# Patch Content-Security-Policy so MapLibre GL JS can fetch vector/raster tiles and
# run its Web Workers. Keeps 'self' for same-origin API calls and adds tile domains
# to connect-src; adds worker-src for the blob-URL workers MapLibre spawns.
RUN sed -i "s|connect-src 'self' ;|connect-src 'self' https://tiles.opennms.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://tile.opentopomap.org https://*.tile.opentopomap.org ; worker-src 'self' blob: ;|" /opt/opennms/jetty-webapps/opennms/WEB-INF/web.xml

# jmxconfiggenerator + its transitive dep namecutter must be in the Bootstrap server
# classpath (not WEB-INF/lib) so Jetty's WebAppClassLoader can resolve them.
RUN cp /opt/opennms/system/org/opennms/features/jmxconfiggenerator/35.0.4/jmxconfiggenerator-35.0.4.jar /opt/opennms/lib/jmxconfiggenerator-35.0.4.jar && cp /opt/opennms/system/org/opennms/features/org.opennms.features.name-cutter/35.0.4/org.opennms.features.name-cutter-35.0.4.jar /opt/opennms/lib/org.opennms.features.name-cutter-35.0.4.jar

# mib-compiler + jsmiparser for SNMP MIB Compiler REST endpoints (Bootstrap classpath)
# jsmiparser jars are embedded inside the mib-compiler OSGi bundle via Embed-Dependency.
# The JVM can't see embedded JARs on the classpath, so we extract them separately.
RUN cp /opt/opennms/system/org/opennms/features/org.opennms.features.mib-compiler/35.0.4/org.opennms.features.mib-compiler-35.0.4.jar /opt/opennms/lib/org.opennms.features.mib-compiler-35.0.4.jar && \
    cd /tmp && unzip -o /opt/opennms/system/org/opennms/features/org.opennms.features.mib-compiler/35.0.4/org.opennms.features.mib-compiler-35.0.4.jar jsmiparser-api-0.14.jar jsmiparser-util-0.14.jar && \
    mv /tmp/jsmiparser-api-0.14.jar /opt/opennms/lib/ && \
    mv /tmp/jsmiparser-util-0.14.jar /opt/opennms/lib/

# Updated opennms-webapp with patched Spring MVC controllers (categories/sendevent redirects)
COPY --chown=10001:10001 webapp-lib/${WEBAPP_BASENAME} /opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-35.0.4.jar

# Updated opennms-webapp-rest with JMX Config + MIB Compiler REST endpoints
COPY --chown=10001:10001 webapp-rest-lib/${WEBAPP_REST_BASENAME} /opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-rest-35.0.4.jar

# Spring context with jmxconfig + mibcompiler packages in component-scan (base image lacks them)
COPY --chown=10001:10001 spring-context/applicationContext-cxf-rest-v2.xml /opt/opennms/jetty-webapps/opennms/WEB-INF/applicationContext-cxf-rest-v2.xml
# Spring Security with topology/views intercept rules before the REST catch-all
COPY --chown=10001:10001 spring-context/applicationContext-spring-security.xml /opt/opennms/jetty-webapps/opennms/WEB-INF/applicationContext-spring-security.xml

# Tell AssetLocatorImpl to load assets.json from the filesystem (not the
# classpath JAR that lacks dark-mode/modern-ui entries).
# The entrypoint appends \${JAVA_OPTS} to the JVM exec line, so ENV is the
# correct mechanism — opennms.conf is NOT sourced by the container entrypoint.
ENV JAVA_OPTS="-Dorg.opennms.web.assets.path=/opt/opennms/jetty-webapps/opennms/assets/"

# Install net-snmp (daemon) + net-snmp-utils (snmpwalk for verification)
RUN microdnf install -y net-snmp net-snmp-utils && microdnf clean all
COPY snmpd.conf /etc/snmp/snmpd.conf
COPY entrypoint-wrapper.sh /entrypoint-wrapper.sh
RUN chmod +x /entrypoint-wrapper.sh

# Set admin password to notdefault (hash pre-computed at build time)
RUN sed -i "s|<password salt=\"true\">.*</password>|<password salt=\"true\">${ADMIN_HASH}</password>|" \
    /opt/opennms/etc/users.xml

# OpenNMS SNMP client config + self-provisioning requisition
COPY --chown=10001:10001 etc/snmp-config.xml /opt/opennms/etc/snmp-config.xml
COPY --chown=10001:10001 etc/enlinkd-configuration.xml /opt/opennms/etc/enlinkd-configuration.xml
COPY --chown=10001:10001 etc/collectd-configuration.xml /opt/opennms/etc/collectd-configuration.xml
COPY --chown=10001:10001 etc/imports/Self.xml /opt/opennms/etc/imports/Self.xml

ENTRYPOINT ["/entrypoint-wrapper.sh"]

USER 10001
DOCKERFILE
echo "    Dockerfile: written (ENV JAVA_OPTS sets web assets path)"

# ---------------------------------------------------------------------------
# 5. Build image
# ---------------------------------------------------------------------------
echo ""
echo "==> Building container image: ${IMAGE_TAG}"
podman build --no-cache -t "${IMAGE_TAG}" "${OVERLAY_DIR}"

echo ""
echo "==> Build complete: ${IMAGE_TAG}"
echo ""
echo "==> Overlay dir (kept for inspection): ${OVERLAY_DIR}"
echo ""
echo "============================================================"
echo " Run + setup (needs postgres on host):"
echo "============================================================"
echo ""
echo "# 1. Start"
echo "podman rm -f test-opennms 2>/dev/null; podman run -d --name test-opennms --privileged \\"
echo "  -p 8980:8980 -p 8101:8101 \\"
echo "  -e POSTGRES_HOST=host.containers.internal \\"
echo "  -e POSTGRES_PORT=5432 \\"
echo "  -e POSTGRES_USER=postgres \\"
echo "  -e POSTGRES_PASSWORD=postgres \\"
echo "  -e OPENNMS_DBNAME=opennms \\"
echo "  -e OPENNMS_DBUSER=opennms \\"
echo "  -e OPENNMS_DBPASS=opennms \\"
echo "  ${IMAGE_TAG} -s"
echo ""
echo "# 2. Wait for startup"
echo "until curl -s -o /dev/null -w '%{http_code}' -u admin:admin http://localhost:8980/opennms/rest/info | grep -q 200; do sleep 5; done && echo ready"
echo ""
echo "# 3. Set password to notdefault via Jasypt (REST API stores plaintext, breaking Jasypt verification)"
echo "HASH=\$(podman exec test-opennms java -cp /opt/opennms/lib/jasypt-1.9.3.jar \\"
echo "  org.jasypt.intf.cli.JasyptStringDigestCLI \\"
echo "  input='notdefault' algorithm=SHA-256 saltSizeBytes=16 iterations=100000 2>/dev/null \\"
echo "  | tail -3 | head -1)"
echo "podman exec test-opennms sed -i \\"
echo "  \"s|<password salt=\\\"true\\\">.*</password>|<password salt=\\\"true\\\">\${HASH}</password>|\" \\"
echo "  /opt/opennms/etc/users.xml"
echo "# users.xml auto-reloads in ~5s"
echo ""
echo "# 4. Open: http://localhost:8980/opennms/  (login: admin / notdefault)"
echo ""
echo " What to verify:"
echo "  1. Sun/moon icon visible in the Feather app bar (top right)"
echo "  2. Clicking it toggles dark mode on the JSP content area"
echo "  3. Reload preserves the theme (no flash of light mode)"
echo "  4. Topology / dashboard Vaadin iframes also go dark"
echo ""
echo "# Cleanup:"
echo "  podman rm -f test-opennms"
