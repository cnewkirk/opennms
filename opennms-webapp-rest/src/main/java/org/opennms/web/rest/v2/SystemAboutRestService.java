package org.opennms.web.rest.v2;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.db.DataSourceFactory;
import org.opennms.core.resource.Vault;
import org.opennms.core.utils.DBUtils;
import org.springframework.stereotype.Component;

@Component
@Path("system/about")
@Tag(name = "System", description = "System Information API")
@Produces(MediaType.APPLICATION_JSON)
public class SystemAboutRestService {

    @GET
    @Operation(summary = "Get system about information", operationId = "getSystemAbout")
    public Response getSystemAbout() {
        SystemAboutDTO dto = new SystemAboutDTO();

        dto.version = Vault.getProperty("version.display");
        dto.displayVersion = Vault.getProperty("version.display");
        dto.packageName = Vault.getProperty("opennms.product");

        // DB metadata — always clean up the connection
        DBUtils d = new DBUtils(getClass());
        try {
            Connection conn = DataSourceFactory.getInstance().getConnection();
            d.watch(conn);
            DatabaseMetaData meta = conn.getMetaData();
            dto.dbProductName = meta.getDatabaseProductName();
            dto.dbVersion = meta.getDatabaseProductVersion();
        } catch (Exception e) {
            dto.dbProductName = "Unknown";
            dto.dbVersion = "Unknown";
        } finally {
            d.cleanUp();
        }

        dto.javaVersion = System.getProperty("java.version");
        dto.javaVendor = System.getProperty("java.vendor");
        dto.javaRuntimeName = System.getProperty("java.runtime.name");
        dto.osName = System.getProperty("os.name");
        dto.osVersion = System.getProperty("os.version");
        dto.osArch = System.getProperty("os.arch");
        dto.serverTimeMs = System.currentTimeMillis();

        return Response.ok(dto).build();
    }

    public static class SystemAboutDTO {
        public String version;
        public String displayVersion;
        public String packageName;
        public String dbProductName;
        public String dbVersion;
        public String javaVersion;
        public String javaVendor;
        public String javaRuntimeName;
        public String osName;
        public String osVersion;
        public String osArch;
        public long serverTimeMs;
    }
}
