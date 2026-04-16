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
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Replace ops board configuration", operationId = "putWallboardConfig")
    public Response putConfig(WallboardsConfig config, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (config == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Request body required")).build();
        }
        if (config.getWallboards() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "wallboards must not be null")).build();
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
