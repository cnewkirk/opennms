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
import org.opennms.netmgt.config.NotificationFactory;
import org.opennms.netmgt.config.notifications.Notification;
import org.opennms.netmgt.config.notifications.Parameter;
import org.opennms.netmgt.config.notifications.Rule;
import org.opennms.netmgt.config.notifications.Varbind;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Path("notificationConfig")
@Tag(name = "NotificationConfig", description = "Notification Rules Configuration API")
public class NotificationConfigRestService {

    private static final Logger LOG = LoggerFactory.getLogger(NotificationConfigRestService.class);

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public static class VarbindDTO {
        private String vbname;
        private String vbvalue;

        public VarbindDTO() {}

        public String getVbname() { return vbname; }
        public void setVbname(String vbname) { this.vbname = vbname; }
        public String getVbvalue() { return vbvalue; }
        public void setVbvalue(String vbvalue) { this.vbvalue = vbvalue; }
    }

    public static class ParameterDTO {
        private String name;
        private String value;

        public ParameterDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
    }

    public static class NotificationConfigDTO {
        private String name;
        private String status;
        private Boolean writeable;
        private String uei;
        private String description;
        private String rule;
        private String destinationPath;
        private String textMessage;
        private String subject;
        private String numericMessage;
        private String eventSeverity;
        private String noticeQueue;
        private VarbindDTO varbind;
        private List<ParameterDTO> parameters = new ArrayList<>();

        public NotificationConfigDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public Boolean getWriteable() { return writeable; }
        public void setWriteable(Boolean writeable) { this.writeable = writeable; }
        public String getUei() { return uei; }
        public void setUei(String uei) { this.uei = uei; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getRule() { return rule; }
        public void setRule(String rule) { this.rule = rule; }
        public String getDestinationPath() { return destinationPath; }
        public void setDestinationPath(String destinationPath) { this.destinationPath = destinationPath; }
        public String getTextMessage() { return textMessage; }
        public void setTextMessage(String textMessage) { this.textMessage = textMessage; }
        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }
        public String getNumericMessage() { return numericMessage; }
        public void setNumericMessage(String numericMessage) { this.numericMessage = numericMessage; }
        public String getEventSeverity() { return eventSeverity; }
        public void setEventSeverity(String eventSeverity) { this.eventSeverity = eventSeverity; }
        public String getNoticeQueue() { return noticeQueue; }
        public void setNoticeQueue(String noticeQueue) { this.noticeQueue = noticeQueue; }
        public VarbindDTO getVarbind() { return varbind; }
        public void setVarbind(VarbindDTO varbind) { this.varbind = varbind; }
        public List<ParameterDTO> getParameters() { return parameters; }
        public void setParameters(List<ParameterDTO> parameters) { this.parameters = parameters; }
    }

    public static class NotificationConfigListDTO {
        private List<NotificationConfigDTO> notifications = new ArrayList<>();

        public NotificationConfigListDTO() {}

        public List<NotificationConfigDTO> getNotifications() { return notifications; }
        public void setNotifications(List<NotificationConfigDTO> notifications) { this.notifications = notifications; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private NotificationFactory factory() {
        try {
            return NotificationFactory.getInstance();
        } catch (IllegalStateException e) {
            throw new javax.ws.rs.ServiceUnavailableException("NotificationFactory not initialized");
        }
    }

    private NotificationConfigDTO toDTO(Notification n) {
        NotificationConfigDTO dto = new NotificationConfigDTO();
        dto.setName(n.getName());
        dto.setStatus(n.getStatus());
        dto.setWriteable(n.getWriteable());
        dto.setUei(n.getUei());
        dto.setDescription(n.getDescription().orElse(null));
        if (n.getRule() != null) {
            dto.setRule(n.getRule().getContent());
        }
        dto.setDestinationPath(n.getDestinationPath());
        dto.setTextMessage(n.getTextMessage());
        dto.setSubject(n.getSubject().orElse(null));
        dto.setNumericMessage(n.getNumericMessage().orElse(null));
        dto.setEventSeverity(n.getEventSeverity().orElse(null));
        dto.setNoticeQueue(n.getNoticeQueue().orElse(null));
        if (n.getVarbind() != null) {
            VarbindDTO vb = new VarbindDTO();
            vb.setVbname(n.getVarbind().getVbname());
            vb.setVbvalue(n.getVarbind().getVbvalue());
            dto.setVarbind(vb);
        }
        List<ParameterDTO> params = new ArrayList<>();
        for (Parameter p : n.getParameters()) {
            ParameterDTO pd = new ParameterDTO();
            pd.setName(p.getName());
            pd.setValue(p.getValue());
            params.add(pd);
        }
        dto.setParameters(params);
        return dto;
    }

    private Notification fromDTO(NotificationConfigDTO dto) {
        Notification n = new Notification();
        n.setName(dto.getName());
        n.setStatus(dto.getStatus() != null ? dto.getStatus() : "on");
        if (dto.getWriteable() != null) n.setWriteable(dto.getWriteable());
        n.setUei(dto.getUei());
        if (dto.getDescription() != null) n.setDescription(dto.getDescription());
        Rule rule = new Rule();
        rule.setContent(dto.getRule() != null ? dto.getRule() : "IPADDR != '0.0.0.0'");
        n.setRule(rule);
        n.setDestinationPath(dto.getDestinationPath());
        n.setTextMessage(dto.getTextMessage());
        if (dto.getSubject() != null) n.setSubject(dto.getSubject());
        if (dto.getNumericMessage() != null) n.setNumericMessage(dto.getNumericMessage());
        if (dto.getEventSeverity() != null) n.setEventSeverity(dto.getEventSeverity());
        if (dto.getNoticeQueue() != null) n.setNoticeQueue(dto.getNoticeQueue());
        if (dto.getVarbind() != null) {
            Varbind vb = new Varbind();
            vb.setVbname(dto.getVarbind().getVbname());
            vb.setVbvalue(dto.getVarbind().getVbvalue());
            n.setVarbind(vb);
        }
        if (dto.getParameters() != null) {
            for (ParameterDTO pd : dto.getParameters()) {
                Parameter p = new Parameter();
                p.setName(pd.getName());
                p.setValue(pd.getValue());
                n.addParameter(p);
            }
        }
        return n;
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll() {
        try {
            Map<String, Notification> all = factory().getNotifications();
            NotificationConfigListDTO result = new NotificationConfigListDTO();
            List<NotificationConfigDTO> list = new ArrayList<>();
            for (Notification n : all.values()) {
                list.add(toDTO(n));
            }
            result.setNotifications(list);
            return Response.ok(result).build();
        } catch (IOException e) {
            LOG.error("Failed to load notifications", e);
            return Response.serverError().entity("Failed to load notifications").build();
        }
    }

    @GET
    @Path("{name}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getByName(@PathParam("name") String name) {
        try {
            Notification n = factory().getNotification(name);
            if (n == null) {
                return Response.status(404).entity("Notification not found: " + name).build();
            }
            return Response.ok(toDTO(n)).build();
        } catch (IOException e) {
            LOG.error("Failed to load notification {}", name, e);
            return Response.serverError().entity("Failed to load notification").build();
        }
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(NotificationConfigDTO dto) {
        if (dto == null || dto.getName() == null || dto.getName().isBlank()) {
            return Response.status(400).entity("name is required").build();
        }
        try {
            factory().addNotification(fromDTO(dto));
            return Response.status(201).build();
        } catch (Exception e) {
            LOG.error("Failed to create notification", e);
            return Response.serverError().entity("Failed to create notification").build();
        }
    }

    @PUT
    @Path("{name}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("name") String name, NotificationConfigDTO dto) {
        try {
            Notification existing = factory().getNotification(name);
            if (existing == null) {
                return Response.status(404).entity("Notification not found: " + name).build();
            }
            dto.setName(name);
            factory().replaceNotification(name, fromDTO(dto));
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to update notification {}", name, e);
            return Response.serverError().entity("Failed to update notification").build();
        }
    }

    @DELETE
    @Path("{name}")
    public Response delete(@PathParam("name") String name) {
        try {
            Notification existing = factory().getNotification(name);
            if (existing == null) {
                return Response.status(404).entity("Notification not found: " + name).build();
            }
            factory().removeNotification(name);
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to delete notification {}", name, e);
            return Response.serverError().entity("Failed to delete notification").build();
        }
    }

    @POST
    @Path("{name}/toggle")
    public Response toggle(@PathParam("name") String name) {
        try {
            Notification existing = factory().getNotification(name);
            if (existing == null) {
                return Response.status(404).entity("Notification not found: " + name).build();
            }
            String newStatus = "on".equalsIgnoreCase(existing.getStatus()) ? "off" : "on";
            factory().updateStatus(name, newStatus);
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to toggle notification {}", name, e);
            return Response.serverError().entity("Failed to toggle notification").build();
        }
    }

    @POST
    @Path("reload")
    public Response reload() {
        try {
            factory().reload();
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to reload notifications", e);
            return Response.serverError().entity("Failed to reload notifications").build();
        }
    }
}
