# Domain E — Path Outages & On-Call Roles: REST + Vue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two new v2 REST services and three Vue SPA pages for path-outage configuration and on-call role management, then redirect the six legacy JSPs.

**Architecture:** Two `@Component` JAX-RS services in `org.opennms.web.rest.v2` — `PathOutageRestService` (autowires `PathOutageDao`) and `OnCallRoleRestService` (uses `GroupFactory.getInstance()` static singleton). Vue side follows the established pattern: one service file per feature, one container per route, PrimeVue DataTable for list views, Dialog for edit forms.

**Tech Stack:** Java 17 / JAX-RS (Apache CXF) / Spring / Hibernate — REST at `/api/v2/`. Vue 3 / TypeScript / PrimeVue 4 / Axios. Build: `./maven/bin/mvn compile -DskipTests --projects :opennms-webapp-rest` + `cd ui && ../target/node/pnpm build`.

---

## Environment assumptions

- Container `test-opennms` is running on port 8980, password `notdefault`.
- `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home`
- All commands run from repo root `/Users/chance/git/opennms` unless noted.

---

## File Map

### Created
| File | Purpose |
|---|---|
| `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/PathOutageDTO.java` | JSON-serializable DTO (OnmsPathOutage has no @XmlRootElement) |
| `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/RoleList.java` | JAXB list wrapper for Role collection responses |
| `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/PathOutageRestService.java` | REST service: CRUD for path outages |
| `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/OnCallRoleRestService.java` | REST service: CRUD for on-call roles |
| `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/PathOutageRestServiceTest.java` | DTO marshal round-trip tests |
| `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/OnCallRoleRestServiceTest.java` | RoleList marshal round-trip tests |
| `ui/src/services/pathOutageService.ts` | Axios calls + TypeScript types for path outages |
| `ui/src/services/onCallRoleService.ts` | Axios calls + TypeScript types for on-call roles |
| `ui/src/containers/PathOutages.vue` | Route `/path-outages` — list + inline create/delete |
| `ui/src/containers/OnCallRoles.vue` | Route `/on-call-roles` — list + create/delete |
| `ui/src/containers/OnCallRoleDetail.vue` | Route `/on-call-role/:name` — detail + schedule |

### Modified
| File | Change |
|---|---|
| `ui/src/main/router/index.ts` | 3 new admin-guarded routes |
| `ui/src/containers/Admin.vue` | `href:` → `to:` for path outages; add on-call roles link |
| `opennms-webapp/src/main/webapp/pathOutage/index.jsp` | sendRedirect → `/ui/path-outages` |
| `opennms-webapp/src/main/webapp/pathOutage/showNodes.jsp` | sendRedirect → `/ui/path-outages` |
| `opennms-webapp/src/main/webapp/admin/userGroupView/roles/list.jsp` | sendRedirect → `/ui/on-call-roles` |
| `opennms-webapp/src/main/webapp/admin/userGroupView/roles/view.jsp` | sendRedirect → `/ui/on-call-role/:name` |
| `opennms-webapp/src/main/webapp/admin/userGroupView/roles/editDetails.jsp` | sendRedirect → `/ui/on-call-roles` |
| `opennms-webapp/src/main/webapp/admin/userGroupView/roles/editSpecific.jsp` | sendRedirect → `/ui/on-call-roles` |

---

## Task 1: PathOutageDTO

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/PathOutageDTO.java`

- [ ] **Step 1: Create the DTO**

```java
// opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/PathOutageDTO.java
package org.opennms.web.rest.support;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "pathOutage")
public class PathOutageDTO {
    private int nodeId;
    private String nodeLabel;
    private String criticalPathIp;
    private String criticalPathServiceName;

    public PathOutageDTO() {}

    @XmlElement public int getNodeId() { return nodeId; }
    public void setNodeId(int nodeId) { this.nodeId = nodeId; }

    @XmlElement public String getNodeLabel() { return nodeLabel; }
    public void setNodeLabel(String nodeLabel) { this.nodeLabel = nodeLabel; }

    @XmlElement public String getCriticalPathIp() { return criticalPathIp; }
    public void setCriticalPathIp(String criticalPathIp) { this.criticalPathIp = criticalPathIp; }

    @XmlElement public String getCriticalPathServiceName() { return criticalPathServiceName; }
    public void setCriticalPathServiceName(String criticalPathServiceName) {
        this.criticalPathServiceName = criticalPathServiceName;
    }
}
```

- [ ] **Step 2: Create the test**

```java
// opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/PathOutageRestServiceTest.java
package org.opennms.web.rest.v2;

import static org.junit.Assert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import org.opennms.web.rest.support.PathOutageDTO;

public class PathOutageRestServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    public void dtoRoundTripsAsJson() throws Exception {
        PathOutageDTO dto = new PathOutageDTO();
        dto.setNodeId(42);
        dto.setNodeLabel("router-core");
        dto.setCriticalPathIp("10.0.0.1");
        dto.setCriticalPathServiceName("ICMP");

        String json = mapper.writeValueAsString(dto);
        PathOutageDTO back = mapper.readValue(json, PathOutageDTO.class);

        assertEquals(42, back.getNodeId());
        assertEquals("router-core", back.getNodeLabel());
        assertEquals("10.0.0.1", back.getCriticalPathIp());
        assertEquals("ICMP", back.getCriticalPathServiceName());
    }
}
```

- [ ] **Step 3: Run test**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn test -pl opennms-webapp-rest \
  -Dtest=PathOutageRestServiceTest -DskipITs
```

Expected: `BUILD SUCCESS`, `Tests run: 1, Failures: 0`.

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/PathOutageDTO.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/PathOutageRestServiceTest.java
git commit -m "feat(rest): add PathOutageDTO support class"
```

---

## Task 2: PathOutageRestService

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/PathOutageRestService.java`

- [ ] **Step 1: Write the service**

```java
// opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/PathOutageRestService.java
package org.opennms.web.rest.v2;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.utils.InetAddressUtils;
import org.opennms.netmgt.dao.api.NodeDao;
import org.opennms.netmgt.dao.api.PathOutageDao;
import org.opennms.netmgt.model.OnmsNode;
import org.opennms.netmgt.model.OnmsPathOutage;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.PathOutageDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.ws.rs.*;
import javax.ws.rs.core.*;
import java.util.List;
import java.util.stream.Collectors;

@Component
@Path("path-outages")
@Tag(name = "PathOutages", description = "Path Outages API")
public class PathOutageRestService {

    private static final Logger LOG = LoggerFactory.getLogger(PathOutageRestService.class);

    @Autowired
    private PathOutageDao m_pathOutageDao;

    @Autowired
    private NodeDao m_nodeDao;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List all path outage configurations", operationId = "listPathOutages")
    public Response getPathOutages(@Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        List<PathOutageDTO> dtos = m_pathOutageDao.findAll().stream()
            .map(this::toDto).collect(Collectors.toList());
        return Response.ok(dtos).build();
    }

    @GET
    @Path("{nodeId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get path outage configuration for a node", operationId = "getPathOutage")
    public Response getPathOutage(@PathParam("nodeId") int nodeId, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        OnmsPathOutage outage = m_pathOutageDao.get(nodeId);
        if (outage == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(toDto(outage)).build();
    }

    @GET
    @Path("{nodeId}/dependents")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List node IDs that depend on this critical path", operationId = "getPathOutageDependents")
    public Response getDependents(@PathParam("nodeId") int nodeId, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        OnmsPathOutage outage = m_pathOutageDao.get(nodeId);
        if (outage == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        List<Integer> deps = m_pathOutageDao.getNodesForPathOutage(outage);
        return Response.ok(deps).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create or update a path outage", operationId = "savePathOutage")
    public Response savePathOutage(PathOutageDTO dto, @Context SecurityContext sc, @Context UriInfo uriInfo) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        OnmsNode node = m_nodeDao.get(dto.getNodeId());
        if (node == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity("Node " + dto.getNodeId() + " not found").build();
        }
        OnmsPathOutage entity = new OnmsPathOutage(
            node,
            InetAddressUtils.addr(dto.getCriticalPathIp()),
            dto.getCriticalPathServiceName()
        );
        m_pathOutageDao.saveOrUpdate(entity);
        return Response.created(uriInfo.getRequestUriBuilder()
            .path(String.valueOf(dto.getNodeId())).build())
            .entity(toDto(entity)).build();
    }

    @DELETE
    @Path("{nodeId}")
    @Operation(summary = "Remove path outage configuration for a node", operationId = "deletePathOutage")
    public Response deletePathOutage(@PathParam("nodeId") int nodeId, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        OnmsPathOutage outage = m_pathOutageDao.get(nodeId);
        if (outage == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        m_pathOutageDao.delete(outage);
        return Response.noContent().build();
    }

    private PathOutageDTO toDto(OnmsPathOutage e) {
        PathOutageDTO dto = new PathOutageDTO();
        dto.setNodeId(e.getNodeId());
        if (e.getNode() != null) dto.setNodeLabel(e.getNode().getLabel());
        dto.setCriticalPathIp(InetAddressUtils.str(e.getCriticalPathIp()));
        dto.setCriticalPathServiceName(e.getCriticalPathServiceName());
        return dto;
    }
}
```

- [ ] **Step 2: Compile**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp-rest
```

Expected: `BUILD SUCCESS`. Fix any import errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/PathOutageRestService.java
git commit -m "feat(rest): add PathOutageRestService v2 endpoint"
```

---

## Task 3: RoleList wrapper

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/RoleList.java`

- [ ] **Step 1: Create RoleList**

```java
// opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/RoleList.java
package org.opennms.web.rest.support;

import org.opennms.netmgt.config.groups.Role;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@XmlRootElement(name = "roles")
public class RoleList {
    private List<Role> m_roles = new ArrayList<>();

    public RoleList() {}

    public RoleList(Collection<Role> roles) {
        m_roles.addAll(roles);
    }

    @XmlElement(name = "role")
    public List<Role> getRoles() { return m_roles; }
    public void setRoles(List<Role> roles) { m_roles = roles; }
}
```

- [ ] **Step 2: Create the test**

```java
// opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/OnCallRoleRestServiceTest.java
package org.opennms.web.rest.v2;

import static org.junit.Assert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import org.opennms.netmgt.config.groups.Role;
import org.opennms.web.rest.support.RoleList;

public class OnCallRoleRestServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    public void roleListRoundTripsAsJson() throws Exception {
        Role role = new Role();
        role.setName("Network-On-Call");
        role.setMembershipGroup("Network");
        role.setSupervisor("admin");
        role.setDescription("Network team on-call rotation");

        RoleList list = new RoleList();
        list.getRoles().add(role);

        String json = mapper.writeValueAsString(list);
        assertTrue("JSON should contain role name", json.contains("Network-On-Call"));

        RoleList back = mapper.readValue(json, RoleList.class);
        assertEquals(1, back.getRoles().size());
        assertEquals("Network-On-Call", back.getRoles().get(0).getName());
    }

    @Test
    public void emptyRoleListRoundTrips() throws Exception {
        RoleList list = new RoleList();
        String json = mapper.writeValueAsString(list);
        RoleList back = mapper.readValue(json, RoleList.class);
        assertNotNull(back);
    }
}
```

- [ ] **Step 3: Run test**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn test -pl opennms-webapp-rest \
  -Dtest=OnCallRoleRestServiceTest -DskipITs
```

Expected: `BUILD SUCCESS`, `Tests run: 2, Failures: 0`.

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/RoleList.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/OnCallRoleRestServiceTest.java
git commit -m "feat(rest): add RoleList wrapper and OnCallRole tests"
```

---

## Task 4: OnCallRoleRestService

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/OnCallRoleRestService.java`

The role management backend is `GroupFactory` — a static singleton, identical pattern to `NotifdConfigFactory`. Call `GroupFactory.init()` then `GroupFactory.getInstance()` on each request (idempotent after first init).

- [ ] **Step 1: Write the service**

```java
// opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/OnCallRoleRestService.java
package org.opennms.web.rest.v2;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.GroupFactory;
import org.opennms.netmgt.config.GroupManager;
import org.opennms.netmgt.config.groups.Role;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.RoleList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.ws.rs.*;
import javax.ws.rs.core.*;

@Component
@Path("on-call-roles")
@Tag(name = "OnCallRoles", description = "On-Call Roles API")
public class OnCallRoleRestService {

    private static final Logger LOG = LoggerFactory.getLogger(OnCallRoleRestService.class);

    private GroupManager groupManager() {
        try {
            GroupFactory.init();
            return GroupFactory.getInstance();
        } catch (Exception e) {
            throw new WebApplicationException(Response.serverError()
                .entity("Failed to load group configuration: " + e.getMessage()).build());
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List all on-call roles", operationId = "listOnCallRoles")
    public Response getRoles(@Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        return Response.ok(new RoleList(groupManager().getRoles())).build();
    }

    @GET
    @Path("{name}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get an on-call role by name", operationId = "getOnCallRole")
    public Response getRole(@PathParam("name") String name, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        Role role = groupManager().getRole(name);
        if (role == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(role).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create an on-call role", operationId = "createOnCallRole")
    public Response createRole(Role role, @Context SecurityContext sc, @Context UriInfo uriInfo) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (role.getName() == null || role.getName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("name is required").build();
        }
        try {
            groupManager().saveRole(role);
            return Response.created(uriInfo.getRequestUriBuilder()
                .path(role.getName()).build()).entity(role).build();
        } catch (Exception e) {
            LOG.error("Failed to save role {}", role.getName(), e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @PUT
    @Path("{name}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Update an on-call role", operationId = "updateOnCallRole")
    public Response updateRole(@PathParam("name") String name, Role role,
                               @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (groupManager().getRole(name) == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        try {
            groupManager().saveRole(role);
            return Response.ok(role).build();
        } catch (Exception e) {
            LOG.error("Failed to update role {}", name, e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @DELETE
    @Path("{name}")
    @Operation(summary = "Delete an on-call role", operationId = "deleteOnCallRole")
    public Response deleteRole(@PathParam("name") String name, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (groupManager().getRole(name) == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        try {
            groupManager().deleteRole(name);
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to delete role {}", name, e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }
}
```

- [ ] **Step 2: Compile**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp-rest
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/OnCallRoleRestService.java
git commit -m "feat(rest): add OnCallRoleRestService v2 endpoint"
```

---

## Task 5: Hot-deploy REST changes and curl-verify

**Files:** none new — patching the running jar.

- [ ] **Step 1: Build the war/jar**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn package -DskipTests --projects :opennms-webapp-rest
```

- [ ] **Step 2: Patch the running jar (uf = update, NOT cf)**

```bash
JAR=/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-rest-35.0.4.jar
CLASSES=opennms-webapp-rest/target/classes

jar uf "$CLASSES/../opennms-webapp-rest-35.0.4.jar" \
  -C "$CLASSES" org/opennms/web/rest/support/PathOutageDTO.class \
  -C "$CLASSES" org/opennms/web/rest/support/RoleList.class \
  -C "$CLASSES" org/opennms/web/rest/v2/PathOutageRestService.class \
  -C "$CLASSES" org/opennms/web/rest/v2/OnCallRoleRestService.class

podman cp "$CLASSES/../opennms-webapp-rest-35.0.4.jar" \
  test-opennms:$JAR
podman restart test-opennms
```

Wait ~20 seconds for startup, then:

```bash
until curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/info | grep -q 200; do sleep 5; done
echo "OpenNMS ready"
```

- [ ] **Step 3: Verify path-outages endpoint**

```bash
curl -s -u admin:notdefault \
  http://localhost:8980/opennms/api/v2/path-outages \
  -H "Accept: application/json" | python3 -m json.tool
```

Expected: HTTP 200, JSON array (possibly empty `[]` if no path outages configured). Note the exact field names returned — use them verbatim in the TypeScript types in Task 6.

- [ ] **Step 4: Verify on-call-roles endpoint**

```bash
curl -s -u admin:notdefault \
  http://localhost:8980/opennms/api/v2/on-call-roles \
  -H "Accept: application/json" | python3 -m json.tool
```

Expected: HTTP 200, JSON object with `roles` array. Note the exact JSON key casing (e.g. `membership-group` vs `membershipGroup`) — use verbatim in TypeScript.

- [ ] **Step 5: Smoke-test create + delete for path outages**

Find a valid nodeId first:
```bash
curl -s -u admin:notdefault \
  "http://localhost:8980/opennms/api/v2/nodes?limit=1" \
  -H "Accept: application/json" | python3 -m json.tool | grep '"id"'
```

Then create a path outage (replace `NODE_ID` with the id from above):
```bash
curl -s -u admin:notdefault -X POST \
  http://localhost:8980/opennms/api/v2/path-outages \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"nodeId": NODE_ID, "criticalPathIp": "127.0.0.1", "criticalPathServiceName": "ICMP"}' \
  | python3 -m json.tool
```

Expected: HTTP 201 with the created object. Then delete it:
```bash
curl -s -u admin:notdefault -X DELETE \
  http://localhost:8980/opennms/api/v2/path-outages/NODE_ID
```

Expected: HTTP 204.

---

## Task 6: pathOutageService.ts

**Files:**
- Create: `ui/src/services/pathOutageService.ts`

Use the exact JSON field names observed from the curl in Task 5. The shape below assumes the DTO maps camelCase — adjust if the curl output differs.

- [ ] **Step 1: Write the service**

```typescript
// ui/src/services/pathOutageService.ts
import { v2 } from '@/services/axiosInstances'

export interface PathOutage {
  nodeId: number
  nodeLabel?: string
  criticalPathIp: string
  criticalPathServiceName: string
}

const normalize = (raw: unknown): PathOutage[] => {
  if (Array.isArray(raw)) return raw
  if (raw) return [raw as PathOutage]
  return []
}

export const getPathOutages = async (): Promise<PathOutage[]> => {
  const resp = await v2.get('/path-outages')
  return normalize(resp.data)
}

export const getPathOutage = async (nodeId: number): Promise<PathOutage> => {
  const resp = await v2.get(`/path-outages/${nodeId}`)
  return resp.data
}

export const getPathOutageDependents = async (nodeId: number): Promise<number[]> => {
  const resp = await v2.get(`/path-outages/${nodeId}/dependents`)
  const raw = resp.data
  return Array.isArray(raw) ? raw : raw ? [raw] : []
}

export const savePathOutage = async (outage: PathOutage): Promise<PathOutage> => {
  const resp = await v2.post('/path-outages', outage)
  return resp.data
}

export const deletePathOutage = async (nodeId: number): Promise<void> => {
  await v2.delete(`/path-outages/${nodeId}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/services/pathOutageService.ts
git commit -m "feat(ui): add pathOutageService"
```

---

## Task 7: PathOutages.vue

**Files:**
- Create: `ui/src/containers/PathOutages.vue`

- [ ] **Step 1: Write the container**

```vue
<!-- ui/src/containers/PathOutages.vue -->
<template>
  <div class="path-outages-container">
    <feather-app-layout>
      <template #rail>
        <side-menu />
      </template>
      <div class="page-content">
        <bread-crumb :items="breadCrumbs" />
        <h1 class="page-title">Path Outages</h1>
        <p class="page-desc">
          Configure critical path dependencies. When a node's critical path is down,
          its outage will not generate notifications.
        </p>

        <div class="actions-bar">
          <Button label="Add Path Outage" icon="pi pi-plus" @click="openAddDialog" />
        </div>

        <DataTable
          :value="pathOutages"
          :loading="loading"
          dataKey="nodeId"
          stripedRows
          rowHover
          class="path-outages-table"
        >
          <template #empty>No path outages configured.</template>
          <Column field="nodeId" header="Node ID" style="width: 8rem" />
          <Column field="nodeLabel" header="Node Label" />
          <Column field="criticalPathIp" header="Critical Path IP" />
          <Column field="criticalPathServiceName" header="Service" style="width: 10rem" />
          <Column header="Actions" style="width: 8rem">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                :aria-label="`Delete path outage for node ${data.nodeId}`"
                @click="confirmDelete(data)"
              />
            </template>
          </Column>
        </DataTable>

        <Dialog v-model:visible="addDialogVisible" header="Add Path Outage" modal style="width: 480px">
          <div class="form-field">
            <label for="nodeId">Node ID</label>
            <InputText id="nodeId" v-model="form.nodeId" type="number" />
          </div>
          <div class="form-field">
            <label for="criticalIp">Critical Path IP</label>
            <InputText id="criticalIp" v-model="form.criticalPathIp" placeholder="e.g. 192.168.1.1" />
          </div>
          <div class="form-field">
            <label for="service">Service</label>
            <InputText id="service" v-model="form.criticalPathServiceName" placeholder="e.g. ICMP" />
          </div>
          <template #footer>
            <Button label="Cancel" text @click="addDialogVisible = false" />
            <Button label="Save" :loading="saving" @click="submitAdd" />
          </template>
        </Dialog>

        <ConfirmDialog />
      </div>
    </feather-app-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumb from '@/components/BreadCrumb.vue'
import SideMenu from '@/components/Menu/SideMenu.vue'
import useSnackbar from '@/composables/useSnackbar'
import {
  type PathOutage,
  getPathOutages,
  savePathOutage,
  deletePathOutage
} from '@/services/pathOutageService'

const confirm = useConfirm()
const { showSnackBar } = useSnackbar()

const breadCrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'Path Outages', to: '#', position: 'last' }
]

const pathOutages = ref<PathOutage[]>([])
const loading = ref(false)
const saving = ref(false)
const addDialogVisible = ref(false)
const form = ref({ nodeId: '' as unknown as number, criticalPathIp: '', criticalPathServiceName: 'ICMP' })

const load = async () => {
  loading.value = true
  try {
    pathOutages.value = await getPathOutages()
  } catch {
    showSnackBar({ msg: 'Failed to load path outages.' })
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  form.value = { nodeId: '' as unknown as number, criticalPathIp: '', criticalPathServiceName: 'ICMP' }
  addDialogVisible.value = true
}

const submitAdd = async () => {
  saving.value = true
  try {
    await savePathOutage({
      nodeId: Number(form.value.nodeId),
      criticalPathIp: form.value.criticalPathIp,
      criticalPathServiceName: form.value.criticalPathServiceName
    })
    addDialogVisible.value = false
    showSnackBar({ msg: 'Path outage saved.' })
    await load()
  } catch {
    showSnackBar({ msg: 'Failed to save path outage.' })
  } finally {
    saving.value = false
  }
}

const confirmDelete = (outage: PathOutage) => {
  confirm.require({
    message: `Remove path outage for node ${outage.nodeId} (${outage.nodeLabel ?? outage.nodeId})?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      try {
        await deletePathOutage(outage.nodeId)
        showSnackBar({ msg: 'Path outage removed.' })
        await load()
      } catch {
        showSnackBar({ msg: 'Failed to remove path outage.' })
      }
    }
  })
}

onMounted(load)
</script>

<style scoped lang="scss">
.page-content { padding: 1.5rem; max-width: 1200px; }
.page-title { margin: 0 0 0.5rem; }
.page-desc { margin: 0 0 1.5rem; color: var(--feather-secondary-text-on-surface); }
.actions-bar { margin-bottom: 1rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; }
.form-field label { font-weight: 500; font-size: 0.875rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/PathOutages.vue
git commit -m "feat(ui): add PathOutages container"
```

---

## Task 8: onCallRoleService.ts

**Files:**
- Create: `ui/src/services/onCallRoleService.ts`

Use the exact JSON key names from the curl in Task 5 Step 4. The `Role` JAXB model uses kebab-case XML attribute names (`membership-group`, `supervisor`) — check whether these appear as-is in JSON or as camelCase.

- [ ] **Step 1: Write the service**

```typescript
// ui/src/services/onCallRoleService.ts
import { v2 } from '@/services/axiosInstances'

// Adjust property names to match actual JSON output from curl in Task 5 Step 4.
// Role comes from org.opennms.netmgt.config.groups.Role (JAXB @XmlRootElement).
export interface OnCallRole {
  name: string
  'membership-group': string   // JAXB @XmlAttribute(name="membership-group")
  supervisor: string
  description?: string
  schedule?: unknown[]         // Schedule model is complex; treat as opaque for now
}

const normalizeRoles = (raw: unknown): OnCallRole[] => {
  // Response is wrapped: { role: [...] } or { role: {...} }
  const data = (raw as Record<string, unknown>)?.role ?? raw
  if (Array.isArray(data)) return data
  if (data) return [data as OnCallRole]
  return []
}

export const getRoles = async (): Promise<OnCallRole[]> => {
  const resp = await v2.get('/on-call-roles')
  return normalizeRoles(resp.data)
}

export const getRole = async (name: string): Promise<OnCallRole> => {
  const resp = await v2.get(`/on-call-roles/${encodeURIComponent(name)}`)
  return resp.data
}

export const createRole = async (role: OnCallRole): Promise<OnCallRole> => {
  const resp = await v2.post('/on-call-roles', role)
  return resp.data
}

export const updateRole = async (name: string, role: OnCallRole): Promise<OnCallRole> => {
  const resp = await v2.put(`/on-call-roles/${encodeURIComponent(name)}`, role)
  return resp.data
}

export const deleteRole = async (name: string): Promise<void> => {
  await v2.delete(`/on-call-roles/${encodeURIComponent(name)}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/services/onCallRoleService.ts
git commit -m "feat(ui): add onCallRoleService"
```

---

## Task 9: OnCallRoles.vue

**Files:**
- Create: `ui/src/containers/OnCallRoles.vue`

- [ ] **Step 1: Write the container**

```vue
<!-- ui/src/containers/OnCallRoles.vue -->
<template>
  <div class="on-call-roles-container">
    <feather-app-layout>
      <template #rail>
        <side-menu />
      </template>
      <div class="page-content">
        <bread-crumb :items="breadCrumbs" />
        <h1 class="page-title">On-Call Roles</h1>
        <p class="page-desc">Manage on-call rotation roles and their membership groups.</p>

        <div class="actions-bar">
          <Button label="New Role" icon="pi pi-plus" @click="openAddDialog" />
        </div>

        <DataTable
          :value="roles"
          :loading="loading"
          dataKey="name"
          stripedRows
          rowHover
        >
          <template #empty>No on-call roles defined.</template>
          <Column field="name" header="Role Name">
            <template #body="{ data }">
              <router-link :to="`/on-call-role/${encodeURIComponent(data.name)}`">
                {{ data.name }}
              </router-link>
            </template>
          </Column>
          <Column field="membership-group" header="Membership Group" />
          <Column field="supervisor" header="Supervisor" />
          <Column field="description" header="Description" />
          <Column header="Actions" style="width: 8rem">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                :aria-label="`Delete role ${data.name}`"
                @click="confirmDelete(data)"
              />
            </template>
          </Column>
        </DataTable>

        <Dialog v-model:visible="addDialogVisible" header="New On-Call Role" modal style="width: 480px">
          <div class="form-field">
            <label for="roleName">Name</label>
            <InputText id="roleName" v-model="form.name" />
          </div>
          <div class="form-field">
            <label for="group">Membership Group</label>
            <InputText id="group" v-model="form['membership-group']" />
          </div>
          <div class="form-field">
            <label for="supervisor">Supervisor</label>
            <InputText id="supervisor" v-model="form.supervisor" />
          </div>
          <div class="form-field">
            <label for="desc">Description</label>
            <InputText id="desc" v-model="form.description" />
          </div>
          <template #footer>
            <Button label="Cancel" text @click="addDialogVisible = false" />
            <Button label="Create" :loading="saving" @click="submitAdd" />
          </template>
        </Dialog>

        <ConfirmDialog />
      </div>
    </feather-app-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumb from '@/components/BreadCrumb.vue'
import SideMenu from '@/components/Menu/SideMenu.vue'
import useSnackbar from '@/composables/useSnackbar'
import { type OnCallRole, getRoles, createRole, deleteRole } from '@/services/onCallRoleService'

const confirm = useConfirm()
const { showSnackBar } = useSnackbar()

const breadCrumbs = [
  { label: 'Admin', to: '/admin' },
  { label: 'On-Call Roles', to: '#', position: 'last' }
]

const roles = ref<OnCallRole[]>([])
const loading = ref(false)
const saving = ref(false)
const addDialogVisible = ref(false)
const form = ref<OnCallRole>({ name: '', 'membership-group': '', supervisor: '', description: '' })

const load = async () => {
  loading.value = true
  try { roles.value = await getRoles() }
  catch { showSnackBar({ msg: 'Failed to load on-call roles.' }) }
  finally { loading.value = false }
}

const openAddDialog = () => {
  form.value = { name: '', 'membership-group': '', supervisor: '', description: '' }
  addDialogVisible.value = true
}

const submitAdd = async () => {
  saving.value = true
  try {
    await createRole(form.value)
    addDialogVisible.value = false
    showSnackBar({ msg: 'Role created.' })
    await load()
  } catch {
    showSnackBar({ msg: 'Failed to create role.' })
  } finally {
    saving.value = false
  }
}

const confirmDelete = (role: OnCallRole) => {
  confirm.require({
    message: `Delete role "${role.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      try {
        await deleteRole(role.name)
        showSnackBar({ msg: 'Role deleted.' })
        await load()
      } catch {
        showSnackBar({ msg: 'Failed to delete role.' })
      }
    }
  })
}

onMounted(load)
</script>

<style scoped lang="scss">
.page-content { padding: 1.5rem; max-width: 1200px; }
.page-title { margin: 0 0 0.5rem; }
.page-desc { margin: 0 0 1.5rem; color: var(--feather-secondary-text-on-surface); }
.actions-bar { margin-bottom: 1rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; }
.form-field label { font-weight: 500; font-size: 0.875rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/OnCallRoles.vue
git commit -m "feat(ui): add OnCallRoles container"
```

---

## Task 10: OnCallRoleDetail.vue

**Files:**
- Create: `ui/src/containers/OnCallRoleDetail.vue`

- [ ] **Step 1: Write the container**

```vue
<!-- ui/src/containers/OnCallRoleDetail.vue -->
<template>
  <div class="on-call-role-detail-container">
    <feather-app-layout>
      <template #rail>
        <side-menu />
      </template>
      <div class="page-content">
        <bread-crumb :items="breadCrumbs" />

        <div v-if="loading" class="loading-state">
          <ProgressSpinner />
        </div>

        <template v-else-if="role">
          <h1 class="page-title">{{ role.name }}</h1>

          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Membership Group</span>
              <span>{{ role['membership-group'] }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Supervisor</span>
              <span>{{ role.supervisor }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Description</span>
              <span>{{ role.description ?? '—' }}</span>
            </div>
          </div>

          <h2 class="section-title">Schedule</h2>
          <p v-if="!role.schedule?.length" class="empty-note">No schedule defined.</p>
          <DataTable v-else :value="role.schedule" dataKey="name" stripedRows>
            <Column field="name" header="Schedule Name" />
            <Column field="type" header="Type" />
          </DataTable>
        </template>

        <div v-else class="error-state">Role not found.</div>
      </div>
    </feather-app-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressSpinner from 'primevue/progressspinner'
import BreadCrumb from '@/components/BreadCrumb.vue'
import SideMenu from '@/components/Menu/SideMenu.vue'
import useSnackbar from '@/composables/useSnackbar'
import { type OnCallRole, getRole } from '@/services/onCallRoleService'

const route = useRoute()
const { showSnackBar } = useSnackbar()

const role = ref<OnCallRole | null>(null)
const loading = ref(false)

const roleName = computed(() => decodeURIComponent(route.params.name as string))

const breadCrumbs = computed(() => [
  { label: 'Admin', to: '/admin' },
  { label: 'On-Call Roles', to: '/on-call-roles' },
  { label: roleName.value, to: '#', position: 'last' }
])

onMounted(async () => {
  loading.value = true
  try {
    role.value = await getRole(roleName.value)
  } catch {
    showSnackBar({ msg: `Failed to load role "${roleName.value}".` })
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.page-content { padding: 1.5rem; max-width: 900px; }
.page-title { margin: 0 0 1.5rem; }
.section-title { margin: 1.5rem 0 0.75rem; }
.detail-grid { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
.detail-row { display: flex; gap: 1rem; }
.detail-label { font-weight: 600; width: 160px; flex-shrink: 0; color: var(--feather-secondary-text-on-surface); }
.loading-state, .error-state, .empty-note { padding: 1rem 0; color: var(--feather-secondary-text-on-surface); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/containers/OnCallRoleDetail.vue
git commit -m "feat(ui): add OnCallRoleDetail container"
```

---

## Task 11: Router + Admin.vue wiring

**Files:**
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/containers/Admin.vue`

- [ ] **Step 1: Add routes to router**

In `ui/src/main/router/index.ts`, find the block of admin-guarded routes (e.g. near the `/path-outages` or `/monitoring-locations` entry). Add the three new routes following the exact same `beforeEnter` guard pattern used by every other admin route:

```typescript
{
  path: '/path-outages',
  name: 'PathOutages',
  component: () => import('@/containers/PathOutages.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'No role access to path outages.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
{
  path: '/on-call-roles',
  name: 'OnCallRoles',
  component: () => import('@/containers/OnCallRoles.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'No role access to on-call roles.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
{
  path: '/on-call-role/:name',
  name: 'OnCallRoleDetail',
  component: () => import('@/containers/OnCallRoleDetail.vue'),
  beforeEnter: (to, from) => {
    const checkRoles = () => {
      if (!adminRole.value) {
        showSnackBar({ msg: 'No role access to on-call roles.' })
        router.push(from.path)
      }
    }
    if (rolesAreLoaded.value) checkRoles()
    else whenever(rolesAreLoaded, () => checkRoles())
  }
},
```

- [ ] **Step 2: Update Admin.vue**

In `ui/src/containers/Admin.vue`, make two changes:

**Change 1** — replace the legacy path outage href:
```typescript
// Before:
{ label: 'Configure Path Outages (legacy)', href: baseHref.value + 'admin/notification/noticeWizard/buildPathOutage.jsp' },

// After:
{ label: 'Configure Path Outages', to: '/path-outages' },
```

**Change 2** — add on-call roles as a separate entry under the Users/Groups section. Find the `Configure Users, Groups and On-Call Roles` entry and add a new line after it:
```typescript
{ label: 'Configure Users, Groups and On-Call Roles', to: '/users-groups' },
{ label: 'Manage On-Call Roles', to: '/on-call-roles' },  // add this line
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/main/router/index.ts ui/src/containers/Admin.vue
git commit -m "feat(ui): wire path-outages and on-call-roles routes + admin links"
```

---

## Task 12: JSP redirects

**Files:** 6 JSPs, all changed to redirect-only scriptlets.

- [ ] **Step 1: Redirect pathOutage JSPs**

```bash
cat > opennms-webapp/src/main/webapp/pathOutage/index.jsp << 'EOF'
<%@ page language="java" %>
<% response.sendRedirect(request.getContextPath() + "/ui/path-outages"); %>
EOF

cat > opennms-webapp/src/main/webapp/pathOutage/showNodes.jsp << 'EOF'
<%@ page language="java" %>
<% response.sendRedirect(request.getContextPath() + "/ui/path-outages"); %>
EOF
```

- [ ] **Step 2: Redirect roles JSPs**

`roles/view.jsp` receives a `role` query parameter — forward it to the detail route:

```bash
cat > opennms-webapp/src/main/webapp/admin/userGroupView/roles/list.jsp << 'EOF'
<%@ page language="java" %>
<% response.sendRedirect(request.getContextPath() + "/ui/on-call-roles"); %>
EOF

cat > opennms-webapp/src/main/webapp/admin/userGroupView/roles/editDetails.jsp << 'EOF'
<%@ page language="java" %>
<% response.sendRedirect(request.getContextPath() + "/ui/on-call-roles"); %>
EOF

cat > opennms-webapp/src/main/webapp/admin/userGroupView/roles/editSpecific.jsp << 'EOF'
<%@ page language="java" %>
<% response.sendRedirect(request.getContextPath() + "/ui/on-call-roles"); %>
EOF
```

For `view.jsp`, forward to the detail page using the `role` parameter if present:

```bash
cat > opennms-webapp/src/main/webapp/admin/userGroupView/roles/view.jsp << 'EOF'
<%@ page language="java" %>
<%
  String name = request.getParameter("role");
  String target = "/ui/on-call-roles";
  if (name != null && !name.isEmpty()) {
    target = "/ui/on-call-role/" + java.net.URLEncoder.encode(name, "UTF-8");
  }
  response.sendRedirect(request.getContextPath() + target);
%>
EOF
```

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp/src/main/webapp/pathOutage/index.jsp \
        opennms-webapp/src/main/webapp/pathOutage/showNodes.jsp \
        opennms-webapp/src/main/webapp/admin/userGroupView/roles/list.jsp \
        opennms-webapp/src/main/webapp/admin/userGroupView/roles/view.jsp \
        opennms-webapp/src/main/webapp/admin/userGroupView/roles/editDetails.jsp \
        opennms-webapp/src/main/webapp/admin/userGroupView/roles/editSpecific.jsp
git commit -m "chore: redirect path outage and on-call role JSPs to Vue SPA"
```

---

## Task 13: Vue build, deploy, and end-to-end verify

**Files:** none new.

- [ ] **Step 1: Build the Vue SPA**

```bash
cd ui && ../target/node/pnpm build
```

Expected: `dist/index.html` present, `src/main/dist/index.html` updated with new chunk hashes. No TypeScript errors.

- [ ] **Step 2: Verify built CSS has no bare CSS var references**

```bash
grep -r "var(--feather" ui/src/main/dist/assets/*.css | head -5
# Should produce output (feather vars ARE valid, they're wrapped in var())
# If you see bare --feather-* WITHOUT var() wrapper, the build is broken — check vite config
```

- [ ] **Step 3: Deploy to container**

```bash
cd ..  # back to repo root
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 4: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' \
  /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Both lines must be identical. If they differ, the deploy did not copy correctly.

- [ ] **Step 5: Smoke test in browser**

1. Navigate to `http://localhost:8980/opennms/ui/admin` — confirm the Admin page shows "Configure Path Outages" (not "legacy") and "Manage On-Call Roles" links.
2. Click "Configure Path Outages" → confirm `/path-outages` loads the DataTable.
3. Click "Manage On-Call Roles" → confirm `/on-call-roles` loads.
4. Navigate directly to `http://localhost:8980/opennms/pathOutage/index.jsp` → confirm it redirects to `/ui/path-outages`.
5. Navigate directly to `http://localhost:8980/opennms/admin/userGroupView/roles/list.jsp` → confirm it redirects to `/ui/on-call-roles`.
6. Test in dark mode: toggle the theme and reload each page — no white boxes, no missing colors.

- [ ] **Step 6: Final commit**

```bash
git add -u
git commit -m "feat: Domain E complete — path outages + on-call roles REST + Vue + JSP redirects"
```

---

## Domain H quick-wins (bonus — no new code)

These six JSPs just need a `sendRedirect` — do them any time independently of Domain E.

| JSP | Redirect target |
|---|---|
| `charts/index.jsp` | `/ui/resource-graphs` |
| `heatmap/index.jsp` | `/ui/resource-graphs` |
| `geomap/standalone.jsp` | `/ui/map` |
| `alarm/advsearch.jsp` | `/ui/alarms` |
| `event/advsearch.jsp` | `/ui/events` |
| `frontPage.jsp` | `/ui/dashboard` |

For each:
```bash
cat > opennms-webapp/src/main/webapp/<path>.jsp << 'EOF'
<%@ page language="java" %>
<% response.sendRedirect(request.getContextPath() + "/ui/<target>"); %>
EOF
```

Commit together: `chore: Domain H — redirect legacy no-op JSPs to Vue SPA`.
