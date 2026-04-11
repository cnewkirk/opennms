package org.opennms.web.rest.v2;

import java.util.ArrayList;
import java.util.List;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.soa.support.DefaultServiceRegistry;
import org.opennms.netmgt.config.dao.thresholding.api.WriteableThresholdingDao;
import org.opennms.netmgt.config.threshd.Expression;
import org.opennms.netmgt.config.threshd.FilterOperator;
import org.opennms.netmgt.config.threshd.Group;
import org.opennms.netmgt.config.threshd.ResourceFilter;
import org.opennms.netmgt.config.threshd.Threshold;
import org.opennms.netmgt.config.threshd.ThresholdType;
import org.opennms.netmgt.events.api.EventConstants;
import org.opennms.netmgt.events.api.EventProxy;
import org.opennms.netmgt.events.api.EventProxyException;
import org.opennms.netmgt.model.events.EventBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("thresholds")
@Tag(name = "Thresholds", description = "Thresholding Configuration API")
public class ThresholdRestService {

    private static final Logger LOG = LoggerFactory.getLogger(ThresholdRestService.class);

    @Autowired
    private EventProxy eventProxy;

    private WriteableThresholdingDao thresholdingDao() {
        WriteableThresholdingDao dao = DefaultServiceRegistry.INSTANCE.findProvider(WriteableThresholdingDao.class);
        if (dao == null) {
            throw new javax.ws.rs.ServiceUnavailableException("WriteableThresholdingDao not available");
        }
        return dao;
    }

    // ── DTOs ────────────────────────��────────────────────────────────────────

    public static class ResourceFilterDTO {
        private String field;
        private String filter;

        public ResourceFilterDTO() {}

        public String getField() { return field; }
        public void setField(String field) { this.field = field; }
        public String getFilter() { return filter; }
        public void setFilter(String filter) { this.filter = filter; }
    }

    public static class ThresholdDTO {
        private String type;
        private String dsType;
        private String dsName;
        private String value;
        private String rearm;
        private String trigger;
        private String dsLabel;
        private String triggeredUEI;
        private String rearmedUEI;
        private String filterOperator;
        private List<ResourceFilterDTO> resourceFilters = new ArrayList<>();
        private String description;
        private Boolean relaxed;

        public ThresholdDTO() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getDsType() { return dsType; }
        public void setDsType(String dsType) { this.dsType = dsType; }
        public String getDsName() { return dsName; }
        public void setDsName(String dsName) { this.dsName = dsName; }
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
        public String getRearm() { return rearm; }
        public void setRearm(String rearm) { this.rearm = rearm; }
        public String getTrigger() { return trigger; }
        public void setTrigger(String trigger) { this.trigger = trigger; }
        public String getDsLabel() { return dsLabel; }
        public void setDsLabel(String dsLabel) { this.dsLabel = dsLabel; }
        public String getTriggeredUEI() { return triggeredUEI; }
        public void setTriggeredUEI(String triggeredUEI) { this.triggeredUEI = triggeredUEI; }
        public String getRearmedUEI() { return rearmedUEI; }
        public void setRearmedUEI(String rearmedUEI) { this.rearmedUEI = rearmedUEI; }
        public String getFilterOperator() { return filterOperator; }
        public void setFilterOperator(String filterOperator) { this.filterOperator = filterOperator; }
        public List<ResourceFilterDTO> getResourceFilters() { return resourceFilters; }
        public void setResourceFilters(List<ResourceFilterDTO> resourceFilters) { this.resourceFilters = resourceFilters; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public Boolean getRelaxed() { return relaxed; }
        public void setRelaxed(Boolean relaxed) { this.relaxed = relaxed; }
    }

    public static class ExpressionDTO {
        private String type;
        private String dsType;
        private String expression;
        private String value;
        private String rearm;
        private String trigger;
        private String dsLabel;
        private String exprLabel;
        private String triggeredUEI;
        private String rearmedUEI;
        private String filterOperator;
        private List<ResourceFilterDTO> resourceFilters = new ArrayList<>();
        private String description;
        private Boolean relaxed;

        public ExpressionDTO() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getDsType() { return dsType; }
        public void setDsType(String dsType) { this.dsType = dsType; }
        public String getExpression() { return expression; }
        public void setExpression(String expression) { this.expression = expression; }
        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
        public String getRearm() { return rearm; }
        public void setRearm(String rearm) { this.rearm = rearm; }
        public String getTrigger() { return trigger; }
        public void setTrigger(String trigger) { this.trigger = trigger; }
        public String getDsLabel() { return dsLabel; }
        public void setDsLabel(String dsLabel) { this.dsLabel = dsLabel; }
        public String getExprLabel() { return exprLabel; }
        public void setExprLabel(String exprLabel) { this.exprLabel = exprLabel; }
        public String getTriggeredUEI() { return triggeredUEI; }
        public void setTriggeredUEI(String triggeredUEI) { this.triggeredUEI = triggeredUEI; }
        public String getRearmedUEI() { return rearmedUEI; }
        public void setRearmedUEI(String rearmedUEI) { this.rearmedUEI = rearmedUEI; }
        public String getFilterOperator() { return filterOperator; }
        public void setFilterOperator(String filterOperator) { this.filterOperator = filterOperator; }
        public List<ResourceFilterDTO> getResourceFilters() { return resourceFilters; }
        public void setResourceFilters(List<ResourceFilterDTO> resourceFilters) { this.resourceFilters = resourceFilters; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public Boolean getRelaxed() { return relaxed; }
        public void setRelaxed(Boolean relaxed) { this.relaxed = relaxed; }
    }

    public static class GroupDTO {
        private String name;
        private String rrdRepository;
        private List<ThresholdDTO> thresholds = new ArrayList<>();
        private List<ExpressionDTO> expressions = new ArrayList<>();

        public GroupDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRrdRepository() { return rrdRepository; }
        public void setRrdRepository(String rrdRepository) { this.rrdRepository = rrdRepository; }
        public List<ThresholdDTO> getThresholds() { return thresholds; }
        public void setThresholds(List<ThresholdDTO> thresholds) { this.thresholds = thresholds; }
        public List<ExpressionDTO> getExpressions() { return expressions; }
        public void setExpressions(List<ExpressionDTO> expressions) { this.expressions = expressions; }
    }

    public static class GroupSummaryDTO {
        private String name;
        private String rrdRepository;

        public GroupSummaryDTO() {}
        public GroupSummaryDTO(String name, String rrdRepository) {
            this.name = name;
            this.rrdRepository = rrdRepository;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRrdRepository() { return rrdRepository; }
        public void setRrdRepository(String rrdRepository) { this.rrdRepository = rrdRepository; }
    }

    public static class GroupListDTO {
        private List<GroupSummaryDTO> groups = new ArrayList<>();

        public GroupListDTO() {}

        public List<GroupSummaryDTO> getGroups() { return groups; }
        public void setGroups(List<GroupSummaryDTO> groups) { this.groups = groups; }
    }

    // ── Endpoints ─────────────────────────────────────────────────────��───────

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response listGroups() {
        try {
            GroupListDTO result = new GroupListDTO();
            for (Group g : thresholdingDao().getWriteableConfig().getGroups()) {
                result.getGroups().add(new GroupSummaryDTO(g.getName(), g.getRrdRepository()));
            }
            return Response.ok(result).build();
        } catch (Exception e) {
            LOG.error("Failed to list threshold groups", e);
            return Response.serverError().build();
        }
    }

    @GET
    @Path("/{groupName}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getGroup(@PathParam("groupName") String groupName) {
        try {
            Group group = thresholdingDao().getWriteableConfig().getGroup(groupName);
            return Response.ok(toGroupDTO(group)).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND).entity("Group not found: " + groupName).build();
        } catch (Exception e) {
            LOG.error("Failed to get threshold group: {}", groupName, e);
            return Response.serverError().build();
        }
    }

    @PUT
    @Path("/{groupName}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response saveGroup(@PathParam("groupName") String groupName, GroupDTO dto) {
        try {
            Group group = thresholdingDao().getWriteableConfig().getGroup(groupName);

            if (dto.getRrdRepository() != null) {
                group.setRrdRepository(dto.getRrdRepository());
            }

            group.setThresholds(new ArrayList<>());
            for (ThresholdDTO tdto : dto.getThresholds()) {
                group.addThreshold(toThreshold(tdto));
            }

            group.setExpressions(new ArrayList<>());
            for (ExpressionDTO edto : dto.getExpressions()) {
                group.addExpression(toExpression(edto));
            }

            thresholdingDao().saveConfig();
            fireReloadEvent();
            return Response.noContent().build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND).entity("Group not found: " + groupName).build();
        } catch (Exception e) {
            LOG.error("Failed to save threshold group: {}", groupName, e);
            return Response.serverError().build();
        }
    }

    @POST
    @Path("/reload")
    public Response reload() {
        try {
            thresholdingDao().reload();
            fireReloadEvent();
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Failed to reload thresholding config", e);
            return Response.serverError().build();
        }
    }

    // ── Helpers ──────────────────────────────────��────────────────────────────

    private void fireReloadEvent() {
        EventBuilder bldr = new EventBuilder(EventConstants.RELOAD_DAEMON_CONFIG_UEI, "ThresholdRestService");
        bldr.addParam(EventConstants.PARM_DAEMON_NAME, "Threshd");
        bldr.addParam(EventConstants.PARM_CONFIG_FILE_NAME, "thresholds.xml");
        try {
            eventProxy.send(bldr.getEvent());
        } catch (EventProxyException e) {
            LOG.warn("Could not send reload event for Threshd", e);
        }
    }

    private GroupDTO toGroupDTO(Group group) {
        GroupDTO dto = new GroupDTO();
        dto.setName(group.getName());
        dto.setRrdRepository(group.getRrdRepository());
        for (Threshold t : group.getThresholds()) {
            dto.getThresholds().add(toThresholdDTO(t));
        }
        for (Expression e : group.getExpressions()) {
            dto.getExpressions().add(toExpressionDTO(e));
        }
        return dto;
    }

    private ThresholdDTO toThresholdDTO(Threshold t) {
        ThresholdDTO dto = new ThresholdDTO();
        dto.setType(t.getType().getEnumName());
        dto.setDsType(t.getDsType());
        dto.setDsName(t.getDsName());
        dto.setValue(t.getValue());
        dto.setRearm(t.getRearm());
        dto.setTrigger(t.getTrigger());
        dto.setDsLabel(t.getDsLabel().orElse(null));
        dto.setTriggeredUEI(t.getTriggeredUEI().orElse(null));
        dto.setRearmedUEI(t.getRearmedUEI().orElse(null));
        dto.setFilterOperator(t.getFilterOperator().getEnumName());
        dto.setDescription(t.getDescription().orElse(null));
        dto.setRelaxed(t.getRelaxed());
        for (ResourceFilter rf : t.getResourceFilters()) {
            ResourceFilterDTO rfdto = new ResourceFilterDTO();
            rfdto.setField(rf.getField());
            rfdto.setFilter(rf.getContent().orElse(null));
            dto.getResourceFilters().add(rfdto);
        }
        return dto;
    }

    private ExpressionDTO toExpressionDTO(Expression e) {
        ExpressionDTO dto = new ExpressionDTO();
        dto.setType(e.getType().getEnumName());
        dto.setDsType(e.getDsType());
        dto.setExpression(e.getExpression());
        dto.setValue(e.getValue());
        dto.setRearm(e.getRearm());
        dto.setTrigger(e.getTrigger());
        dto.setDsLabel(e.getDsLabel().orElse(null));
        dto.setExprLabel(e.getExprLabel().orElse(null));
        dto.setTriggeredUEI(e.getTriggeredUEI().orElse(null));
        dto.setRearmedUEI(e.getRearmedUEI().orElse(null));
        dto.setFilterOperator(e.getFilterOperator().getEnumName());
        dto.setDescription(e.getDescription().orElse(null));
        dto.setRelaxed(e.getRelaxed());
        for (ResourceFilter rf : e.getResourceFilters()) {
            ResourceFilterDTO rfdto = new ResourceFilterDTO();
            rfdto.setField(rf.getField());
            rfdto.setFilter(rf.getContent().orElse(null));
            dto.getResourceFilters().add(rfdto);
        }
        return dto;
    }

    private Threshold toThreshold(ThresholdDTO dto) {
        Threshold t = new Threshold();
        t.setType(parseThresholdType(dto.getType()));
        t.setDsType(dto.getDsType());
        t.setDsName(dto.getDsName());
        t.setValue(dto.getValue());
        t.setRearm(dto.getRearm());
        t.setTrigger(dto.getTrigger());
        if (dto.getDsLabel() != null) t.setDsLabel(dto.getDsLabel());
        if (dto.getTriggeredUEI() != null) t.setTriggeredUEI(dto.getTriggeredUEI());
        if (dto.getRearmedUEI() != null) t.setRearmedUEI(dto.getRearmedUEI());
        if (dto.getFilterOperator() != null) t.setFilterOperator(parseFilterOperator(dto.getFilterOperator()));
        if (dto.getDescription() != null) t.setDescription(dto.getDescription());
        if (dto.getRelaxed() != null) t.setRelaxed(dto.getRelaxed());
        for (ResourceFilterDTO rfdto : dto.getResourceFilters()) {
            ResourceFilter rf = new ResourceFilter();
            rf.setField(rfdto.getField());
            if (rfdto.getFilter() != null) rf.setContent(rfdto.getFilter());
            t.addResourceFilter(rf);
        }
        return t;
    }

    private Expression toExpression(ExpressionDTO dto) {
        Expression e = new Expression();
        e.setType(parseThresholdType(dto.getType()));
        e.setDsType(dto.getDsType());
        e.setExpression(dto.getExpression());
        e.setValue(dto.getValue());
        e.setRearm(dto.getRearm());
        e.setTrigger(dto.getTrigger());
        if (dto.getDsLabel() != null) e.setDsLabel(dto.getDsLabel());
        if (dto.getExprLabel() != null) e.setExprLabel(dto.getExprLabel());
        if (dto.getTriggeredUEI() != null) e.setTriggeredUEI(dto.getTriggeredUEI());
        if (dto.getRearmedUEI() != null) e.setRearmedUEI(dto.getRearmedUEI());
        if (dto.getFilterOperator() != null) e.setFilterOperator(parseFilterOperator(dto.getFilterOperator()));
        if (dto.getDescription() != null) e.setDescription(dto.getDescription());
        if (dto.getRelaxed() != null) e.setRelaxed(dto.getRelaxed());
        for (ResourceFilterDTO rfdto : dto.getResourceFilters()) {
            ResourceFilter rf = new ResourceFilter();
            rf.setField(rfdto.getField());
            if (rfdto.getFilter() != null) rf.setContent(rfdto.getFilter());
            e.addResourceFilter(rf);
        }
        return e;
    }

    private ThresholdType parseThresholdType(String value) {
        if (value == null) return ThresholdType.HIGH;
        for (ThresholdType tt : ThresholdType.values()) {
            if (tt.getEnumName().equals(value)) return tt;
        }
        return ThresholdType.valueOf(value.toUpperCase().replace('-', '_'));
    }

    private FilterOperator parseFilterOperator(String value) {
        if (value == null) return FilterOperator.OR;
        if ("and".equalsIgnoreCase(value)) return FilterOperator.AND;
        return FilterOperator.OR;
    }
}
