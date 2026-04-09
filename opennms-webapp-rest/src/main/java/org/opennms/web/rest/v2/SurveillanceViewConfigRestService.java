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
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Replace surveillance view configuration", operationId = "putSurveillanceViewConfig")
    public Response putConfig(SurveillanceViewConfigDto dto, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (dto == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "Request body required")).build();
        }
        if (dto.getViews() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "views must not be null")).build();
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
        public void setViews(List<ViewDto> v) { this.views = v != null ? v : new ArrayList<>(); }
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
