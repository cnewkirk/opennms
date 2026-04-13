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

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component("topologyViewRestService")
@javax.ws.rs.Path("topology/views")
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
    @javax.ws.rs.Path("/{id}")
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
    @javax.ws.rs.Path("/{id}")
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
    @javax.ws.rs.Path("/{id}")
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
