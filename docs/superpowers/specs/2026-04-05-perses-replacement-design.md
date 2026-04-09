# Perses Replacement for Backshift Graph Infrastructure

**Date:** 2026-04-05  
**Branch:** feature/jmx-config-vue  
**Status:** Approved

## Overview

Replace the legacy Backshift/Flot graph rendering infrastructure with Perses — a CNCF-graduated dashboard platform — across both the legacy JSP stack and the Vue SPA. The Dashboards section replaces and rebrands KSC reports as a full Grafana-like dashboard builder embedded in the OpenNMS experience.

## Scope

**In scope:**
- Full replacement of `Backshift.Graph.Flot` rendering in legacy JSP pages
- Full replacement of Chart.js rendering in the Vue SPA Resource Graphs page
- New Dashboards section replacing KSC reports (rebranded, not just graph rendering)
- OpenNMS Perses datasource plugin (`/rest/measurements` integration)
- Server-side dashboard storage (new `onms_dashboards` table + REST API)
- URL redirects from legacy JSP pages to new Vue SPA routes
- Groundwork for Perses-based forecast panel (replaces Angular/Backshift forecast page)

**Out of scope:**
- KSC config auto-migration (provided as optional utility, not required for launch)
- Perses upstream contribution / standalone Perses server deployment
- Non-graph Vaadin pages

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  OpenNMS Vue SPA  (Vue 3 + Feather DS)                  │
│                                                         │
│  Vue Router                                             │
│  ├── /resource-graphs/*   → ResourceGraphs.vue          │
│  │      └── <PersesPanel> (React mount per graph)       │
│  ├── /dashboards          → DashboardList.vue           │
│  ├── /dashboards/:id      → DashboardViewer.vue         │
│  │      └── <PersesCanvas> (React mount, full editor)   │
│  ├── /dashboards/:id/edit → DashboardViewer.vue (edit)  │
│  └── /dashboards/new      → DashboardViewer.vue (new)   │
│                                                         │
│  Redirect layer (active when engine=perses)             │
│  ├── /KSC/*       → /dashboards/*                       │
│  ├── /graph/results.htm → /resource-graphs/*            │
│  └── /graph/forecast.jsp → /dashboards/new (seeded)     │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐    ┌───────────────────────────┐
│ React subtrees   │    │  OpenNMS REST              │
│                  │    │                            │
│ @perses-dev/     │    │  /rest/measurements  ◄─────┼── OpenNMS Datasource Plugin
│   dashboards     │    │  /rest/graphs/<name>       │   (implements Perses DataSource)
│ @perses-dev/     │    │  /rest/resources/*         │
│   panels-plugin  │    │  /rest/dashboards/* (new)  │
│                  │    │   └── stores Perses JSON    │
└──────────────────┘    └───────────────────────────┘
```

**Key decisions:**
- Vue SPA owns the entire page chrome (nav, header, Feather DS). React subtrees are mounted by Vue components at designated container divs — Vue manages the container, React manages the canvas inside.
- Perses is React + MUI. Framework mismatch is handled via `ReactDOM.createRoot` at mount points — no bridge library.
- The `RrdGraphConverter` TypeScript port stays client-side. Its output is changed from Chart.js datasets to Perses panel specs.
- `org.opennms.web.graphs.engine=perses` activates the full new stack and enables all redirects. Our container test environment sets this property.

## Component 1 — OpenNMS Datasource Plugin

**Location:** `ui/src/datasource/opennms/`

```
opennms/
├── index.ts        — registers plugin with Perses plugin registry
├── plugin.ts       — DataSourcePlugin definition
├── client.ts       — fetches /rest/measurements, maps response to TimeSeriesData
├── QueryEditor.tsx — React component: resource + metric picker in dashboard editor
└── types.ts        — OpenNMSQuery { resourceId, attribute, aggregation, label, expression }
```

**Query execution:**
1. Perses calls `plugin.getTimeSeriesData(query, timeRange)`
2. Plugin maps `OpenNMSQuery` → `/rest/measurements` payload
3. Response columns/timestamps mapped to Perses `TimeSeriesData`
4. Auth: same-origin session cookies, no additional token handling

**Two query modes:**
- **Prefab graphs:** `RrdGraphConverter` emits `OpenNMSQuery[]` from graph definition — no user interaction
- **User-built dashboards:** `QueryEditor` lets users pick resource + metric interactively

## Component 2 — React-in-Vue Mounting + Theme Bridge

**`usePerses` composable** (`ui/src/composables/usePerses.ts`):

```typescript
export function usePerses(containerRef: Ref<HTMLElement | null>, spec: Ref<PanelSpec>) {
  let root: ReactDOM.Root | null = null

  watch([containerRef, spec], ([el, s]) => {
    if (!el) return
    root ??= ReactDOM.createRoot(el)
    root.render(createElement(PersesPanel, { spec: s, datasource: openNMSPlugin }))
  })

  onUnmounted(() => root?.unmount())
}
```

**`buildPersesTheme()`** (`ui/src/theme/persesTheme.ts`):
- Reads Feather DS CSS custom properties via `getComputedStyle(document.body)` at mount time
- Maps to Perses/MUI theme object (`palette.mode`, `palette.primary`, `palette.background`, `palette.text`)
- Dark mode: watches `document.body.classList` for `open-dark` toggle, re-renders React subtree with rebuilt theme

**Mount components:**
- `PersesPanel.vue` — mounts a single `TimeSeriesChart` panel. Used in Resource Graphs.
- `PersesCanvas.vue` — mounts `DashboardProvider` + full `Dashboard` tree. Used in Dashboards pages.

## Component 3 — Dashboard Storage

**Liquibase migration** — `core/schema/src/main/liquibase/36.0.0/changelog.xml`:

```xml
<changeSet author="cnewkirk" id="36.0.0-create-onms-dashboards">
    <preConditions onFail="MARK_RAN">
        <not><tableExists tableName="onms_dashboards"/></not>
    </preConditions>
    <createTable tableName="onms_dashboards">
        <column name="id" type="varchar(36)">
            <constraints primaryKey="true" nullable="false"/>
        </column>
        <column name="name" type="varchar(255)">
            <constraints nullable="false"/>
        </column>
        <column name="description" type="varchar(1024)"/>
        <column name="spec" type="text">
            <constraints nullable="false"/>
        </column>
        <column name="created_by" type="varchar(255)"/>
        <column name="created_at" type="timestamp with time zone">
            <constraints nullable="false"/>
        </column>
        <column name="updated_at" type="timestamp with time zone">
            <constraints nullable="false"/>
        </column>
    </createTable>
    <createIndex tableName="onms_dashboards" indexName="idx_onms_dashboards_name">
        <column name="name"/>
    </createIndex>
</changeSet>
```

Master `changelog.xml` includes `<include file="36.0.0/changelog.xml"/>` after the `35.0.0` line.

**Java DAO layer:**
- `OnmsDashboard.java` — Hibernate entity (`@Entity`, `@Table(name="onms_dashboards")`)
- `OnmsDashboardDao.java` — interface extending `OnmsDao`
- `OnmsDashboardDaoHibernate.java` — Hibernate implementation
- `DashboardRestService.java` — JAX-RS at `/rest/dashboards`

**REST API:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rest/dashboards` | List (name, id, description — no spec) |
| `GET` | `/rest/dashboards/{id}` | Full dashboard including spec |
| `POST` | `/rest/dashboards` | Create |
| `PUT` | `/rest/dashboards/{id}` | Update spec |
| `DELETE` | `/rest/dashboards/{id}` | Delete |

Access control: read = any authenticated user, write = `ROLE_ADMIN` or `ROLE_DASHBOARD_EDITOR`. `ROLE_DASHBOARD_EDITOR` is a new role introduced by this feature, configured in `users.xml` and manageable via the existing user admin UI.

**Perses persistence wiring:** `DashboardViewer.vue` passes `onSave` callback to `<PersesCanvas>` which calls `PUT /rest/dashboards/{id}`. Persistence logic stays in Vue, outside the React subtree.

**KSC:** Not auto-migrated. KSC configs remain accessible at old URLs until redirect gate is enabled.

## Component 4 — Vue Routes + URL Redirects

**New Vue routes:**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/resource-graphs/*` | `Resources.vue` (existing) | Resource graph browser, Perses panels |
| `/dashboards` | `DashboardList.vue` | List all saved dashboards |
| `/dashboards/new` | `DashboardViewer.vue` | New dashboard, edit mode |
| `/dashboards/:id` | `DashboardViewer.vue` | View dashboard |
| `/dashboards/:id/edit` | `DashboardViewer.vue` | Edit dashboard |

**Server-side redirect filter** (active when `org.opennms.web.graphs.engine=perses`):

| Old URL | Redirects to |
|---------|-------------|
| `/KSC/index.htm` | `/ui/#/dashboards` |
| `/KSC/customReport.htm?report=N` | `/ui/#/dashboards` |
| `/KSC/customView.htm` | `/ui/#/dashboards` |
| `/KSC/customGraphEditDetails.htm` | `/ui/#/dashboards/new` |
| `/graph/results.htm?resourceId=X&reports=Y` | `/ui/#/resource-graphs/graphs/.../X` |
| `/graph/forecast.jsp` | `/ui/#/dashboards/new` |

**Engine property effects:**
- `bootstrap.jsp` stops including `backshift-js`, `flot-js`, `d3-js` vendor assets
- `bootstrap.jsp` stops including `onms-graph` asset on `renderGraphs` pages
- `TimeSeries.getGraphEngine()` returns `"perses"`

## Component 5 — RrdGraphConverter → Perses Panel Specs

**New output type** (`PersesGraphSpec`):
```typescript
{
  panelSpec: TimeSeriesChartSpec,  // Perses visual config
  queries: OpenNMSQuery[],         // fed to datasource plugin
  printStatements: PrintStatement[] // legend text, rendered below panel
}
```

**Mapping from RRD graph definition:**
- `_onDEF` → `OpenNMSQuery { resourceId, attribute, aggregation, label }`
- `_onCDEF` → `OpenNMSQuery { expression, label }` (JEXL, evaluated server-side)
- `_onLine/_onArea/_onStack` → `TimeSeriesChartSpec.visual.seriesConfig[i]`
- `verticalLabel` → `TimeSeriesChartSpec.yAxis.label`
- `title` → panel title
- `_onVDEF/_onGPrint` → `printStatements` (unchanged)

**`Graph.vue` changes:**
- `<canvas>` + Chart.js replaced with `<PersesPanel>`
- `render()` calls `RrdGraphConverter` → gets `PersesGraphSpec` → passes to `<PersesPanel>`
- `GraphDataTable` tab retained (receives raw measurements response)

**Removed when this lands:**
- Chart.js initialization and `chart` instance management in `Graph.vue`
- `plugins/HtmlLegendPlugin.ts`
- `utils/LegendFormatter.ts`
- `chartjs-plugin-zoom` dependency

## Component 6 — Forecast Groundwork

The Angular/Backshift forecast page (`forecast.jsp` + `forecast/index.js`) is retired without a direct redirect. A new `ForecastPanel` Perses plugin is registered:

- Exposes Holt-Winters parameters as panel config fields (`trainingStart`, `season`, `forecasts`, `confidenceLevel`, etc.)
- Constructs the filter payload (`Chomp`, `Outlier`, `HoltWinters`, `Trend`) in the datasource plugin
- Renders as a `TimeSeriesChart` with forecast bands as additional series

This can land as Phase 3 follow-on if needed.

## Phasing Plan

### Phase 1 — Foundation
- Liquibase `36.0.0` migration
- `OnmsDashboard` entity + DAO + `/rest/dashboards` REST API
- `usePerses` composable + `buildPersesTheme()`
- OpenNMS datasource plugin
- `PersesPanel` + `PersesCanvas` Vue components

### Phase 2 — Resource Graphs
- `RrdGraphConverter` extended to emit `PersesGraphSpec`
- `Graph.vue` updated to use `<PersesPanel>`
- `HtmlLegendPlugin`, `LegendFormatter`, `chartjs-plugin-zoom` removed

### Phase 3 — Dashboards
- `DashboardList.vue`, `DashboardViewer.vue`
- Vue routes registered
- Server-side redirect filter
- `org.opennms.web.graphs.engine=perses` set in container env
- Forecast plugin (or follow-on)

### Phase 4 — Backshift Retirement
- `onms-graph/index.js` removed
- `forecast/index.js` removed
- `vendor/backshift-js.js` removed
- `vendor/flot-js.js` removed (if not used elsewhere)
- `bootstrap.jsp` `usebackshift`/`renderGraphs` handling removed
- `TimeSeries.DEFAULT_GRAPHS_ENGINE_TYPE` changed to `"perses"`

## Files Changed Summary

**New files:**
- `core/schema/src/main/liquibase/36.0.0/changelog.xml`
- `opennms-model/src/main/java/.../OnmsDashboard.java`
- `opennms-dao-api/src/main/java/.../OnmsDashboardDao.java`
- `opennms-dao/src/main/java/.../OnmsDashboardDaoHibernate.java`
- `opennms-webapp/src/main/java/.../DashboardRestService.java`
- `opennms-webapp/src/main/java/.../PersesRedirectFilter.java`
- `ui/src/datasource/opennms/` (plugin module)
- `ui/src/composables/usePerses.ts`
- `ui/src/theme/persesTheme.ts`
- `ui/src/components/Perses/PersesPanel.vue`
- `ui/src/components/Perses/PersesCanvas.vue`
- `ui/src/components/Dashboards/DashboardList.vue`
- `ui/src/components/Dashboards/DashboardViewer.vue`

**Modified files:**
- `core/schema/src/main/liquibase/changelog.xml` (add 36.0.0 include)
- `core/lib/src/main/java/.../TimeSeries.java` (add `"perses"` engine value)
- `opennms-webapp/src/main/webapp/includes/bootstrap.jsp` (perses engine gate)
- `ui/src/components/Resources/Graph.vue` (Chart.js → PersesPanel)
- `ui/src/components/Resources/utils/RrdGraphConverter.class.ts` (new output type)
- `ui/src/router/index.ts` (new dashboard routes)
- `ui/package.json` (add `@perses-dev/*`, `react`, `react-dom`)

**Deleted files (Phase 4):**
- `core/web-assets/src/main/assets/js/apps/onms-graph/index.js`
- `core/web-assets/src/main/assets/js/apps/forecast/index.js`
- `core/web-assets/src/main/assets/js/vendor/backshift-js.js`
- `ui/src/components/Resources/plugins/HtmlLegendPlugin.ts`
- `ui/src/components/Resources/utils/LegendFormatter.ts`
