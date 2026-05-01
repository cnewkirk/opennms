package org.opennms.web.rest.v2;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.GroupFactory;
import org.opennms.netmgt.config.GroupManager;
import org.opennms.netmgt.config.groups.Role;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.RoleList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.ws.rs.*;
import javax.ws.rs.core.*;

@Component
@Path("on-call-roles")
@Tag(name = "OnCallRoles", description = "On-Call Roles API")
public class OnCallRoleRestService {

    private static final Logger LOG = LoggerFactory.getLogger(OnCallRoleRestService.class);

    private GroupManager groupManager() {
        try {
            GroupFactory.init();
            return GroupFactory.getInstance();
        } catch (Exception e) {
            throw new WebApplicationException(Response.serverError()
                .entity("Failed to load group configuration: " + e.getMessage()).build());
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List all on-call roles", operationId = "listOnCallRoles")
    public Response getRoles(@Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        LOG.debug("getRoles: listing all on-call roles");
        return Response.ok(new RoleList(groupManager().getRoles())).build();
    }

    @GET
    @Path("{name}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get an on-call role by name", operationId = "getOnCallRole")
    public Response getRole(@PathParam("name") String name, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        Role role = groupManager().getRole(name);
        if (role == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(role).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create an on-call role", operationId = "createOnCallRole")
    public Response createRole(Role role, @Context SecurityContext sc, @Context UriInfo uriInfo) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (role.getName() == null || role.getName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("name is required").build();
        }
        LOG.debug("createRole: creating role {}", role.getName());
        try {
            groupManager().saveRole(role);
            return Response.created(uriInfo.getRequestUriBuilder()
                .path(role.getName()).build()).entity(role).build();
        } catch (Exception e) {
            LOG.error("Failed to save role {}", role.getName(), e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @PUT
    @Path("{name}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Update an on-call role", operationId = "updateOnCallRole")
    public Response updateRole(@PathParam("name") String name, Role role,
                               @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (groupManager().getRole(name) == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        role.setName(name);
        LOG.debug("updateRole: updating role {}", name);
        try {
            groupManager().saveRole(role);
            return Response.ok(role).build();
        } catch (Exception e) {
            LOG.error("Failed to update role {}", name, e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @DELETE
    @Path("{name}")
    @Operation(summary = "Delete an on-call role", operationId = "deleteOnCallRole")
    public Response deleteRole(@PathParam("name") String name, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (groupManager().getRole(name) == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        LOG.debug("deleteRole: deleting role {}", name);
        try {
            groupManager().deleteRole(name);
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to delete role {}", name, e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }
}
