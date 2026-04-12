# Topology View Persistence + Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist named topology views server-side as YAML files, support loading/saving from a Views dropdown in the toolbar, and allow tech leads to suppress vertices/edges from a view via an explicit edit mode.

**Architecture:** New `TopologyViewRestService.java` (JAX-RS, file I/O, jackson-dataformat-yaml, scoped directories under `etc/topology-views/`). Frontend: typed `TopologyViewState`, real REST service calls, extended Pinia store, Views toolbar dropdown, LoadViewModal, edit mode banner, suppression context menu in Cytoscape.

**Tech Stack:** Java 17, JAX-RS (CXF), Jackson YAML. Vue 3, TypeScript, Pinia, Cytoscape.js `cytoscape-cxtmenu`. Build backend with `./build-dark-mode-overlay.sh`, frontend with `yarn build` + `./ui/deploy-to-container.sh`.

---

## File Map

| File | Change |
|------|--------|
| `ui/src/types/topology.ts` | Replace `data: string` with typed `TopologyViewState`; update `TopologyView.scope` |
| `ui/src/services/topologyViewService.ts` | Replace stubs with real `rest` axios calls |
| `ui/src/stores/topologyViewStore.ts` | Add server views, active view, view layout, suppression state, edit mode |
| `ui/src/composables/useTopology.ts` | Suppression CSS classes; suppression in `syncElements`; edit mode context menu; expose `getPositions` |
| `ui/src/components/Topology/TopologyToolbar.vue` | Views dropdown (Load, Save, Save as New, Edit) |
| `ui/src/components/Topology/TopologyGraph.vue` | Edit mode banner; expose `getPositions`; handle save-view events |
| `ui/src/components/Topology/LoadViewModal.vue` | New — lists views grouped by scope, load/delete actions |
| `ui/src/components/Topology/SaveViewModal.vue` | New — name + scope form for saving new views |
| `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v1/TopologyViewRestService.java` | New JAX-RS resource |

---

## Task 1: Update TypeScript types

**Files:**
- Modify: `ui/src/types/topology.ts`

- [ ] **Step 1: Replace `TopologyView` with typed state**

In `types/topology.ts`, replace the existing `TopologyView` interface (around line 88):
```typescript
export interface TopologyView {
  id: string
  name: string
  description?: string
  scope: 'private' | 'user' | 'shared' | 'global'
  owner?: string
  data: string  // JSON-serialized view state
}
```
With:
```typescript
export interface TopologyViewState {
  layers: string[]
  filters: {
    surveillanceCategories: string[]
    cidrs: string[]
    namePattern: string
  }
  layout: Record<string, { x: number; y: number }>
  suppressed: {
    vertices: string[]
    edges: string[]
  }
  edgeColorMode: 'protocol' | 'utilization' | 'capacity'
  edgeLabels: {
    showUtilization: boolean
    showLocalPort: boolean
    showRemotePort: boolean
    showIp: boolean
    showMac: boolean
    showSpeed: boolean
  }
}

export interface TopologyView {
  id: string
  name: string
  description?: string
  scope: 'private' | 'shared' | 'global'
  owner?: string
  created?: string
  updated?: string
  state: TopologyViewState
}
```

- [ ] **Step 2: Build to find type breakages**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error TS" | head -30
```

Any errors referencing `TopologyView.data` or `TopologyView.scope` (old `'user'` value) need fixing. The main location is `topologyViewStore.ts` — the `privateViews` + `addPrivateView` + `deletePrivateView` functions reference the old type. Those are replaced in Task 3, so TypeScript errors there are expected. Note them but do not fix them yet.

- [ ] **Step 3: Commit**

```bash
git add ui/src/types/topology.ts
git commit -m "feat(topology): typed TopologyViewState — replace data:string blob"
```

---

## Task 2: Replace topology view service stubs

**Files:**
- Modify: `ui/src/services/topologyViewService.ts`

The REST endpoint lives under `/opennms/rest/topology/views`. Use the `rest` axios instance (baseURL `/opennms/rest`, `withCredentials: true`).

- [ ] **Step 1: Replace the stub file entirely**

```typescript
import { rest } from './axiosInstances'
import type { TopologyView, TopologyViewState } from '@/types/topology'

export const getViews = async (): Promise<TopologyView[]> => {
  try {
    const res = await rest.get<TopologyView[]>('/topology/views')
    return res.data ?? []
  } catch {
    return []
  }
}

export const getView = async (id: string): Promise<TopologyView | null> => {
  try {
    const res = await rest.get<TopologyView>(`/topology/views/${id}`)
    return res.data
  } catch {
    return null
  }
}

export const createView = async (
  view: Omit<TopologyView, 'id' | 'created' | 'updated'>
): Promise<TopologyView> => {
  const res = await rest.post<TopologyView>('/topology/views', view)
  return res.data
}

export const updateView = async (id: string, view: TopologyView): Promise<TopologyView> => {
  const res = await rest.put<TopologyView>(`/topology/views/${id}`, view)
  return res.data
}

export const deleteView = async (id: string): Promise<void> => {
  await rest.delete(`/topology/views/${id}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/services/topologyViewService.ts
git commit -m "feat(topology): replace view service stubs with real REST calls"
```

---

## Task 3: Extend topologyViewStore

**Files:**
- Modify: `ui/src/stores/topologyViewStore.ts`

Replace the entire store. The `privateViews` localStorage mechanism is removed (private views now live server-side). All other existing state (gridSnap, filters, icon maps, etc.) is preserved.

- [ ] **Step 1: Rewrite topologyViewStore.ts**

```typescript
import { defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import type { IconMapping, TopologyView, TopologyViewState } from '@/types/topology'
import { getViews, createView, updateView, deleteView as deleteViewApi } from '@/services/topologyViewService'

const LS_KEY_FILTERS = 'topology:filter:defaults'

function loadFilterDefaults() {
  try {
    const raw = localStorage.getItem(LS_KEY_FILTERS)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useTopologyViewStore = defineStore('topologyView', () => {
  // Grid snap
  const gridSnap = reactive({ enabled: false, size: 40 })

  // Filters
  const savedDefaults = loadFilterDefaults()
  const filters = reactive({
    surveillanceCategories: (savedDefaults?.surveillanceCategories ?? []) as string[],
    cidrs: (savedDefaults?.cidrs ?? []) as string[],
    namePattern: (savedDefaults?.namePattern ?? '') as string,
  })

  // Icon mappings
  const categoryIconMap = ref<IconMapping[]>([])
  const oidIconMap      = ref<IconMapping[]>([])
  const lagPrefixPatterns = ref<string[]>(['Po', 'ae', 'bond', 'Bundle-Ether', 'LAG'])

  // Dirty flag
  const isDirty = ref(false)
  const markDirty = () => { isDirty.value = true }
  const clearDirty = () => { isDirty.value = false }

  const saveFilterDefaults = () => {
    try {
      localStorage.setItem(LS_KEY_FILTERS, JSON.stringify({
        surveillanceCategories: filters.surveillanceCategories,
        cidrs: filters.cidrs,
        namePattern: filters.namePattern,
      }))
    } catch { /* ignore */ }
  }

  const clearFilterDefaults = () => {
    try { localStorage.removeItem(LS_KEY_FILTERS) } catch { /* ignore */ }
    filters.surveillanceCategories = []
    filters.cidrs = []
    filters.namePattern = ''
    markDirty()
  }

  // Server-side views
  const serverViews = ref<TopologyView[]>([])
  const activeView  = ref<TopologyView | null>(null)
  const viewsLoading = ref(false)
  const viewsError   = ref<string | null>(null)

  // Layout from the loaded view — useTopology.ts reads this to apply positions
  const viewLayout = ref<Record<string, { x: number; y: number }>>({})

  // Suppression: what's currently hidden from the loaded view
  const suppressedVertices = ref<string[]>([])
  const suppressedEdges    = ref<string[]>([])

  // Edit mode working copies (pending changes not yet saved)
  const editMode            = ref(false)
  const editPendingVertices = ref<string[]>([])
  const editPendingEdges    = ref<string[]>([])

  const fetchServerViews = async () => {
    viewsLoading.value = true
    viewsError.value   = null
    try {
      serverViews.value = await getViews()
    } catch {
      viewsError.value = 'Failed to load views from server'
    } finally {
      viewsLoading.value = false
    }
  }

  /**
   * Apply a loaded view's state to the store.
   * Caller is responsible for applying layers/filters/edgeLabels to the
   * relevant stores (topologyStore, edgeLabelStore) after calling this.
   */
  const applyView = (view: TopologyView) => {
    activeView.value        = view
    viewLayout.value        = { ...view.state.layout }
    suppressedVertices.value = [...view.state.suppressed.vertices]
    suppressedEdges.value   = [...view.state.suppressed.edges]
    editMode.value          = false
    editPendingVertices.value = []
    editPendingEdges.value    = []
    clearDirty()
  }

  const saveView = async (state: TopologyViewState) => {
    if (!activeView.value) return
    const updated: TopologyView = { ...activeView.value, state }
    const result = await updateView(activeView.value.id, updated)
    activeView.value         = result
    viewLayout.value         = { ...state.layout }
    suppressedVertices.value = [...state.suppressed.vertices]
    suppressedEdges.value    = [...state.suppressed.edges]
    editMode.value           = false
    editPendingVertices.value = []
    editPendingEdges.value    = []
    clearDirty()
    await fetchServerViews()
  }

  const saveNewView = async (
    name: string,
    scope: 'private' | 'shared' | 'global',
    state: TopologyViewState,
    description?: string
  ): Promise<TopologyView> => {
    const result = await createView({ name, scope, description, state })
    activeView.value         = result
    viewLayout.value         = { ...state.layout }
    suppressedVertices.value = [...state.suppressed.vertices]
    suppressedEdges.value    = [...state.suppressed.edges]
    clearDirty()
    await fetchServerViews()
    return result
  }

  const deleteServerView = async (id: string) => {
    await deleteViewApi(id)
    if (activeView.value?.id === id) {
      activeView.value         = null
      viewLayout.value         = {}
      suppressedVertices.value = []
      suppressedEdges.value    = []
    }
    await fetchServerViews()
  }

  const enterEditMode = () => {
    if (!activeView.value) return
    editMode.value            = true
    editPendingVertices.value = [...suppressedVertices.value]
    editPendingEdges.value    = [...suppressedEdges.value]
  }

  const discardEditMode = () => {
    editMode.value            = false
    editPendingVertices.value = []
    editPendingEdges.value    = []
  }

  const toggleSuppression = (id: string, type: 'vertex' | 'edge') => {
    if (!editMode.value) return
    const list = type === 'vertex' ? editPendingVertices : editPendingEdges
    const idx = list.value.indexOf(id)
    if (idx >= 0) list.value.splice(idx, 1)
    else list.value.push(id)
  }

  return {
    gridSnap, filters, categoryIconMap, oidIconMap, lagPrefixPatterns,
    isDirty, markDirty, clearDirty, saveFilterDefaults, clearFilterDefaults,
    serverViews, activeView, viewsLoading, viewsError, viewLayout,
    suppressedVertices, suppressedEdges,
    editMode, editPendingVertices, editPendingEdges,
    fetchServerViews, applyView, saveView, saveNewView, deleteServerView,
    enterEditMode, discardEditMode, toggleSuppression,
  }
})
```

- [ ] **Step 2: Build to find remaining type errors**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error TS" | head -30
```

Fix any errors from callers of the old `privateViews`, `addPrivateView`, `deletePrivateView` — those references should be removed (they were in `TopologyToolbar.vue` or similar; check and delete the dead code).

- [ ] **Step 3: Commit**

```bash
git add ui/src/stores/topologyViewStore.ts
git commit -m "feat(topology): extend view store — server views, edit mode, suppression state"
```

---

## Task 4: Create TopologyViewRestService.java

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v1/TopologyViewRestService.java`

The class uses `@Component` + `@Path` and is auto-discovered via `<context:component-scan base-package="org.opennms.web.rest.v1" />` — no manual registration needed. **No `@Transactional` at class level** (CXF hides `@Path` on CGLIB-proxied classes). All file I/O uses `jackson-dataformat-yaml` (already declared in `opennms-webapp-rest/pom.xml`).

- [ ] **Step 1: Create the REST service**

Create `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v1/TopologyViewRestService.java`:

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
package org.opennms.web.rest.v1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.web.api.Authentication;
import org.springframework.stereotype.Component;

import javax.ws.rs.*;
import javax.ws.rs.core.*;
import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.stream.*;

@Component("topologyViewRestService")
@Path("topology/views")
@Tag(name = "Topology Views", description = "Named topology view persistence API")
public class TopologyViewRestService {

    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    private static final YAMLMapper   YAML_MAPPER  = new YAMLMapper();

    // Base directory: $OPENNMS_HOME/etc/topology-views/
    private static Path viewsDir() {
        final String home = System.getProperty("opennms.home", "/opt/opennms");
        return Paths.get(home, "etc", "topology-views");
    }

    /**
     * Resolve the YAML file for a given view ID by scanning all scope directories.
     * IDs are globally unique across scopes, so the first match wins.
     * Returns null if no file found.
     */
    private static Path resolveFile(final String id) {
        for (final String scope : new String[]{"global", "shared"}) {
            final Path candidate = viewsDir().resolve(scope).resolve(id + ".yaml");
            if (Files.exists(candidate)) return candidate;
        }
        // private: scan all per-user subdirs
        final Path privateDir = viewsDir().resolve("private");
        if (Files.isDirectory(privateDir)) {
            try (Stream<Path> dirs = Files.list(privateDir)) {
                for (final Path userDir : dirs.collect(Collectors.toList())) {
                    if (!Files.isDirectory(userDir)) continue;
                    final Path candidate = userDir.resolve(id + ".yaml");
                    if (Files.exists(candidate)) return candidate;
                }
            } catch (IOException ignored) { /* fall through */ }
        }
        return null;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response listViews(@Context SecurityContext sec) throws IOException {
        final String username = sec.getUserPrincipal().getName();
        final List<JsonNode> results = new ArrayList<>();

        // global + shared: visible to all authenticated users
        for (final String scope : new String[]{"global", "shared"}) {
            final Path dir = viewsDir().resolve(scope);
            if (!Files.isDirectory(dir)) continue;
            try (Stream<Path> files = Files.list(dir)) {
                files.filter(p -> p.toString().endsWith(".yaml"))
                     .forEach(f -> {
                         final JsonNode node = readYaml(f);
                         if (node != null) results.add(stripState(node));
                     });
            }
        }

        // private: only the caller's own views
        final Path userPrivateDir = viewsDir().resolve("private").resolve(username);
        if (Files.isDirectory(userPrivateDir)) {
            try (Stream<Path> files = Files.list(userPrivateDir)) {
                files.filter(p -> p.toString().endsWith(".yaml"))
                     .forEach(f -> {
                         final JsonNode node = readYaml(f);
                         if (node != null) results.add(stripState(node));
                     });
            }
        }

        return Response.ok(JSON_MAPPER.writeValueAsString(results))
                       .type(MediaType.APPLICATION_JSON)
                       .build();
    }

    @GET
    @Path("/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getView(@PathParam("id") final String id,
                            @Context SecurityContext sec) throws IOException {
        final Path file = resolveFile(id);
        if (file == null) return Response.status(Response.Status.NOT_FOUND).build();
        if (!canRead(file, sec)) return Response.status(Response.Status.FORBIDDEN).build();

        final JsonNode node = readYaml(file);
        if (node == null) return Response.status(Response.Status.NOT_FOUND).build();
        return Response.ok(JSON_MAPPER.writeValueAsString(node))
                       .type(MediaType.APPLICATION_JSON)
                       .build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createView(final String body,
                               @Context SecurityContext sec) throws IOException {
        final JsonNode incoming = JSON_MAPPER.readTree(body);
        if (!incoming.isObject()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Expected JSON object").build();
        }

        final String scope    = incoming.path("scope").asText("private");
        final String username = sec.getUserPrincipal().getName();

        if ("global".equals(scope) && !sec.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN)
                           .entity("ROLE_ADMIN required to create global views")
                           .build();
        }

        final String name = incoming.path("name").asText("Unnamed View");
        final String id   = uniqueSlug(name);
        final Path   file = targetFile(scope, username, id);
        Files.createDirectories(file.getParent());

        final ObjectNode out = incoming.deepCopy();
        out.put("id",      id);
        out.put("owner",   username);
        out.put("created", Instant.now().toString());
        out.put("updated", Instant.now().toString());

        YAML_MAPPER.writeValue(file.toFile(), JSON_MAPPER.treeToValue(out, Object.class));
        return Response.status(Response.Status.CREATED)
                       .entity(JSON_MAPPER.writeValueAsString(out))
                       .type(MediaType.APPLICATION_JSON)
                       .build();
    }

    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateView(@PathParam("id") final String id,
                               final String body,
                               @Context SecurityContext sec) throws IOException {
        final Path file = resolveFile(id);
        if (file == null) return Response.status(Response.Status.NOT_FOUND).build();
        if (!canWrite(file, sec)) return Response.status(Response.Status.FORBIDDEN).build();

        final JsonNode incoming = JSON_MAPPER.readTree(body);
        if (!incoming.isObject()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Expected JSON object").build();
        }

        final ObjectNode out = incoming.deepCopy();
        out.put("id",      id);
        out.put("updated", Instant.now().toString());

        YAML_MAPPER.writeValue(file.toFile(), JSON_MAPPER.treeToValue(out, Object.class));
        return Response.ok(JSON_MAPPER.writeValueAsString(out))
                       .type(MediaType.APPLICATION_JSON)
                       .build();
    }

    @DELETE
    @Path("/{id}")
    public Response deleteView(@PathParam("id") final String id,
                               @Context SecurityContext sec) throws IOException {
        final Path file = resolveFile(id);
        if (file == null) return Response.status(Response.Status.NOT_FOUND).build();
        if (!canWrite(file, sec)) return Response.status(Response.Status.FORBIDDEN).build();
        Files.delete(file);
        return Response.noContent().build();
    }

    // --- helpers ---

    private static JsonNode readYaml(final Path file) {
        try {
            return YAML_MAPPER.readTree(file.toFile());
        } catch (IOException e) {
            return null;
        }
    }

    /** Return a copy of the node without the 'state' blob — for list responses. */
    private static JsonNode stripState(final JsonNode node) {
        final ObjectNode copy = node.deepCopy();
        copy.remove("state");
        return copy;
    }

    /** Resolve target file path for a new view. */
    private static Path targetFile(final String scope, final String username, final String id) {
        return switch (scope) {
            case "global" -> viewsDir().resolve("global").resolve(id + ".yaml");
            case "shared" -> viewsDir().resolve("shared").resolve(id + ".yaml");
            default       -> viewsDir().resolve("private").resolve(username).resolve(id + ".yaml");
        };
    }

    /** Whether the caller can read the given file. Private files: only owner or admin. */
    private static boolean canRead(final Path file, final SecurityContext sec) {
        if (sec.isUserInRole(Authentication.ROLE_ADMIN)) return true;
        final String path = file.toString();
        if (path.contains(File.separator + "private" + File.separator)) {
            final String owner = file.getParent().getFileName().toString();
            return owner.equals(sec.getUserPrincipal().getName());
        }
        return true; // global + shared
    }

    /** Whether the caller can write/delete the given file. */
    private static boolean canWrite(final Path file, final SecurityContext sec) {
        if (sec.isUserInRole(Authentication.ROLE_ADMIN)) return true;
        final String path = file.toString();
        if (path.contains(File.separator + "global" + File.separator)) return false;
        if (path.contains(File.separator + "private" + File.separator)) {
            final String owner = file.getParent().getFileName().toString();
            return owner.equals(sec.getUserPrincipal().getName());
        }
        return true; // shared: any authenticated user
    }

    /**
     * Generate a filesystem-safe slug from a view name, guaranteed globally unique
     * by scanning all scope directories for collisions.
     */
    private static String uniqueSlug(final String name) {
        final String base = name.toLowerCase()
                                .replaceAll("[^a-z0-9]+", "-")
                                .replaceAll("^-|-$", "");
        final String trimmed = base.isEmpty() ? "view" : base.substring(0, Math.min(base.length(), 64));
        String candidate = trimmed;
        int suffix = 1;
        while (resolveFile(candidate) != null) {
            candidate = trimmed + "-" + suffix++;
        }
        return candidate;
    }
}
```

- [ ] **Step 2: Build the backend (full overlay rebuild required for new Java)**

```bash
./build-dark-mode-overlay.sh
```
Expected: BUILD SUCCESS. Check for the class in the overlay jar:
```bash
jar tf container-current.jar | grep TopologyViewRestService
```
Expected: `org/opennms/web/rest/v1/TopologyViewRestService.class`

- [ ] **Step 3: Start a fresh container and smoke-test the endpoint**

```bash
podman rm -f test-opennms && podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms -e OPENNMS_DBUSER=opennms -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
```

Wait for readiness (poll until 200):
```bash
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/info)
  echo "attempt $i: $code"
  [ "$code" = "200" ] && break
  sleep 5
done
```

Test the endpoint (unauthenticated should 401, authenticated should 200):
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/topology/views
# Expected: 401 (no auth)

curl -s -u admin:notdefault -w "\n%{http_code}\n" http://localhost:8980/opennms/rest/topology/views
# Expected: [] (empty JSON array) followed by 200
```

Test create:
```bash
curl -s -u admin:notdefault -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Test View","scope":"private","state":{"layers":[],"filters":{"surveillanceCategories":[],"cidrs":[],"namePattern":""},"layout":{},"suppressed":{"vertices":[],"edges":[]},"edgeColorMode":"utilization","edgeLabels":{"showUtilization":true,"showLocalPort":false,"showRemotePort":false,"showIp":false,"showMac":false,"showSpeed":false}}}' \
  http://localhost:8980/opennms/rest/topology/views
# Expected: JSON with "id" field set, HTTP 201
```

Confirm YAML file was written:
```bash
podman exec test-opennms cat /opt/opennms/etc/topology-views/private/admin/test-view.yaml
```
Expected: valid YAML with all fields.

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v1/TopologyViewRestService.java
git commit -m "feat(topology): server-side view persistence via YAML files (JAX-RS)"
```

---

## Task 5: Add suppression to useTopology.ts

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

Three changes: (1) suppression CSS classes in `buildStylesheet`, (2) apply suppression in `syncElements`, (3) suppression context menu items.

- [ ] **Step 1: Add suppression CSS rules to buildStylesheet**

In `buildStylesheet()`, inside the returned array, add after the `edge.user-defined` selector block:

```typescript
    // Edit mode: suppressed elements shown semi-transparent with dashed border/line
    {
      selector: 'node.element-suppressed',
      css: {
        'opacity': 0.25,
        'border-style': 'dashed',
        'border-width': 2,
        'border-color': cssVar('--feather-error') || '#e53e3e'
      }
    },
    {
      selector: 'edge.element-suppressed',
      css: {
        'opacity': 0.25,
        'line-style': 'dashed',
      }
    },
```

- [ ] **Step 2: Apply suppression in syncElements**

`useTopology.ts` already imports `useTopologyViewStore`. At the end of `syncElements()`, after `applyEdgeLabels()` and `runLayout()`, add:

```typescript
    // Apply loaded-view suppression: remove suppressed elements from the canvas.
    // In edit mode they stay visible but marked with the .element-suppressed CSS class.
    if (!viewStore.editMode) {
      viewStore.suppressedVertices.forEach(id => {
        cy!.getElementById(id).remove()
      })
      viewStore.suppressedEdges.forEach(key => {
        cy!.edges(`[edgeKey="${key}"]`).remove()
      })
    } else {
      updateSuppressionClasses()
    }
```

Add the `updateSuppressionClasses` helper inside the `useTopology` function (before `syncElements`):

```typescript
  const updateSuppressionClasses = () => {
    if (!cy) return
    cy.nodes().forEach(n => {
      if (viewStore.editPendingVertices.includes(n.id())) {
        n.addClass('element-suppressed')
      } else {
        n.removeClass('element-suppressed')
      }
    })
    cy.edges().forEach(e => {
      const key = e.data('edgeKey') as string
      if (viewStore.editPendingEdges.includes(key)) {
        e.addClass('element-suppressed')
      } else {
        e.removeClass('element-suppressed')
      }
    })
  }
```

- [ ] **Step 3: Watch editMode to sync the graph**

After the existing `watch(() => store.linkMode, ...)` block, add:

```typescript
  // When edit mode changes, re-sync elements so suppression is applied or lifted
  watch(() => viewStore.editMode, () => {
    syncElements()
  })
```

- [ ] **Step 4: Update the node context menu to use dynamic commands**

Replace the existing `cy.cxtmenu` call for nodes with the function form:

```typescript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cy as any).cxtmenu({
      selector: 'node',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      commands: (ele: any) => {
        const cmds: object[] = [
          {
            content: 'Create Link',
            select: (el: cytoscape.SingularElementReturnValue) => {
              const vertex = store.vertices.find(v => v.id === el.id())
              if (vertex) store.startLinkMode(vertex)
            }
          }
        ]
        if (viewStore.editMode) {
          const isSuppressed = viewStore.editPendingVertices.includes(ele.id())
          cmds.push({
            content: isSuppressed ? 'Restore from view' : 'Hide from view',
            select: (el: cytoscape.SingularElementReturnValue) => {
              viewStore.toggleSuppression(el.id(), 'vertex')
              updateSuppressionClasses()
            }
          })
        }
        return cmds
      },
      fillColor: cssVar('--feather-surface') || '#1e1e2e',
      activeFillColor: cssVar('--feather-primary') || '#1f78c1',
      activePadding: 10,
      indicatorSize: 14,
      separatorWidth: 3,
      spotlightPadding: 4,
      adaptativeNodeSpotlightRadius: true,
      minSpotlightRadius: 20,
      maxSpotlightRadius: 38,
      itemTextShadowColor: 'transparent'
    })
```

After the node cxtmenu, add an edge context menu:

```typescript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cy as any).cxtmenu({
      selector: 'edge',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      commands: (ele: any) => {
        if (!viewStore.editMode) return []
        const edgeKey = ele.data('edgeKey') as string
        const isSuppressed = viewStore.editPendingEdges.includes(edgeKey)
        return [{
          content: isSuppressed ? 'Restore from view' : 'Hide from view',
          select: (el: cytoscape.SingularElementReturnValue) => {
            viewStore.toggleSuppression(el.data('edgeKey') as string, 'edge')
            updateSuppressionClasses()
          }
        }]
      },
      fillColor: cssVar('--feather-surface') || '#1e1e2e',
      activeFillColor: cssVar('--feather-primary') || '#1f78c1',
      activePadding: 10,
      indicatorSize: 14,
      separatorWidth: 3,
      spotlightPadding: 4,
      adaptativeNodeSpotlightRadius: true,
      minSpotlightRadius: 20,
      maxSpotlightRadius: 38,
      itemTextShadowColor: 'transparent'
    })
```

- [ ] **Step 5: Expose `getPositions` from the composable return value**

Add to the return statement at the bottom of `useTopology`:
```typescript
  const getPositions = (): Record<string, { x: number; y: number }> => {
    const positions: Record<string, { x: number; y: number }> = {}
    cy?.nodes().forEach(n => { positions[n.id()] = { ...n.position() } })
    return positions
  }

  return { getCy: () => cy, saveLayout, resetLayout, toggleGrid, alignToGrid,
           pendingLinkSource, pendingLinkTarget, edgeTooltip, nodeTooltip,
           getPositions }
```

- [ ] **Step 6: Expose `getPositions` from TopologyGraph.vue**

In `TopologyGraph.vue`, update the destructuring and `defineExpose`:
```typescript
const { saveLayout, resetLayout, toggleGrid, alignToGrid, pendingLinkSource,
        pendingLinkTarget, edgeTooltip, nodeTooltip, getPositions } = useTopology(graphContainer)
```
```typescript
defineExpose({ saveLayout, resetLayout, toggleGrid, alignToGrid, getPositions })
```

- [ ] **Step 7: Commit**

```bash
git add ui/src/composables/useTopology.ts ui/src/components/Topology/TopologyGraph.vue
git commit -m "feat(topology): suppression CSS, syncElements suppression, edit mode context menu"
```

---

## Task 6: Create LoadViewModal.vue and SaveViewModal.vue

**Files:**
- Create: `ui/src/components/Topology/LoadViewModal.vue`
- Create: `ui/src/components/Topology/SaveViewModal.vue`

- [ ] **Step 1: Create LoadViewModal.vue**

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
  <div v-if="visible" class="lv-modal-backdrop" @click.self="emit('close')">
    <div class="lv-modal">
      <div class="lv-modal__header">
        <span>Load View</span>
        <button class="lv-modal__close" @click="emit('close')">✕</button>
      </div>

      <div v-if="viewStore.viewsLoading" class="lv-modal__loading">Loading…</div>
      <div v-else-if="viewStore.viewsError" class="lv-modal__error">{{ viewStore.viewsError }}</div>
      <div v-else-if="viewStore.serverViews.length === 0" class="lv-modal__empty">No saved views found.</div>
      <div v-else class="lv-modal__body">
        <template v-for="scope in ['global','shared','private']" :key="scope">
          <div
            v-if="viewsByScope(scope).length > 0"
            class="lv-modal__group"
          >
            <div class="lv-modal__group-label">{{ scopeLabel(scope) }}</div>
            <div
              v-for="view in viewsByScope(scope)"
              :key="view.id"
              class="lv-modal__row"
            >
              <div class="lv-modal__row-info">
                <span class="lv-modal__row-name">{{ view.name }}</span>
                <span v-if="view.description" class="lv-modal__row-desc">{{ view.description }}</span>
                <span class="lv-modal__row-owner">{{ view.owner }}</span>
              </div>
              <div class="lv-modal__row-actions">
                <button class="lv-modal__btn lv-modal__btn--primary" @click="emit('load', view)">Load</button>
                <button
                  v-if="canDelete(view)"
                  class="lv-modal__btn lv-modal__btn--danger"
                  @click="onDelete(view.id)"
                >Delete</button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { useAuthStore } from '@/stores/authStore'
import type { TopologyView } from '@/types/topology'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'load', view: TopologyView): void
}>()

const viewStore = useTopologyViewStore()
const authStore = useAuthStore()

const viewsByScope = (scope: string) =>
  viewStore.serverViews.filter(v => v.scope === scope)

const scopeLabel = (scope: string) =>
  ({ global: 'Global', shared: 'Shared', private: 'Private' })[scope] ?? scope

const canDelete = (view: TopologyView) =>
  view.owner === authStore.whoAmI?.id || authStore.whoAmI?.roles?.includes('ROLE_ADMIN')

const onDelete = async (id: string) => {
  if (!confirm('Delete this view?')) return
  await viewStore.deleteServerView(id)
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.lv-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lv-modal {
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  width: 520px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var($border-on-surface);
    font-weight: 600;
    font-size: 0.95rem;
    color: var($primary-text-on-surface);
  }

  &__close {
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    font-size: 1rem;
    padding: 2px 6px;
    &:hover { color: var($primary-text-on-surface); }
  }

  &__loading, &__error, &__empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 0.85rem;
    color: var($secondary-text-on-surface);
  }

  &__error { color: var($error); }

  &__body {
    overflow-y: auto;
    padding: 8px 0;
  }

  &__group-label {
    padding: 8px 16px 4px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    gap: 12px;
    &:hover { background: var($background); }
  }

  &__row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__row-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var($primary-text-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__row-desc {
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
  }

  &__row-owner {
    font-size: 0.7rem;
    color: var($secondary-text-on-surface);
    opacity: 0.7;
  }

  &__row-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  &__btn {
    font-size: 0.78rem;
    padding: 4px 12px;
    border-radius: vars.$border-radius-xs;
    border: 1px solid transparent;
    cursor: pointer;
    font-weight: 500;

    &--primary {
      background: var($primary);
      color: #fff;
      &:hover { opacity: 0.9; }
    }

    &--danger {
      background: none;
      border-color: var($error);
      color: var($error);
      &:hover { background: var($error); color: #fff; }
    }
  }
}
</style>
```

- [ ] **Step 2: Create SaveViewModal.vue**

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
  <div v-if="visible" class="sv-modal-backdrop" @click.self="emit('cancel')">
    <div class="sv-modal">
      <div class="sv-modal__header">
        <span>Save as New View</span>
        <button class="sv-modal__close" @click="emit('cancel')">✕</button>
      </div>
      <div class="sv-modal__body">
        <label class="sv-modal__label">
          Name
          <input v-model="name" class="sv-modal__input" placeholder="My View" />
        </label>
        <label class="sv-modal__label">
          Description (optional)
          <input v-model="description" class="sv-modal__input" placeholder="" />
        </label>
        <label class="sv-modal__label">
          Scope
          <select v-model="scope" class="sv-modal__select">
            <option value="private">Private (only me)</option>
            <option value="shared">Shared (all users)</option>
            <option v-if="isAdmin" value="global">Global (admin-curated)</option>
          </select>
        </label>
      </div>
      <div class="sv-modal__footer">
        <button class="sv-modal__btn sv-modal__btn--secondary" @click="emit('cancel')">Cancel</button>
        <button class="sv-modal__btn sv-modal__btn--primary" :disabled="!name.trim()" @click="onSave">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'save', name: string, scope: 'private' | 'shared' | 'global', description: string): void
}>()

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.whoAmI?.roles?.includes('ROLE_ADMIN') ?? false)

const name        = ref('')
const description = ref('')
const scope       = ref<'private' | 'shared' | 'global'>('private')

const onSave = () => {
  if (!name.value.trim()) return
  emit('save', name.value.trim(), scope.value, description.value.trim())
  name.value        = ''
  description.value = ''
  scope.value       = 'private'
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.sv-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sv-modal {
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-sm;
  width: 380px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var($border-on-surface);
    font-weight: 600;
    font-size: 0.95rem;
    color: var($primary-text-on-surface);
  }

  &__close {
    background: none;
    border: none;
    cursor: pointer;
    color: var($secondary-text-on-surface);
    font-size: 1rem;
    padding: 2px 6px;
    &:hover { color: var($primary-text-on-surface); }
  }

  &__body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var($primary-text-on-surface);
  }

  &__input, &__select {
    padding: 6px 10px;
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-xs;
    background: var($background);
    color: var($primary-text-on-surface);
    font-size: 0.85rem;
    &:focus { outline: 2px solid var($primary); outline-offset: -1px; }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var($border-on-surface);
  }

  &__btn {
    font-size: 0.82rem;
    padding: 6px 16px;
    border-radius: vars.$border-radius-xs;
    border: 1px solid transparent;
    cursor: pointer;
    font-weight: 500;

    &--primary {
      background: var($primary);
      color: #fff;
      &:hover:not(:disabled) { opacity: 0.9; }
      &:disabled { opacity: 0.4; cursor: default; }
    }

    &--secondary {
      background: none;
      border-color: var($border-on-surface);
      color: var($primary-text-on-surface);
      &:hover { background: var($background); }
    }
  }
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Topology/LoadViewModal.vue ui/src/components/Topology/SaveViewModal.vue
git commit -m "feat(topology): LoadViewModal and SaveViewModal components"
```

---

## Task 7: Add Views dropdown to TopologyToolbar + edit mode banner to TopologyGraph

**Files:**
- Modify: `ui/src/components/Topology/TopologyToolbar.vue`
- Modify: `ui/src/components/Topology/TopologyGraph.vue`

- [ ] **Step 1: Add Views dropdown to TopologyToolbar.vue**

Import the view store and add a `views-panel` dropdown alongside the existing Layout dropdown. Add at the top of `<script setup>`:

```typescript
import { useTopologyViewStore } from '@/stores/topologyViewStore'
const viewStore = useTopologyViewStore()
const viewsPanelOpen = ref(false)
const viewsPanelRef = ref<HTMLElement | null>(null)
```

Add click-outside handling for `viewsPanelRef` (same pattern used by `layersPanelRef`).

Add the following template block in the toolbar, after the Layout dropdown:

```html
<!-- Views -->
<div class="topology-toolbar__dd" ref="viewsPanelRef">
  <button
    type="button"
    class="topology-toolbar__chip"
    :class="{ active: viewsPanelOpen }"
    @click="viewsPanelOpen = !viewsPanelOpen"
  >Views ▾</button>
  <div v-if="viewsPanelOpen" class="topology-toolbar__panel topology-toolbar__panel--sm">
    <button class="topology-toolbar__menu-item" @click="emit('open-load-view'); viewsPanelOpen = false">
      Load View…
    </button>
    <hr class="topology-toolbar__divider">
    <button
      class="topology-toolbar__menu-item"
      :class="{ disabled: !viewStore.activeView }"
      :disabled="!viewStore.activeView"
      @click="emit('save-view'); viewsPanelOpen = false"
    >
      Save
    </button>
    <button
      class="topology-toolbar__menu-item"
      @click="emit('save-new-view'); viewsPanelOpen = false"
    >
      Save as New…
    </button>
    <hr class="topology-toolbar__divider">
    <button
      class="topology-toolbar__menu-item"
      :class="{ disabled: !viewStore.activeView || viewStore.editMode }"
      :disabled="!viewStore.activeView || viewStore.editMode"
      @click="viewStore.enterEditMode(); viewsPanelOpen = false"
    >
      Edit View
    </button>
  </div>
</div>
```

Add the new emit events to the existing `defineEmits`:
```typescript
const emit = defineEmits<{
  // ... existing emits (save-layout, reset-layout, toggle-grid, align-to-grid)
  (e: 'open-load-view'): void
  (e: 'save-view'): void
  (e: 'save-new-view'): void
}>()
```

- [ ] **Step 2: Add edit mode banner to TopologyGraph.vue**

In `TopologyGraph.vue`, import the view store and add the banner after the link-mode banner:

```typescript
import { useTopologyViewStore } from '@/stores/topologyViewStore'
const viewStore = useTopologyViewStore()
```

Template — add after the `v-if="store.linkMode"` banner:

```html
<!-- Edit mode banner -->
<div v-if="viewStore.editMode" class="topology-graph__edit-banner">
  <span>Editing: <strong>{{ viewStore.activeView?.name }}</strong></span>
  <FeatherButton text @click="emit('save-view')">Save</FeatherButton>
  <FeatherButton text @click="viewStore.discardEditMode(); syncAfterDiscard()">Discard</FeatherButton>
</div>
```

Add `emit('save-view')` and `syncAfterDiscard` in the script:
```typescript
const emit = defineEmits(['save-view'])

const syncAfterDiscard = () => {
  // After discard, re-run syncElements via the store watch already in useTopology.ts
  // (watches editMode and calls syncElements). No direct call needed.
}
```

Add the SCSS for the edit banner (same pattern as `&__link-banner`):
```scss
  &__edit-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 20px;
    background: var($surface);
    border: 2px solid var($state-warning-text-on-light, #b45309);
    border-radius: vars.$border-radius-sm;
    font-size: 0.9rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
```

- [ ] **Step 3: Rewrite Topology.vue to wire all view events**

`Topology.vue` currently has stub `onSaveView` / `onRestoreView` that use the old `data:string` API. Replace the entire file with:

```vue
<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div class="topology-page">
    <TopologyToolbar
      @save-layout="graphRef?.saveLayout()"
      @reset-layout="graphRef?.resetLayout()"
      @toggle-grid="graphRef?.toggleGrid()"
      @align-to-grid="graphRef?.alignToGrid()"
      @open-load-view="openLoadModal"
      @save-view="onSaveView"
      @save-new-view="showSaveModal = true"
    />
    <TopologyGraph ref="graphRef" @save-view="onSaveView" />

    <LoadViewModal
      :visible="showLoadModal"
      @close="showLoadModal = false"
      @load="onLoadView"
    />
    <SaveViewModal
      :visible="showSaveModal"
      @cancel="showSaveModal = false"
      @save="onSaveNewView"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import TopologyToolbar from '@/components/Topology/TopologyToolbar.vue'
import TopologyGraph from '@/components/Topology/TopologyGraph.vue'
import LoadViewModal from '@/components/Topology/LoadViewModal.vue'
import SaveViewModal from '@/components/Topology/SaveViewModal.vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
import { useMenuStore } from '@/stores/menuStore'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import type { TopologyView, TopologyViewState } from '@/types/topology'
import { BreadCrumb } from '@/types'

const store     = useTopologyStore()
const wmStore   = useWeathermapStore()
const elStore   = useEdgeLabelStore()
const menuStore = useMenuStore()
const viewStore = useTopologyViewStore()

const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)

const showLoadModal = ref(false)
const showSaveModal = ref(false)

const openLoadModal = async () => {
  await viewStore.fetchServerViews()
  showLoadModal.value = true
}

/** Capture current topology state into a TopologyViewState object. */
const captureViewState = (): TopologyViewState => {
  const layout: Record<string, { x: number; y: number }> = graphRef.value?.getPositions() ?? {}
  return {
    layers: [...store.activeLayers],
    filters: {
      surveillanceCategories: [...viewStore.filters.surveillanceCategories],
      cidrs: [...viewStore.filters.cidrs],
      namePattern: viewStore.filters.namePattern,
    },
    layout,
    suppressed: {
      vertices: viewStore.editMode
        ? [...viewStore.editPendingVertices]
        : [...viewStore.suppressedVertices],
      edges: viewStore.editMode
        ? [...viewStore.editPendingEdges]
        : [...viewStore.suppressedEdges],
    },
    edgeColorMode: elStore.colorMode,
    edgeLabels: {
      showUtilization: elStore.showUtilization,
      showLocalPort:   elStore.showLocalPort,
      showRemotePort:  elStore.showRemotePort,
      showIp:          elStore.showIp,
      showMac:         elStore.showMac,
      showSpeed:       elStore.showSpeed,
    }
  }
}

const onSaveView = async () => {
  if (!viewStore.activeView) return
  await viewStore.saveView(captureViewState())
}

const onSaveNewView = async (
  name: string,
  scope: 'private' | 'shared' | 'global',
  description: string
) => {
  showSaveModal.value = false
  await viewStore.saveNewView(name, scope, captureViewState(), description)
}

const onLoadView = (view: TopologyView) => {
  showLoadModal.value = false
  viewStore.applyView(view)
  // Apply layers
  store.activeLayers = [...view.state.layers]
  // Apply filters
  viewStore.filters.surveillanceCategories = [...view.state.filters.surveillanceCategories]
  viewStore.filters.cidrs                  = [...view.state.filters.cidrs]
  viewStore.filters.namePattern            = view.state.filters.namePattern
  // Apply edge settings
  elStore.colorMode       = view.state.edgeColorMode
  elStore.showUtilization = view.state.edgeLabels.showUtilization
  elStore.showLocalPort   = view.state.edgeLabels.showLocalPort
  elStore.showRemotePort  = view.state.edgeLabels.showRemotePort
  elStore.showIp          = view.state.edgeLabels.showIp
  elStore.showMac         = view.state.edgeLabels.showMac
  elStore.showSpeed       = view.state.edgeLabels.showSpeed
}

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl ?? '/opennms')
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Network Topology', to: '#', position: 'last' }
])

onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities(),
    store.loadUserDefinedLinks(),
    viewStore.fetchServerViews(),
  ])
  await wmStore.start(store.vertices, store.edges)
})

watch(() => store.edges, async (edges) => {
  await wmStore.start(store.vertices, edges)
}, { deep: false })

onBeforeUnmount(() => {
  wmStore.stop()
})
</script>

<style lang="scss" scoped>
.topology-page {
  display: flex;
  flex-direction: column;
  // 120px = FeatherAppLayout header (64px) + breadcrumb row (32px) + padding (24px)
  height: calc(100vh - 120px);
  overflow: hidden;
}
</style>
```
```

- [ ] **Step 4: Wire `savedPositions` in useTopology.ts to check viewLayout first**

Find `savedPositions()` in `useTopology.ts` and change:
```typescript
  const savedPositions = (): Record<string, { x: number; y: number }> | null => {
    const key = localStorageKey()
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }
```
To:
```typescript
  const savedPositions = (): Record<string, { x: number; y: number }> | null => {
    // View layout takes priority over localStorage when a view is loaded
    if (Object.keys(viewStore.viewLayout).length > 0) {
      return viewStore.viewLayout
    }
    const key = localStorageKey()
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }
```

- [ ] **Step 5: Build and check for type errors**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | grep -E "error TS" | head -30
```
Fix any remaining errors. Common issues: missing emits, unresolved imports, Topology.vue needing the new store imports and event handlers.

- [ ] **Step 6: Deploy and test the full flow**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```

Verify bundle hash matches, then test in browser:

1. Open topology, configure layers/filters, click **Views → Save as New…**, fill in name, click Save. Confirm success snackbar.
2. Reload the page. Click **Views → Load View…**, confirm the view appears. Select it — layers/filters should restore.
3. Re-open topology after hard refresh. Click **Views → Edit View**. Edit banner appears. Right-click a node — "Hide from view" appears. Click it — node dims. Click Discard — node restored to full opacity.
4. Enter edit mode again, hide a node, click Save. Node disappears. Reload page, load the view — the hidden node should not appear.

```bash
# Confirm YAML file on disk
podman exec test-opennms ls /opt/opennms/etc/topology-views/private/admin/
podman exec test-opennms cat /opt/opennms/etc/topology-views/private/admin/<slug>.yaml
```

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/Topology/TopologyToolbar.vue \
        ui/src/components/Topology/TopologyGraph.vue \
        ui/src/containers/Topology.vue \
        ui/src/composables/useTopology.ts
git commit -m "feat(topology): Views dropdown, edit mode banner, load/save view wired end-to-end"
```
