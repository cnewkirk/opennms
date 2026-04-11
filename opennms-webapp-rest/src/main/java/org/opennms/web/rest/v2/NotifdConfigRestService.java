package org.opennms.web.rest.v2;

import java.io.IOException;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.NotifdConfigFactory;
import org.opennms.netmgt.events.api.EventProxy;
import org.opennms.netmgt.events.api.EventProxyException;
import org.opennms.netmgt.model.events.EventBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("notifd")
@Tag(name = "NotifdConfig", description = "Notifd Global Status API")
public class NotifdConfigRestService {

    private static final Logger LOG = LoggerFactory.getLogger(NotifdConfigRestService.class);

    @Autowired
    private EventProxy eventProxy;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public static class NotifdStatusDTO {
        private String status;

        public NotifdStatusDTO() {}

        public NotifdStatusDTO(String status) { this.status = status; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private NotifdConfigFactory factory() {
        try {
            return NotifdConfigFactory.getInstance();
        } catch (IllegalStateException e) {
            throw new javax.ws.rs.ServiceUnavailableException("NotifdConfigFactory not initialized");
        }
    }

    private void sendEvent(String uei) {
        try {
            eventProxy.send(new EventBuilder(uei, "REST").getEvent());
        } catch (EventProxyException e) {
            LOG.warn("Failed to send event {}: {}", uei, e.getMessage());
        }
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GET
    @Path("status")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getStatus() {
        try {
            NotifdConfigFactory f = factory();
            String status = f.getConfiguration().getStatus();
            return Response.ok(new NotifdStatusDTO(status)).build();
        } catch (IOException e) {
            LOG.error("Failed to read notifd configuration", e);
            return Response.serverError().entity("Failed to read notifd configuration").build();
        }
    }

    @POST
    @Path("status")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response setStatus(NotifdStatusDTO dto) {
        if (dto == null || dto.getStatus() == null) {
            return Response.status(400).entity("Missing status field").build();
        }
        try {
            NotifdConfigFactory f = factory();
            if ("on".equalsIgnoreCase(dto.getStatus())) {
                f.turnNotifdOn();
                sendEvent("uei.opennms.org/internal/notificationsTurnedOn");
            } else if ("off".equalsIgnoreCase(dto.getStatus())) {
                f.turnNotifdOff();
                sendEvent("uei.opennms.org/internal/notificationsTurnedOff");
            } else {
                return Response.status(400).entity("status must be 'on' or 'off'").build();
            }
            return Response.noContent().build();
        } catch (IOException e) {
            LOG.error("Failed to update notifd status", e);
            return Response.serverError().entity("Failed to update notifd status").build();
        }
    }
}
