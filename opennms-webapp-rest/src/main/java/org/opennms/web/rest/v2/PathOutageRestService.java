package org.opennms.web.rest.v2;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.utils.InetAddressUtils;
import org.opennms.netmgt.dao.api.NodeDao;
import org.opennms.netmgt.dao.api.PathOutageDao;
import org.opennms.netmgt.model.OnmsNode;
import org.opennms.netmgt.model.OnmsPathOutage;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.PathOutageDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.ws.rs.*;
import javax.ws.rs.core.*;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

@Component
@Path("path-outages")
@Tag(name = "PathOutages", description = "Path Outages API")
public class PathOutageRestService {

    private static final Logger LOG = LoggerFactory.getLogger(PathOutageRestService.class);

    @Autowired
    private PathOutageDao m_pathOutageDao;

    @Autowired
    private NodeDao m_nodeDao;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List all path outage configurations", operationId = "listPathOutages")
    public Response getPathOutages(@Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        List<PathOutageDTO> dtos = m_pathOutageDao.findAll().stream()
            .map(this::toDto).collect(Collectors.toList());
        return Response.ok(dtos).build();
    }

    @GET
    @Path("{nodeId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get path outage configuration for a node", operationId = "getPathOutage")
    public Response getPathOutage(@PathParam("nodeId") int nodeId, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        OnmsPathOutage outage = m_pathOutageDao.get(nodeId);
        if (outage == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(toDto(outage)).build();
    }

    @GET
    @Path("{nodeId}/dependents")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "List node IDs that depend on this critical path", operationId = "getPathOutageDependents")
    public Response getDependents(@PathParam("nodeId") int nodeId, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        OnmsPathOutage outage = m_pathOutageDao.get(nodeId);
        if (outage == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        List<Integer> deps = m_pathOutageDao.getNodesForPathOutage(outage);
        return Response.ok(deps).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Create or update a path outage", operationId = "savePathOutage")
    @Transactional
    public Response savePathOutage(PathOutageDTO dto, @Context SecurityContext sc, @Context UriInfo uriInfo) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        LOG.debug("savePathOutage: creating/updating path outage for nodeId={}", dto.getNodeId());
        OnmsNode node = m_nodeDao.get(dto.getNodeId());
        if (node == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity("Node " + dto.getNodeId() + " not found").build();
        }
        OnmsPathOutage existing = m_pathOutageDao.get(dto.getNodeId());
        if (existing != null) {
            // Update: modify the existing managed entity in-session
            existing.setCriticalPathIp(InetAddressUtils.addr(dto.getCriticalPathIp()));
            existing.setCriticalPathServiceName(dto.getCriticalPathServiceName());
            m_pathOutageDao.saveOrUpdate(existing);
            return Response.ok(toDto(existing)).build();
        } else {
            // Insert: use save() to force INSERT on a foreign-key-id entity
            OnmsPathOutage entity = new OnmsPathOutage(
                node,
                InetAddressUtils.addr(dto.getCriticalPathIp()),
                dto.getCriticalPathServiceName()
            );
            m_pathOutageDao.save(entity);
            return Response.created(uriInfo.getRequestUriBuilder()
                .path(String.valueOf(dto.getNodeId())).build())
                .entity(toDto(entity)).build();
        }
    }

    @DELETE
    @Path("{nodeId}")
    @Operation(summary = "Remove path outage configuration for a node", operationId = "deletePathOutage")
    @Transactional
    public Response deletePathOutage(@PathParam("nodeId") int nodeId, @Context SecurityContext sc) {
        if (!sc.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        LOG.debug("deletePathOutage: removing path outage for nodeId={}", nodeId);
        OnmsPathOutage outage = m_pathOutageDao.get(nodeId);
        if (outage == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        m_pathOutageDao.delete(outage);
        return Response.noContent().build();
    }

    private PathOutageDTO toDto(OnmsPathOutage e) {
        PathOutageDTO dto = new PathOutageDTO();
        dto.setNodeId(e.getNodeId());
        if (e.getNode() != null) dto.setNodeLabel(e.getNode().getLabel());
        dto.setCriticalPathIp(InetAddressUtils.str(e.getCriticalPathIp()));
        dto.setCriticalPathServiceName(e.getCriticalPathServiceName());
        return dto;
    }
}
