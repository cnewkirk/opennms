package org.opennms.web.rest.v2;

import java.util.HashMap;
import java.util.Map;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.EnhancedLinkdConfig;
import org.opennms.netmgt.config.api.CollectdConfigFactory;
import org.opennms.netmgt.config.api.DataCollectionConfigDao;
import org.opennms.netmgt.config.collectd.Package;
import org.opennms.netmgt.config.collectd.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * REST endpoint that exposes actual configured collection and discovery
 * intervals so the Vue UI can derive cache TTLs from server configuration
 * rather than using hardcoded values.
 */
@Component
@Path("config/measurementIntervals")
@Tag(name = "MeasurementIntervals", description = "Measurement Intervals Config API")
public class MeasurementIntervalsRestService {

    private static final Logger LOG = LoggerFactory.getLogger(MeasurementIntervalsRestService.class);

    @Autowired(required = false)
    private CollectdConfigFactory collectdConfigFactory;

    @Autowired(required = false)
    private DataCollectionConfigDao dataCollectionConfigDao;

    @Autowired(required = false)
    private EnhancedLinkdConfig enhancedLinkdConfig;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
        summary = "Get configured measurement and discovery intervals",
        description = "Returns the minimum SNMP collection interval per service name (minimum across all packages "
            + "— using the minimum ensures the UI cache TTL never exceeds the shortest active collection cycle, "
            + "preventing stale reads regardless of which package a node falls into), the RRD step size, "
            + "and per-protocol EnLinkd discovery rescanning intervals. Intended for use as cache TTL hints "
            + "in the Vue UI.",
        operationId = "getMeasurementIntervals"
    )
    public Response getIntervals() {
        try {
            return Response.ok(buildDto(collectdConfigFactory, dataCollectionConfigDao, enhancedLinkdConfig)).build();
        } catch (Exception e) {
            LOG.error("Failed to build measurement intervals response", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    /**
     * Builds the response DTO from the three optional config beans.
     *
     * <p>Collection intervals: for each service name (e.g. "SNMP"), we take the
     * <em>minimum</em> interval across all packages that define that service.
     * Using the minimum guarantees the UI cache TTL never outlives the shortest
     * active collection cycle — if any package collects every 30 s, caching for
     * 300 s would return stale data for nodes in that package.</p>
     *
     * @param collectd  collectd config factory, may be null
     * @param dcDao     data-collection config DAO, may be null
     * @param enlinkd   enhanced linkd config, may be null
     * @return populated DTO; sections for null beans are omitted (NON_NULL)
     */
    static IntervalsDto buildDto(CollectdConfigFactory collectd,
                                 DataCollectionConfigDao dcDao,
                                 EnhancedLinkdConfig enlinkd) {
        IntervalsDto dto = new IntervalsDto();

        // --- Collection intervals (min across packages) ---
        if (collectd != null) {
            Map<String, Long> collection = new HashMap<>();
            for (Package pkg : collectd.getPackages()) {
                for (Service svc : pkg.getServices()) {
                    collection.merge(svc.getName(), svc.getInterval(), Math::min);
                }
            }
            dto.collection = collection.isEmpty() ? new HashMap<>() : collection;
        }

        // --- RRD step from the "default" SNMP collection ---
        if (dcDao != null) {
            dto.rrdStep = dcDao.getStep("default");
        }

        // --- EnLinkd per-protocol discovery intervals ---
        if (enlinkd != null) {
            Map<String, Long> el = new HashMap<>();
            el.put("lldp", enlinkd.getLldpRescanInterval());
            el.put("ospf", enlinkd.getOspfRescanInterval());
            el.put("isis", enlinkd.getIsisRescanInterval());
            el.put("cdp", enlinkd.getCdpRescanInterval());
            el.put("bridge", enlinkd.getBridgeRescanInterval());
            el.put("topology", enlinkd.getTopologyInterval());
            dto.enlinkd = el;
        }

        return dto;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class IntervalsDto {
        /** Minimum SNMP collection interval (ms) per service name, across all packages. */
        public Map<String, Long> collection;

        /** RRD step size (seconds) for the "default" SNMP collection. */
        public int rrdStep;

        /** EnLinkd per-protocol discovery rescan intervals (ms). */
        public Map<String, Long> enlinkd;
    }
}
