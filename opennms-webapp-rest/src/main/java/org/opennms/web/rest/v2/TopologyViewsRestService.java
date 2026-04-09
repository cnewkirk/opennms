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
import java.util.ArrayList;
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
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.dao.api.TopologyViewDao;
import org.opennms.netmgt.model.TopologyView;
import org.opennms.web.api.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Path("topology/views")
@Transactional
@Tag(name = "TopologyViews", description = "Topology saved views API")
public class TopologyViewsRestService {

    private static final Logger LOG = LoggerFactory.getLogger(TopologyViewsRestService.class);

    // 'system' is a reserved owner sentinel for global default views — do not resolve as user
    private static final String SYSTEM_OWNER = "system";

    @Autowired(required=false)
    private TopologyViewDao topologyViewDao;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list(@QueryParam("scope") final String scope,
                         @Context final SecurityContext securityContext) {
        if (topologyViewDao == null) {
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity("topologyViewDao not available").build();
        }
        final String currentUser = securityContext.getUserPrincipal() != null
                ? securityContext.getUserPrincipal().getName() : null;
        final List<TopologyView> views;
        if (scope != null && !scope.isBlank()) {
            if ("user".equals(scope)) {
                // Return server-side user-scoped views for the current user only
                views = currentUser != null ? topologyViewDao.findByOwnerAndScope(currentUser, "user") : new ArrayList<>();
            } else {
                views = topologyViewDao.findByScope(scope);
            }
        } else {
            // Return shared + global + user-scoped views for current user
            final List<TopologyView> result = new ArrayList<>();
            result.addAll(topologyViewDao.findByScope("shared"));
            result.addAll(topologyViewDao.findByScope("global"));
            if (currentUser != null) {
                result.addAll(topologyViewDao.findByOwnerAndScope(currentUser, "user"));
            }
            views = result;
        }
        if ("global".equals(scope) && views.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        if ("global".equals(scope) && views.size() == 1) {
            return Response.ok(views.get(0)).build();
        }
        return Response.ok(views).build();
    }

    @GET
    @Path("{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response get(@PathParam("id") final String id) {
        final TopologyView view = topologyViewDao.get(id);
        if (view == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(view).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(@Context final UriInfo uriInfo,
                           @Context final SecurityContext securityContext,
                           final TopologyView view) {
        if (view == null || view.getName() == null || view.getName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("View name is required").build();
        }
        if ("global".equals(view.getScope()) && !securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Only admins can set the global default view").build();
        }
        if (view.getId() == null || view.getId().isBlank()) {
            view.setId(UUID.randomUUID().toString());
        }
        // Global views use the 'system' sentinel owner — never resolved as a user record
        if ("global".equals(view.getScope())) {
            view.setOwner(SYSTEM_OWNER);
        } else if (view.getOwner() == null || view.getOwner().isBlank()) {
            view.setOwner(securityContext.getUserPrincipal() != null
                    ? securityContext.getUserPrincipal().getName() : "anonymous");
        }
        final Date now = new Date();
        view.setCreatedAt(now);
        view.setUpdatedAt(now);
        topologyViewDao.save(view);
        LOG.debug("Created topology view '{}' scope='{}' owner='{}'", view.getName(), view.getScope(), view.getOwner());
        final URI location = uriInfo.getAbsolutePathBuilder().path(view.getId()).build();
        return Response.created(location).entity(view).build();
    }

    @PUT
    @Path("{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("id") final String id,
                           @Context final SecurityContext securityContext,
                           final TopologyView incoming) {
        if (incoming == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Request body is required").build();
        }
        if (incoming.getName() == null || incoming.getName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("name is required").build();
        }
        if (incoming.getStateJson() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("stateJson is required").build();
        }
        final TopologyView existing = topologyViewDao.get(id);
        if (existing == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        final String user = securityContext.getUserPrincipal() != null
                ? securityContext.getUserPrincipal().getName() : "";
        final boolean isAdmin = securityContext.isUserInRole(Authentication.ROLE_ADMIN);
        if (!isAdmin && !user.equals(existing.getOwner())) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if ("global".equals(existing.getScope()) && !isAdmin) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Only admins can update the global default view").build();
        }
        existing.setName(incoming.getName());
        existing.setDescription(incoming.getDescription());
        existing.setStateJson(incoming.getStateJson());
        existing.setUpdatedAt(new Date());
        topologyViewDao.saveOrUpdate(existing);
        return Response.ok(existing).build();
    }

    @DELETE
    @Path("{id}")
    public Response delete(@PathParam("id") final String id,
                           @Context final SecurityContext securityContext) {
        final TopologyView view = topologyViewDao.get(id);
        if (view == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        final String user = securityContext.getUserPrincipal() != null
                ? securityContext.getUserPrincipal().getName() : "";
        final boolean isAdmin = securityContext.isUserInRole(Authentication.ROLE_ADMIN);
        if (!isAdmin && !user.equals(view.getOwner())) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        topologyViewDao.delete(view);
        return Response.noContent().build();
    }
}
