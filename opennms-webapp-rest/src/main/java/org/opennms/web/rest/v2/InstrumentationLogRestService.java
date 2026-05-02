package org.opennms.web.rest.v2;

import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.web.api.Authentication;
import org.opennms.util.ilr.Collector;
import org.springframework.stereotype.Component;

@Component
@Path("instrumentation-log")
@Tag(name = "Instrumentation Log", description = "Instrumentation Log Reader API")
@Produces(MediaType.APPLICATION_JSON)
public class InstrumentationLogRestService {

    @GET
    @Operation(summary = "Get instrumentation log statistics", operationId = "getInstrumentationLog")
    public Response getInstrumentationLog(
            @Context SecurityContext securityContext,
            @QueryParam("search") @DefaultValue("") String search,
            @QueryParam("sortColumn") @DefaultValue("TOTALCOLLECTS") String sortColumn,
            @QueryParam("sortOrder") @DefaultValue("DESCENDING") String sortOrder) {

        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Status.FORBIDDEN).build();
        }

        String opennmsHome = System.getProperty("opennms.home");
        if (opennmsHome == null) {
            return Response.ok(Collections.emptyList()).build();
        }

        Collector collector = new Collector();
        if (!search.isEmpty()) {
            collector.setSearchString(search);
        }
        try {
            collector.setSortColumn(Collector.SortColumn.valueOf(sortColumn));
        } catch (IllegalArgumentException ignored) { }
        try {
            collector.setSortOrder(Collector.SortOrder.valueOf(sortOrder));
        } catch (IllegalArgumentException ignored) { }

        File logDir = new File(opennmsHome, "logs");
        if (logDir.exists() && logDir.isDirectory()) {
            File[] logFiles = logDir.listFiles(f -> f.getName().startsWith("instrumentation.log"));
            if (logFiles != null) {
                for (File f : logFiles) {
                    try {
                        collector.readLogMessagesFromFile(f.getPath());
                    } catch (IOException ignored) { }
                }
            }
        }

        List<ServiceCollectorDTO> result = collector.getServiceCollectors()
                .stream()
                .map(ServiceCollectorDTO::from)
                .collect(Collectors.toList());

        return Response.ok(result).build();
    }
}
