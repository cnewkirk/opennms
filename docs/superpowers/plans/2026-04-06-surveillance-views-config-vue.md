# Surveillance Views Config — Vue Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `admin/surveillanceViewsConfig.jsp` (Vaadin iframe) with a Vue SPA editor at `#/surveillance-views-config`, backed by a new `GET`/`PUT` REST endpoint.

**Architecture:** Load-edit-save pattern — `GET /api/v2/surveillance-view-config` returns the full `surveillance-views.xml` as JSON; `PUT` replaces it. Vue owns all in-memory editing. The Java REST resource reads/writes the file directly with JaxbUtils (same pattern as `JmxConfigResource`). JSP becomes a redirect.

**Tech Stack:** Java 17, JAX-RS (CXF), Jackson, JaxbUtils, Vue 3 Composition API, TypeScript, Pinia-free (local reactive state), Feather DS, SCSS.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestService.java` |
| **Create** | `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestServiceTest.java` |
| **Create** | `ui/src/services/surveillanceViewConfigService.ts` |
| **Create** | `ui/src/containers/SurveillanceViewsConfig.vue` |
| **Create** | `ui/src/components/SurveillanceViewsConfig/SurveillanceViewList.vue` |
| **Create** | `ui/src/components/SurveillanceViewsConfig/SurveillanceViewEditor.vue` |
| **Create** | `ui/src/components/SurveillanceViewsConfig/SurveillanceViewRowColumnEditor.vue` |
| **Modify** | `ui/src/services/jmxConfigService.ts` — fix wrong axios instance (uses `rest` instead of `v2`) |
| **Modify** | `ui/src/main/router/index.ts` — add route |
| **Modify** | `opennms-webapp/src/main/webapp/admin/surveillanceViewsConfig.jsp` — redirect |

---

## Task 1: Fix existing jmxConfigService axios instance

The JMX config REST endpoints live at `/api/v2/jmx-config/…` but `jmxConfigService.ts`
imports the `rest` instance (baseURL `/opennms/rest`) instead of `v2` (baseURL `/opennms/api/v2`).
Fix this before adding more services that follow the wrong pattern.

**Files:**
- Modify: `ui/src/services/jmxConfigService.ts`

- [ ] **Step 1: Fix the import**

Open `ui/src/services/jmxConfigService.ts`. Change line 23:

```ts
// Before
import { rest } from './axiosInstances'

// After
import { v2 } from './axiosInstances'
```

- [ ] **Step 2: Fix all three usages**

Replace every `rest.` call in the file with `v2.`:

```ts
export const startDetect = async (request: DetectRequest): Promise<string> => {
  const resp = await v2.post(`${BASE}/detect`, request)
  return resp.data.jobId as string
}

export const pollDetect = async (jobId: string): Promise<DetectJobStatus> => {
  const resp = await v2.get(`${BASE}/detect/${jobId}`)
  return resp.data as DetectJobStatus
}

export const generate = async (request: GenerateRequest): Promise<GenerateResponse> => {
  const resp = await v2.post(`${BASE}/generate`, request)
  return resp.data as GenerateResponse
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/services/jmxConfigService.ts
git commit -m "fix(jmx-config): use v2 axios instance — endpoints are at /api/v2 not /rest"
```

---

## Task 2: Write the REST resource unit tests

The REST resource will expose two static conversion helpers — `toDto` and `fromDto` — that can be tested in isolation without a running server (same pattern as `JmxConfigResourceTest`).

**Files:**
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestServiceTest.java`

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
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.v2;

import static org.junit.Assert.*;

import java.util.List;
import java.util.Map;

import org.junit.Test;
import org.opennms.netmgt.config.surveillanceViews.Category;
import org.opennms.netmgt.config.surveillanceViews.ColumnDef;
import org.opennms.netmgt.config.surveillanceViews.RowDef;
import org.opennms.netmgt.config.surveillanceViews.SurveillanceViewConfiguration;
import org.opennms.netmgt.config.surveillanceViews.View;
import org.opennms.web.rest.v2.SurveillanceViewConfigRestService.SurveillanceViewConfigDto;
import org.opennms.web.rest.v2.SurveillanceViewConfigRestService.ViewDto;
import org.opennms.web.rest.v2.SurveillanceViewConfigRestService.RowOrColumnDto;

public class SurveillanceViewConfigRestServiceTest {

    @Test
    public void toDtoPreservesDefaultView() {
        SurveillanceViewConfiguration config = new SurveillanceViewConfiguration();
        config.setDefaultView("myview");
        View view = new View();
        view.setName("myview");
        view.setRefreshSeconds(120);
        config.getViews().add(view);

        SurveillanceViewConfigDto dto = SurveillanceViewConfigRestService.toDto(config);

        assertEquals("myview", dto.getDefaultView());
        assertEquals(1, dto.getViews().size());
        assertEquals("myview", dto.getViews().get(0).getName());
        assertEquals(120, dto.getViews().get(0).getRefreshSeconds());
    }

    @Test
    public void toDtoMapsRowsAndColumns() {
        SurveillanceViewConfiguration config = new SurveillanceViewConfiguration();
        View view = new View();
        view.setName("default");

        RowDef row = new RowDef();
        row.setLabel("Routers");
        Category cat = new Category();
        cat.setName("Routers");
        row.addCategory(cat);
        view.addRow(row);

        ColumnDef col = new ColumnDef();
        col.setLabel("PROD");
        Category prodCat = new Category();
        prodCat.setName("Production");
        col.addCategory(prodCat);
        view.addColumn(col);

        config.getViews().add(view);

        SurveillanceViewConfigDto dto = SurveillanceViewConfigRestService.toDto(config);

        ViewDto viewDto = dto.getViews().get(0);
        assertEquals(1, viewDto.getRows().size());
        assertEquals("Routers", viewDto.getRows().get(0).getLabel());
        assertEquals(List.of("Routers"), viewDto.getRows().get(0).getCategories());
        assertEquals(1, viewDto.getColumns().size());
        assertEquals("PROD", viewDto.getColumns().get(0).getLabel());
        assertEquals(List.of("Production"), viewDto.getColumns().get(0).getCategories());
    }

    @Test
    public void roundTripPreservesData() {
        SurveillanceViewConfiguration original = new SurveillanceViewConfiguration();
        original.setDefaultView("default");
        View view = new View();
        view.setName("default");
        view.setRefreshSeconds(300);

        RowDef row = new RowDef();
        row.setLabel("Switches");
        Category cat = new Category();
        cat.setName("Switches");
        row.addCategory(cat);
        view.addRow(row);

        ColumnDef col = new ColumnDef();
        col.setLabel("TEST");
        Category testCat = new Category();
        testCat.setName("Test");
        col.addCategory(testCat);
        view.addColumn(col);

        original.getViews().add(view);

        SurveillanceViewConfigDto dto = SurveillanceViewConfigRestService.toDto(original);
        SurveillanceViewConfiguration roundTripped = SurveillanceViewConfigRestService.fromDto(dto);

        assertEquals("default", roundTripped.getDefaultView());
        assertEquals(1, roundTripped.getViews().size());
        View rt = roundTripped.getViews().get(0);
        assertEquals("default", rt.getName());
        assertEquals(300, rt.getRefreshSeconds());
        assertEquals(1, rt.getRows().size());
        assertEquals("Switches", rt.getRows().get(0).getLabel());
        assertEquals("Switches", rt.getRows().get(0).getCategories().get(0).getName());
        assertEquals(1, rt.getColumns().size());
        assertEquals("TEST", rt.getColumns().get(0).getLabel());
    }

    @Test
    public void fromDtoHandlesEmptyViews() {
        SurveillanceViewConfigDto dto = new SurveillanceViewConfigDto();
        dto.setDefaultView("");
        dto.setViews(List.of());

        SurveillanceViewConfiguration config = SurveillanceViewConfigRestService.fromDto(dto);

        assertNotNull(config);
        assertTrue(config.getViews().isEmpty());
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail (class not found)**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=SurveillanceViewConfigRestServiceTest -pl . 2>&1 | tail -20
```

Expected: compilation error — `SurveillanceViewConfigRestService` does not exist yet.

---

## Task 3: Implement the REST resource

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestService.java`

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
import org.opennms.core.xml.JaxbUtils;
import org.opennms.netmgt.config.surveillanceViews.Category;
import org.opennms.netmgt.config.surveillanceViews.ColumnDef;
import org.opennms.netmgt.config.surveillanceViews.RowDef;
import org.opennms.netmgt.config.surveillanceViews.SurveillanceViewConfiguration;
import org.opennms.netmgt.config.surveillanceViews.View;
import org.opennms.web.api.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("surveillance-view-config")
@Tag(name = "SurveillanceViewConfig", description = "Surveillance View Configuration API")
public class SurveillanceViewConfigRestService {

    private static final Logger LOG = LoggerFactory.getLogger(SurveillanceViewConfigRestService.class);

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get surveillance view configuration", operationId = "getSurveillanceViewConfig")
    public Response getConfig(@Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        try {
            File cfgFile = getConfigFile();
            SurveillanceViewConfiguration config;
            if (!cfgFile.exists()) {
                config = new SurveillanceViewConfiguration();
            } else {
                config = JaxbUtils.unmarshal(SurveillanceViewConfiguration.class, cfgFile);
            }
            return Response.ok(toDto(config)).build();
        } catch (Exception e) {
            LOG.error("Failed to read surveillance view configuration", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Replace surveillance view configuration", operationId = "putSurveillanceViewConfig")
    public Response putConfig(SurveillanceViewConfigDto dto, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (dto == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "Request body required")).build();
        }
        String defaultView = dto.getDefaultView();
        if (defaultView != null && !defaultView.isEmpty()) {
            boolean found = dto.getViews().stream().anyMatch(v -> defaultView.equals(v.getName()));
            if (!found) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("error", "defaultView '" + defaultView + "' does not match any view name")).build();
            }
        }
        try {
            File cfgFile = getConfigFile();
            JaxbUtils.marshal(fromDto(dto), cfgFile);
            LOG.info("Saved surveillance view configuration to {}", cfgFile);
            return Response.noContent().build();
        } catch (IOException e) {
            LOG.error("Failed to write surveillance view configuration", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    static File getConfigFile() {
        return Paths.get(System.getProperty("opennms.home", "/opt/opennms"), "etc", "surveillance-views.xml").toFile();
    }

    /** Visible for testing. */
    public static SurveillanceViewConfigDto toDto(SurveillanceViewConfiguration config) {
        SurveillanceViewConfigDto dto = new SurveillanceViewConfigDto();
        dto.setDefaultView(config.getDefaultView() != null ? config.getDefaultView() : "");
        List<ViewDto> viewDtos = new ArrayList<>();
        for (View view : config.getViews()) {
            ViewDto vDto = new ViewDto();
            vDto.setName(view.getName());
            vDto.setRefreshSeconds(view.getRefreshSeconds());
            vDto.setRows(view.getRows().stream()
                    .map(SurveillanceViewConfigRestService::rowToDto)
                    .collect(Collectors.toList()));
            vDto.setColumns(view.getColumns().stream()
                    .map(SurveillanceViewConfigRestService::colToDto)
                    .collect(Collectors.toList()));
            viewDtos.add(vDto);
        }
        dto.setViews(viewDtos);
        return dto;
    }

    /** Visible for testing. */
    public static SurveillanceViewConfiguration fromDto(SurveillanceViewConfigDto dto) {
        SurveillanceViewConfiguration config = new SurveillanceViewConfiguration();
        config.setDefaultView(dto.getDefaultView());
        for (ViewDto vDto : dto.getViews()) {
            View view = new View();
            view.setName(vDto.getName());
            view.setRefreshSeconds(vDto.getRefreshSeconds());
            for (RowOrColumnDto rowDto : vDto.getRows()) {
                RowDef row = new RowDef();
                row.setLabel(rowDto.getLabel());
                for (String catName : rowDto.getCategories()) {
                    Category cat = new Category();
                    cat.setName(catName);
                    row.addCategory(cat);
                }
                view.addRow(row);
            }
            for (RowOrColumnDto colDto : vDto.getColumns()) {
                ColumnDef col = new ColumnDef();
                col.setLabel(colDto.getLabel());
                for (String catName : colDto.getCategories()) {
                    Category cat = new Category();
                    cat.setName(catName);
                    col.addCategory(cat);
                }
                view.addColumn(col);
            }
            config.getViews().add(view);
        }
        return config;
    }

    private static RowOrColumnDto rowToDto(RowDef row) {
        RowOrColumnDto dto = new RowOrColumnDto();
        dto.setLabel(row.getLabel());
        dto.setCategories(row.getCategories().stream()
                .map(Category::getName).collect(Collectors.toList()));
        return dto;
    }

    private static RowOrColumnDto colToDto(ColumnDef col) {
        RowOrColumnDto dto = new RowOrColumnDto();
        dto.setLabel(col.getLabel());
        dto.setCategories(col.getCategories().stream()
                .map(Category::getName).collect(Collectors.toList()));
        return dto;
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public static class SurveillanceViewConfigDto {
        private String defaultView = "";
        private List<ViewDto> views = new ArrayList<>();

        @JsonProperty("defaultView")
        public String getDefaultView() { return defaultView; }
        public void setDefaultView(String v) { this.defaultView = v; }

        public List<ViewDto> getViews() { return views; }
        public void setViews(List<ViewDto> v) { this.views = v; }
    }

    public static class ViewDto {
        private String name = "";
        private int refreshSeconds = 300;
        private List<RowOrColumnDto> rows = new ArrayList<>();
        private List<RowOrColumnDto> columns = new ArrayList<>();

        public String getName() { return name; }
        public void setName(String v) { this.name = v; }
        public int getRefreshSeconds() { return refreshSeconds; }
        public void setRefreshSeconds(int v) { this.refreshSeconds = v; }
        public List<RowOrColumnDto> getRows() { return rows; }
        public void setRows(List<RowOrColumnDto> v) { this.rows = v; }
        public List<RowOrColumnDto> getColumns() { return columns; }
        public void setColumns(List<RowOrColumnDto> v) { this.columns = v; }
    }

    public static class RowOrColumnDto {
        private String label = "";
        private List<String> categories = new ArrayList<>();

        public String getLabel() { return label; }
        public void setLabel(String v) { this.label = v; }
        public List<String> getCategories() { return categories; }
        public void setCategories(List<String> v) { this.categories = v; }
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
cd /Users/chance/git/opennms/opennms-webapp-rest
../../maven/bin/mvn test -Dtest=SurveillanceViewConfigRestServiceTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestService.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/SurveillanceViewConfigRestServiceTest.java
git commit -m "feat(surveillance-views): add GET/PUT REST resource for surveillance-view-config"
```

---

## Task 4: TypeScript service

**Files:**
- Create: `ui/src/services/surveillanceViewConfigService.ts`

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

export interface SurveillanceViewRowOrColumn {
  label: string
  categories: string[]
}

export interface SurveillanceView {
  name: string
  refreshSeconds: number
  rows: SurveillanceViewRowOrColumn[]
  columns: SurveillanceViewRowOrColumn[]
}

export interface SurveillanceViewConfig {
  defaultView: string
  views: SurveillanceView[]
}

const BASE = 'surveillance-view-config'

export const getConfig = async (): Promise<SurveillanceViewConfig> => {
  const resp = await v2.get<SurveillanceViewConfig>(BASE)
  return resp.data
}

export const saveConfig = async (config: SurveillanceViewConfig): Promise<void> => {
  await v2.put(BASE, config)
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/services/surveillanceViewConfigService.ts
git commit -m "feat(surveillance-views): add Vue service for surveillance-view-config API"
```

---

## Task 5: SurveillanceViewList component

**Files:**
- Create: `ui/src/components/SurveillanceViewsConfig/SurveillanceViewList.vue`

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
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="view-list">
    <div class="view-list-header">
      <span class="list-label">Views</span>
      <FeatherButton icon text @click="$emit('add')" :disabled="disabled">
        <FeatherIcon :icon="AddIcon" />
      </FeatherButton>
    </div>

    <div
      v-for="(view, i) in views"
      :key="view.name + i"
      class="view-item"
      :class="{ selected: i === selectedIndex }"
      @click="$emit('select', i)"
    >
      <span class="view-name">{{ view.name || '(unnamed)' }}</span>
      <span v-if="view.name === defaultView" class="default-badge">default</span>
      <FeatherButton icon text class="delete-btn" @click.stop="$emit('delete', i)" :disabled="disabled">
        <FeatherIcon :icon="DeleteIcon" />
      </FeatherButton>
    </div>

    <div v-if="views.length === 0" class="empty-state">No views configured.</div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherIcon } from '@featherds/icon'
import Add from '@featherds/icon/navigation/Add'
import Delete from '@featherds/icon/action/Delete'
import type { SurveillanceView } from '@/services/surveillanceViewConfigService'

defineProps<{
  views: SurveillanceView[]
  selectedIndex: number
  defaultView: string
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

.view-list {
  border-right: 1px solid var($border-on-surface);
  min-width: 200px;
  display: flex;
  flex-direction: column;
}

.view-list-header {
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

.view-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var($surface-dark);
  }

  &.selected {
    background: var($surface-dark);
    border-left: 3px solid var($primary);
  }

  .delete-btn {
    margin-left: auto;
    opacity: 0;
  }

  &:hover .delete-btn {
    opacity: 1;
  }
}

.view-name {
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

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/SurveillanceViewsConfig/SurveillanceViewList.vue
git commit -m "feat(surveillance-views): add SurveillanceViewList component"
```

---

## Task 6: SurveillanceViewRowColumnEditor component

**Files:**
- Create: `ui/src/components/SurveillanceViewsConfig/SurveillanceViewRowColumnEditor.vue`

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
  <div class="rowcol-editor">
    <div class="section-header">
      <span class="section-title">{{ title }}</span>
      <FeatherButton text @click="addItem">+ Add</FeatherButton>
    </div>

    <div v-if="localItems.length === 0" class="empty-state">
      No {{ title.toLowerCase() }} defined.
    </div>

    <div v-for="(item, i) in localItems" :key="i" class="item-row">
      <FeatherInput
        v-model="item.label"
        :label="title.slice(0, -1) + ' Label'"
        class="label-input"
        @update:modelValue="emitUpdate"
      />
      <div class="categories-section">
        <div class="category-chips">
          <span
            v-for="(cat, ci) in item.categories"
            :key="ci"
            class="category-chip"
          >
            {{ cat }}
            <button class="chip-remove" @click="removeCategory(i, ci)">×</button>
          </span>
        </div>
        <select class="category-select" @change="(e) => addCategory(i, (e.target as HTMLSelectElement).value, e)">
          <option value="">+ Add category…</option>
          <option
            v-for="cat in availableCategories(i)"
            :key="cat"
            :value="cat"
          >{{ cat }}</option>
        </select>
      </div>
      <FeatherButton icon text @click="removeItem(i)">
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
import type { SurveillanceViewRowOrColumn } from '@/services/surveillanceViewConfigService'

const props = defineProps<{
  title: string
  modelValue: SurveillanceViewRowOrColumn[]
  allCategories: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: SurveillanceViewRowOrColumn[]): void
}>()

const DeleteIcon = Delete

const localItems = ref<SurveillanceViewRowOrColumn[]>(
  JSON.parse(JSON.stringify(props.modelValue))
)

watch(() => props.modelValue, (v) => {
  localItems.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(localItems.value)))

const addItem = () => {
  localItems.value.push({ label: '', categories: [] })
  emitUpdate()
}

const removeItem = (i: number) => {
  localItems.value.splice(i, 1)
  emitUpdate()
}

const addCategory = (itemIndex: number, catName: string, event: Event) => {
  if (!catName) return
  const item = localItems.value[itemIndex]
  if (!item.categories.includes(catName)) {
    item.categories.push(catName)
    emitUpdate()
  }
  // Reset the select
  ;(event.target as HTMLSelectElement).value = ''
}

const removeCategory = (itemIndex: number, catIndex: number) => {
  localItems.value[itemIndex].categories.splice(catIndex, 1)
  emitUpdate()
}

const availableCategories = (itemIndex: number) =>
  props.allCategories.filter(c => !localItems.value[itemIndex].categories.includes(c))
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.rowcol-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.section-title {
  @include typo.subtitle1();
}

.empty-state {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
}

.label-input {
  width: 160px;
  flex-shrink: 0;
}

.categories-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-height: 1.5rem;
}

.category-chip {
  @include typo.caption();
  background: var($surface-dark);
  border: 1px solid var($border-on-surface);
  border-radius: 0.75rem;
  padding: 0.1rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var($secondary-text-on-surface);
  padding: 0;
  line-height: 1;
  font-size: 1rem;

  &:hover {
    color: var($error);
  }
}

.category-select {
  @include typo.body-small();
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  background: var($surface);
  color: var($primary-text-on-surface);
  cursor: pointer;
  max-width: 200px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/SurveillanceViewsConfig/SurveillanceViewRowColumnEditor.vue
git commit -m "feat(surveillance-views): add SurveillanceViewRowColumnEditor component"
```

---

## Task 7: SurveillanceViewEditor component

**Files:**
- Create: `ui/src/components/SurveillanceViewsConfig/SurveillanceViewEditor.vue`

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
  <div class="view-editor">
    <div class="editor-toolbar">
      <FeatherInput v-model="localView.name" label="View Name" class="name-input" @update:modelValue="emitUpdate" />
      <FeatherInput
        :modelValue="String(localView.refreshSeconds)"
        label="Refresh (seconds)"
        type="number"
        class="refresh-input"
        @update:modelValue="(v) => { localView.refreshSeconds = Number(v) || 300; emitUpdate() }"
      />
      <FeatherButton
        v-if="!isDefault"
        text
        @click="$emit('setDefault')"
      >Set as Default</FeatherButton>
      <span v-else class="default-label">Default view</span>
    </div>

    <div class="editors-row">
      <div class="editor-section">
        <SurveillanceViewRowColumnEditor
          title="Rows"
          v-model="localView.rows"
          :allCategories="allCategories"
          @update:modelValue="emitUpdate"
        />
      </div>
      <div class="editor-section">
        <SurveillanceViewRowColumnEditor
          title="Columns"
          v-model="localView.columns"
          :allCategories="allCategories"
          @update:modelValue="emitUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import SurveillanceViewRowColumnEditor from './SurveillanceViewRowColumnEditor.vue'
import type { SurveillanceView } from '@/services/surveillanceViewConfigService'

const props = defineProps<{
  modelValue: SurveillanceView
  isDefault: boolean
  allCategories: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: SurveillanceView): void
  (e: 'setDefault'): void
}>()

const localView = ref<SurveillanceView>(JSON.parse(JSON.stringify(props.modelValue)))

watch(() => props.modelValue, (v) => {
  localView.value = JSON.parse(JSON.stringify(v))
}, { deep: true })

const emitUpdate = () => emit('update:modelValue', JSON.parse(JSON.stringify(localView.value)))
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.view-editor {
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
  gap: 1rem;
  flex-wrap: wrap;
}

.name-input {
  width: 220px;
}

.refresh-input {
  width: 140px;
}

.default-label {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  padding-bottom: 0.5rem;
}

.editors-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.editor-section {
  flex: 1;
  min-width: 260px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/SurveillanceViewsConfig/SurveillanceViewEditor.vue
git commit -m "feat(surveillance-views): add SurveillanceViewEditor component"
```

---

## Task 8: Container, router, and JSP redirect

**Files:**
- Create: `ui/src/containers/SurveillanceViewsConfig.vue`
- Modify: `ui/src/main/router/index.ts`
- Modify: `opennms-webapp/src/main/webapp/admin/surveillanceViewsConfig.jsp`

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
  <div class="surveillance-views-config">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">Surveillance Views Configuration</h1>

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
        <SurveillanceViewList
          :views="config.views"
          :selectedIndex="selectedIndex"
          :defaultView="config.defaultView"
          :disabled="saving"
          @select="selectedIndex = $event"
          @add="addView"
          @delete="deleteView"
        />

        <SurveillanceViewEditor
          v-if="selectedView"
          :modelValue="selectedView"
          :isDefault="selectedView.name === config.defaultView"
          :allCategories="allCategories"
          @update:modelValue="updateSelectedView"
          @setDefault="config.defaultView = selectedView?.name ?? ''"
        />

        <div v-else class="no-selection">
          <p>Select a view to edit, or create a new one.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SurveillanceViewList from '@/components/SurveillanceViewsConfig/SurveillanceViewList.vue'
import SurveillanceViewEditor from '@/components/SurveillanceViewsConfig/SurveillanceViewEditor.vue'
import { getConfig, saveConfig } from '@/services/surveillanceViewConfigService'
import type { SurveillanceViewConfig, SurveillanceView } from '@/services/surveillanceViewConfigService'
import { v2 } from '@/services/axiosInstances'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'Surveillance Views Configuration', to: '/surveillance-views-config' }
]

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const config = ref<SurveillanceViewConfig>({ defaultView: '', views: [] })
const savedSnapshot = ref<string>('')
const selectedIndex = ref(0)
const allCategories = ref<string[]>([])

const isDirty = computed(() => JSON.stringify(config.value) !== savedSnapshot.value)
const selectedView = computed(() => config.value.views[selectedIndex.value] ?? null)

const loadData = async () => {
  loading.value = true
  loadError.value = null
  try {
    const [cfg, catResp] = await Promise.all([
      getConfig(),
      v2.get('/categories').catch(() => ({ data: { category: [] } }))
    ])
    config.value = cfg
    savedSnapshot.value = JSON.stringify(cfg)
    allCategories.value = (catResp.data?.category ?? []).map((c: any) => c.name as string).sort()
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
    showSnackBar({ msg: 'Surveillance view configuration saved.' })
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

const addView = () => {
  const newView: SurveillanceView = {
    name: `view-${config.value.views.length + 1}`,
    refreshSeconds: 300,
    rows: [],
    columns: []
  }
  config.value.views.push(newView)
  selectedIndex.value = config.value.views.length - 1
}

const deleteView = (i: number) => {
  const deleted = config.value.views[i]
  config.value.views.splice(i, 1)
  if (deleted.name === config.value.defaultView) {
    config.value.defaultView = ''
  }
  selectedIndex.value = Math.min(selectedIndex.value, config.value.views.length - 1)
}

const updateSelectedView = (updated: SurveillanceView) => {
  config.value.views[selectedIndex.value] = updated
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
@use "@featherds/styles/mixins/typography" as typo;
@import "@featherds/styles/themes/variables";

.surveillance-views-config {
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

Open `ui/src/main/router/index.ts`. After the existing jmx-config-generator route block, add:

```ts
{
  path: '/surveillance-views-config',
  name: 'Surveillance Views Config',
  component: () => import('@/containers/SurveillanceViewsConfig.vue')
},
```

- [ ] **Step 3: Update the JSP**

Replace the entire content of `opennms-webapp/src/main/webapp/admin/surveillanceViewsConfig.jsp` with:

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
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/surveillance-views-config"); %>
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/SurveillanceViewsConfig.vue \
        ui/src/main/router/index.ts \
        opennms-webapp/src/main/webapp/admin/surveillanceViewsConfig.jsp
git commit -m "feat(surveillance-views): add Vue container, route, and JSP redirect"
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

- [ ] **Step 3: Verify no bare CSS variable references**

```bash
grep -c 'var($' src/main/dist/index.html || true
grep --include="*.css" -r 'var(\$' src/main/dist/assets/ | wc -l
```

Expected: 0 for the second command (no bare `var($…)` in built CSS).

- [ ] **Step 4: Check container is running**

```bash
podman ps --filter name=test-opennms --format "{{.Status}}"
```

Expected: `Up …`. If empty, start with:
```bash
podman start test-opennms && sleep 20
```

- [ ] **Step 5: Deploy**

```bash
cd /Users/chance/git/opennms/ui
./deploy-to-container.sh test-opennms 2>&1 | tail -5
```

- [ ] **Step 6: Verify live hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' src/main/dist/index.html
```

Both lines must be identical.

- [ ] **Step 7: Verify HTTP 200**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```

Expected: `200`.

- [ ] **Step 8: Manual verification**

Navigate to `http://localhost:8980/opennms/admin/surveillanceViewsConfig.jsp` — should redirect to the Vue SPA. Verify:
- Views list loads without errors
- Adding a view, setting name/refresh, adding rows/columns with categories works
- Save succeeds (snackbar appears)
- Navigating to `http://localhost:8980/opennms/surveillance-view.jsp` still works (not broken)

Tell user to hard-refresh (`Cmd+Shift+R`).
