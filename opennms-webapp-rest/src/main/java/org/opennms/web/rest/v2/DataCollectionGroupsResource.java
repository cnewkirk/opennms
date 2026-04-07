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
