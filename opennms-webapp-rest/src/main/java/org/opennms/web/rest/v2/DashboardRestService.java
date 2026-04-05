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

import java.net.URI;
import java.util.Date;
import java.util.List;
import java.util.UUID;
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
import javax.ws.rs.core.UriInfo;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.dao.api.OnmsDashboardDao;
import org.opennms.netmgt.model.OnmsDashboard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Path("dashboards")
@Transactional
@Tag(name = "Dashboards", description = "Perses Dashboard Storage API")
public class DashboardRestService {

    private static final Logger LOG = LoggerFactory.getLogger(DashboardRestService.class);

    @Autowired
    private OnmsDashboardDao dashboardDao;

    /** List all dashboards — returns lightweight summaries (no spec). */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list() {
        final List<DashboardSummary> summaries = dashboardDao.findAll().stream()
                .map(DashboardSummary::from)
                .collect(Collectors.toList());
        return Response.ok(summaries).build();
    }

    /** Get one dashboard including full spec. */
    @GET
    @Path("{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response get(@PathParam("id") final String id) {
        final OnmsDashboard dashboard = dashboardDao.get(id);
        if (dashboard == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(dashboard).build();
    }

    /** Create a new dashboard. */
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(@Context final UriInfo uriInfo,
                           @Context final SecurityContext securityContext,
                           final OnmsDashboard dashboard) {
        dashboard.setId(UUID.randomUUID().toString());
        dashboard.setCreatedBy(securityContext.getUserPrincipal() != null
                ? securityContext.getUserPrincipal().getName() : "anonymous");
        dashboard.setCreatedAt(new Date());
        dashboard.setUpdatedAt(new Date());
        dashboardDao.save(dashboard);
        final URI location = uriInfo.getAbsolutePathBuilder()
                .path(dashboard.getId()).build();
        return Response.created(location).entity(dashboard).build();
    }

    /** Replace a dashboard spec. */
    @PUT
    @Path("{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("id") final String id,
                           final OnmsDashboard incoming) {
        final OnmsDashboard existing = dashboardDao.get(id);
        if (existing == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        existing.setName(incoming.getName());
        existing.setDescription(incoming.getDescription());
        existing.setSpec(incoming.getSpec());
        existing.setUpdatedAt(new Date());
        dashboardDao.saveOrUpdate(existing);
        return Response.ok(existing).build();
    }

    /** Delete a dashboard. */
    @DELETE
    @Path("{id}")
    public Response delete(@PathParam("id") final String id) {
        final OnmsDashboard dashboard = dashboardDao.get(id);
        if (dashboard == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        dashboardDao.delete(dashboard);
        return Response.noContent().build();
    }

    // --- Summary DTO (no spec field) ---

    public static class DashboardSummary {
        public String id;
        public String name;
        public String description;
        public String createdBy;
        public Date createdAt;
        public Date updatedAt;

        public static DashboardSummary from(final OnmsDashboard d) {
            final DashboardSummary s = new DashboardSummary();
            s.id = d.getId();
            s.name = d.getName();
            s.description = d.getDescription();
            s.createdBy = d.getCreatedBy();
            s.createdAt = d.getCreatedAt();
            s.updatedAt = d.getUpdatedAt();
            return s;
        }
    }
}
