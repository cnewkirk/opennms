# Perses Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Java storage layer (`onms_dashboards` table + REST API) and the frontend infrastructure (OpenNMS Perses datasource plugin, React mount composable, theme bridge, `PersesPanel`/`PersesCanvas` Vue components) that all subsequent phases depend on.

**Architecture:** A new `onms_dashboards` DB table stores Perses dashboard JSON, accessed via a JAX-RS v2 REST service. In the Vue SPA, `ReactDOM.createRoot` mounts Perses React panels into Vue-managed container divs. A theme bridge reads Feather DS CSS custom properties at mount time and builds the MUI theme. An OpenNMS-specific Perses datasource plugin translates `OpenNMSQuery` objects into `/rest/measurements` calls.

**Tech Stack:** Java 17, Hibernate 3 (JPA annotations), CXF JAX-RS v2, Liquibase, Vue 3, TypeScript, React 18, `@perses-dev/core`, `@perses-dev/panels-plugin`, `@perses-dev/dashboards`, `@perses-dev/plugin-system`, MUI 5, Vitest

---

## File Map

**New Java files:**
- `core/schema/src/main/liquibase/36.0.0/changelog.xml` — DB migration
- `opennms-model/src/main/java/org/opennms/netmgt/model/OnmsDashboard.java` — Hibernate entity
- `opennms-dao-api/src/main/java/org/opennms/netmgt/dao/api/OnmsDashboardDao.java` — DAO interface
- `opennms-dao/src/main/java/org/opennms/netmgt/dao/hibernate/OnmsDashboardDaoHibernate.java` — Hibernate impl
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DashboardRestService.java` — JAX-RS REST
- `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DashboardRestServiceIT.java` — integration test

**Modified Java files:**
- `core/schema/src/main/liquibase/changelog.xml` — add 36.0.0 include
- `opennms-dao/src/main/resources/META-INF/opennms/applicationContext-shared.xml` — register DAO bean

**New frontend files:**
- `ui/src/datasource/opennms/types.ts` — OpenNMSQuery type
- `ui/src/datasource/opennms/client.ts` — /rest/measurements fetch client
- `ui/src/datasource/opennms/plugin.ts` — Perses DataSourcePlugin implementation
- `ui/src/datasource/opennms/QueryEditor.tsx` — React query editor component
- `ui/src/datasource/opennms/index.ts` — plugin registration export
- `ui/src/composables/usePerses.ts` — ReactDOM.createRoot mount composable
- `ui/src/theme/persesTheme.ts` — Feather DS → MUI theme bridge
- `ui/src/components/Perses/PersesPanel.vue` — single panel Vue wrapper
- `ui/src/components/Perses/PersesCanvas.vue` — full dashboard Vue wrapper

**New frontend tests:**
- `ui/tests/datasource/opennms-client.test.ts`
- `ui/tests/datasource/opennms-plugin.test.ts`
- `ui/tests/composables/usePerses.test.ts`
- `ui/tests/theme/persesTheme.test.ts`

**Modified frontend files:**
- `ui/package.json` — add Perses + React deps

---

## Task 1: Liquibase Migration

**Files:**
- Create: `core/schema/src/main/liquibase/36.0.0/changelog.xml`
- Modify: `core/schema/src/main/liquibase/changelog.xml`

- [ ] **Step 1: Create the 36.0.0 directory and changelog**

```bash
mkdir -p core/schema/src/main/liquibase/36.0.0
```

Create `core/schema/src/main/liquibase/36.0.0/changelog.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-2.0.xsd">

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

</databaseChangeLog>
```

- [ ] **Step 2: Register in master changelog**

In `core/schema/src/main/liquibase/changelog.xml`, add after the `35.0.0` include line:

```xml
	<include file="36.0.0/changelog.xml"/>
```

- [ ] **Step 3: Commit**

```bash
git add core/schema/src/main/liquibase/36.0.0/changelog.xml \
        core/schema/src/main/liquibase/changelog.xml
git commit -m "feat(schema): add onms_dashboards table for Perses dashboard storage"
```

---

## Task 2: OnmsDashboard Hibernate Entity

**Files:**
- Create: `opennms-model/src/main/java/org/opennms/netmgt/model/OnmsDashboard.java`

The `org.opennms.netmgt.model` package is already in the Hibernate session factory's `packagesToScan` list (`applicationContext-shared.xml:40`), so no additional registration is needed.

- [ ] **Step 1: Create the entity**

```java
// opennms-model/src/main/java/org/opennms/netmgt/model/OnmsDashboard.java
package org.opennms.netmgt.model;

import java.io.Serializable;
import java.util.Date;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlRootElement;

import com.google.common.base.MoreObjects;

@Entity
@Table(name = "onms_dashboards")
@XmlRootElement(name = "dashboard")
@XmlAccessorType(XmlAccessType.NONE)
public class OnmsDashboard implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id", length = 36, nullable = false)
    private String id;

    @Column(name = "name", length = 255, nullable = false)
    private String name;

    @Column(name = "description", length = 1024)
    private String description;

    @Column(name = "spec", nullable = false, columnDefinition = "text")
    private String spec;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        final Date now = new Date();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    // --- getters / setters ---

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSpec() { return spec; }
    public void setSpec(String spec) { this.spec = spec; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .add("name", name)
                .toString();
    }
}
```

- [ ] **Step 2: Compile the model module**

```bash
./compile.pl -DskipTests --projects :opennms-model install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add opennms-model/src/main/java/org/opennms/netmgt/model/OnmsDashboard.java
git commit -m "feat(model): add OnmsDashboard Hibernate entity"
```

---

## Task 3: OnmsDashboardDao Interface

**Files:**
- Create: `opennms-dao-api/src/main/java/org/opennms/netmgt/dao/api/OnmsDashboardDao.java`

- [ ] **Step 1: Create the DAO interface**

```java
// opennms-dao-api/src/main/java/org/opennms/netmgt/dao/api/OnmsDashboardDao.java
package org.opennms.netmgt.dao.api;

import org.opennms.netmgt.model.OnmsDashboard;

public interface OnmsDashboardDao extends OnmsDao<OnmsDashboard, String> {
}
```

- [ ] **Step 2: Compile**

```bash
./compile.pl -DskipTests --projects :opennms-dao-api install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add opennms-dao-api/src/main/java/org/opennms/netmgt/dao/api/OnmsDashboardDao.java
git commit -m "feat(dao-api): add OnmsDashboardDao interface"
```

---

## Task 4: OnmsDashboardDaoHibernate + Spring Registration

**Files:**
- Create: `opennms-dao/src/main/java/org/opennms/netmgt/dao/hibernate/OnmsDashboardDaoHibernate.java`
- Modify: `opennms-dao/src/main/resources/META-INF/opennms/applicationContext-shared.xml`

- [ ] **Step 1: Create the Hibernate implementation**

```java
// opennms-dao/src/main/java/org/opennms/netmgt/dao/hibernate/OnmsDashboardDaoHibernate.java
package org.opennms.netmgt.dao.hibernate;

import org.opennms.netmgt.dao.api.OnmsDashboardDao;
import org.opennms.netmgt.model.OnmsDashboard;

public class OnmsDashboardDaoHibernate extends AbstractDaoHibernate<OnmsDashboard, String>
        implements OnmsDashboardDao {

    public OnmsDashboardDaoHibernate() {
        super(OnmsDashboard.class);
    }
}
```

- [ ] **Step 2: Register the Spring bean**

In `opennms-dao/src/main/resources/META-INF/opennms/applicationContext-shared.xml`, add after the `memoDao` bean (around line 122):

```xml
    <bean id="dashboardDao" class="org.opennms.netmgt.dao.hibernate.OnmsDashboardDaoHibernate">
        <property name="sessionFactory" ref="sessionFactory" />
    </bean>
    <onmsgi:service interface="org.opennms.netmgt.dao.api.OnmsDashboardDao" ref="dashboardDao" />
```

- [ ] **Step 3: Compile the dao module**

```bash
./compile.pl -DskipTests --projects :opennms-dao install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add opennms-dao/src/main/java/org/opennms/netmgt/dao/hibernate/OnmsDashboardDaoHibernate.java \
        opennms-dao/src/main/resources/META-INF/opennms/applicationContext-shared.xml
git commit -m "feat(dao): add OnmsDashboardDaoHibernate + Spring bean registration"
```

---

## Task 5: DashboardRestService

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DashboardRestService.java`

The CXF v2 server (`applicationContext-cxf-rest-v2.xml:74`) auto-discovers all `@Component @Path` classes in `org.opennms.web.rest.v2` — no XML registration needed.

- [ ] **Step 1: Create the REST service**

```java
// opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DashboardRestService.java
package org.opennms.web.rest.v2;

import java.net.URI;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.dao.api.OnmsDashboardDao;
import org.opennms.netmgt.model.OnmsDashboard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Path("dashboards")
@Transactional
@Tag(name = "Dashboards", description = "Perses Dashboard Storage API")
public class DashboardRestService {

    private static final Logger LOG = LoggerFactory.getLogger(DashboardRestService.class);

    @Autowired
    private OnmsDashboardDao dashboardDao;

    /** List all dashboards — returns lightweight summaries (no spec). */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list() {
        final List<DashboardSummary> summaries = dashboardDao.findAll().stream()
                .map(DashboardSummary::from)
                .collect(Collectors.toList());
        return Response.ok(summaries).build();
    }

    /** Get one dashboard including full spec. */
    @GET
    @Path("{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response get(@PathParam("id") final String id) {
        final OnmsDashboard dashboard = dashboardDao.get(id);
        if (dashboard == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(dashboard).build();
    }

    /** Create a new dashboard. */
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(@Context final UriInfo uriInfo,
                           @Context final SecurityContext securityContext,
                           final OnmsDashboard dashboard) {
        dashboard.setId(UUID.randomUUID().toString());
        dashboard.setCreatedBy(securityContext.getUserPrincipal() != null
                ? securityContext.getUserPrincipal().getName() : "anonymous");
        dashboard.setCreatedAt(new Date());
        dashboard.setUpdatedAt(new Date());
        dashboardDao.save(dashboard);
        final URI location = uriInfo.getAbsolutePathBuilder()
                .path(dashboard.getId()).build();
        return Response.created(location).entity(dashboard).build();
    }

    /** Replace a dashboard spec. */
    @PUT
    @Path("{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("id") final String id,
                           final OnmsDashboard incoming) {
        final OnmsDashboard existing = dashboardDao.get(id);
        if (existing == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        existing.setName(incoming.getName());
        existing.setDescription(incoming.getDescription());
        existing.setSpec(incoming.getSpec());
        existing.setUpdatedAt(new Date());
        dashboardDao.saveOrUpdate(existing);
        return Response.ok(existing).build();
    }

    /** Delete a dashboard. */
    @DELETE
    @Path("{id}")
    public Response delete(@PathParam("id") final String id) {
        final OnmsDashboard dashboard = dashboardDao.get(id);
        if (dashboard == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        dashboardDao.delete(dashboard);
        return Response.noContent().build();
    }

    // --- Summary DTO (no spec field) ---

    public static class DashboardSummary {
        public String id;
        public String name;
        public String description;
        public String createdBy;
        public Date createdAt;
        public Date updatedAt;

        public static DashboardSummary from(final OnmsDashboard d) {
            final DashboardSummary s = new DashboardSummary();
            s.id = d.getId();
            s.name = d.getName();
            s.description = d.getDescription();
            s.createdBy = d.getCreatedBy();
            s.createdAt = d.getCreatedAt();
            s.updatedAt = d.getUpdatedAt();
            return s;
        }
    }
}
```

- [ ] **Step 2: Compile webapp-rest**

```bash
./compile.pl -DskipTests --projects :opennms-webapp-rest install
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DashboardRestService.java
git commit -m "feat(rest): add DashboardRestService at /rest/dashboards"
```

---

## Task 6: DashboardRestService Integration Test

**Files:**
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DashboardRestServiceIT.java`

- [ ] **Step 1: Write the failing test**

```java
// opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DashboardRestServiceIT.java
package org.opennms.web.rest.v2;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;

import javax.ws.rs.core.MediaType;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.opennms.core.test.MockLogAppender;
import org.opennms.core.test.OpenNMSJUnit4ClassRunner;
import org.opennms.core.test.db.annotations.JUnitTemporaryDatabase;
import org.opennms.core.test.rest.AbstractSpringJerseyRestTestCase;
import org.opennms.test.JUnitConfigurationEnvironment;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.web.WebAppConfiguration;

@RunWith(OpenNMSJUnit4ClassRunner.class)
@WebAppConfiguration
@ContextConfiguration(locations={
        "classpath:/META-INF/opennms/applicationContext-soa.xml",
        "classpath:/META-INF/opennms/applicationContext-commonConfigs.xml",
        "classpath:/META-INF/opennms/applicationContext-minimal-conf.xml",
        "classpath:/META-INF/opennms/applicationContext-dao.xml",
        "classpath:/META-INF/opennms/applicationContext-mockConfigManager.xml",
        "classpath:/META-INF/opennms/applicationContext-databasePopulator.xml",
        "classpath:/META-INF/opennms/applicationContext-mockEventIpcManager.xml",
        "classpath:META-INF/opennms/applicationContext-jersey-test.xml"
})
@JUnitConfigurationEnvironment
@JUnitTemporaryDatabase
public class DashboardRestServiceIT extends AbstractSpringJerseyRestTestCase {

    @Override
    protected void afterServletStart() {
        MockLogAppender.setupLogging(true, "DEBUG");
    }

    @Test
    public void testCreateAndRetrieve() throws Exception {
        // Create
        final String body = "{\"name\":\"My Dashboard\",\"description\":\"test\",\"spec\":\"{\\\"panels\\\":[]}\"}";
        final String location = sendPost("/dashboards", body, 201, MediaType.APPLICATION_JSON);
        assertThat(location, containsString("/rest/dashboards/"));

        // Extract ID from Location header
        final String id = location.substring(location.lastIndexOf('/') + 1);

        // GET by ID — spec is present
        final String json = sendRequest(GET, "/dashboards/" + id, 200);
        assertThat(json, containsString("My Dashboard"));
        assertThat(json, containsString("panels"));

        // GET list — spec is NOT present in summary
        final String list = sendRequest(GET, "/dashboards", 200);
        assertThat(list, containsString("My Dashboard"));
        assertThat(list, not(containsString("panels")));
    }

    @Test
    public void testUpdateAndDelete() throws Exception {
        final String body = "{\"name\":\"ToUpdate\",\"spec\":\"{}\"}";
        final String location = sendPost("/dashboards", body, 201, MediaType.APPLICATION_JSON);
        final String id = location.substring(location.lastIndexOf('/') + 1);

        // Update
        final String updated = "{\"name\":\"Updated\",\"spec\":\"{\\\"v\\\":2}\"}";
        sendRequest(PUT, "/dashboards/" + id, updated, 200);
        final String json = sendRequest(GET, "/dashboards/" + id, 200);
        assertThat(json, containsString("Updated"));

        // Delete
        sendRequest(DELETE, "/dashboards/" + id, 204);
        sendRequest(GET, "/dashboards/" + id, 404);
    }
}
```

- [ ] **Step 2: Run the test — verify it fails (no table yet in test DB)**

```bash
cd opennms-webapp-rest && \
  ../../maven/bin/mvn test -Dtest=DashboardRestServiceIT -t 1
```

Expected: test failure due to missing table (Liquibase hasn't run in test context yet). If test runner auto-applies Liquibase, the test may pass. Either way, note the output.

- [ ] **Step 3: Run with full dependency build to ensure Liquibase applies**

```bash
./compile.pl -t --projects :opennms-webapp-rest install
```

Expected: `DashboardRestServiceIT` PASSES. Build SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DashboardRestServiceIT.java
git commit -m "test(rest): add DashboardRestServiceIT integration tests"
```

---

## Task 7: Install Perses + React Dependencies

**Files:**
- Modify: `ui/package.json`

- [ ] **Step 1: Add dependencies**

In `ui/package.json`, add to `"dependencies"`:

```json
    "@emotion/react": "^11.13.0",
    "@emotion/styled": "^11.13.0",
    "@mui/material": "^5.16.0",
    "@perses-dev/core": "^0.51.0",
    "@perses-dev/components": "^0.51.0",
    "@perses-dev/dashboards": "^0.51.0",
    "@perses-dev/panels-plugin": "^0.51.0",
    "@perses-dev/plugin-system": "^0.51.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
```

Add to `"devDependencies"`:

```json
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
```

- [ ] **Step 2: Install**

```bash
cd ui && yarn install
```

Expected: lockfile updated, no peer dependency errors. If Perses pins an incompatible MUI version, adjust `@mui/material` to match what Perses requires (check `node_modules/@perses-dev/components/package.json`).

- [ ] **Step 3: Verify TypeScript can import Perses types**

```bash
cd ui && node -e "const p = require('@perses-dev/core'); console.log(Object.keys(p).slice(0,5))"
```

Expected: prints some exported type names without error.

- [ ] **Step 4: Commit**

```bash
git add ui/package.json ui/yarn.lock
git commit -m "feat(ui): add @perses-dev/* and react 18 dependencies"
```

---

## Task 8: OpenNMS Datasource Types

**Files:**
- Create: `ui/src/datasource/opennms/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// ui/src/datasource/opennms/types.ts

/** A single metric query sent to /rest/measurements */
export interface OpenNMSQuerySpec {
  /** e.g. "node[1].interfaceSnmp[eth0-000000000000]" */
  resourceId: string
  /** RRD attribute name, e.g. "ifInOctets" */
  attribute: string
  /** Aggregation function */
  aggregation: 'AVERAGE' | 'MIN' | 'MAX' | 'LAST'
  /** Optional label override (defaults to attribute) */
  label?: string
  /** JEXL expression — present on CDEF metrics, absent on DEF metrics */
  expression?: string
  /** If true, fetch but don't render (used in CDEF chains) */
  transient?: boolean
}

/** Shape of a single source entry in the /rest/measurements request body */
export interface MeasurementsSource {
  aggregation: string
  attribute: string
  label: string
  resourceId: string
  transient: boolean
}

/** Shape of a JEXL expression entry in the /rest/measurements request body */
export interface MeasurementsExpression {
  value: string
  label: string
  transient: boolean
}

/** POST body for /rest/measurements */
export interface MeasurementsPayload {
  start: number
  end: number
  step: number
  source: MeasurementsSource[]
  expression?: MeasurementsExpression[]
}

/** Column of values in the /rest/measurements response */
export interface MeasurementsColumn {
  values: (number | null)[]
}

/** Response from /rest/measurements */
export interface MeasurementsResponse {
  start: number
  end: number
  step: number
  timestamps: number[]
  labels: string[]
  columns: MeasurementsColumn[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep -i "datasource" || echo "OK"
```

Expected: no errors mentioning `datasource/opennms/types.ts`

- [ ] **Step 3: Commit**

```bash
git add ui/src/datasource/opennms/types.ts
git commit -m "feat(datasource): add OpenNMS query and measurements types"
```

---

## Task 9: OpenNMS Measurements Client

**Files:**
- Create: `ui/src/datasource/opennms/client.ts`
- Create: `ui/tests/datasource/opennms-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/datasource/opennms-client.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchMeasurements } from '@/datasource/opennms/client'
import type { MeasurementsPayload, MeasurementsResponse } from '@/datasource/opennms/types'

const mockResponse: MeasurementsResponse = {
  start: 1000000,
  end: 2000000,
  step: 300000,
  timestamps: [1000000, 1300000, 1600000, 1900000],
  labels: ['ifInOctets'],
  columns: [{ values: [10.0, 20.0, 15.0, 25.0] }]
}

describe('fetchMeasurements', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    }))
  })

  test('POSTs to /rest/measurements with correct body', async () => {
    const payload: MeasurementsPayload = {
      start: 1000000,
      end: 2000000,
      step: 300000,
      source: [{ aggregation: 'AVERAGE', attribute: 'ifInOctets', label: 'ifInOctets', resourceId: 'node[1].interfaceSnmp[eth0]', transient: false }]
    }

    const result = await fetchMeasurements(payload)

    expect(fetch).toHaveBeenCalledWith('/rest/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
    expect(result.labels).toEqual(['ifInOctets'])
    expect(result.columns[0].values).toHaveLength(4)
  })

  test('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(fetchMeasurements({ start: 0, end: 1, step: 300000, source: [] }))
      .rejects.toThrow('Measurements request failed: 500')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd ui && yarn test tests/datasource/opennms-client.test.ts
```

Expected: FAIL — `fetchMeasurements` not found

- [ ] **Step 3: Implement the client**

```typescript
// ui/src/datasource/opennms/client.ts
import type { MeasurementsPayload, MeasurementsResponse } from './types'

/**
 * POST to /rest/measurements and return the response.
 * Auth is handled by session cookies (same-origin request).
 */
export async function fetchMeasurements(payload: MeasurementsPayload): Promise<MeasurementsResponse> {
  const response = await fetch('/rest/measurements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Measurements request failed: ${response.status}`)
  }

  return response.json() as Promise<MeasurementsResponse>
}
```

- [ ] **Step 4: Run passing test**

```bash
cd ui && yarn test tests/datasource/opennms-client.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/datasource/opennms/client.ts \
        ui/tests/datasource/opennms-client.test.ts
git commit -m "feat(datasource): add fetchMeasurements client with tests"
```

---

## Task 10: OpenNMS Perses Datasource Plugin

**Files:**
- Create: `ui/src/datasource/opennms/plugin.ts`
- Create: `ui/tests/datasource/opennms-plugin.test.ts`

This implements the Perses `TimeSeriesQueryPlugin` interface. The plugin receives an `OpenNMSQuerySpec` plus time range context, fetches measurements, and returns `TimeSeriesData`.

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/datasource/opennms-plugin.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { OpenNMSTimeSeriesQueryPlugin } from '@/datasource/opennms/plugin'
import * as client from '@/datasource/opennms/client'
import type { MeasurementsResponse } from '@/datasource/opennms/types'

const mockMeasurements: MeasurementsResponse = {
  start: 1700000000000,
  end:   1700003600000,
  step:  300000,
  timestamps: [1700000000000, 1700000300000],
  labels: ['ifInOctets'],
  columns: [{ values: [100.0, 200.0] }]
}

describe('OpenNMSTimeSeriesQueryPlugin', () => {
  beforeEach(() => {
    vi.spyOn(client, 'fetchMeasurements').mockResolvedValue(mockMeasurements)
  })

  test('maps measurements response to Perses TimeSeriesData', async () => {
    const result = await OpenNMSTimeSeriesQueryPlugin.getTimeSeriesData(
      {
        resourceId: 'node[1].interfaceSnmp[eth0]',
        attribute: 'ifInOctets',
        aggregation: 'AVERAGE'
      },
      {
        timeRange: { start: new Date(1700000000000), end: new Date(1700003600000) },
        suggestedStepMs: 300000,
        datasource: undefined
      }
    )

    expect(result.series).toHaveLength(1)
    expect(result.series[0].name).toBe('ifInOctets')
    // Perses values are [timestamp_seconds, value]
    expect(result.series[0].values[0]).toEqual([1700000000, 100.0])
    expect(result.series[0].values[1]).toEqual([1700000300, 200.0])
  })

  test('passes null values through as null', async () => {
    vi.spyOn(client, 'fetchMeasurements').mockResolvedValue({
      ...mockMeasurements,
      columns: [{ values: [null, 200.0] }]
    })

    const result = await OpenNMSTimeSeriesQueryPlugin.getTimeSeriesData(
      { resourceId: 'x', attribute: 'y', aggregation: 'AVERAGE' },
      { timeRange: { start: new Date(1700000000000), end: new Date(1700003600000) }, suggestedStepMs: 300000, datasource: undefined }
    )

    expect(result.series[0].values[0][1]).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd ui && yarn test tests/datasource/opennms-plugin.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the plugin**

```typescript
// ui/src/datasource/opennms/plugin.ts
import type { TimeSeriesQueryPlugin, TimeSeriesData, TimeSeriesQueryContext } from '@perses-dev/core'
import { fetchMeasurements } from './client'
import type { OpenNMSQuerySpec, MeasurementsPayload, MeasurementsSource } from './types'

export const OpenNMSTimeSeriesQueryPlugin: TimeSeriesQueryPlugin<OpenNMSQuerySpec> = {
  async getTimeSeriesData(
    spec: OpenNMSQuerySpec,
    context: TimeSeriesQueryContext
  ): Promise<TimeSeriesData> {
    const { timeRange, suggestedStepMs } = context
    const start = timeRange.start.getTime()
    const end = timeRange.end.getTime()
    const step = Math.max(suggestedStepMs ?? 300000, 60000)

    const payload: MeasurementsPayload = {
      start,
      end,
      step,
      source: []
    }

    if (spec.expression) {
      // CDEF metric — use expression array
      payload.source = []
      payload.expression = [{
        value: spec.expression,
        label: spec.label ?? spec.attribute,
        transient: spec.transient ?? false
      }]
    } else {
      const source: MeasurementsSource = {
        aggregation: spec.aggregation,
        attribute: spec.attribute,
        label: spec.label ?? spec.attribute,
        resourceId: spec.resourceId,
        transient: spec.transient ?? false
      }
      payload.source = [source]
    }

    const response = await fetchMeasurements(payload)

    // Map to Perses TimeSeriesData format
    // Perses expects values as [unix_timestamp_seconds, value | null][]
    const series = response.labels.map((label, colIdx) => ({
      name: label,
      values: response.timestamps.map((ts, rowIdx) => [
        ts / 1000, // ms → seconds
        response.columns[colIdx]?.values[rowIdx] ?? null
      ] as [number, number | null])
    }))

    return {
      timeRange: { start: timeRange.start, end: timeRange.end },
      series
    }
  }
}
```

- [ ] **Step 4: Run passing test**

```bash
cd ui && yarn test tests/datasource/opennms-plugin.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/datasource/opennms/plugin.ts \
        ui/tests/datasource/opennms-plugin.test.ts
git commit -m "feat(datasource): implement OpenNMS Perses TimeSeriesQueryPlugin"
```

---

## Task 11: QueryEditor React Component

**Files:**
- Create: `ui/src/datasource/opennms/QueryEditor.tsx`

This is the React component Perses renders in the dashboard editor's query section. It lets users pick a resource and metric.

Note: Ensure `ui/tsconfig.json` (or `vite.config.ts`) has `"jsx": "react-jsx"` or the equivalent Vite React plugin configured.

- [ ] **Step 1: Add React JSX support to Vite config**

Check `ui/vite.config.ts`. If `@vitejs/plugin-vue` is present but `@vitejs/plugin-react` is not, add it:

```bash
cd ui && yarn add -D @vitejs/plugin-react
```

In `ui/vite.config.ts`, add:

```typescript
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    vue(),
    react()   // add this line
  ],
  // ...
})
```

- [ ] **Step 2: Create the QueryEditor component**

```tsx
// ui/src/datasource/opennms/QueryEditor.tsx
import React, { useState } from 'react'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import type { OpenNMSQuerySpec } from './types'

interface QueryEditorProps {
  value: OpenNMSQuerySpec
  onChange: (spec: OpenNMSQuerySpec) => void
}

const AGGREGATIONS = ['AVERAGE', 'MIN', 'MAX', 'LAST'] as const

export const QueryEditor: React.FC<QueryEditorProps> = ({ value, onChange }) => {
  const [spec, setSpec] = useState<OpenNMSQuerySpec>(value)

  const update = (patch: Partial<OpenNMSQuerySpec>) => {
    const updated = { ...spec, ...patch }
    setSpec(updated)
    onChange(updated)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
      <TextField
        label="Resource ID"
        size="small"
        value={spec.resourceId ?? ''}
        onChange={e => update({ resourceId: e.target.value })}
        helperText="e.g. node[1].interfaceSnmp[eth0-000000000000]"
        fullWidth
      />
      <TextField
        label="Attribute"
        size="small"
        value={spec.attribute ?? ''}
        onChange={e => update({ attribute: e.target.value })}
        helperText="e.g. ifInOctets"
        fullWidth
      />
      <TextField
        select
        label="Aggregation"
        size="small"
        value={spec.aggregation ?? 'AVERAGE'}
        onChange={e => update({ aggregation: e.target.value as OpenNMSQuerySpec['aggregation'] })}
        fullWidth
      >
        {AGGREGATIONS.map(agg => (
          <MenuItem key={agg} value={agg}>{agg}</MenuItem>
        ))}
      </TextField>
      <TextField
        label="Label (optional)"
        size="small"
        value={spec.label ?? ''}
        onChange={e => update({ label: e.target.value || undefined })}
        fullWidth
      />
    </Box>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep "QueryEditor" || echo "OK"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add ui/src/datasource/opennms/QueryEditor.tsx ui/vite.config.ts ui/package.json ui/yarn.lock
git commit -m "feat(datasource): add QueryEditor React component + Vite React plugin"
```

---

## Task 12: Datasource Plugin Registration

**Files:**
- Create: `ui/src/datasource/opennms/index.ts`

- [ ] **Step 1: Create the index**

```typescript
// ui/src/datasource/opennms/index.ts
import { QueryEditor } from './QueryEditor'
import { OpenNMSTimeSeriesQueryPlugin } from './plugin'

export const OPENNMS_DATASOURCE_KIND = 'OpenNMSTimeSeries' as const

/**
 * Perses plugin definition for OpenNMS time series queries.
 * Register this with the Perses PluginRegistry at app startup.
 */
export const OpenNMSPlugin = {
  kind: OPENNMS_DATASOURCE_KIND,
  plugin: OpenNMSTimeSeriesQueryPlugin,
  queryEditor: QueryEditor
}

export { OpenNMSTimeSeriesQueryPlugin } from './plugin'
export { QueryEditor } from './QueryEditor'
export type { OpenNMSQuerySpec } from './types'
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/datasource/opennms/index.ts
git commit -m "feat(datasource): add OpenNMS Perses plugin registration index"
```

---

## Task 13: usePerses Composable

**Files:**
- Create: `ui/src/composables/usePerses.ts`
- Create: `ui/tests/composables/usePerses.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/composables/usePerses.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

// Mock ReactDOM to avoid JSDOM React rendering issues in tests
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn()
  }))
}))
vi.mock('react', () => ({
  createElement: vi.fn(() => ({})),
  default: { createElement: vi.fn(() => ({})) }
}))

import { usePerses } from '@/composables/usePerses'
import * as ReactDOM from 'react-dom/client'

describe('usePerses', () => {
  test('creates root when container ref is set', async () => {
    const containerRef = ref<HTMLElement | null>(null)
    const specRef = ref({ kind: 'TimeSeriesChart', spec: {} })

    mount(defineComponent({
      setup() {
        usePerses(containerRef, specRef, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    const div = document.createElement('div')
    containerRef.value = div
    await nextTick()

    expect(ReactDOM.createRoot).toHaveBeenCalledWith(div)
  })

  test('unmounts on component unmount', async () => {
    const mockUnmount = vi.fn()
    vi.mocked(ReactDOM.createRoot).mockReturnValue({ render: vi.fn(), unmount: mockUnmount } as any)

    const containerRef = ref<HTMLElement | null>(null)
    const specRef = ref({ kind: 'TimeSeriesChart', spec: {} })

    const wrapper = mount(defineComponent({
      setup() {
        usePerses(containerRef, specRef, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    containerRef.value = document.createElement('div')
    await nextTick()

    wrapper.unmount()
    expect(mockUnmount).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd ui && yarn test tests/composables/usePerses.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the composable**

```typescript
// ui/src/composables/usePerses.ts
import { watch, onUnmounted, type Ref } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import { createElement, type ComponentType } from 'react'

type PanelSpec = { kind: string; spec: Record<string, unknown> }

/**
 * Mounts a React Perses component into a Vue-managed container element.
 *
 * @param containerRef - ref to the DOM element to mount into
 * @param specRef      - reactive panel spec; re-renders React when changed
 * @param renderFn     - called with (createElement, spec) — returns the React element to render
 *
 * Usage:
 *   const containerRef = ref<HTMLElement | null>(null)
 *   usePerses(containerRef, specRef, (h, spec) => h(PersesPanel, { spec, datasource }))
 */
export function usePerses(
  containerRef: Ref<HTMLElement | null>,
  specRef: Ref<PanelSpec>,
  renderFn: (spec: PanelSpec) => ReturnType<typeof createElement>
): void {
  let root: Root | null = null

  watch([containerRef, specRef], ([el, spec]) => {
    if (!el) return
    if (!root) {
      root = createRoot(el)
    }
    root.render(renderFn(spec))
  }, { deep: true })

  onUnmounted(() => {
    root?.unmount()
    root = null
  })
}
```

- [ ] **Step 4: Run passing test**

```bash
cd ui && yarn test tests/composables/usePerses.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/composables/usePerses.ts \
        ui/tests/composables/usePerses.test.ts
git commit -m "feat(composable): add usePerses ReactDOM mount composable"
```

---

## Task 14: Feather DS → MUI Theme Bridge

**Files:**
- Create: `ui/src/theme/persesTheme.ts`
- Create: `ui/tests/theme/persesTheme.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/theme/persesTheme.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { buildPersesTheme } from '@/theme/persesTheme'

describe('buildPersesTheme', () => {
  beforeEach(() => {
    // Mock getComputedStyle to return known Feather DS values
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => {
        const map: Record<string, string> = {
          '--feather-color-scheme': ' light',
          '--feather-primary-interactive-default': ' #6200ee',
          '--feather-background': ' #ffffff',
          '--feather-surface-fill': ' #f5f5f5',
          '--feather-text-color': ' #212121'
        }
        return map[prop] ?? ''
      }
    }))
  })

  test('builds light theme from Feather CSS vars', () => {
    const theme = buildPersesTheme()
    expect(theme.palette.mode).toBe('light')
    expect(theme.palette.primary?.main).toBe('#6200ee')
    expect(theme.palette.background?.default).toBe('#ffffff')
  })

  test('returns dark theme when open-dark class is set', () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => (prop === '--feather-color-scheme' ? ' dark' : ' #000000')
    }))
    const theme = buildPersesTheme()
    expect(theme.palette.mode).toBe('dark')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd ui && yarn test tests/theme/persesTheme.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the theme bridge**

```typescript
// ui/src/theme/persesTheme.ts
import { createTheme, type Theme } from '@mui/material/styles'

/**
 * Builds a Perses/MUI theme by reading Feather DS CSS custom properties
 * from the computed style of document.body at call time.
 *
 * Call this at React subtree mount time (and re-call when dark mode changes).
 */
export function buildPersesTheme(): Theme {
  const style = getComputedStyle(document.body)
  const get = (prop: string) => style.getPropertyValue(prop).trim()

  const mode = get('--feather-color-scheme') === 'dark' ? 'dark' : 'light'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: get('--feather-primary-interactive-default') || '#1976d2'
      },
      background: {
        default: get('--feather-background') || (mode === 'dark' ? '#121212' : '#ffffff'),
        paper:   get('--feather-surface-fill') || (mode === 'dark' ? '#1e1e1e' : '#f5f5f5')
      },
      text: {
        primary: get('--feather-text-color') || (mode === 'dark' ? '#ffffff' : '#212121')
      }
    }
  })
}
```

- [ ] **Step 4: Run passing test**

```bash
cd ui && yarn test tests/theme/persesTheme.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/theme/persesTheme.ts \
        ui/tests/theme/persesTheme.test.ts
git commit -m "feat(theme): add Feather DS → MUI theme bridge for Perses"
```

---

## Task 15: PersesPanel Vue Component

**Files:**
- Create: `ui/src/components/Perses/PersesPanel.vue`

Mounts a single Perses `TimeSeriesChart` panel (React) into a Vue-managed div. Used by Resource Graphs (Phase 2).

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/Perses/PersesPanel.vue -->
<template>
  <div ref="containerRef" class="perses-panel-container"></div>
</template>

<script setup lang="ts">
import { ref, toRef, computed } from 'vue'
import { createElement } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { PluginRegistry, PluginRegistryProvider } from '@perses-dev/plugin-system'
import { TimeSeriesChart } from '@perses-dev/panels-plugin'
import { usePerses } from '@/composables/usePerses'
import { buildPersesTheme } from '@/theme/persesTheme'
import { OpenNMSPlugin } from '@/datasource/opennms'
import type { OpenNMSQuerySpec } from '@/datasource/opennms'

// Perses plugin registry — created once, shared across all PersesPanel instances
const registry = new PluginRegistry({
  plugins: [
    { pluginType: 'TimeSeriesQuery', kind: OpenNMSPlugin.kind, plugin: OpenNMSPlugin.plugin }
  ]
})

interface Props {
  title: string
  queries: OpenNMSQuerySpec[]
  /** Optional y-axis label */
  yAxisLabel?: string
  /** Optional series visual overrides: [{ name, color, type }] */
  seriesOverrides?: Array<{ name: string; color?: string; type?: 'line' | 'area' | 'stack' }>
}

const props = defineProps<Props>()
const containerRef = ref<HTMLElement | null>(null)

const panelSpec = computed(() => ({
  kind: 'TimeSeriesChart' as const,
  spec: {
    queries: props.queries.map(q => ({
      kind: OpenNMSPlugin.kind,
      spec: q
    })),
    yAxis: props.yAxisLabel ? { label: props.yAxisLabel } : undefined,
    visual: props.seriesOverrides ? { seriesOverrides: props.seriesOverrides } : undefined
  }
}))

usePerses(containerRef, panelSpec, (spec) => {
  const theme = buildPersesTheme()
  return createElement(
    ThemeProvider,
    { theme },
    createElement(
      PluginRegistryProvider,
      { pluginRegistry: registry },
      createElement(TimeSeriesChart, { spec: spec.spec as any })
    )
  )
})
</script>

<style scoped>
.perses-panel-container {
  width: 100%;
  height: 300px;
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep "PersesPanel" || echo "OK"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Perses/PersesPanel.vue
git commit -m "feat(components): add PersesPanel Vue component (React mount)"
```

---

## Task 16: PersesCanvas Vue Component

**Files:**
- Create: `ui/src/components/Perses/PersesCanvas.vue`

Mounts the full Perses `DashboardProvider` + `Dashboard` React tree. Used by the Dashboards pages (Phase 3).

- [ ] **Step 1: Create the component**

```vue
<!-- ui/src/components/Perses/PersesCanvas.vue -->
<template>
  <div ref="containerRef" class="perses-canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { createElement } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { PluginRegistry, PluginRegistryProvider } from '@perses-dev/plugin-system'
import { DashboardProvider, Dashboard } from '@perses-dev/dashboards'
import { usePerses } from '@/composables/usePerses'
import { buildPersesTheme } from '@/theme/persesTheme'
import { OpenNMSPlugin } from '@/datasource/opennms'
import type { DashboardResource } from '@perses-dev/core'

const registry = new PluginRegistry({
  plugins: [
    { pluginType: 'TimeSeriesQuery', kind: OpenNMSPlugin.kind, plugin: OpenNMSPlugin.plugin }
  ]
})

interface Props {
  dashboardResource: DashboardResource
  isEditMode?: boolean
  onSave?: (resource: DashboardResource) => Promise<void>
}

const props = defineProps<Props>()
const containerRef = ref<HTMLElement | null>(null)

// Wrap props in a ref-like object so usePerses can watch it
const canvasSpec = toRef(() => ({
  kind: 'PersesCanvas' as const,
  spec: {
    resource: props.dashboardResource,
    isEditMode: props.isEditMode ?? false
  }
}))

usePerses(containerRef, canvasSpec as any, (_spec) => {
  const theme = buildPersesTheme()
  return createElement(
    ThemeProvider,
    { theme },
    createElement(
      PluginRegistryProvider,
      { pluginRegistry: registry },
      createElement(
        DashboardProvider,
        {
          initialState: {
            dashboardResource: props.dashboardResource,
            isEditMode: props.isEditMode ?? false
          },
          onSave: props.onSave
        },
        createElement(Dashboard, null)
      )
    )
  )
})
</script>

<style scoped>
.perses-canvas-container {
  width: 100%;
  min-height: 500px;
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep "PersesCanvas" || echo "OK"
```

Expected: no errors

- [ ] **Step 3: Run all frontend tests**

```bash
cd ui && yarn test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Perses/PersesCanvas.vue
git commit -m "feat(components): add PersesCanvas Vue component (full dashboard runtime)"
```

---

## Phase 1 Complete

At this point:
- `onms_dashboards` table exists and is schema-managed by Liquibase
- `/rest/dashboards` CRUD endpoints are live and tested
- The OpenNMS Perses datasource plugin can translate `OpenNMSQuerySpec` → `/rest/measurements` → `TimeSeriesData`
- React panels can be mounted in Vue components via `usePerses`
- `PersesPanel` and `PersesCanvas` are ready for use in Phases 2 and 3

Proceed to `2026-04-05-perses-phase2-resource-graphs.md`.
