package org.opennms.web.rest.v2;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.DestinationPathFactory;
import org.opennms.netmgt.config.destinationPaths.Escalate;
import org.opennms.netmgt.config.destinationPaths.Target;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("destinationPaths")
@Tag(name = "DestinationPaths", description = "Destination Paths Configuration API")
public class DestinationPathRestService {

    private static final Logger LOG = LoggerFactory.getLogger(DestinationPathRestService.class);

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public static class TargetDTO {
        private String name;
        private String interval;
        private String autoNotify;
        private List<String> commands = new ArrayList<>();

        public TargetDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getInterval() { return interval; }
        public void setInterval(String interval) { this.interval = interval; }
        public String getAutoNotify() { return autoNotify; }
        public void setAutoNotify(String autoNotify) { this.autoNotify = autoNotify; }
        public List<String> getCommands() { return commands; }
        public void setCommands(List<String> commands) { this.commands = commands; }
    }

    public static class EscalateDTO {
        private String delay;
        private List<TargetDTO> targets = new ArrayList<>();

        public EscalateDTO() {}

        public String getDelay() { return delay; }
        public void setDelay(String delay) { this.delay = delay; }
        public List<TargetDTO> getTargets() { return targets; }
        public void setTargets(List<TargetDTO> targets) { this.targets = targets; }
    }

    public static class DestinationPathDTO {
        private String name;
        private String initialDelay;
        private List<TargetDTO> targets = new ArrayList<>();
        private List<EscalateDTO> escalates = new ArrayList<>();

        public DestinationPathDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getInitialDelay() { return initialDelay; }
        public void setInitialDelay(String initialDelay) { this.initialDelay = initialDelay; }
        public List<TargetDTO> getTargets() { return targets; }
        public void setTargets(List<TargetDTO> targets) { this.targets = targets; }
        public List<EscalateDTO> getEscalates() { return escalates; }
        public void setEscalates(List<EscalateDTO> escalates) { this.escalates = escalates; }
    }

    public static class DestinationPathListDTO {
        private List<DestinationPathDTO> paths = new ArrayList<>();

        public DestinationPathListDTO() {}

        public List<DestinationPathDTO> getPaths() { return paths; }
        public void setPaths(List<DestinationPathDTO> paths) { this.paths = paths; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private DestinationPathFactory factory() {
        try {
            return DestinationPathFactory.getInstance();
        } catch (IllegalStateException e) {
            throw new javax.ws.rs.ServiceUnavailableException("DestinationPathFactory not initialized");
        }
    }

    private TargetDTO targetToDTO(Target t) {
        TargetDTO dto = new TargetDTO();
        dto.setName(t.getName());
        dto.setInterval(t.getInterval().orElse(null));
        dto.setAutoNotify(t.getAutoNotify().orElse(null));
        dto.setCommands(new ArrayList<>(t.getCommands()));
        return dto;
    }

    private Target targetFromDTO(TargetDTO dto) {
        Target t = new Target();
        t.setName(dto.getName());
        if (dto.getInterval() != null) t.setInterval(dto.getInterval());
        if (dto.getAutoNotify() != null) t.setAutoNotify(dto.getAutoNotify());
        if (dto.getCommands() != null) {
            for (String cmd : dto.getCommands()) {
                t.addCommand(cmd);
            }
        }
        return t;
    }

    private DestinationPathDTO pathToDTO(org.opennms.netmgt.config.destinationPaths.Path p) {
        DestinationPathDTO dto = new DestinationPathDTO();
        dto.setName(p.getName());
        dto.setInitialDelay(p.getInitialDelay().orElse(null));
        List<TargetDTO> targets = new ArrayList<>();
        for (Target t : p.getTargets()) {
            targets.add(targetToDTO(t));
        }
        dto.setTargets(targets);
        List<EscalateDTO> escalates = new ArrayList<>();
        for (Escalate e : p.getEscalates()) {
            EscalateDTO ed = new EscalateDTO();
            ed.setDelay(e.getDelay());
            List<TargetDTO> etargets = new ArrayList<>();
            for (Target t : e.getTargets()) {
                etargets.add(targetToDTO(t));
            }
            ed.setTargets(etargets);
            escalates.add(ed);
        }
        dto.setEscalates(escalates);
        return dto;
    }

    private org.opennms.netmgt.config.destinationPaths.Path pathFromDTO(DestinationPathDTO dto) {
        org.opennms.netmgt.config.destinationPaths.Path p = new org.opennms.netmgt.config.destinationPaths.Path();
        p.setName(dto.getName());
        if (dto.getInitialDelay() != null) p.setInitialDelay(dto.getInitialDelay());
        if (dto.getTargets() != null) {
            for (TargetDTO td : dto.getTargets()) {
                p.addTarget(targetFromDTO(td));
            }
        }
        if (dto.getEscalates() != null) {
            for (EscalateDTO ed : dto.getEscalates()) {
                Escalate e = new Escalate();
                e.setDelay(ed.getDelay() != null ? ed.getDelay() : "0s");
                if (ed.getTargets() != null) {
                    for (TargetDTO td : ed.getTargets()) {
                        e.addTarget(targetFromDTO(td));
                    }
                }
                p.addEscalate(e);
            }
        }
        return p;
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll() {
        try {
            Map<String, org.opennms.netmgt.config.destinationPaths.Path> all = factory().getPaths();
            DestinationPathListDTO result = new DestinationPathListDTO();
            List<DestinationPathDTO> list = new ArrayList<>();
            for (org.opennms.netmgt.config.destinationPaths.Path p : all.values()) {
                list.add(pathToDTO(p));
            }
            result.setPaths(list);
            return Response.ok(result).build();
        } catch (IOException e) {
            LOG.error("Failed to load destination paths", e);
            return Response.serverError().entity("Failed to load destination paths").build();
        }
    }

    @GET
    @Path("{name}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getByName(@PathParam("name") String name) {
        try {
            org.opennms.netmgt.config.destinationPaths.Path p = factory().getPath(name);
            if (p == null) {
                return Response.status(404).entity("Path not found: " + name).build();
            }
            return Response.ok(pathToDTO(p)).build();
        } catch (IOException e) {
            LOG.error("Failed to load destination path {}", name, e);
            return Response.serverError().entity("Failed to load destination path").build();
        }
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(DestinationPathDTO dto) {
        if (dto == null || dto.getName() == null || dto.getName().isBlank()) {
            return Response.status(400).entity("name is required").build();
        }
        try {
            factory().addPath(pathFromDTO(dto));
            return Response.status(201).build();
        } catch (Exception e) {
            LOG.error("Failed to create destination path", e);
            return Response.serverError().entity("Failed to create destination path").build();
        }
    }

    @PUT
    @Path("{name}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("name") String name, DestinationPathDTO dto) {
        try {
            org.opennms.netmgt.config.destinationPaths.Path existing = factory().getPath(name);
            if (existing == null) {
                return Response.status(404).entity("Path not found: " + name).build();
            }
            dto.setName(name);
            factory().replacePath(name, pathFromDTO(dto));
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to update destination path {}", name, e);
            return Response.serverError().entity("Failed to update destination path").build();
        }
    }

    @DELETE
    @Path("{name}")
    public Response delete(@PathParam("name") String name) {
        try {
            org.opennms.netmgt.config.destinationPaths.Path existing = factory().getPath(name);
            if (existing == null) {
                return Response.status(404).entity("Path not found: " + name).build();
            }
            factory().removePath(name);
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to delete destination path {}", name, e);
            return Response.serverError().entity("Failed to delete destination path").build();
        }
    }
}
