package org.opennms.web.rest.v2;

import java.util.HashMap;
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.filter.api.FilterDao;
import org.opennms.netmgt.filter.api.FilterParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("filterRule")
@Tag(name = "FilterRule", description = "Filter Rule Validation API")
public class FilterRuleRestService {

    private static final Logger LOG = LoggerFactory.getLogger(FilterRuleRestService.class);

    @Autowired
    private FilterDao filterDao;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public static class FilterRuleRequest {
        private String rule;

        public FilterRuleRequest() {}

        public String getRule() { return rule; }
        public void setRule(String rule) { this.rule = rule; }
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @POST
    @Path("validate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response validateRule(FilterRuleRequest req) {
        if (req == null || req.getRule() == null || req.getRule().isBlank()) {
            return Response.status(400).entity(errorMap("rule is required")).build();
        }
        try {
            filterDao.validateRule(req.getRule());
            return Response.noContent().build();
        } catch (FilterParseException e) {
            return Response.status(400).entity(errorMap(e.getMessage())).build();
        } catch (Exception e) {
            LOG.error("Unexpected error validating filter rule", e);
            return Response.serverError().entity(errorMap("Validation failed: " + e.getMessage())).build();
        }
    }

    private Map<String, String> errorMap(String message) {
        Map<String, String> m = new HashMap<>();
        m.put("error", message);
        return m;
    }
}
