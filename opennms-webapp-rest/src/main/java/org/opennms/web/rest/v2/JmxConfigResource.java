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
import java.nio.file.StandardOpenOption;
import java.util.HashMap;
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.netmgt.collection.api.AttributeType;
import org.opennms.netmgt.config.collectd.jmx.Attrib;
import org.opennms.netmgt.config.collectd.jmx.JmxCollection;
import org.opennms.netmgt.config.collectd.jmx.JmxDatacollectionConfig;
import org.opennms.netmgt.config.collectd.jmx.Mbean;
import org.opennms.netmgt.config.collectd.jmx.Rrd;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.jmxconfig.DetectJobStatus;
import org.opennms.web.rest.support.jmxconfig.DetectRequest;
import org.opennms.web.rest.support.jmxconfig.GenerateRequest;
import org.opennms.web.rest.support.jmxconfig.GenerateResponse;
import org.opennms.web.rest.support.jmxconfig.JmxDetectJobManager;
import org.opennms.web.rest.support.jmxconfig.MBeanAttributeDto;
import org.opennms.web.rest.support.jmxconfig.MBeanDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("jmx-config")
@Tag(name = "JmxConfig", description = "JMX Configuration Generator API")
public class JmxConfigResource {
    private static final Logger LOG = LoggerFactory.getLogger(JmxConfigResource.class);

    @Autowired
    private JmxDetectJobManager jobManager;

    @POST
    @Path("/detect")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Start async MBean detection", operationId = "JmxConfigResourceDetect")
    public Response detect(DetectRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        String jobId = jobManager.submit(request);
        Map<String, String> resp = new HashMap<>();
        resp.put("jobId", jobId);
        return Response.accepted(resp).build();
    }

    @GET
    @Path("/detect/{jobId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Poll MBean detection job status", operationId = "JmxConfigResourcePoll")
    public Response pollDetect(@PathParam("jobId") String jobId, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        DetectJobStatus status = jobManager.getStatus(jobId);
        if (status == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(status).build();
    }

    @POST
    @Path("/generate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Generate JMX datacollection XML", operationId = "JmxConfigResourceGenerate")
    public Response generate(GenerateRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        String fileName = request.getOutputFileName();
        if (fileName == null || fileName.isBlank()) {
            fileName = request.getServiceName() + "-jmx.xml";
        }

        try {
            fileName = sanitizeFileName(fileName);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        String xml = buildXml(request);
        String savedPath = null;

        if (request.isSaveToServer()) {
            String opennmsHome = System.getProperty("opennms.home", "/opt/opennms");
            java.nio.file.Path outputDir = Paths.get(opennmsHome, "etc", "jmx-datacollection-config.d");
            java.nio.file.Path outputFile = outputDir.resolve(fileName);

            try {
                Files.createDirectories(outputDir);
            } catch (IOException e) {
                LOG.error("Cannot create output directory {}: {}", outputDir, e.getMessage(), e);
                return Response.serverError().entity(Map.of("error", "Cannot create output directory: " + e.getMessage())).build();
            }

            if (outputFile.toFile().exists() && !request.isOverwrite()) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("error", "File already exists: " + fileName)).build();
            }

            try {
                Files.writeString(outputFile, xml, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                savedPath = outputFile.toString();
                LOG.info("Saved JMX config to {}", savedPath);
            } catch (IOException e) {
                LOG.error("Cannot write JMX config to {}: {}", outputFile, e.getMessage(), e);
                return Response.serverError().entity(Map.of("error", "Cannot write file: " + e.getMessage())).build();
            }
        }

        return Response.ok(new GenerateResponse(xml, savedPath)).build();
    }

    /** Builds a JmxDatacollectionConfig XML string from the user's selections. Visible for testing. */
    public static String buildXml(GenerateRequest request) {
        JmxDatacollectionConfig config = new JmxDatacollectionConfig();
        JmxCollection collection = new JmxCollection();
        collection.setName(request.getServiceName());

        Rrd rrd = new Rrd();
        rrd.setStep(300);
        rrd.addRra("RRA:AVERAGE:0.5:1:2016");
        rrd.addRra("RRA:AVERAGE:0.5:12:1488");
        rrd.addRra("RRA:AVERAGE:0.5:288:366");
        rrd.addRra("RRA:MAX:0.5:288:366");
        rrd.addRra("RRA:MIN:0.5:288:366");
        collection.setRrd(rrd);

        for (MBeanDto mbeanDto : request.getMbeans()) {
            if (!mbeanDto.isInclude()) {
                continue;
            }
            Mbean mbean = new Mbean();
            mbean.setObjectname(mbeanDto.getObjectName());
            mbean.setName(mbeanDto.getName() != null ? mbeanDto.getName() : mbeanDto.getObjectName());

            for (MBeanAttributeDto attrDto : mbeanDto.getAttributes()) {
                if (!attrDto.isInclude()) {
                    continue;
                }
                Attrib attrib = new Attrib();
                attrib.setName(attrDto.getName());
                attrib.setAlias(attrDto.getAlias());
                attrib.setType(parseAttributeType(attrDto.getType()));
                mbean.addAttrib(attrib);
            }
            collection.addMbean(mbean);
        }

        config.addJmxCollection(collection);
        return JaxbUtils.marshal(config);
    }

    /** Validates and returns the filename. Rejects path traversal and directory separators. Visible for testing. */
    public static String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new IllegalArgumentException("File name must not be blank");
        }
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains(File.separator)) {
            throw new IllegalArgumentException("File name must not contain path separators or '..'");
        }
        return fileName;
    }

    private static AttributeType parseAttributeType(String type) {
        if (type == null) {
            return AttributeType.GAUGE;
        }
        AttributeType parsed = AttributeType.parse(type);
        return parsed != null ? parsed : AttributeType.GAUGE;
    }
}
