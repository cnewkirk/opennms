package org.opennms.web.rest.v2;

import static org.junit.Assert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import org.opennms.web.rest.support.PathOutageDTO;

public class PathOutageRestServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    public void dtoRoundTripsAsJson() throws Exception {
        PathOutageDTO dto = new PathOutageDTO();
        dto.setNodeId(42);
        dto.setNodeLabel("router-core");
        dto.setCriticalPathIp("10.0.0.1");
        dto.setCriticalPathServiceName("ICMP");

        String json = mapper.writeValueAsString(dto);
        PathOutageDTO back = mapper.readValue(json, PathOutageDTO.class);

        assertEquals(42, back.getNodeId());
        assertEquals("router-core", back.getNodeLabel());
        assertEquals("10.0.0.1", back.getCriticalPathIp());
        assertEquals("ICMP", back.getCriticalPathServiceName());
    }
}
