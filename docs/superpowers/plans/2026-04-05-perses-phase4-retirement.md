# Perses Phase 4 — Backshift Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy Backshift/Flot graph rendering infrastructure now that it has been fully replaced by Perses. Delete vendor JS bundles, the `onms-graph` and `forecast` webpack apps, remove `bootstrap.jsp`'s backshift asset loading, and change the `TimeSeries` default engine to `"perses"`.

**Architecture:** Pure cleanup — no new code is written. Every deletion is preceded by a grep to confirm no remaining callers. The `usebackshift` and `renderGraphs` bootstrap.jsp flags are removed. The `DEFAULT_GRAPHS_ENGINE_TYPE` constant changes to `"perses"`.

**Prerequisites:** Phase 2 and Phase 3 complete and verified in the container environment.

**Tech Stack:** Java, JSP, webpack (legacy `core/web-assets`)

---

## File Map

**Deleted:**
- `core/web-assets/src/main/assets/js/apps/onms-graph/index.js`
- `core/web-assets/src/main/assets/js/apps/forecast/index.js`
- `core/web-assets/src/main/assets/js/vendor/backshift-js.js`

**Modified:**
- `core/web-assets/package.json` — remove `backshift` npm dependency
- `core/web-assets/webpack.config.js` — remove `onms-graph` and `forecast` entry points
- `opennms-webapp/src/main/webapp/includes/bootstrap.jsp` — remove backshift/flot asset loading
- `core/lib/src/main/java/org/opennms/core/utils/TimeSeries.java` — change default engine to `"perses"`

**Possibly deleted** (verify first):
- `core/web-assets/src/main/assets/js/vendor/flot-js.js` — only if not used by anything other than backshift/NRTG

---

## Task 1: Confirm No Remaining Callers of Backshift

Before deleting anything, verify all consumers have been replaced.

- [ ] **Step 1: Check for backshift imports in web-assets**

```bash
grep -rn "backshift\|Backshift" core/web-assets/src/main/assets/js/ --include="*.js" --include="*.ts" | grep -v "vendor/backshift-js"
```

Expected: only `onms-graph/index.js` and `forecast/index.js` import backshift. If any other file imports it, stop and investigate before proceeding.

- [ ] **Step 2: Check for graph-container divs in JSPs**

```bash
grep -rn "graph-container\|renderGraphs\|usebackshift" opennms-webapp/src/main/webapp/ --include="*.jsp" | grep -v "#"
```

Expected: only `bootstrap.jsp` references these flags. The KSC and graph result JSPs should no longer inject `graph-container` divs when the engine is `perses` (because the controllers redirect before the JSP renders). If any JSP still uses `graph-container` outside of a perses-gate, flag it.

- [ ] **Step 3: Check for flot.js usage outside backshift**

```bash
grep -rn "flot-js\|require.*flot\|import.*flot" core/web-assets/src/main/assets/js/ --include="*.js" | grep -v "vendor/backshift-js\|apps/forecast\|apps/onms-graph"
grep -rn "flot-js\|require.*flot" opennms-webapp/src/main/webapp/ --include="*.jsp"
```

If `flot-js` is referenced by NRTG (`nrtg.jsp`) or any other page outside the backshift chain, note it — flot.js deletion may need to be deferred.

- [ ] **Step 4: Document findings**

If all checks are clean, proceed. If any unexpected caller is found, open a follow-up task before deleting.

---

## Task 2: Delete onms-graph App

**Files:**
- Delete: `core/web-assets/src/main/assets/js/apps/onms-graph/index.js`

- [ ] **Step 1: Verify no callers**

```bash
grep -rn "onms-graph\|apps/onms-graph" core/web-assets/src/ --include="*.js" --include="*.ts" --include="*.json"
```

Expected: references only in `webpack.config.js` (entry point) and possibly `bootstrap.jsp` (asset load). Both will be cleaned up in subsequent tasks.

- [ ] **Step 2: Delete the file**

```bash
rm core/web-assets/src/main/assets/js/apps/onms-graph/index.js
# Remove the directory if it's now empty:
rmdir core/web-assets/src/main/assets/js/apps/onms-graph/ 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add core/web-assets/src/main/assets/js/apps/onms-graph/
git commit -m "chore(cleanup): remove onms-graph webpack app (replaced by Perses)"
```

---

## Task 3: Delete forecast App

**Files:**
- Delete: `core/web-assets/src/main/assets/js/apps/forecast/index.js`

- [ ] **Step 1: Verify no callers outside forecast.jsp**

```bash
grep -rn "apps/forecast\|forecast/index" core/web-assets/src/ --include="*.js" --include="*.json"
grep -rn "asset.*forecast\|forecast.*asset" opennms-webapp/src/main/webapp/ --include="*.jsp"
```

Expected: only `webpack.config.js` and `forecast.jsp`. The `forecast.jsp` now redirects immediately when engine=perses so the asset is never loaded in the Perses path.

- [ ] **Step 2: Delete the file**

```bash
rm core/web-assets/src/main/assets/js/apps/forecast/index.js
rmdir core/web-assets/src/main/assets/js/apps/forecast/ 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add core/web-assets/src/main/assets/js/apps/forecast/
git commit -m "chore(cleanup): remove forecast webpack app (Perses forecast is future work)"
```

---

## Task 4: Delete backshift-js Vendor Bundle

**Files:**
- Delete: `core/web-assets/src/main/assets/js/vendor/backshift-js.js`

- [ ] **Step 1: Final check for any remaining backshift import**

```bash
grep -rn "backshift-js\|require.*backshift\|vendor/backshift" core/web-assets/src/ --include="*.js"
```

Expected: zero results (onms-graph and forecast were the only importers, now deleted)

- [ ] **Step 2: Delete the vendor bundle**

```bash
rm core/web-assets/src/main/assets/js/vendor/backshift-js.js
```

- [ ] **Step 3: Commit**

```bash
git add core/web-assets/src/main/assets/js/vendor/backshift-js.js
git commit -m "chore(cleanup): remove backshift-js vendor bundle"
```

---

## Task 5: Remove backshift npm Dependency

**Files:**
- Modify: `core/web-assets/package.json`
- Modify: `core/web-assets/webpack.config.js`

- [ ] **Step 1: Read the current webpack config entries**

```bash
grep -n "onms-graph\|forecast\|backshift" core/web-assets/webpack.config.js | head -10
```

Note the exact entry point keys to remove.

- [ ] **Step 2: Remove entry points from webpack.config.js**

Remove the `'onms-graph'` and `'forecast'` entries from the webpack `entry` object in `core/web-assets/webpack.config.js`.

- [ ] **Step 3: Remove backshift from package.json**

In `core/web-assets/package.json`, remove the `backshift` dependency entry (it's pinned to a GitHub tarball). Run:

```bash
cd core/web-assets && grep "backshift" package.json
```

Remove that line from `package.json`.

- [ ] **Step 4: Install to clean up lockfile**

```bash
cd core/web-assets && npm install
```

Expected: backshift removed from `package-lock.json`

- [ ] **Step 5: Build the web-assets module to verify**

```bash
./compile.pl -DskipTests --projects :org.opennms.features.distributed:core-web-assets install
```

If the artifact ID differs, find it with:
```bash
tools/development/pom-artifact.sh core/web-assets/pom.xml
```

Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add core/web-assets/package.json core/web-assets/package-lock.json core/web-assets/webpack.config.js
git commit -m "chore(deps): remove backshift npm dependency and webpack entry points"
```

---

## Task 6: Clean Up bootstrap.jsp

**Files:**
- Modify: `opennms-webapp/src/main/webapp/includes/bootstrap.jsp`

- [ ] **Step 1: Read the relevant section**

Read lines 172-197 of `bootstrap.jsp` (already read in prior context). The section to remove is:

```jsp
<c:if test='${__bs_flags.contains("renderGraphs")}'>
    <!-- Graphing -->
    <script type="text/javascript">
      window.onmsGraphContainers = {
          'engine': '<%= TimeSeries.getGraphEngine() %>',
          'baseHref': '<%= __baseHref %>'
      };
    </script>
    <jsp:include page="/assets/load-assets.jsp" flush="false">
      <jsp:param name="asset" value="onms-graph" />
    </jsp:include>
</c:if>

<c:if test='${__bs_flags.contains("usebackshift")}'>
  <%-- ... --%>
  <jsp:include ... asset=d3-js />
  <jsp:include ... asset=flot-js />
  <jsp:include ... asset=backshift-js />
</c:if>
```

- [ ] **Step 2: Remove both c:if blocks**

Remove the entire `renderGraphs` block (lines 172-184) and the entire `usebackshift` block (lines 186-197) from `bootstrap.jsp`.

- [ ] **Step 3: Verify bootstrap.jsp still compiles**

```bash
./compile.pl -DskipTests --projects :opennms-webapp install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp/src/main/webapp/includes/bootstrap.jsp
git commit -m "chore(cleanup): remove renderGraphs and usebackshift asset loading from bootstrap.jsp"
```

---

## Task 7: Optionally Delete flot-js

- [ ] **Step 1: Check if flot-js is still used**

```bash
grep -rn "flot-js\|require.*flot\|vendor/flot" \
  core/web-assets/src/main/assets/js/ \
  opennms-webapp/src/main/webapp/ \
  --include="*.js" --include="*.jsp" --include="*.ts"
```

- If **zero results**: delete `core/web-assets/src/main/assets/js/vendor/flot-js.js` and commit.
- If **results found** (e.g., `nrtg.jsp`): leave flot-js in place and open a follow-up task to handle the remaining consumer.

```bash
# Only run if zero results above:
rm core/web-assets/src/main/assets/js/vendor/flot-js.js
git add core/web-assets/src/main/assets/js/vendor/flot-js.js
git commit -m "chore(cleanup): remove flot-js vendor bundle (no remaining consumers)"
```

---

## Task 8: Change Default Graph Engine to "perses"

**Files:**
- Modify: `core/lib/src/main/java/org/opennms/core/utils/TimeSeries.java`

- [ ] **Step 1: Change the constant**

In `TimeSeries.java`, change:

```java
public static final String DEFAULT_GRAPHS_ENGINE_TYPE = "backshift";
```

to:

```java
public static final String DEFAULT_GRAPHS_ENGINE_TYPE = "perses";
```

- [ ] **Step 2: Verify `getGraphEngine()` still works**

The method already handles `"auto"` specially (returns `DEFAULT_GRAPHS_ENGINE_TYPE`). Since the default is now `"perses"`, both `"auto"` and an unset property will return `"perses"`.

- [ ] **Step 3: Compile**

```bash
./compile.pl -DskipTests --projects :opennms-core install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Run TimeSeries-related tests if any exist**

```bash
grep -rn "TimeSeries\|getGraphEngine" opennms-*/src/test/ --include="*.java" -l | head -5
```

Run any found test files to confirm no regressions.

- [ ] **Step 5: Commit**

```bash
git add core/lib/src/main/java/org/opennms/core/utils/TimeSeries.java
git commit -m "feat(timeseries): change default graph engine from backshift to perses"
```

---

## Task 9: Final Build Verification

- [ ] **Step 1: Full build of affected modules**

```bash
./compile.pl -DskipTests --projects :opennms-webapp,:opennms-webapp-rest,:opennms-core -am install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 2: Full frontend build**

```bash
cd ui && yarn build 2>&1 | tail -10
```

Expected: success, no warnings about missing modules

- [ ] **Step 3: Run all frontend tests**

```bash
cd ui && yarn test
```

Expected: all pass

- [ ] **Step 4: Container smoke test**

Rebuild the overlay container and verify:

```bash
# After container starts (health check passes):

# 1. Backshift assets are NOT served
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8980/opennms/assets/backshift-js.js
# Expected: 404

# 2. KSC redirect still works
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
  -u admin:notdefault \
  http://localhost:8980/opennms/KSC/index.htm
# Expected: 302 .../ui/index.html#/dashboards

# 3. Graph results redirect
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
  -u admin:notdefault \
  "http://localhost:8980/opennms/graph/results.htm?resourceId=node%5B1%5D"
# Expected: 302 .../ui/index.html#/resource-graphs/graphs/node%5B1%5D

# 4. Dashboards API is live
curl -s -u admin:notdefault \
  http://localhost:8980/opennms/rest/dashboards
# Expected: []
```

- [ ] **Step 5: Commit any final fixes**

```bash
git add -p
git commit -m "fix(phase4): final build and smoke test fixes"
```

---

## Phase 4 Complete — Backshift Infrastructure Retired

At this point:
- `backshift-js.js`, `onms-graph/index.js`, `forecast/index.js`, `flot-js.js` (if clean) are gone
- `bootstrap.jsp` no longer loads backshift or flot assets
- `TimeSeries.DEFAULT_GRAPHS_ENGINE_TYPE` is `"perses"`
- The default engine for all new OpenNMS installations is Perses
- The legacy `"backshift"` value still works as an explicit opt-out (for operators who need the legacy rendering)

**Total changes across all 4 phases:**
- New: Liquibase migration, Java entity/DAO/REST, OpenNMS Perses datasource plugin, React mount infrastructure, `DashboardList`, `DashboardViewer`, dashboard REST service
- Updated: `RrdGraphConverter` (Perses output), `Graph.vue` (PersesPanel), `TimeSeries.java`, `bootstrap.jsp`, 5 Spring MVC controllers, Vue router
- Deleted: `backshift-js.js`, `onms-graph/index.js`, `forecast/index.js`, `HtmlLegendPlugin.ts`, `LegendFormatter.ts`, `chart.js`, `chartjs-plugin-zoom`
