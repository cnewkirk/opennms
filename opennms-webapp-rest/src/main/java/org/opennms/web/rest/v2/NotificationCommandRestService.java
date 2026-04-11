package org.opennms.web.rest.v2;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.NotificationCommandFactory;
import org.opennms.netmgt.config.notificationCommands.Command;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("notificationCommands")
@Tag(name = "NotificationCommands", description = "Notification Commands API (read-only)")
public class NotificationCommandRestService {

    private static final Logger LOG = LoggerFactory.getLogger(NotificationCommandRestService.class);

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public static class NotificationCommandDTO {
        private String name;
        private String description;
        private Boolean binary;

        public NotificationCommandDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public Boolean getBinary() { return binary; }
        public void setBinary(Boolean binary) { this.binary = binary; }
    }

    public static class NotificationCommandListDTO {
        private List<NotificationCommandDTO> commands = new ArrayList<>();

        public NotificationCommandListDTO() {}

        public List<NotificationCommandDTO> getCommands() { return commands; }
        public void setCommands(List<NotificationCommandDTO> commands) { this.commands = commands; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private NotificationCommandFactory factory() {
        return NotificationCommandFactory.getInstance();
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll() {
        try {
            Map<String, Command> all = factory().getCommands();
            NotificationCommandListDTO result = new NotificationCommandListDTO();
            List<NotificationCommandDTO> list = new ArrayList<>();
            for (Command cmd : all.values()) {
                NotificationCommandDTO dto = new NotificationCommandDTO();
                dto.setName(cmd.getName());
                dto.setDescription(cmd.getComment().orElse(null));
                dto.setBinary(cmd.getBinary());
                list.add(dto);
            }
            result.setCommands(list);
            return Response.ok(result).build();
        } catch (Exception e) {
            LOG.error("Failed to load notification commands", e);
            return Response.serverError().entity("Failed to load notification commands").build();
        }
    }
}
