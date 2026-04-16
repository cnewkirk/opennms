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
