# SNMP Collections Config — Vue Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `admin/manageSnmpCollections.jsp` with a Vue SPA page at `/snmp-collections-config` that provides a split-pane XML editor for data collection group files and a table-based form for SNMP collection root config.

**Architecture:** Two new JAX-RS resources in `opennms-webapp-rest` expose file-level CRUD for `etc/datacollection/*.xml` and read/write of the SNMP collections in `datacollection-config.xml`. The Vue frontend is a tabbed container with a VS Code-style file list + Ace XML editor for Tab 1, and a table + form for Tab 2.

**Tech Stack:** Java 17, JAX-RS (javax.ws.rs), JAXB (JaxbUtils), Vue 3 Composition API, Feather DS, vue3-ace-editor (already in project), Vitest, JUnit 4.

---

## File Map

| Action | Path |
|--------|------|
| Create | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DataCollectionGroupsResource.java` |
| Create | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SnmpCollectionConfigResource.java` |
| Create | `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DataCollectionGroupsResourceTest.java` |
| Create | `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SnmpCollectionConfigResourceTest.java` |
| Create | `ui/src/services/snmpCollectionsService.ts` |
| Create | `ui/src/components/SnmpCollectionsConfig/GroupFileList.vue` |
| Create | `ui/src/components/SnmpCollectionsConfig/GroupFileEditor.vue` |
| Create | `ui/src/components/SnmpCollectionsConfig/DataCollectionGroupsTab.vue` |
| Create | `ui/src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue` |
| Create | `ui/src/components/SnmpCollectionsConfig/SnmpCollectionsTab.vue` |
| Create | `ui/src/containers/SnmpCollectionsConfig.vue` |
| Create | `ui/tests/snmpCollections.test.ts` |
| Modify | `ui/src/main/router/index.ts` — add `/snmp-collections-config` route with admin guard |
| Modify | `ui/src/components/Menu/SideMenu.vue` — add `legacyToVueRoutes` entry |
| Replace | `opennms-webapp/src/main/webapp/admin/manageSnmpCollections.jsp` — redirect only |

---

## Task 1: `DataCollectionGroupsResource` — Java REST resource for group file CRUD

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DataCollectionGroupsResource.java`
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DataCollectionGroupsResourceTest.java`

- [ ] **Step 1: Write the failing unit test**

Create `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DataCollectionGroupsResourceTest.java`:

```java
/*
 * Licensed to The OpenNMS Group, Inc (TOG) under one or more
 * contributor license agreements.  See the LICENSE.md file
 * distributed with this work for additional information
 * regarding copyright ownership.
 *
 * TOG licenses this file to You under the GNU Affero General
 * Public License Version 3 (the "License") or (at your option)
 * any later version.  You may not use this file except in
 * compliance with the License.  You may obtain a copy of the
 * License at:
 *
 *      https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class DataCollectionGroupsResourceTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    // ── isValidFilename ──────────────────────────────────────────────────────

    @Test
    public void validFilenameAcceptsAlphanumericDotDash() {
        assertTrue(DataCollectionGroupsResource.isValidFilename("cisco.xml"));
        assertTrue(DataCollectionGroupsResource.isValidFilename("net-snmp.xml"));
        assertTrue(DataCollectionGroupsResource.isValidFilename("mib2_extended.xml"));
    }

    @Test
    public void validFilenameRejectsPathTraversal() {
        assertFalse(DataCollectionGroupsResource.isValidFilename("../etc/passwd"));
        assertFalse(DataCollectionGroupsResource.isValidFilename("/etc/passwd"));
        assertFalse(DataCollectionGroupsResource.isValidFilename("foo/bar.xml"));
    }

    @Test
    public void validFilenameRejectsNull() {
        assertFalse(DataCollectionGroupsResource.isValidFilename(null));
    }

    // ── extractGroupName ─────────────────────────────────────────────────────

    @Test
    public void extractGroupNameParsesValidXml() throws IOException {
        File f = tmp.newFile("cisco.xml");
        Files.writeString(f.toPath(),
            "<?xml version=\"1.0\"?>\n" +
            "<datacollection-group xmlns=\"http://xmlns.opennms.org/xsd/config/datacollection\" name=\"Cisco\">\n" +
            "</datacollection-group>");
        String name = DataCollectionGroupsResource.extractGroupName(f);
        assertEquals("Cisco", name);
    }

    @Test
    public void extractGroupNameReturnsNullForMalformedXml() throws IOException {
        File f = tmp.newFile("bad.xml");
        Files.writeString(f.toPath(), "<not valid xml at all <<>>");
        String name = DataCollectionGroupsResource.extractGroupName(f);
        assertNull(name);
    }

    // ── buildFileMeta ────────────────────────────────────────────────────────

    @Test
    public void buildFileMetaReturnsFilenameAndGroupName() throws IOException {
        File dir = tmp.newFolder("datacollection");
        File f = new File(dir, "mib2.xml");
        Files.writeString(f.toPath(),
            "<?xml version=\"1.0\"?>\n" +
            "<datacollection-group xmlns=\"http://xmlns.opennms.org/xsd/config/datacollection\" name=\"MIB-2\">\n" +
            "</datacollection-group>");

        DataCollectionGroupsResource.GroupFileMeta meta =
            DataCollectionGroupsResource.buildFileMeta(f);
        assertEquals("mib2.xml", meta.getFilename());
        assertEquals("MIB-2", meta.getGroupName());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails (class does not exist)**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=DataCollectionGroupsResourceTest -pl . 2>&1 | tail -20
```

Expected: `COMPILATION ERROR` — `DataCollectionGroupsResource` not found.

- [ ] **Step 3: Write `DataCollectionGroupsResource.java`**

Create `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DataCollectionGroupsResource.java`:

```java
/*
 * Licensed to The OpenNMS Group, Inc (TOG) under one or more
 * contributor license agreements.  See the LICENSE.md file
 * distributed with this work for additional information
 * regarding copyright ownership.
 *
 * TOG licenses this file to You under the GNU Affero General
 * Public License Version 3 (the "License") or (at your option)
 * any later version.  You may not use this file except in
 * compliance with the License.  You may obtain a copy of the
 * License at:
 *
 *      https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.v2;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.utils.ConfigFileConstants;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.netmgt.config.datacollection.DatacollectionConfig;
import org.opennms.netmgt.config.datacollection.DatacollectionGroup;
import org.opennms.netmgt.config.datacollection.IncludeCollection;
import org.opennms.netmgt.config.datacollection.SnmpCollection;
import org.opennms.web.api.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("datacollection-groups")
@Tag(name = "DataCollectionGroups", description = "Data Collection Group File API")
public class DataCollectionGroupsResource {

    private static final Logger LOG = LoggerFactory.getLogger(DataCollectionGroupsResource.class);

    // ── List ──────────────────────────────────────────────────────────────────

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List all data collection group files", operationId = "listDataCollectionGroups")
    public Response listGroupFiles(@Context SecurityContext secCtx) {
        if (!secCtx.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        File dir = getDatacollectionDir();
        if (!dir.isDirectory()) {
            return Response.ok(Collections.emptyList()).build();
        }
        File[] xmlFiles = dir.listFiles((d, name) -> name.endsWith(".xml"));
        if (xmlFiles == null) xmlFiles = new File[0];
        Arrays.sort(xmlFiles, (a, b) -> a.getName().compareToIgnoreCase(b.getName()));

        List<GroupFileMeta> result = new ArrayList<>();
        for (File f : xmlFiles) {
            result.add(buildFileMeta(f));
        }
        return Response.ok(result).build();
    }

    // ── Get raw XML ───────────────────────────────────────────────────────────

    @GET
    @Path("{filename}")
    @Produces(MediaType.TEXT_XML)
    @Operation(summary = "Get raw XML content of a data collection group file", operationId = "getDataCollectionGroupFile")
    public Response getGroupFile(@PathParam("filename") String filename,
                                  @Context SecurityContext secCtx) {
        if (!secCtx.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (!isValidFilename(filename)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid filename")).build();
        }
        File f = new File(getDatacollectionDir(), filename);
        if (!f.exists()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        try {
            String xml = Files.readString(f.toPath(), StandardCharsets.UTF_8);
            return Response.ok(xml, MediaType.TEXT_XML).build();
        } catch (IOException e) {
            LOG.error("Failed to read group file {}", filename, e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    // ── Save (create or overwrite) ────────────────────────────────────────────

    @PUT
    @Path("{filename}")
    @Consumes(MediaType.TEXT_XML)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Save a data collection group file", operationId = "saveDataCollectionGroupFile")
    public Response saveGroupFile(@PathParam("filename") String filename,
                                   String xmlContent,
                                   @Context SecurityContext secCtx) {
        if (!secCtx.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (!isValidFilename(filename)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid filename: only [a-zA-Z0-9._-] characters allowed")).build();
        }
        // Validate XML by attempting JAXB unmarshal
        try {
            JaxbUtils.unmarshal(DatacollectionGroup.class, xmlContent);
        } catch (Exception e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid XML: " + e.getMessage())).build();
        }
        File dest = new File(getDatacollectionDir(), filename);
        try {
            Files.writeString(dest.toPath(), xmlContent, StandardCharsets.UTF_8);
            LOG.info("Saved data collection group file {}", dest);
            return Response.ok(Map.of("savedPath", dest.getAbsolutePath())).build();
        } catch (IOException e) {
            LOG.error("Failed to write group file {}", filename, e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @DELETE
    @Path("{filename}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Delete a data collection group file", operationId = "deleteDataCollectionGroupFile")
    public Response deleteGroupFile(@PathParam("filename") String filename,
                                     @Context SecurityContext secCtx) {
        if (!secCtx.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (!isValidFilename(filename)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid filename")).build();
        }
        File f = new File(getDatacollectionDir(), filename);
        if (!f.exists()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        // Capture group name before deleting
        String groupName = extractGroupName(f);

        try {
            Files.delete(f.toPath());
            LOG.info("Deleted data collection group file {}", filename);
        } catch (IOException e) {
            LOG.error("Failed to delete group file {}", filename, e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }

        // Remove include-collection references from root config
        if (groupName != null) {
            removeIncludeCollectionRefs(groupName);
        }

        return Response.noContent().build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Remove all include-collection entries matching groupName from datacollection-config.xml. */
    private void removeIncludeCollectionRefs(String groupName) {
        try {
            File cfgFile = ConfigFileConstants.getFile(ConfigFileConstants.DATA_COLLECTION_CONF_FILE_NAME);
            DatacollectionConfig config = JaxbUtils.unmarshal(DatacollectionConfig.class, cfgFile);
            boolean modified = false;
            for (SnmpCollection col : config.getSnmpCollections()) {
                List<IncludeCollection> refs = col.getIncludeCollections().stream()
                        .filter(ic -> !groupName.equals(ic.getDataCollectionGroup()))
                        .collect(Collectors.toList());
                if (refs.size() != col.getIncludeCollections().size()) {
                    col.setIncludeCollections(refs);
                    modified = true;
                }
            }
            if (modified) {
                JaxbUtils.marshal(config, cfgFile);
                LOG.info("Removed include-collection refs for group '{}' from root config", groupName);
            }
        } catch (Exception e) {
            LOG.warn("Could not remove include-collection refs for group '{}': {}", groupName, e.getMessage());
        }
    }

    /** Visible for testing. */
    public static String extractGroupName(File xmlFile) {
        try {
            String xml = Files.readString(xmlFile.toPath(), StandardCharsets.UTF_8);
            DatacollectionGroup grp = JaxbUtils.unmarshal(DatacollectionGroup.class, xml);
            return grp.getName();
        } catch (Exception e) {
            return null;
        }
    }

    /** Visible for testing. */
    public static GroupFileMeta buildFileMeta(File f) {
        return new GroupFileMeta(f.getName(), extractGroupName(f));
    }

    /** Visible for testing. */
    public static boolean isValidFilename(String filename) {
        return filename != null && filename.matches("[a-zA-Z0-9._-]+");
    }

    static File getDatacollectionDir() {
        return Paths.get(System.getProperty("opennms.home", "/opt/opennms"), "etc", "datacollection").toFile();
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    public static class GroupFileMeta {
        private final String filename;
        private final String groupName;

        public GroupFileMeta(String filename, String groupName) {
            this.filename = filename;
            this.groupName = groupName;
        }

        @JsonProperty("filename")
        public String getFilename() { return filename; }

        @JsonProperty("groupName")
        public String getGroupName() { return groupName; }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=DataCollectionGroupsResourceTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS` — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/DataCollectionGroupsResource.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/DataCollectionGroupsResourceTest.java
git commit -m "feat(rest): add DataCollectionGroupsResource for datacollection group file CRUD"
```

---

## Task 2: `SnmpCollectionConfigResource` — Java REST resource for SNMP collections root config

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SnmpCollectionConfigResource.java`
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SnmpCollectionConfigResourceTest.java`

- [ ] **Step 1: Write the failing unit test**

Create `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SnmpCollectionConfigResourceTest.java`:

```java
/*
 * Licensed to The OpenNMS Group, Inc (TOG) under one or more
 * contributor license agreements.  See the LICENSE.md file
 * distributed with this work for additional information
 * regarding copyright ownership.
 *
 * TOG licenses this file to You under the GNU Affero General
 * Public License Version 3 (the "License") or (at your option)
 * any later version.  You may not use this file except in
 * compliance with the License.  You may obtain a copy of the
 * License at:
 *
 *      https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import java.util.Arrays;
import java.util.List;

import org.junit.Test;
import org.opennms.netmgt.config.datacollection.DatacollectionConfig;
import org.opennms.netmgt.config.datacollection.IncludeCollection;
import org.opennms.netmgt.config.datacollection.Rrd;
import org.opennms.netmgt.config.datacollection.SnmpCollection;
import org.opennms.web.rest.v2.SnmpCollectionConfigResource.SnmpCollectionDto;
import org.opennms.web.rest.v2.SnmpCollectionConfigResource.SnmpCollectionsDto;

public class SnmpCollectionConfigResourceTest {

    @Test
    public void toDtoRoundTrip() {
        DatacollectionConfig config = new DatacollectionConfig();
        config.setRrdRepository("/var/lib/opennms/rrd/snmp");

        SnmpCollection col = new SnmpCollection();
        col.setName("default");
        col.setSnmpStorageFlag("select");
        Rrd rrd = new Rrd();
        rrd.setStep(300);
        rrd.setRras(Arrays.asList("RRA:AVERAGE:0.5:1:2016", "RRA:MAX:0.5:288:366"));
        col.setRrd(rrd);
        IncludeCollection ic = new IncludeCollection();
        ic.setDataCollectionGroup("MIB-2");
        col.setIncludeCollections(Arrays.asList(ic));
        config.setSnmpCollections(Arrays.asList(col));

        SnmpCollectionsDto dto = SnmpCollectionConfigResource.toDto(config);

        assertNotNull(dto);
        assertEquals(1, dto.getSnmpCollections().size());
        SnmpCollectionDto cd = dto.getSnmpCollections().get(0);
        assertEquals("default", cd.getName());
        assertEquals("select", cd.getSnmpStorageFlag());
        assertEquals(300, cd.getRrdStep());
        assertEquals(Arrays.asList("RRA:AVERAGE:0.5:1:2016", "RRA:MAX:0.5:288:366"), cd.getRras());
        assertEquals(Arrays.asList("MIB-2"), cd.getIncludeCollections());
    }

    @Test
    public void fromDtoRoundTrip() {
        SnmpCollectionDto cd = new SnmpCollectionDto();
        cd.setName("default");
        cd.setSnmpStorageFlag("primary");
        cd.setRrdStep(300);
        cd.setRras(Arrays.asList("RRA:AVERAGE:0.5:1:2016"));
        cd.setIncludeCollections(Arrays.asList("Cisco", "Net-SNMP"));

        SnmpCollectionsDto dto = new SnmpCollectionsDto();
        dto.setSnmpCollections(Arrays.asList(cd));

        DatacollectionConfig config = new DatacollectionConfig();
        config.setRrdRepository("/var/lib/opennms/rrd/snmp");

        SnmpCollectionConfigResource.applyDto(config, dto);

        assertEquals(1, config.getSnmpCollections().size());
        SnmpCollection col = config.getSnmpCollections().get(0);
        assertEquals("default", col.getName());
        assertEquals("primary", col.getSnmpStorageFlag());
        assertEquals(300, (int) col.getRrd().getStep());
        assertEquals(Arrays.asList("RRA:AVERAGE:0.5:1:2016"), col.getRrd().getRras());
        List<String> groups = col.getIncludeCollections().stream()
                .map(IncludeCollection::getDataCollectionGroup)
                .collect(java.util.stream.Collectors.toList());
        assertEquals(Arrays.asList("Cisco", "Net-SNMP"), groups);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails (class not found)**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=SnmpCollectionConfigResourceTest -pl . 2>&1 | tail -20
```

Expected: `COMPILATION ERROR` — `SnmpCollectionConfigResource` not found.

- [ ] **Step 3: Write `SnmpCollectionConfigResource.java`**

Create `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SnmpCollectionConfigResource.java`:

```java
/*
 * Licensed to The OpenNMS Group, Inc (TOG) under one or more
 * contributor license agreements.  See the LICENSE.md file
 * distributed with this work for additional information
 * regarding copyright ownership.
 *
 * TOG licenses this file to You under the GNU Affero General
 * Public License Version 3 (the "License") or (at your option)
 * any later version.  You may not use this file except in
 * compliance with the License.  You may obtain a copy of the
 * License at:
 *
 *      https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.v2;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.utils.ConfigFileConstants;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.netmgt.config.datacollection.DatacollectionConfig;
import org.opennms.netmgt.config.datacollection.IncludeCollection;
import org.opennms.netmgt.config.datacollection.Rrd;
import org.opennms.netmgt.config.datacollection.SnmpCollection;
import org.opennms.web.api.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("datacollection-config")
@Tag(name = "DataCollectionConfig", description = "SNMP Collection Root Config API")
public class SnmpCollectionConfigResource {

    private static final Logger LOG = LoggerFactory.getLogger(SnmpCollectionConfigResource.class);

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get SNMP collection entries from root config", operationId = "getSnmpCollectionConfig")
    public Response getConfig(@Context SecurityContext secCtx) {
        if (!secCtx.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        try {
            File cfgFile = ConfigFileConstants.getFile(ConfigFileConstants.DATA_COLLECTION_CONF_FILE_NAME);
            DatacollectionConfig config = JaxbUtils.unmarshal(DatacollectionConfig.class, cfgFile);
            return Response.ok(toDto(config)).build();
        } catch (Exception e) {
            LOG.error("Failed to read datacollection-config.xml", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Replace SNMP collection entries in root config", operationId = "putSnmpCollectionConfig")
    public Response putConfig(SnmpCollectionsDto dto, @Context SecurityContext secCtx) {
        if (!secCtx.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (dto == null || dto.getSnmpCollections() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "snmpCollections required")).build();
        }
        try {
            File cfgFile = ConfigFileConstants.getFile(ConfigFileConstants.DATA_COLLECTION_CONF_FILE_NAME);
            DatacollectionConfig config = JaxbUtils.unmarshal(DatacollectionConfig.class, cfgFile);
            applyDto(config, dto);
            JaxbUtils.marshal(config, cfgFile);
            LOG.info("Saved SNMP collection config to {}", cfgFile);
            return Response.ok(Map.of("saved", true)).build();
        } catch (IOException e) {
            LOG.error("Failed to write datacollection-config.xml", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    /** Visible for testing. */
    public static SnmpCollectionsDto toDto(DatacollectionConfig config) {
        SnmpCollectionsDto dto = new SnmpCollectionsDto();
        List<SnmpCollectionDto> cols = new ArrayList<>();
        for (SnmpCollection col : config.getSnmpCollections()) {
            SnmpCollectionDto cd = new SnmpCollectionDto();
            cd.setName(col.getName());
            cd.setSnmpStorageFlag(col.getSnmpStorageFlag());
            cd.setRrdStep(col.getRrd() != null ? col.getRrd().getStep() : 300);
            cd.setRras(col.getRrd() != null ? new ArrayList<>(col.getRrd().getRras()) : new ArrayList<>());
            cd.setIncludeCollections(col.getIncludeCollections().stream()
                    .filter(ic -> ic.getDataCollectionGroup() != null)
                    .map(IncludeCollection::getDataCollectionGroup)
                    .collect(Collectors.toList()));
            cols.add(cd);
        }
        dto.setSnmpCollections(cols);
        return dto;
    }

    /** Visible for testing. Replaces the snmp-collection list in config with values from dto. */
    public static void applyDto(DatacollectionConfig config, SnmpCollectionsDto dto) {
        List<SnmpCollection> newCols = new ArrayList<>();
        for (SnmpCollectionDto cd : dto.getSnmpCollections()) {
            SnmpCollection col = new SnmpCollection();
            col.setName(cd.getName());
            col.setSnmpStorageFlag(cd.getSnmpStorageFlag() != null ? cd.getSnmpStorageFlag() : "select");
            Rrd rrd = new Rrd();
            rrd.setStep(cd.getRrdStep() > 0 ? cd.getRrdStep() : 300);
            rrd.setRras(cd.getRras() != null ? cd.getRras() : new ArrayList<>());
            col.setRrd(rrd);
            if (cd.getIncludeCollections() != null) {
                List<IncludeCollection> ics = new ArrayList<>();
                for (String groupName : cd.getIncludeCollections()) {
                    IncludeCollection ic = new IncludeCollection();
                    ic.setDataCollectionGroup(groupName);
                    ics.add(ic);
                }
                col.setIncludeCollections(ics);
            }
            newCols.add(col);
        }
        config.setSnmpCollections(newCols);
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public static class SnmpCollectionsDto {
        private List<SnmpCollectionDto> snmpCollections = new ArrayList<>();

        @JsonProperty("snmpCollections")
        public List<SnmpCollectionDto> getSnmpCollections() { return snmpCollections; }
        public void setSnmpCollections(List<SnmpCollectionDto> v) {
            this.snmpCollections = v != null ? v : new ArrayList<>();
        }
    }

    public static class SnmpCollectionDto {
        private String name = "";
        private String snmpStorageFlag = "select";
        private int rrdStep = 300;
        private List<String> rras = new ArrayList<>();
        private List<String> includeCollections = new ArrayList<>();

        @JsonProperty("name")
        public String getName() { return name; }
        public void setName(String v) { this.name = v; }

        @JsonProperty("snmpStorageFlag")
        public String getSnmpStorageFlag() { return snmpStorageFlag; }
        public void setSnmpStorageFlag(String v) { this.snmpStorageFlag = v; }

        @JsonProperty("rrdStep")
        public int getRrdStep() { return rrdStep; }
        public void setRrdStep(int v) { this.rrdStep = v; }

        @JsonProperty("rras")
        public List<String> getRras() { return rras; }
        public void setRras(List<String> v) { this.rras = v != null ? v : new ArrayList<>(); }

        @JsonProperty("includeCollections")
        public List<String> getIncludeCollections() { return includeCollections; }
        public void setIncludeCollections(List<String> v) { this.includeCollections = v != null ? v : new ArrayList<>(); }
    }
}
```

- [ ] **Step 4: Run both Java tests to verify they pass**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest="DataCollectionGroupsResourceTest,SnmpCollectionConfigResourceTest" -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS` — all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SnmpCollectionConfigResource.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SnmpCollectionConfigResourceTest.java
git commit -m "feat(rest): add SnmpCollectionConfigResource for SNMP collection root config CRUD"
```

---

## Task 3: Build + overlay JAR + verify endpoints

**Files:** None created — build + deploy task.

- [ ] **Step 1: Build the webapp-rest module**

```bash
cd /Users/chance/git/opennms
./compile.pl -DskipTests -Ddisable.checkstyle --projects :opennms-webapp-rest install 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`. Jar produced at `opennms-webapp-rest/target/opennms-webapp-rest-35.0.4.jar`.

- [ ] **Step 2: Copy the JAR to the local overlay path**

```bash
cp opennms-webapp-rest/target/opennms-webapp-rest-35.0.4.jar opennms-webapp-rest-35.0.4.jar
```

- [ ] **Step 3: Verify container is running; start it if stopped**

```bash
podman ps --format "{{.Names}}" | grep test-opennms || \
  podman start test-opennms && sleep 15
```

- [ ] **Step 4: Overlay the JAR into the container**

The `build-dark-mode-overlay.sh` script handles this. Check its JAR overlay section or run directly:

```bash
podman cp opennms-webapp-rest-35.0.4.jar \
  test-opennms:/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-rest-35.0.4.jar
podman exec test-opennms /opt/opennms/bin/opennms restart 2>&1 | tail -5
```

Wait ~15 seconds for the webapp to reload, then verify:

- [ ] **Step 5: Verify new endpoints respond**

```bash
# List group files (should return JSON array of {filename, groupName})
curl -s -u admin:notdefault \
  'http://localhost:8980/opennms/api/v2/datacollection-groups' | python3 -m json.tool | head -20

# Get SNMP collections config
curl -s -u admin:notdefault \
  'http://localhost:8980/opennms/api/v2/datacollection-config' | python3 -m json.tool | head -20
```

Expected: Both return valid JSON with data. If 404, the webapp hasn't reloaded yet — wait 10s and retry.

- [ ] **Step 6: Commit (note the exact JAXB JSON key names for the service layer)**

> **IMPORTANT before writing TypeScript:** Check the actual JSON key names returned by the API — JAXB `@JsonProperty` annotations drive the keys. From the Java code above, the keys are exactly: `filename`, `groupName`, `snmpCollections`, `name`, `snmpStorageFlag`, `rrdStep`, `rras`, `includeCollections`. No normalization needed.

```bash
cd /Users/chance/git/opennms
git add opennms-webapp-rest-35.0.4.jar
git commit -m "build: rebuild webapp-rest overlay with datacollection REST resources"
```

---

## Task 4: `snmpCollectionsService.ts` — TypeScript service layer

**Files:**
- Create: `ui/src/services/snmpCollectionsService.ts`
- Create: `ui/tests/snmpCollections.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `ui/tests/snmpCollections.test.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { describe, it, expect } from 'vitest'
import {
  makeDefaultSnmpCollection,
  makeNewGroupXml,
  type GroupFileMeta,
  type SnmpCollectionEntry
} from '@/services/snmpCollectionsService'

describe('snmpCollectionsService', () => {
  describe('makeDefaultSnmpCollection', () => {
    it('returns an entry with sensible defaults', () => {
      const col = makeDefaultSnmpCollection()
      expect(col.name).toBe('')
      expect(col.snmpStorageFlag).toBe('select')
      expect(col.rrdStep).toBe(300)
      expect(col.rras).toHaveLength(5)
      expect(col.rras[0]).toMatch(/^RRA:AVERAGE/)
      expect(col.includeCollections).toEqual([])
    })
  })

  describe('makeNewGroupXml', () => {
    it('returns a valid datacollection-group XML template', () => {
      const xml = makeNewGroupXml('test-group')
      expect(xml).toContain('<datacollection-group')
      expect(xml).toContain('name="test-group"')
      expect(xml).toContain('xmlns="http://xmlns.opennms.org/xsd/config/datacollection"')
    })
  })

  describe('types', () => {
    it('GroupFileMeta has filename and groupName fields', () => {
      const meta: GroupFileMeta = { filename: 'cisco.xml', groupName: 'Cisco' }
      expect(meta.filename).toBe('cisco.xml')
      expect(meta.groupName).toBe('Cisco')
    })

    it('SnmpCollectionEntry has all required fields', () => {
      const entry: SnmpCollectionEntry = {
        name: 'default',
        snmpStorageFlag: 'select',
        rrdStep: 300,
        rras: [],
        includeCollections: []
      }
      expect(entry.name).toBe('default')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chance/git/opennms/ui
/Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/snmpCollections.test.ts 2>&1 | tail -15
```

Expected: FAIL — `snmpCollectionsService` module not found.

- [ ] **Step 3: Write `snmpCollectionsService.ts`**

Create `ui/src/services/snmpCollectionsService.ts`:

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { v2 } from './axiosInstances'

export interface GroupFileMeta {
  filename: string
  groupName: string | null
}

export interface SnmpCollectionEntry {
  name: string
  snmpStorageFlag: string
  rrdStep: number
  rras: string[]
  includeCollections: string[]
}

export interface SnmpCollectionsConfig {
  snmpCollections: SnmpCollectionEntry[]
}

const BASE_GROUPS = 'datacollection-groups'
const BASE_CONFIG = 'datacollection-config'

export const listGroupFiles = async (): Promise<GroupFileMeta[]> => {
  const resp = await v2.get<GroupFileMeta[]>(BASE_GROUPS)
  return resp.data
}

export const getGroupFileXml = async (filename: string): Promise<string> => {
  const resp = await v2.get<string>(`${BASE_GROUPS}/${encodeURIComponent(filename)}`, {
    headers: { Accept: 'text/xml' },
    responseType: 'text'
  })
  return resp.data
}

export const saveGroupFileXml = async (filename: string, xml: string): Promise<void> => {
  await v2.put(`${BASE_GROUPS}/${encodeURIComponent(filename)}`, xml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export const deleteGroupFile = async (filename: string): Promise<void> => {
  await v2.delete(`${BASE_GROUPS}/${encodeURIComponent(filename)}`)
}

export const getSnmpCollections = async (): Promise<SnmpCollectionsConfig> => {
  const resp = await v2.get<SnmpCollectionsConfig>(BASE_CONFIG)
  return resp.data
}

export const saveSnmpCollections = async (collections: SnmpCollectionEntry[]): Promise<void> => {
  await v2.put(BASE_CONFIG, { snmpCollections: collections })
}

export const makeDefaultSnmpCollection = (): SnmpCollectionEntry => ({
  name: '',
  snmpStorageFlag: 'select',
  rrdStep: 300,
  rras: [
    'RRA:AVERAGE:0.5:1:2016',
    'RRA:AVERAGE:0.5:12:1488',
    'RRA:AVERAGE:0.5:288:366',
    'RRA:MAX:0.5:288:366',
    'RRA:MIN:0.5:288:366'
  ],
  includeCollections: []
})

export const makeNewGroupXml = (groupName = ''): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<datacollection-group xmlns="http://xmlns.opennms.org/xsd/config/datacollection"
                      name="${groupName}">
  <!-- Add resourceType, group, and systemDef elements here -->
</datacollection-group>`
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chance/git/opennms/ui
/Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn test tests/snmpCollections.test.ts 2>&1 | tail -15
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/services/snmpCollectionsService.ts ui/tests/snmpCollections.test.ts
git commit -m "feat(ui): add snmpCollectionsService TypeScript layer"
```

---

## Task 5: `GroupFileList.vue` — Searchable file list sidebar

**Files:**
- Create: `ui/src/components/SnmpCollectionsConfig/GroupFileList.vue`

- [ ] **Step 1: Write `GroupFileList.vue`**

Create `ui/src/components/SnmpCollectionsConfig/GroupFileList.vue`:

```vue
<template>
  <div class="group-file-list">
    <div class="search-row">
      <FeatherInput
        v-model="searchQuery"
        label="Search files"
        hide-label
        :background="true"
        class="search-input"
      >
        <template #pre><FeatherIcon :icon="SearchIcon" /></template>
      </FeatherInput>
    </div>

    <ul class="file-list" role="listbox">
      <li
        v-for="file in filteredFiles"
        :key="file.filename"
        :class="['file-item', { selected: file.filename === selectedFilename }]"
        role="option"
        :aria-selected="file.filename === selectedFilename"
        @click="emit('select', file.filename)"
      >
        <span class="group-name">{{ file.groupName ?? file.filename }}</span>
        <span class="file-name">{{ file.filename }}</span>
        <span v-if="file.filename === selectedFilename && isDirty" class="dirty-dot" title="Unsaved changes" />
      </li>

      <li v-if="filteredFiles.length === 0" class="empty">
        No files match "{{ searchQuery }}"
      </li>
    </ul>

    <div class="list-footer">
      <FeatherButton text @click="emit('new-file')">+ New File</FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import SearchIcon from '@featherds/icon/action/Search'
import type { GroupFileMeta } from '@/services/snmpCollectionsService'

const props = defineProps<{
  files: GroupFileMeta[]
  selectedFilename: string | null
  isDirty: boolean
}>()

const emit = defineEmits<{
  (e: 'select', filename: string): void
  (e: 'new-file'): void
}>()

const searchQuery = ref('')

const filteredFiles = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.files
  return props.files.filter(f =>
    f.filename.toLowerCase().includes(q) ||
    (f.groupName?.toLowerCase().includes(q) ?? false)
  )
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.group-file-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var($border-on-surface);
}

.search-row {
  padding: 0.5rem;
  border-bottom: 1px solid var($border-on-surface);
}

.search-input {
  width: 100%;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

.file-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  position: relative;
  border-bottom: 1px solid var($border-light-on-surface);

  &:hover {
    background: var($hover);
  }

  &.selected {
    background: var($primary-tint);
  }
}

.group-name {
  @include body1;
  font-weight: 600;
  color: var($primary-text-on-surface);
}

.file-name {
  @include caption;
  color: var($secondary-text-on-surface);
}

.dirty-dot {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var($warning);
}

.empty {
  padding: 1rem;
  color: var($secondary-text-on-surface);
  font-style: italic;
}

.list-footer {
  padding: 0.5rem;
  border-top: 1px solid var($border-on-surface);
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles (no errors in IDE or build)**

```bash
cd /Users/chance/git/opennms/ui
/Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn vue-tsc --noEmit 2>&1 | grep -i "error\|SnmpCollections" | head -20
```

Expected: No errors for the new file (other pre-existing errors are OK to ignore).

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/SnmpCollectionsConfig/GroupFileList.vue
git commit -m "feat(ui): add GroupFileList sidebar for data collection groups"
```

---

## Task 6: `GroupFileEditor.vue` — Ace XML editor with toolbar

**Files:**
- Create: `ui/src/components/SnmpCollectionsConfig/GroupFileEditor.vue`

- [ ] **Step 1: Write `GroupFileEditor.vue`**

Create `ui/src/components/SnmpCollectionsConfig/GroupFileEditor.vue`:

```vue
<template>
  <div class="group-file-editor">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <h3 class="file-title">{{ filename ?? 'No file selected' }}</h3>
      <div class="toolbar-actions">
        <FeatherButton
          primary
          :disabled="!filename || !isDirty || isSaving"
          @click="onSave"
        >
          {{ isSaving ? 'Saving…' : 'Save' }}
        </FeatherButton>
        <FeatherButton
          v-if="filename"
          text
          class="delete-btn"
          @click="showDeleteConfirm = true"
        >
          Delete
        </FeatherButton>
      </div>
    </div>

    <!-- Inline error banner -->
    <div v-if="saveError" class="error-banner" role="alert">
      <strong>Save failed:</strong> {{ saveError }}
    </div>

    <!-- Ace editor -->
    <div class="editor-area">
      <VAceEditor
        v-if="filename"
        v-model:value="localXml"
        lang="xml"
        :theme="aceTheme"
        :print-margin="false"
        :options="{ useWorker: true, fontSize: 14 }"
        @init="onEditorInit"
        style="height: 100%; width: 100%"
      />
      <div v-else class="placeholder">
        Select a file from the list or create a new one.
      </div>
    </div>

    <!-- Delete confirm dialog -->
    <FeatherDialog
      v-if="showDeleteConfirm"
      :labels="{ title: 'Delete group file?' }"
      @close="showDeleteConfirm = false"
    >
      <p>Delete <strong>{{ filename }}</strong>?</p>
      <p>This will also remove all <code>include-collection</code> references to this group from the root config.</p>
      <template #footer>
        <FeatherButton text @click="showDeleteConfirm = false">Cancel</FeatherButton>
        <FeatherButton primary @click="onDelete">Delete</FeatherButton>
      </template>
    </FeatherDialog>
  </div>
</template>

<script setup lang="ts">
import { VAceEditor } from 'vue3-ace-editor'
import 'ace-builds/src-noconflict/mode-xml'
import 'ace-builds/src-noconflict/theme-xcode'
import 'ace-builds/src-noconflict/theme-dracula'
import 'ace-builds/src-noconflict/ext-searchbox'
import ace from 'ace-builds'
import workerXmlUrl from 'ace-builds/src-noconflict/worker-xml?url'
import { FeatherButton } from '@featherds/button'
import { FeatherDialog } from '@featherds/dialog'
import { useAppStore } from '@/stores/appStore'

ace.config.setModuleUrl('ace/mode/xml_worker', workerXmlUrl)

const props = defineProps<{
  filename: string | null
  xml: string
}>()

const emit = defineEmits<{
  (e: 'save', filename: string, xml: string): void
  (e: 'delete', filename: string): void
  (e: 'dirty-change', dirty: boolean): void
}>()

const appStore = useAppStore()
const localXml = ref(props.xml)
const isSaving = ref(false)
const saveError = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const isDirty = computed(() => localXml.value !== props.xml)
const aceTheme = computed(() => appStore.theme === 'open-dark' ? 'dracula' : 'xcode')

// Sync external xml changes (file switch) into local state
watch(() => props.xml, (newXml) => {
  localXml.value = newXml
  saveError.value = null
})

// Notify parent of dirty state
watch(isDirty, (dirty) => emit('dirty-change', dirty))

const onEditorInit = (editor: any) => {
  ace.config.loadModule('ace/ext/searchbox', (m: any) => m.Search(editor))
  editor.searchBox?.hide()
  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => { if (isDirty.value && props.filename) onSave() }
  })
}

const onSave = async () => {
  if (!props.filename) return
  isSaving.value = true
  saveError.value = null
  try {
    emit('save', props.filename, localXml.value)
  } catch (e: any) {
    saveError.value = e?.response?.data?.error ?? e?.message ?? 'Unknown error'
  } finally {
    isSaving.value = false
  }
}

const onDelete = () => {
  showDeleteConfirm.value = false
  if (props.filename) emit('delete', props.filename)
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.group-file-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var($border-on-surface);
  gap: 1rem;
}

.file-title {
  @include subtitle1;
  margin: 0;
  color: var($primary-text-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.delete-btn {
  color: var($error) !important;
}

.error-banner {
  padding: 0.5rem 1rem;
  background: var($error-tint);
  color: var($error);
  @include body2;
  border-bottom: 1px solid var($error);
}

.editor-area {
  flex: 1;
  overflow: hidden;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var($secondary-text-on-surface);
  @include body1;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/SnmpCollectionsConfig/GroupFileEditor.vue
git commit -m "feat(ui): add GroupFileEditor Ace XML editor component"
```

---

## Task 7: `DataCollectionGroupsTab.vue` — Split-pane tab container

**Files:**
- Create: `ui/src/components/SnmpCollectionsConfig/DataCollectionGroupsTab.vue`

- [ ] **Step 1: Write `DataCollectionGroupsTab.vue`**

This component owns loading state, selected file, and dirty tracking. It calls the service directly and delegates UI to `GroupFileList` + `GroupFileEditor`.

Create `ui/src/components/SnmpCollectionsConfig/DataCollectionGroupsTab.vue`:

```vue
<template>
  <div class="dcg-tab">
    <div v-if="loading" class="loading">Loading group files…</div>
    <div v-else-if="loadError" class="load-error">{{ loadError }}</div>
    <div v-else class="split-pane">
      <div class="pane-left">
        <GroupFileList
          :files="files"
          :selected-filename="selectedFilename"
          :is-dirty="isDirty"
          @select="onSelectFile"
          @new-file="onNewFile"
        />
      </div>
      <div class="pane-right">
        <GroupFileEditor
          :filename="selectedFilename"
          :xml="currentXml"
          @save="onSaveFile"
          @delete="onDeleteFile"
          @dirty-change="isDirty = $event"
        />
      </div>
    </div>

    <!-- New file name prompt -->
    <FeatherDialog
      v-if="showNewFileDialog"
      :labels="{ title: 'New group file' }"
      @close="showNewFileDialog = false"
    >
      <FeatherInput v-model="newFilename" label="Filename (e.g. mygroup.xml)" />
      <template #footer>
        <FeatherButton text @click="showNewFileDialog = false">Cancel</FeatherButton>
        <FeatherButton primary :disabled="!newFilename.trim()" @click="onConfirmNewFile">Create</FeatherButton>
      </template>
    </FeatherDialog>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherDialog } from '@featherds/dialog'
import { FeatherInput } from '@featherds/input'
import useSnackbar from '@/composables/useSnackbar'
import GroupFileList from './GroupFileList.vue'
import GroupFileEditor from './GroupFileEditor.vue'
import {
  listGroupFiles,
  getGroupFileXml,
  saveGroupFileXml,
  deleteGroupFile,
  makeNewGroupXml,
  type GroupFileMeta
} from '@/services/snmpCollectionsService'

const { showSnackBar } = useSnackbar()

const files = ref<GroupFileMeta[]>([])
const selectedFilename = ref<string | null>(null)
const currentXml = ref('')
const isDirty = ref(false)
const loading = ref(true)
const loadError = ref<string | null>(null)
const showNewFileDialog = ref(false)
const newFilename = ref('')

onMounted(async () => {
  await loadFileList()
})

const loadFileList = async () => {
  loading.value = true
  loadError.value = null
  try {
    files.value = await listGroupFiles()
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load group files'
  } finally {
    loading.value = false
  }
}

const onSelectFile = async (filename: string) => {
  if (isDirty.value && selectedFilename.value) {
    if (!confirm(`Discard unsaved changes to ${selectedFilename.value}?`)) return
  }
  selectedFilename.value = filename
  isDirty.value = false
  try {
    currentXml.value = await getGroupFileXml(filename)
  } catch {
    currentXml.value = '<!-- File could not be loaded -->'
    showSnackBar({ msg: `Could not load ${filename}` })
  }
}

const onNewFile = () => {
  newFilename.value = ''
  showNewFileDialog.value = true
}

const onConfirmNewFile = () => {
  let name = newFilename.value.trim()
  if (!name.endsWith('.xml')) name = name + '.xml'
  showNewFileDialog.value = false
  // Pre-populate editor with empty template; no server call yet (save creates it)
  const entry: GroupFileMeta = { filename: name, groupName: null }
  if (!files.value.find(f => f.filename === name)) {
    files.value = [...files.value, entry].sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    )
  }
  selectedFilename.value = name
  currentXml.value = makeNewGroupXml()
  isDirty.value = true
}

const onSaveFile = async (filename: string, xml: string) => {
  try {
    await saveGroupFileXml(filename, xml)
    showSnackBar({ msg: `Saved ${filename}` })
    // Refresh the list (groupName may have changed if user edited the name attribute)
    await loadFileList()
    // Keep selected
    selectedFilename.value = filename
    currentXml.value = xml
    isDirty.value = false
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? 'Save failed'
    throw new Error(msg)  // Let GroupFileEditor show inline error
  }
}

const onDeleteFile = async (filename: string) => {
  try {
    await deleteGroupFile(filename)
    showSnackBar({ msg: `Deleted ${filename}` })
    files.value = files.value.filter(f => f.filename !== filename)
    selectedFilename.value = null
    currentXml.value = ''
    isDirty.value = false
  } catch (e: any) {
    showSnackBar({ msg: `Delete failed: ${e?.message ?? 'Unknown error'}` })
  }
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.dcg-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.split-pane {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pane-left {
  width: 280px;
  flex-shrink: 0;
  overflow: hidden;
}

.pane-right {
  flex: 1;
  overflow: hidden;
}

.loading, .load-error {
  padding: 2rem;
  color: var($secondary-text-on-surface);
}

.load-error {
  color: var($error);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/SnmpCollectionsConfig/DataCollectionGroupsTab.vue
git commit -m "feat(ui): add DataCollectionGroupsTab split-pane container"
```

---

## Task 8: `SnmpCollectionForm.vue` — Form for one SNMP collection entry

**Files:**
- Create: `ui/src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue`

- [ ] **Step 1: Write `SnmpCollectionForm.vue`**

Create `ui/src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue`:

```vue
<template>
  <div class="snmp-collection-form">
    <h3 class="form-title">{{ isNew ? 'New SNMP Collection' : `Edit: ${localEntry.name}` }}</h3>

    <div class="form-grid">
      <FeatherInput
        v-model="localEntry.name"
        label="Name"
        :error="nameError"
        required
      />

      <FeatherSelect
        v-model="storageOption"
        :options="storageOptions"
        label="SNMP Storage Flag"
        text-prop="label"
        value-prop="value"
      />

      <FeatherInput
        v-model.number="localEntry.rrdStep"
        label="RRD Step (seconds)"
        type="number"
        :min="1"
      />
    </div>

    <!-- RRAs -->
    <div class="rra-section">
      <label class="section-label">RRA Definitions</label>
      <div
        v-for="(rra, i) in localEntry.rras"
        :key="i"
        class="rra-row"
      >
        <FeatherInput
          :model-value="rra"
          :label="`RRA ${i + 1}`"
          hide-label
          @update:model-value="updateRra(i, $event as string)"
        />
        <FeatherButton icon @click="removeRra(i)" :aria-label="`Remove RRA ${i + 1}`">
          <FeatherIcon :icon="CloseIcon" />
        </FeatherButton>
      </div>
      <FeatherButton text @click="addRra">+ Add RRA</FeatherButton>
    </div>

    <!-- Include Collections -->
    <div class="include-section">
      <label class="section-label">Include Collections</label>
      <div class="include-chips">
        <div
          v-for="groupName in localEntry.includeCollections"
          :key="groupName"
          class="chip"
        >
          {{ groupName }}
          <button class="chip-remove" @click="removeInclude(groupName)" :aria-label="`Remove ${groupName}`">×</button>
        </div>
      </div>
      <FeatherSelect
        v-model="selectedGroupToAdd"
        :options="availableGroups"
        label="Add include collection"
        text-prop="label"
        value-prop="value"
        @update:model-value="onAddInclude"
      />
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <FeatherButton text @click="emit('cancel')">Cancel</FeatherButton>
      <FeatherButton primary :disabled="!!nameError" @click="onSave">Save</FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherSelect } from '@featherds/select'
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import CloseIcon from '@featherds/icon/navigation/Cancel'
import type { SnmpCollectionEntry, GroupFileMeta } from '@/services/snmpCollectionsService'

const props = defineProps<{
  entry: SnmpCollectionEntry
  allEntryNames: string[]
  groupFiles: GroupFileMeta[]
}>()

const emit = defineEmits<{
  (e: 'save', entry: SnmpCollectionEntry): void
  (e: 'cancel'): void
}>()

const isNew = computed(() => !props.allEntryNames.includes(props.entry.name) || props.entry.name === '')

const localEntry = ref<SnmpCollectionEntry>({ ...props.entry, rras: [...props.entry.rras], includeCollections: [...props.entry.includeCollections] })
const selectedGroupToAdd = ref<{ label: string; value: string } | undefined>(undefined)

const storageOptions = [
  { label: 'primary', value: 'primary' },
  { label: 'all', value: 'all' },
  { label: 'select', value: 'select' },
  { label: 'other', value: 'other' }
]

const storageOption = computed({
  get: () => storageOptions.find(o => o.value === localEntry.value.snmpStorageFlag) ?? storageOptions[2],
  set: (opt: { label: string; value: string } | undefined) => {
    if (opt) localEntry.value.snmpStorageFlag = opt.value
  }
})

const nameError = computed(() => {
  if (!localEntry.value.name.trim()) return 'Name is required'
  if (isNew.value && props.allEntryNames.includes(localEntry.value.name)) return 'Name already in use'
  return ''
})

const availableGroups = computed(() => {
  const already = new Set(localEntry.value.includeCollections)
  return props.groupFiles
    .filter(f => f.groupName && !already.has(f.groupName))
    .map(f => ({ label: `${f.groupName} (${f.filename})`, value: f.groupName! }))
})

const updateRra = (i: number, val: string) => {
  const arr = [...localEntry.value.rras]
  arr[i] = val
  localEntry.value.rras = arr
}

const addRra = () => {
  localEntry.value.rras = [...localEntry.value.rras, '']
}

const removeRra = (i: number) => {
  localEntry.value.rras = localEntry.value.rras.filter((_, idx) => idx !== i)
}

const onAddInclude = (opt: { label: string; value: string } | undefined) => {
  if (!opt) return
  if (!localEntry.value.includeCollections.includes(opt.value)) {
    localEntry.value.includeCollections = [...localEntry.value.includeCollections, opt.value]
  }
  selectedGroupToAdd.value = undefined
}

const removeInclude = (groupName: string) => {
  localEntry.value.includeCollections = localEntry.value.includeCollections.filter(n => n !== groupName)
}

const onSave = () => {
  if (nameError.value) return
  emit('save', { ...localEntry.value })
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.snmp-collection-form {
  padding: 1.5rem;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  background: var($surface);
}

.form-title {
  @include headline3;
  margin: 0 0 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.section-label {
  @include subtitle1;
  display: block;
  margin-bottom: 0.5rem;
  color: var($secondary-text-on-surface);
}

.rra-section, .include-section {
  margin-bottom: 1.5rem;
}

.rra-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.include-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 16px;
  background: var($primary-tint);
  color: var($primary-text-on-color);
  @include caption;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var($border-light-on-surface);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue
git commit -m "feat(ui): add SnmpCollectionForm for SNMP collection entry editing"
```

---

## Task 9: `SnmpCollectionsTab.vue` — Collections table + add/edit/delete

**Files:**
- Create: `ui/src/components/SnmpCollectionsConfig/SnmpCollectionsTab.vue`

- [ ] **Step 1: Write `SnmpCollectionsTab.vue`**

Create `ui/src/components/SnmpCollectionsConfig/SnmpCollectionsTab.vue`:

```vue
<template>
  <div class="snmp-collections-tab">
    <div class="tab-header">
      <h3 class="tab-title">SNMP Collections</h3>
      <FeatherButton primary @click="onAdd">+ Add</FeatherButton>
    </div>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="loadError" class="load-error">{{ loadError }}</div>
    <template v-else>
      <table class="collections-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Storage Flag</th>
            <th>RRD Step</th>
            <th>Include Collections</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="col in collections" :key="col.name">
            <td>{{ col.name }}</td>
            <td>{{ col.snmpStorageFlag }}</td>
            <td>{{ col.rrdStep }}s</td>
            <td class="includes-cell">{{ col.includeCollections.join(', ') || '—' }}</td>
            <td class="actions-cell">
              <FeatherButton text @click="onEdit(col)">Edit</FeatherButton>
              <FeatherButton text class="delete-btn" @click="onDelete(col)">Delete</FeatherButton>
            </td>
          </tr>
          <tr v-if="collections.length === 0">
            <td colspan="5" class="empty-row">No SNMP collections configured.</td>
          </tr>
        </tbody>
      </table>

      <!-- Inline form (shown below table when adding/editing) -->
      <div v-if="editingEntry" class="form-area">
        <SnmpCollectionForm
          :entry="editingEntry"
          :all-entry-names="allNames"
          :group-files="groupFiles"
          @save="onFormSave"
          @cancel="editingEntry = null"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import useSnackbar from '@/composables/useSnackbar'
import SnmpCollectionForm from './SnmpCollectionForm.vue'
import {
  getSnmpCollections,
  saveSnmpCollections,
  listGroupFiles,
  makeDefaultSnmpCollection,
  type SnmpCollectionEntry,
  type GroupFileMeta
} from '@/services/snmpCollectionsService'

const { showSnackBar } = useSnackbar()

const collections = ref<SnmpCollectionEntry[]>([])
const groupFiles = ref<GroupFileMeta[]>([])
const editingEntry = ref<SnmpCollectionEntry | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

const allNames = computed(() => collections.value.map(c => c.name))

onMounted(async () => {
  await Promise.all([loadCollections(), loadGroupFiles()])
})

const loadCollections = async () => {
  loading.value = true
  loadError.value = null
  try {
    const cfg = await getSnmpCollections()
    collections.value = cfg.snmpCollections
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load SNMP collections'
  } finally {
    loading.value = false
  }
}

const loadGroupFiles = async () => {
  try {
    groupFiles.value = await listGroupFiles()
  } catch {
    // non-fatal — include collections selector will just be empty
  }
}

const onAdd = () => {
  editingEntry.value = makeDefaultSnmpCollection()
}

const onEdit = (col: SnmpCollectionEntry) => {
  editingEntry.value = { ...col, rras: [...col.rras], includeCollections: [...col.includeCollections] }
}

const onDelete = async (col: SnmpCollectionEntry) => {
  if (!confirm(`Delete collection "${col.name}"?`)) return
  const updated = collections.value.filter(c => c.name !== col.name)
  try {
    await saveSnmpCollections(updated)
    collections.value = updated
    showSnackBar({ msg: `Deleted collection "${col.name}"` })
  } catch (e: any) {
    showSnackBar({ msg: `Delete failed: ${e?.message ?? 'Unknown error'}` })
  }
}

const onFormSave = async (entry: SnmpCollectionEntry) => {
  const existing = collections.value.findIndex(c => c.name === entry.name)
  const updated = existing >= 0
    ? collections.value.map((c, i) => i === existing ? entry : c)
    : [...collections.value, entry]
  try {
    await saveSnmpCollections(updated)
    collections.value = updated
    editingEntry.value = null
    showSnackBar({ msg: `Saved collection "${entry.name}"` })
  } catch (e: any) {
    showSnackBar({ msg: `Save failed: ${e?.message ?? 'Unknown error'}` })
  }
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.snmp-collections-tab {
  padding: 1.5rem;
}

.tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.tab-title {
  @include headline3;
  margin: 0;
}

.collections-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;

  th, td {
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var($border-on-surface);
    @include body2;
  }

  th {
    @include subtitle2;
    background: var($surface-dark);
    color: var($secondary-text-on-surface);
  }

  tr:hover td {
    background: var($hover);
  }
}

.includes-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-cell {
  white-space: nowrap;
}

.delete-btn {
  color: var($error) !important;
}

.empty-row {
  text-align: center;
  color: var($secondary-text-on-surface);
}

.loading, .load-error {
  padding: 1rem;
  color: var($secondary-text-on-surface);
}

.load-error {
  color: var($error);
}

.form-area {
  margin-top: 1rem;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/SnmpCollectionsConfig/SnmpCollectionsTab.vue
git commit -m "feat(ui): add SnmpCollectionsTab with table + inline form"
```

---

## Task 10: `SnmpCollectionsConfig.vue` container + router + JSP redirect + sidebar

**Files:**
- Create: `ui/src/containers/SnmpCollectionsConfig.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `ui/src/components/Menu/SideMenu.vue`
- Replace: `opennms-webapp/src/main/webapp/admin/manageSnmpCollections.jsp`

- [ ] **Step 1: Write the container `SnmpCollectionsConfig.vue`**

Create `ui/src/containers/SnmpCollectionsConfig.vue`:

```vue
<template>
  <div class="snmp-collections-config">
    <BreadCrumbs :breadcrumbs="breadcrumbs" />
    <h2 class="page-title">SNMP Collections Configuration</h2>

    <FeatherTabContainer>
      <template #tabs>
        <FeatherTab>Data Collection Groups</FeatherTab>
        <FeatherTab>SNMP Collections</FeatherTab>
      </template>
      <FeatherTabPanel>
        <DataCollectionGroupsTab />
      </FeatherTabPanel>
      <FeatherTabPanel>
        <SnmpCollectionsTab />
      </FeatherTabPanel>
    </FeatherTabContainer>
  </div>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
import BreadCrumbs from '@/components/Common/BreadCrumbs.vue'
import DataCollectionGroupsTab from '@/components/SnmpCollectionsConfig/DataCollectionGroupsTab.vue'
import SnmpCollectionsTab from '@/components/SnmpCollectionsConfig/SnmpCollectionsTab.vue'

const breadcrumbs = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'SNMP Collections Config' }
]
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.snmp-collections-config {
  padding: 1.5rem;
  height: calc(100vh - var(--feather-header-height, 60px));
  display: flex;
  flex-direction: column;
}

.page-title {
  @include headline2;
  margin: 0 0 1rem;
}

:deep(.feather-tab-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.feather-tab-panel) {
  flex: 1;
  overflow: auto;
}
</style>
```

- [ ] **Step 2: Add the route to `router/index.ts`**

In `ui/src/main/router/index.ts`, find the block with other admin-guarded routes (e.g. the `/configuration` or `/logs` route). Add the new route immediately after `/logs`:

```typescript
    {
      path: '/snmp-collections-config',
      name: 'SnmpCollectionsConfig',
      component: () => import('@/containers/SnmpCollectionsConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'No role access to SNMP collections config.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
```

- [ ] **Step 3: Add `legacyToVueRoutes` entry in `SideMenu.vue`**

In `ui/src/components/Menu/SideMenu.vue`, find the `legacyToVueRoutes` object and add:

```typescript
  'admin/manageSnmpCollections.jsp': 'ui/index.html#/snmp-collections-config',
```

Place it after the `admin/surveillanceViewsConfig.jsp` entry.

- [ ] **Step 4: Replace the JSP with a redirect**

Replace the entire content of `opennms-webapp/src/main/webapp/admin/manageSnmpCollections.jsp` with:

```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/snmp-collections-config"); %>
```

- [ ] **Step 5: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/containers/SnmpCollectionsConfig.vue \
        ui/src/main/router/index.ts \
        ui/src/components/Menu/SideMenu.vue \
        opennms-webapp/src/main/webapp/admin/manageSnmpCollections.jsp
git commit -m "feat(ui): wire SnmpCollectionsConfig container, route, JSP redirect, and sidebar entry"
```

---

## Task 11: Build + deploy + verify

- [ ] **Step 1: Build the Vue SPA**

```bash
cd /Users/chance/git/opennms/ui
/Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: `Build complete.` with no errors.

- [ ] **Step 2: Verify built index.html references the new bundle**

```bash
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: one path like `assets/index-XXXXXXXX.js`.

- [ ] **Step 3: Verify CSS has no bare `--feather-*` values**

```bash
grep -c 'var(--feather' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css
grep -c '[^r]--feather-' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css
```

The `var(--feather` count should be > 0 (valid). The second count (bare `--feather-` outside `var()`) should be 0.

- [ ] **Step 4: Ensure container is running**

```bash
podman ps --format "{{.Names}}" | grep test-opennms || podman start test-opennms
sleep 15
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/login.jsp
```

Expected: `200`.

- [ ] **Step 5: Deploy UI to container**

```bash
cd /Users/chance/git/opennms/ui
./deploy-to-container.sh test-opennms 2>&1 | tail -10
```

- [ ] **Step 6: Verify live bundle hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Both lines must be identical.

- [ ] **Step 7: Verify route loads**

```bash
curl -s -o /dev/null -w "%{http_code}" -L \
  -u admin:notdefault \
  'http://localhost:8980/opennms/ui/index.html#/snmp-collections-config'
```

Expected: `200`.

- [ ] **Step 8: Verify JSP redirect**

```bash
curl -s -o /dev/null -w "%{http_code}" -L \
  -u admin:notdefault \
  'http://localhost:8980/opennms/admin/manageSnmpCollections.jsp'
```

Expected: `200` (follows redirect chain through login and Vue index).

- [ ] **Step 9: Verify API endpoints from browser session (manual)**

In a browser logged in as admin, open the DevTools Network tab and navigate to `/opennms/ui/index.html#/snmp-collections-config`. Confirm:
1. `GET /opennms/api/v2/datacollection-groups` returns `200` with a JSON array.
2. Clicking a file in Tab 1 triggers `GET /opennms/api/v2/datacollection-groups/{filename}` returning XML.
3. Tab 2 loads `GET /opennms/api/v2/datacollection-config` with the collections list.

- [ ] **Step 10: Tell user to hard refresh**

Instruct: `Cmd+Shift+R` to bust the browser cache.

- [ ] **Step 11: Squash and commit all task work**

```bash
cd /Users/chance/git/opennms
git log --oneline -10
# Squash the task commits into logical groups before pushing:
# Group 1: Java REST resources + tests
# Group 2: TypeScript service layer
# Group 3: Vue components
# Group 4: Wiring (container, router, JSP, sidebar)
```

> **Note:** Follow the CLAUDE.md rule — squash iterative commits before pushing. Use `git rebase -i HEAD~N` (N = number of commits since branch start) to combine into 3-4 logical commits.

---

## Self-Review Checklist

- [x] **Java**: `DataCollectionGroupsResource` covers GET list, GET file, PUT (validate+save), DELETE (with ref cleanup)
- [x] **Java**: `SnmpCollectionConfigResource` covers GET and PUT root config
- [x] **Java tests**: `DataCollectionGroupsResourceTest` tests `isValidFilename`, `extractGroupName`, `buildFileMeta`
- [x] **Java tests**: `SnmpCollectionConfigResourceTest` tests `toDto` and `applyDto` round-trips
- [x] **Auto-registration**: Both classes use `@Component` in `org.opennms.web.rest.v2` — auto-scanned, no XML needed
- [x] **TypeScript**: All 6 service functions match spec signatures
- [x] **TypeScript tests**: `makeDefaultSnmpCollection` and `makeNewGroupXml` helper tests, type assertion tests
- [x] **GroupFileList**: Search, dirty indicator, new file button
- [x] **GroupFileEditor**: Ace XML editor, Save/Delete toolbar, inline error on 400, Cmd+S keybinding, dark mode theme
- [x] **DataCollectionGroupsTab**: Loading state, file switch with dirty guard, new file template, error propagation
- [x] **SnmpCollectionForm**: Name, storageFlag, rrdStep, RRA list, include collections multi-select
- [x] **SnmpCollectionsTab**: Table view, add/edit/delete, inline form below table
- [x] **SnmpCollectionsConfig.vue**: Tab container, breadcrumbs, admin-only container
- [x] **Router**: `beforeEnter` admin guard matches existing pattern exactly
- [x] **JSP redirect**: Single-line redirect, no legacy content
- [x] **legacyToVueRoutes**: Entry added for `admin/manageSnmpCollections.jsp`
- [x] **Dark mode**: Ace theme computed from `appStore.theme === 'open-dark'`
- [x] **Filename validation**: `[a-zA-Z0-9._-]+` regex, tested in unit tests
