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
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.cxf.jaxrs.ext.multipart.Attachment;
import org.apache.cxf.jaxrs.ext.multipart.Multipart;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.mibcompiler.CompileRequest;
import org.opennms.web.rest.support.mibcompiler.GenerateDataCollectionRequest;
import org.opennms.web.rest.support.mibcompiler.GenerateEventsRequest;
import org.opennms.web.rest.support.mibcompiler.MibCompileJobManager;
import org.opennms.web.rest.support.mibcompiler.MibJobStatus;
import org.opennms.web.rest.support.mibcompiler.SaveDataCollectionRequest;
import org.opennms.web.rest.support.mibcompiler.SaveEventsRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("mib-compiler")
@Tag(name = "MibCompiler", description = "SNMP MIB Compiler API")
public class MibCompilerResource {
    private static final Logger LOG = LoggerFactory.getLogger(MibCompilerResource.class);

    private static final String SHARE_MIBS = "share" + File.separator + "mibs";
    private static final String PENDING = "pending";
    private static final String COMPILED = "compiled";

    @Autowired
    private MibCompileJobManager jobManager;

    // ── List MIBs ──────────────────────────────────────────────────────

    @GET
    @Path("/mibs")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List pending and compiled MIB files", operationId = "MibCompilerListMibs")
    public Response listMibs(@Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        Map<String, List<String>> result = new HashMap<>();
        result.put(PENDING, listFiles(getPendingDir()));
        result.put(COMPILED, listFiles(getCompiledDir()));
        return Response.ok(result).build();
    }

    // ── Upload MIB ─────────────────────────────────���───────────────────

    @POST
    @Path("/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Upload a MIB file to the pending directory", operationId = "MibCompilerUpload")
    public Response uploadMib(@Multipart("file") Attachment attachment,
                              @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        String originalFilename = null;
        if (attachment.getContentDisposition() != null) {
            originalFilename = attachment.getContentDisposition().getParameter("filename");
        }
        if (originalFilename == null || originalFilename.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "No filename provided")).build();
        }

        try {
            originalFilename = sanitizeFileName(originalFilename);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        File pendingDir = getPendingDir();
        ensureDir(pendingDir);

        File targetFile = new File(pendingDir, originalFilename);
        if (targetFile.exists()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("error", "File already exists in pending directory: " + originalFilename)).build();
        }

        try (InputStream in = attachment.getObject(InputStream.class)) {
            Files.copy(in, targetFile.toPath());
        } catch (IOException e) {
            LOG.error("Failed to save uploaded MIB {}: {}", originalFilename, e.getMessage(), e);
            return Response.serverError()
                    .entity(Map.of("error", "Failed to save file: " + e.getMessage())).build();
        }

        Map<String, String> result = new HashMap<>();
        result.put("filename", originalFilename);
        result.put("folder", PENDING);
        return Response.ok(result).build();
    }

    // ── Read MIB Content ───────────────────────────────────────────────

    @GET
    @Path("/mibs/{folder}/{filename}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Read the content of a MIB file", operationId = "MibCompilerReadMib")
    public Response readMib(@PathParam("folder") String folder,
                            @PathParam("filename") String filename,
                            @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        File dir = resolveFolder(folder);
        if (dir == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid folder: must be 'pending' or 'compiled'")).build();
        }

        try {
            filename = sanitizeFileName(filename);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        File file = new File(dir, filename);
        if (!file.exists()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        try {
            String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            Map<String, String> result = new HashMap<>();
            result.put("filename", filename);
            result.put("content", content);
            return Response.ok(result).build();
        } catch (IOException e) {
            return Response.serverError()
                    .entity(Map.of("error", "Failed to read file: " + e.getMessage())).build();
        }
    }

    // ── Save Edited MIB Content ────────────────────────────────────────

    @PUT
    @Path("/mibs/pending/{filename}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Save edited content of a pending MIB file", operationId = "MibCompilerSaveMib")
    public Response saveMib(@PathParam("filename") String filename,
                            Map<String, String> body,
                            @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        try {
            filename = sanitizeFileName(filename);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        String content = body != null ? body.get("content") : null;
        if (content == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Missing 'content' field")).build();
        }

        File file = new File(getPendingDir(), filename);
        if (!file.exists()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        try {
            Files.writeString(file.toPath(), content, StandardCharsets.UTF_8,
                    StandardOpenOption.TRUNCATE_EXISTING);
            return Response.ok(Map.of("success", true)).build();
        } catch (IOException e) {
            return Response.serverError()
                    .entity(Map.of("error", "Failed to write file: " + e.getMessage())).build();
        }
    }

    // ── Delete MIB ─────────────────────────────────────────────────────

    @DELETE
    @Path("/mibs/{folder}/{filename}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Delete a MIB file", operationId = "MibCompilerDeleteMib")
    public Response deleteMib(@PathParam("folder") String folder,
                              @PathParam("filename") String filename,
                              @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        File dir = resolveFolder(folder);
        if (dir == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid folder: must be 'pending' or 'compiled'")).build();
        }

        try {
            filename = sanitizeFileName(filename);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        File file = new File(dir, filename);
        if (!file.exists()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if (!file.delete()) {
            return Response.serverError()
                    .entity(Map.of("error", "Failed to delete file: " + filename)).build();
        }

        return Response.noContent().build();
    }

    // ── Compile MIB (async) ────────────────────────────────────────────

    @POST
    @Path("/compile")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Start async MIB compilation", operationId = "MibCompilerCompile")
    public Response compile(CompileRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (request == null || request.getFilename() == null || request.getFilename().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "filename is required")).build();
        }

        File pendingDir = getPendingDir();
        File compiledDir = getCompiledDir();
        ensureDir(pendingDir);
        ensureDir(compiledDir);

        String jobId = jobManager.submitCompile(request.getFilename(), pendingDir, compiledDir);
        return Response.accepted(Map.of("jobId", jobId)).build();
    }

    @GET
    @Path("/compile/{jobId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Poll MIB compilation job status", operationId = "MibCompilerPollCompile")
    public Response pollCompile(@PathParam("jobId") String jobId,
                                @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        return pollJob(jobId);
    }

    // ── Generate Events (async) ────────────────────────────────────────

    @POST
    @Path("/generate-events")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Start async event generation from compiled MIB", operationId = "MibCompilerGenerateEvents")
    public Response generateEvents(GenerateEventsRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (request == null || request.getFilename() == null || request.getFilename().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "filename is required")).build();
        }
        if (request.getUeiBase() == null || request.getUeiBase().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "ueiBase is required")).build();
        }

        String jobId = jobManager.submitGenerateEvents(request.getFilename(), request.getUeiBase(), getCompiledDir());
        return Response.accepted(Map.of("jobId", jobId)).build();
    }

    @GET
    @Path("/generate-events/{jobId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Poll event generation job status", operationId = "MibCompilerPollGenerateEvents")
    public Response pollGenerateEvents(@PathParam("jobId") String jobId,
                                       @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        return pollJob(jobId);
    }

    // ── Save Events (sync) ─────────────────────────────────────────────

    @POST
    @Path("/save-events")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Save generated events XML to etc/events/", operationId = "MibCompilerSaveEvents")
    public Response saveEvents(SaveEventsRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (request == null || request.getEventsXml() == null || request.getEventsXml().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "eventsXml is required")).build();
        }

        String fileName = request.getFileName();
        if (fileName == null || fileName.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "fileName is required")).build();
        }

        try {
            fileName = sanitizeFileName(fileName);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        java.nio.file.Path outputDir = Paths.get(getOpennmsHome(), "etc", "events");
        java.nio.file.Path outputFile = outputDir.resolve(fileName);

        return writeFile(outputFile, request.getEventsXml(), request.isOverwrite());
    }

    // ── Generate Data Collection (async) ───────────────────────────────

    @POST
    @Path("/generate-datacollection")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Start async data collection generation from compiled MIB", operationId = "MibCompilerGenerateDataCollection")
    public Response generateDataCollection(GenerateDataCollectionRequest request,
                                           @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (request == null || request.getFilename() == null || request.getFilename().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "filename is required")).build();
        }

        String jobId = jobManager.submitGenerateDataCollection(request.getFilename(), getCompiledDir());
        return Response.accepted(Map.of("jobId", jobId)).build();
    }

    @GET
    @Path("/generate-datacollection/{jobId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Poll data collection generation job status", operationId = "MibCompilerPollGenerateDataCollection")
    public Response pollGenerateDataCollection(@PathParam("jobId") String jobId,
                                               @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        return pollJob(jobId);
    }

    // ── Save Data Collection (sync) ────────────────────────────────────

    @POST
    @Path("/save-datacollection")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Save generated data collection XML to etc/datacollection/", operationId = "MibCompilerSaveDataCollection")
    public Response saveDataCollection(SaveDataCollectionRequest request,
                                       @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (request == null || request.getDatacollectionXml() == null || request.getDatacollectionXml().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "datacollectionXml is required")).build();
        }

        String fileName = request.getFileName();
        if (fileName == null || fileName.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "fileName is required")).build();
        }

        try {
            fileName = sanitizeFileName(fileName);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        // Save datacollection XML
        java.nio.file.Path dcDir = Paths.get(getOpennmsHome(), "etc", "datacollection");
        java.nio.file.Path dcFile = dcDir.resolve(fileName);
        Response dcResponse = writeFile(dcFile, request.getDatacollectionXml(), request.isOverwrite());
        if (dcResponse.getStatus() != 200) {
            return dcResponse;
        }

        // Optionally save graph templates
        String savedGraphPath = null;
        if (request.getGraphTemplates() != null && !request.getGraphTemplates().isBlank()) {
            String graphFileName = fileName.replaceFirst("\\.xml$", "-graph.properties");
            java.nio.file.Path graphDir = Paths.get(getOpennmsHome(), "etc", "snmp-graph.properties.d");
            java.nio.file.Path graphFile = graphDir.resolve(graphFileName);

            try {
                Files.createDirectories(graphDir);
                Files.writeString(graphFile, request.getGraphTemplates(), StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                savedGraphPath = graphFile.toString();
            } catch (IOException e) {
                LOG.warn("Failed to save graph templates to {}: {}", graphFile, e.getMessage());
                // Non-fatal — datacollection was already saved
            }
        }

        Map<String, String> result = new HashMap<>();
        result.put("savedPath", dcFile.toString());
        if (savedGraphPath != null) {
            result.put("graphPath", savedGraphPath);
        }
        return Response.ok(result).build();
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private Response pollJob(String jobId) {
        MibJobStatus status = jobManager.getStatus(jobId);
        if (status == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(status).build();
    }

    private Response writeFile(java.nio.file.Path outputFile, String content, boolean overwrite) {
        try {
            Files.createDirectories(outputFile.getParent());
        } catch (IOException e) {
            LOG.error("Cannot create directory {}: {}", outputFile.getParent(), e.getMessage(), e);
            return Response.serverError()
                    .entity(Map.of("error", "Cannot create directory: " + e.getMessage())).build();
        }

        if (outputFile.toFile().exists() && !overwrite) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("error", "File already exists: " + outputFile.getFileName())).build();
        }

        try {
            Files.writeString(outputFile, content, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            LOG.info("Saved MIB output to {}", outputFile);
            return Response.ok(Map.of("savedPath", outputFile.toString())).build();
        } catch (IOException e) {
            LOG.error("Cannot write to {}: {}", outputFile, e.getMessage(), e);
            return Response.serverError()
                    .entity(Map.of("error", "Cannot write file: " + e.getMessage())).build();
        }
    }

    private List<String> listFiles(File dir) {
        if (!dir.exists() || !dir.isDirectory()) {
            return Collections.emptyList();
        }
        String[] files = dir.list();
        if (files == null) {
            return Collections.emptyList();
        }
        return Arrays.stream(files).sorted().collect(Collectors.toList());
    }

    private File resolveFolder(String folder) {
        if (PENDING.equals(folder)) {
            return getPendingDir();
        } else if (COMPILED.equals(folder)) {
            return getCompiledDir();
        }
        return null;
    }

    private File getPendingDir() {
        return new File(getOpennmsHome(), SHARE_MIBS + File.separator + PENDING);
    }

    private File getCompiledDir() {
        return new File(getOpennmsHome(), SHARE_MIBS + File.separator + COMPILED);
    }

    private static String getOpennmsHome() {
        return System.getProperty("opennms.home", "/opt/opennms");
    }

    private static void ensureDir(File dir) {
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }

    /** Rejects path traversal and directory separators. */
    static String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new IllegalArgumentException("File name must not be blank");
        }
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains(File.separator)) {
            throw new IllegalArgumentException("File name must not contain path separators or '..'");
        }
        return fileName;
    }
}
