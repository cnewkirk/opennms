# Wallboard (Ops Board) Config — Vue Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `admin/wallboardConfig.jsp` (Vaadin iframe) with a Vue SPA editor at `#/wallboard-config`, backed by a new `GET`/`PUT` REST endpoint for `dashboard-config.xml`.

**Architecture:** Load-edit-save pattern — `GET /api/v2/wallboard-config` returns the full `dashboard-config.xml` as JSON; `PUT` replaces it. Vue owns all in-memory editing. The Java REST resource reads/writes the file directly with JaxbUtils using lightweight JAXB DTOs in a new `wallboardconfig` support package (same pattern as `jmxconfig`). JSP becomes a redirect.

**Tech Stack:** Java 17, JAX-RS (CXF), Jackson, JaxbUtils, Vue 3 Composition API, TypeScript, Feather DS, SCSS.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/WallboardsConfig.java` |
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/WallboardEntry.java` |
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/DashletEntry.java` |
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/WallboardConfigRestService.java` |
| **Create** | `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/WallboardConfigRestServiceTest.java` |
| **Create** | `ui/src/services/wallboardConfigService.ts` |
| **Create** | `ui/src/containers/WallboardConfig.vue` |
| **Create** | `ui/src/components/WallboardConfig/WallboardList.vue` |
| **Create** | `ui/src/components/WallboardConfig/WallboardEditor.vue` |
| **Create** | `ui/src/components/WallboardConfig/DashletRow.vue` |
| **Create** | `ui/src/components/WallboardConfig/ParametersTable.vue` |
| **Modify** | `ui/src/main/router/index.ts` — add route |
| **Modify** | `opennms-webapp/src/main/webapp/admin/wallboardConfig.jsp` — redirect |
| **Modify** | `opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml` — add wallboardconfig to component-scan |

---

## Task 1: JAXB DTO classes

These are simple JAXB-annotated model classes in a new support package. They mirror the
structure of `dashboard-config.xml` written by the existing Vaadin `WallboardProvider`.
The XML root element is `<wallboards>` containing `<wallboard>` elements.

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/WallboardsConfig.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/WallboardEntry.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/DashletEntry.java`

- [ ] **Step 1: Create WallboardsConfig.java**

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
package org.opennms.web.rest.support.wallboardconfig;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.util.ArrayList;
import java.util.List;

@XmlRootElement(name = "wallboards")
public class WallboardsConfig {

    private List<WallboardEntry> wallboards = new ArrayList<>();

    @XmlElement(name = "wallboard")
    public List<WallboardEntry> getWallboards() { return wallboards; }
    public void setWallboards(List<WallboardEntry> v) { this.wallboards = v; }
}
```

- [ ] **Step 2: Create WallboardEntry.java**

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
package org.opennms.web.rest.support.wallboardconfig;

import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementWrapper;
import javax.xml.bind.annotation.XmlRootElement;
import java.util.ArrayList;
import java.util.List;

@XmlRootElement(name = "wallboard")
public class WallboardEntry {

    private String title = "";
    private boolean defaultBoard = false;
    private List<DashletEntry> dashlets = new ArrayList<>();

    @XmlAttribute(name = "title")
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }

    @XmlAttribute(name = "default")
    public boolean isDefault() { return defaultBoard; }
    public void setDefault(boolean v) { this.defaultBoard = v; }

    @XmlElement(name = "dashlet")
    @XmlElementWrapper(name = "dashlets")
    public List<DashletEntry> getDashlets() { return dashlets; }
    public void setDashlets(List<DashletEntry> v) { this.dashlets = v; }
}
```

- [ ] **Step 3: Create DashletEntry.java**

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
package org.opennms.web.rest.support.wallboardconfig;

import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementWrapper;
import javax.xml.bind.annotation.XmlRootElement;
import java.util.LinkedHashMap;
import java.util.Map;

@XmlRootElement(name = "dashlet")
public class DashletEntry {

    private String dashletName = "Undefined";
    private String title = "";
    private int duration = 15;
    private int priority = 5;
    private int boostDuration = 0;
    private int boostPriority = 0;
    private Map<String, String> parameters = new LinkedHashMap<>();

    @XmlAttribute(name = "dashlet")
    public String getDashletName() { return dashletName; }
    public void setDashletName(String v) { this.dashletName = v; }

    @XmlAttribute(name = "title")
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }

    @XmlAttribute(name = "duration")
    public int getDuration() { return duration; }
    public void setDuration(int v) { this.duration = v; }

    @XmlAttribute(name = "priority")
    public int getPriority() { return priority; }
    public void setPriority(int v) { this.priority = v; }

    @XmlAttribute(name = "boostDuration")
    public int getBoostDuration() { return boostDuration; }
    public void setBoostDuration(int v) { this.boostDuration = v; }

    @XmlAttribute(name = "boostPriority")
    public int getBoostPriority() { return boostPriority; }
    public void setBoostPriority(int v) { this.boostPriority = v; }

    @XmlElementWrapper(name = "parameters")
    public Map<String, String> getParameters() { return parameters; }
    public void setParameters(Map<String, String> v) { this.parameters = v; }
}
```

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/wallboardconfig/
git commit -m "feat(wallboard-config): add JAXB DTO classes for dashboard-config.xml"
```

---

## Task 2: Write the REST resource unit tests

**Files:**
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/WallboardConfigRestServiceTest.java`

- [ ] **Step 1: Write the failing tests**

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
 * software distributed under the LICENSE is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.v2;

import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.web.rest.support.wallboardconfig.DashletEntry;
import org.opennms.web.rest.support.wallboardconfig.WallboardEntry;
import org.opennms.web.rest.support.wallboardconfig.WallboardsConfig;

public class WallboardConfigRestServiceTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void marshalAndUnmarshalRoundTrip() throws IOException {
        WallboardsConfig config = new WallboardsConfig();
        WallboardEntry board = new WallboardEntry();
        board.setTitle("Main Board");
        board.setDefault(true);

        DashletEntry dashlet = new DashletEntry();
        dashlet.setDashletName("Alarms");
        dashlet.setTitle("Active Alarms");
        dashlet.setDuration(30);
        dashlet.setPriority(3);
        dashlet.getParameters().put("severity", "WARNING");
        board.getDashlets().add(dashlet);
        config.getWallboards().add(board);

        File f = tmp.newFile("dashboard-config.xml");
        JaxbUtils.marshal(config, f);

        WallboardsConfig loaded = JaxbUtils.unmarshal(WallboardsConfig.class, f);
        assertEquals(1, loaded.getWallboards().size());
        WallboardEntry lb = loaded.getWallboards().get(0);
        assertEquals("Main Board", lb.getTitle());
        assertTrue(lb.isDefault());
        assertEquals(1, lb.getDashlets().size());
        DashletEntry ld = lb.getDashlets().get(0);
        assertEquals("Alarms", ld.getDashletName());
        assertEquals("Active Alarms", ld.getTitle());
        assertEquals(30, ld.getDuration());
        assertEquals(3, ld.getPriority());
        assertEquals("WARNING", ld.getParameters().get("severity"));
    }

    @Test
    public void emptyConfigRoundTrips() throws IOException {
        WallboardsConfig config = new WallboardsConfig();
        File f = tmp.newFile("empty.xml");
        JaxbUtils.marshal(config, f);
        WallboardsConfig loaded = JaxbUtils.unmarshal(WallboardsConfig.class, f);
        assertNotNull(loaded);
        assertTrue(loaded.getWallboards().isEmpty());
    }

    @Test
    public void validateMultipleDefaultsIsDetected() {
        WallboardsConfig config = new WallboardsConfig();
        WallboardEntry b1 = new WallboardEntry();
        b1.setTitle("A");
        b1.setDefault(true);
        WallboardEntry b2 = new WallboardEntry();
        b2.setTitle("B");
        b2.setDefault(true);
        config.getWallboards().add(b1);
        config.getWallboards().add(b2);

        long defaultCount = config.getWallboards().stream().filter(WallboardEntry::isDefault).count();
        assertTrue("Should detect multiple defaults", defaultCount > 1);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail (class not found)**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=WallboardConfigRestServiceTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS` after Task 1 DTOs exist; if WallboardsConfig not yet found, it
will fail to compile — that's correct, proceed to Task 3.

---

## Task 3: Implement the REST resource and update component scan

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/WallboardConfigRestService.java`
- Modify: `opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml`

- [ ] **Step 1: Create the REST resource**

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
import java.nio.file.Paths;
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.wallboardconfig.WallboardEntry;
import org.opennms.web.rest.support.wallboardconfig.WallboardsConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("wallboard-config")
@Tag(name = "WallboardConfig", description = "Ops Board Configuration API")
public class WallboardConfigRestService {

    private static final Logger LOG = LoggerFactory.getLogger(WallboardConfigRestService.class);

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get ops board configuration", operationId = "getWallboardConfig")
    public Response getConfig(@Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        try {
            File cfgFile = getConfigFile();
            WallboardsConfig config;
            if (!cfgFile.exists()) {
                config = new WallboardsConfig();
            } else {
                config = JaxbUtils.unmarshal(WallboardsConfig.class, cfgFile);
            }
            return Response.ok(config).build();
        } catch (Exception e) {
            LOG.error("Failed to read wallboard configuration", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Replace ops board configuration", operationId = "putWallboardConfig")
    public Response putConfig(WallboardsConfig config, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (config == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Request body required")).build();
        }
        long defaultCount = config.getWallboards().stream()
                .filter(WallboardEntry::isDefault).count();
        if (defaultCount > 1) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "At most one wallboard may be marked as default")).build();
        }
        try {
            File cfgFile = getConfigFile();
            cfgFile.getParentFile().mkdirs();
            JaxbUtils.marshal(config, cfgFile);
            LOG.info("Saved wallboard configuration to {}", cfgFile);
            return Response.noContent().build();
        } catch (IOException e) {
            LOG.error("Failed to write wallboard configuration", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    static File getConfigFile() {
        return Paths.get(System.getProperty("opennms.home", "/opt/opennms"), "etc", "dashboard-config.xml").toFile();
    }
}
```

- [ ] **Step 2: Add wallboardconfig package to component-scan**

Open `opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml`.

Find the `<context:component-scan>` element (line ~20). It currently looks like:

```xml
<context:component-scan base-package="org.opennms.web.rest.v2, org.opennms.web.rest.mapper.v2, org.opennms.web.rest.support.jmxconfig, org.opennms.web.rest.support.mibcompiler" />
```

Add `org.opennms.web.rest.support.wallboardconfig` to the end:

```xml
<context:component-scan base-package="org.opennms.web.rest.v2, org.opennms.web.rest.mapper.v2, org.opennms.web.rest.support.jmxconfig, org.opennms.web.rest.support.mibcompiler, org.opennms.web.rest.support.wallboardconfig" />
```

- [ ] **Step 3: Run the tests**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=WallboardConfigRestServiceTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/WallboardConfigRestService.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/WallboardConfigRestServiceTest.java \
        opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml
git commit -m "feat(wallboard-config): add GET/PUT REST resource and register wallboardconfig in component-scan"
```

---

## Task 4: TypeScript service

**Files:**
- Create: `ui/src/services/wallboardConfigService.ts`

- [ ] **Step 1: Create the service**

```ts
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

export interface DashletEntry {
  dashletName: string
  title: string
  duration: number
  priority: number
  boostDuration: number
  boostPriority: number
  parameters: Record<string, string>
}

export interface WallboardEntry {
  title: string
  default: boolean
  dashlets: DashletEntry[]
}

export interface WallboardsConfig {
  wallboards: WallboardEntry[]
}

export const DASHLET_TYPES = [
  'Alarms', 'BSM', 'Map', 'Summary', 'RTC', 'Topology', 'Charts', 'Undefined'
] as const

export type DashletType = typeof DASHLET_TYPES[number]

const BASE = 'wallboard-config'

export const getConfig = async (): Promise<WallboardsConfig> => {
  const resp = await v2.get<WallboardsConfig>(BASE)
  return resp.data
}

export const saveConfig = async (config: WallboardsConfig): Promise<void> => {
  await v2.put(BASE, config)
}

export const makeDefaultDashlet = (): DashletEntry => ({
  dashletName: 'Alarms',
  title: '',
  duration: 15,
  priority: 5,
  boostDuration: 0,
  boostPriority: 0,
  parameters: {}
})

export const makeDefaultWallboard = (): WallboardEntry => ({
  title: 'New Board',
  default: false,
  dashlets: []
})
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/services/wallboardConfigService.ts
git commit -m "feat(wallboard-config): add Vue service for wallboard-config API"
```

---

## Task 5: ParametersTable component

**Files:**
- Create: `ui/src/components/WallboardConfig/ParametersTable.vue`

- [ ] **Step 1: Create the component**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="parameters-table">
    <div class="params-header">
      <span class="params-label">Parameters</span>
      <FeatherButton text @click="addRow">+ Add</FeatherButton>
    </div>

    <div v-if="rows.length === 0" class="empty-state">No parameters.</div>

    <div v-for="(row, i) in rows" :key="i" class="param-row">
      <FeatherInput
        v-model="row.key"
        label="Key"
        class="key-input"
        @update:modelValue="emitUpdate"
      />
      <FeatherInput
        v-model="row.value"
        label="Value"
        class="val-input"
        @update:modelValue="emitUpdate"
      />
      <FeatherButton icon text @click="removeRow(i)">
        <FeatherIcon :icon="DeleteIcon" />
      </FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherIcon } from '@featherds/icon'
import Delete from '@featherds/icon/action/Delete'

const props = defineProps<{ modelValue: Record<string, string> }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: Record<string, string>): void }>()

const DeleteIcon = Delete

interface KVRow { key: string; value: string }

const rows = ref<KVRow[]>(
  Object.entries(props.modelValue).map(([key, value]) => ({ key, value }))
)

watch(() => props.modelValue, (v) => {
  rows.value = Object.entries(v).map(([key, value]) => ({ key, value }))
}, { deep: true })

const emitUpdate = () => {
  const obj: Record<string, string> = {}
  rows.value.forEach(r => { if (r.key) obj[r.key] = r.value })
  emit('update:modelValue', obj)
}

const addRow = () => { rows.value.push({ key: '', value: '' }) }
const removeRow = (i: number) => { rows.value.splice(i, 1); emitUpdate() }
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.parameters-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.params-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.params-label {
  @include typo.subtitle2();
  color: var($secondary-text-on-surface);
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
}

.param-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.key-input { width: 140px; flex-shrink: 0; }
.val-input { flex: 1; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/WallboardConfig/ParametersTable.vue
git commit -m "feat(wallboard-config): add ParametersTable component"
```

---

## Task 6: DashletRow component

**Files:**
- Create: `ui/src/components/WallboardConfig/DashletRow.vue`

- [ ] **Step 1: Create the component**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="dashlet-row" :class="{ expanded }">
    <div class="dashlet-summary" @click="expanded = !expanded">
      <span class="dashlet-type-badge">{{ local.dashletName }}</span>
      <span class="dashlet-title">{{ local.title || '(untitled)' }}</span>
      <div class="row-actions">
        <FeatherButton icon text @click.stop="$emit('moveUp')" :disabled="isFirst">
          <FeatherIcon :icon="UpIcon" />
        </FeatherButton>
        <FeatherButton icon text @click.stop="$emit('moveDown')" :disabled="isLast">
          <FeatherIcon :icon="DownIcon" />
        </FeatherButton>
        <FeatherButton icon text @click.stop="$emit('delete')">
          <FeatherIcon :icon="DeleteIcon" />
        </FeatherButton>
        <FeatherIcon :icon="expanded ? CollapseIcon : ExpandIcon" class="expand-icon" />
      </div>
    </div>

    <div v-if="expanded" class="dashlet-form">
      <div class="form-row">
        <div class="form-field">
          <label class="field-label">Type</label>
          <select class="type-select" v-model="local.dashletName" @change="emitUpdate">
            <option v-for="t in DASHLET_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <FeatherInput v-model="local.title" label="Title" class="title-input" @update:modelValue="emitUpdate" />
      </div>

      <div class="form-row">
        <FeatherInput
          :modelValue="String(local.duration)"
          label="Duration (s)"
          type="number"
          class="num-input"
          @update:modelValue="(v) => { local.duration = Number(v) || 0; emitUpdate() }"
        />
        <FeatherInput
          :modelValue="String(local.priority)"
          label="Priority"
          type="number"
          class="num-input"
          @update:modelValue="(v) => { local.priority = Number(v) || 0; emitUpdate() }"
        />
        <FeatherInput
          :modelValue="String(local.boostDuration)"
          label="Boost Duration (s)"
          type="number"
          class="num-input"
          @update:modelValue="(v) => { local.boostDuration = Number(v) || 0; emitUpdate() }"
        />
        <FeatherInput
          :modelValue="String(local.boostPriority)"
          label="Boost Priority"
          type="number"
          class="num-input"
          @update:modelValue="(v) => { local.boostPriority = Number(v) || 0; emitUpdate() }"
        />
      </div>

      <ParametersTable v-model="local.parameters" @update:modelValue="emitUpdate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import Delete from '@featherds/icon/action/Delete'
import ArrowUp from '@featherds/icon/navigation/ArrowUp'
import ArrowDown from '@featherds/icon/navigation/ArrowDown'
import ExpandMore from '@featherds/icon/navigation/ExpandMore'
import ExpandLess from '@featherds/icon/navigation/ExpandLess'
import ParametersTable from './ParametersTable.vue'
import { DASHLET_TYPES } from '@/services/wallboardConfigService'
import type { DashletEntry } from '@/services/wallboardConfigService'

const props = defineProps<{
  modelValue: DashletEntry
  isFirst: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: DashletEntry): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
  (e: 'delete'): void
}>()

const DeleteIcon = Delete
const UpIcon = ArrowUp
const DownIcon = ArrowDown
const ExpandIcon = ExpandMore
const CollapseIcon = ExpandLess

const expanded = ref(false)
const local = ref<DashletEntry>(JSON.parse(JSON.stringify(props.modelValue)))

watch(() => props.modelValue, (v) => {
  local.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(local.value)))
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.dashlet-row {
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  overflow: hidden;
}

.dashlet-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  background: var($surface-dark);
  user-select: none;

  &:hover {
    filter: brightness(0.97);
  }
}

.dashlet-type-badge {
  @include typo.caption();
  background: var($primary);
  color: var($primary-text-on-color);
  border-radius: 0.75rem;
  padding: 0.1rem 0.6rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.dashlet-title {
  @include typo.body-large();
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.expand-icon {
  color: var($secondary-text-on-surface);
}

.dashlet-form {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 1px solid var($border-on-surface);
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.type-select {
  @include typo.body-large();
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  padding: 0.4rem 0.75rem;
  background: var($surface);
  color: var($primary-text-on-surface);
  cursor: pointer;
  height: 2.5rem;
}

.field-label {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  display: block;
  margin-bottom: 0.25rem;
}

.title-input { flex: 1; min-width: 160px; }
.num-input { width: 130px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/WallboardConfig/DashletRow.vue
git commit -m "feat(wallboard-config): add DashletRow component"
```

---

## Task 7: WallboardList and WallboardEditor components

**Files:**
- Create: `ui/src/components/WallboardConfig/WallboardList.vue`
- Create: `ui/src/components/WallboardConfig/WallboardEditor.vue`

- [ ] **Step 1: Create WallboardList.vue**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="wallboard-list">
    <div class="list-header">
      <span class="list-label">Boards</span>
      <FeatherButton icon text @click="$emit('add')" :disabled="disabled">
        <FeatherIcon :icon="AddIcon" />
      </FeatherButton>
    </div>

    <div
      v-for="(board, i) in wallboards"
      :key="i"
      class="board-item"
      :class="{ selected: i === selectedIndex }"
      @click="$emit('select', i)"
    >
      <span class="board-title">{{ board.title || '(untitled)' }}</span>
      <span v-if="board.default" class="default-badge">default</span>
      <FeatherButton icon text class="delete-btn" @click.stop="$emit('delete', i)" :disabled="disabled">
        <FeatherIcon :icon="DeleteIcon" />
      </FeatherButton>
    </div>

    <div v-if="wallboards.length === 0" class="empty-state">No boards configured.</div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import Add from '@featherds/icon/navigation/Add'
import Delete from '@featherds/icon/action/Delete'
import type { WallboardEntry } from '@/services/wallboardConfigService'

defineProps<{
  wallboards: WallboardEntry[]
  selectedIndex: number
  disabled?: boolean
}>()

defineEmits<{
  (e: 'select', index: number): void
  (e: 'add'): void
  (e: 'delete', index: number): void
}>()

const AddIcon = Add
const DeleteIcon = Delete
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.wallboard-list {
  border-right: 1px solid var($border-on-surface);
  min-width: 200px;
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  border-bottom: 1px solid var($border-on-surface);
}

.list-label {
  @include typo.subtitle1();
  color: var($secondary-text-on-surface);
}

.board-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  cursor: pointer;
  user-select: none;

  &:hover { background: var($surface-dark); }
  &.selected {
    background: var($surface-dark);
    border-left: 3px solid var($primary);
  }

  .delete-btn { margin-left: auto; opacity: 0; }
  &:hover .delete-btn { opacity: 1; }
}

.board-title {
  @include typo.body-large();
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.default-badge {
  @include typo.caption();
  background: var($primary);
  color: var($primary-text-on-color);
  border-radius: 0.75rem;
  padding: 0 0.5rem;
  white-space: nowrap;
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  padding: 1rem;
  text-align: center;
}
</style>
```

- [ ] **Step 2: Create WallboardEditor.vue**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="wallboard-editor">
    <div class="editor-toolbar">
      <FeatherInput v-model="local.title" label="Board Title" class="title-input" @update:modelValue="emitUpdate" />
      <FeatherCheckbox v-model="local.default" @update:modelValue="emitUpdate">Default board</FeatherCheckbox>
    </div>

    <div class="dashlets-section">
      <div class="dashlets-header">
        <span class="dashlets-label">Dashlets ({{ local.dashlets.length }})</span>
        <FeatherButton text @click="addDashlet">+ Add Dashlet</FeatherButton>
      </div>

      <div v-if="local.dashlets.length === 0" class="empty-state">
        No dashlets. Add one to get started.
      </div>

      <div class="dashlets-list">
        <DashletRow
          v-for="(dashlet, i) in local.dashlets"
          :key="i"
          :modelValue="dashlet"
          :isFirst="i === 0"
          :isLast="i === local.dashlets.length - 1"
          @update:modelValue="(v) => updateDashlet(i, v)"
          @moveUp="moveDashlet(i, -1)"
          @moveDown="moveDashlet(i, 1)"
          @delete="removeDashlet(i)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherCheckbox } from '@featherds/checkbox'
import DashletRow from './DashletRow.vue'
import { makeDefaultDashlet } from '@/services/wallboardConfigService'
import type { WallboardEntry, DashletEntry } from '@/services/wallboardConfigService'

const props = defineProps<{ modelValue: WallboardEntry }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: WallboardEntry): void }>()

const local = ref<WallboardEntry>(JSON.parse(JSON.stringify(props.modelValue)))

watch(() => props.modelValue, (v) => {
  local.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(local.value)))

const addDashlet = () => {
  local.value.dashlets.push(makeDefaultDashlet())
  emitUpdate()
}

const removeDashlet = (i: number) => {
  local.value.dashlets.splice(i, 1)
  emitUpdate()
}

const updateDashlet = (i: number, updated: DashletEntry) => {
  local.value.dashlets[i] = updated
  emitUpdate()
}

const moveDashlet = (i: number, direction: -1 | 1) => {
  const j = i + direction
  if (j < 0 || j >= local.value.dashlets.length) return
  const tmp = local.value.dashlets[i]
  local.value.dashlets[i] = local.value.dashlets[j]
  local.value.dashlets[j] = tmp
  emitUpdate()
}
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.wallboard-editor {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
}

.editor-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.title-input { width: 250px; }

.dashlets-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashlets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashlets-label {
  @include typo.subtitle1();
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
}

.dashlets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/WallboardConfig/WallboardList.vue \
        ui/src/components/WallboardConfig/WallboardEditor.vue
git commit -m "feat(wallboard-config): add WallboardList and WallboardEditor components"
```

---

## Task 8: Container, router, and JSP redirect

**Files:**
- Create: `ui/src/containers/WallboardConfig.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `opennms-webapp/src/main/webapp/admin/wallboardConfig.jsp`

- [ ] **Step 1: Create the container**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="wallboard-config">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">Ops Board Configuration</h1>

    <div v-if="loading" class="loading-state">
      <FeatherSpinner />
    </div>

    <div v-else-if="loadError" class="error-state">
      <p class="error-text">{{ loadError }}</p>
      <FeatherButton @click="loadData">Retry</FeatherButton>
    </div>

    <template v-else>
      <div class="toolbar">
        <FeatherButton primary @click="save" :disabled="saving || !isDirty">
          {{ saving ? 'Saving…' : 'Save' }}
        </FeatherButton>
        <FeatherButton v-if="isDirty" text @click="resetChanges">Discard Changes</FeatherButton>
      </div>

      <div class="editor-layout">
        <WallboardList
          :wallboards="config.wallboards"
          :selectedIndex="selectedIndex"
          :disabled="saving"
          @select="selectedIndex = $event"
          @add="addBoard"
          @delete="deleteBoard"
        />

        <WallboardEditor
          v-if="selectedBoard"
          :modelValue="selectedBoard"
          @update:modelValue="updateSelectedBoard"
        />

        <div v-else class="no-selection">
          <p>Select a board to edit, or create a new one.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import WallboardList from '@/components/WallboardConfig/WallboardList.vue'
import WallboardEditor from '@/components/WallboardConfig/WallboardEditor.vue'
import { getConfig, saveConfig, makeDefaultWallboard } from '@/services/wallboardConfigService'
import type { WallboardsConfig, WallboardEntry } from '@/services/wallboardConfigService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'Ops Board Configuration', to: '/wallboard-config' }
]

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const config = ref<WallboardsConfig>({ wallboards: [] })
const savedSnapshot = ref<string>('')
const selectedIndex = ref(0)

const isDirty = computed(() => JSON.stringify(config.value) !== savedSnapshot.value)
const selectedBoard = computed(() => config.value.wallboards[selectedIndex.value] ?? null)

const loadData = async () => {
  loading.value = true
  loadError.value = null
  try {
    const cfg = await getConfig()
    config.value = cfg
    savedSnapshot.value = JSON.stringify(cfg)
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load configuration'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await saveConfig(config.value)
    savedSnapshot.value = JSON.stringify(config.value)
    showSnackBar({ msg: 'Ops board configuration saved.' })
  } catch (e: any) {
    const msg = e?.response?.data?.error ?? e?.message ?? 'Save failed'
    showSnackBar({ msg })
  } finally {
    saving.value = false
  }
}

const resetChanges = () => {
  config.value = JSON.parse(savedSnapshot.value)
  selectedIndex.value = 0
}

const addBoard = () => {
  config.value.wallboards.push(makeDefaultWallboard())
  selectedIndex.value = config.value.wallboards.length - 1
}

const deleteBoard = (i: number) => {
  config.value.wallboards.splice(i, 1)
  selectedIndex.value = Math.min(selectedIndex.value, config.value.wallboards.length - 1)
}

const updateSelectedBoard = (updated: WallboardEntry) => {
  // When a board sets itself as default, clear default on all others
  if (updated.default) {
    config.value.wallboards.forEach((b, i) => {
      if (i !== selectedIndex.value) b.default = false
    })
  }
  config.value.wallboards[selectedIndex.value] = updated
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.wallboard-config {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  box-sizing: border-box;
}

.page-title {
  @include typo.headline1();
  margin: 0;
}

.toolbar {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.editor-layout {
  display: flex;
  flex: 1;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  overflow: hidden;
  min-height: 0;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
}

.error-text {
  @include typo.body-large();
  color: var($error);
}

.no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var($secondary-text-on-surface);
}
</style>
```

- [ ] **Step 2: Add the route**

Open `ui/src/main/router/index.ts`. Add after the surveillance-views-config route:

```ts
{
  path: '/wallboard-config',
  name: 'Wallboard Config',
  component: () => import('@/containers/WallboardConfig.vue')
},
```

- [ ] **Step 3: Update the JSP**

Replace the entire content of `opennms-webapp/src/main/webapp/admin/wallboardConfig.jsp` with:

```jsp
<%--

    Licensed to The OpenNMS Group, Inc (TOG) under one or more
    contributor license agreements.  See the LICENSE.md file
    distributed with this work for additional information
    regarding copyright ownership.

    TOG licenses this file to You under the GNU Affero General
    Public License Version 3 (the "License") or (at your option)
    any later version.  You may not use this file except in
    compliance with the License.  You may obtain a copy of the
    License at:

         https://www.gnu.org/licenses/agpl-3.0.txt

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
    either express or implied.  See the License for the specific
    language governing permissions and limitations under the
    License.

--%>
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/wallboard-config"); %>
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/WallboardConfig.vue \
        ui/src/main/router/index.ts \
        opennms-webapp/src/main/webapp/admin/wallboardConfig.jsp
git commit -m "feat(wallboard-config): add Vue container, route, and JSP redirect"
```

---

## Task 9: Build and deploy

- [ ] **Step 1: Build the UI**

```bash
cd /Users/chance/git/opennms/ui
/Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```

Expected: `✓ built in` with no errors.

- [ ] **Step 2: Verify built index.html**

```bash
grep -o 'assets/index-[^"]*\.js' src/main/dist/index.html
```

Expected: one path like `assets/index-AbCdEfGh.js`.

- [ ] **Step 3: Check container is running**

```bash
podman ps --filter name=test-opennms --format "{{.Status}}"
```

Expected: `Up …`. If empty: `podman start test-opennms && sleep 20`.

- [ ] **Step 4: Deploy**

```bash
cd /Users/chance/git/opennms/ui
./deploy-to-container.sh test-opennms 2>&1 | tail -5
```

- [ ] **Step 5: Verify live hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' src/main/dist/index.html
```

Both lines must be identical.

- [ ] **Step 6: Verify HTTP 200**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```

Expected: `200`.

- [ ] **Step 7: Manual verification**

Navigate to `http://localhost:8980/opennms/admin/wallboardConfig.jsp` — should redirect to the Vue SPA. Verify:
- Board list loads (empty if no `dashboard-config.xml` exists — that's correct)
- Adding a board, setting title, checking default, adding dashlets, reordering them works
- Expanding a dashlet shows all fields including parameters
- Save succeeds (snackbar appears)

Tell user to hard-refresh (`Cmd+Shift+R`).
