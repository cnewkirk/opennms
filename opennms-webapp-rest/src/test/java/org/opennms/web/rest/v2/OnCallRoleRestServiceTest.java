package org.opennms.web.rest.v2;

import static org.junit.Assert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;
import org.junit.Test;
import org.opennms.netmgt.config.groups.Role;
import org.opennms.web.rest.support.RoleList;

public class OnCallRoleRestServiceTest {

    // Register Jdk8Module so Optional<String> (used by Role.getDescription()) serializes correctly.
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new Jdk8Module());

    @Test
    public void roleListSerializesExpectedFields() throws Exception {
        Role role = new Role();
        role.setName("Network-On-Call");
        role.setMembershipGroup("Network");
        role.setSupervisor("admin");
        role.setDescription("Network team on-call rotation");

        RoleList list = new RoleList();
        list.getRoles().add(role);

        String json = mapper.writeValueAsString(list);
        assertTrue("JSON should contain role name", json.contains("Network-On-Call"));
        assertTrue("JSON should contain membership group", json.contains("Network"));
        assertTrue("JSON should contain supervisor", json.contains("admin"));
        assertTrue("JSON should contain description", json.contains("Network team on-call rotation"));
    }

    @Test
    public void roleListConstructorAcceptsCollection() throws Exception {
        Role r1 = new Role();
        r1.setName("noc-primary");
        r1.setMembershipGroup("NOC");
        r1.setSupervisor("noc-lead");

        Role r2 = new Role();
        r2.setName("noc-secondary");
        r2.setMembershipGroup("NOC");
        r2.setSupervisor("noc-lead");

        java.util.List<Role> roles = java.util.Arrays.asList(r1, r2);
        RoleList list = new RoleList(roles);

        assertEquals(2, list.getRoles().size());

        String json = mapper.writeValueAsString(list);
        assertTrue("JSON should contain first role", json.contains("noc-primary"));
        assertTrue("JSON should contain second role", json.contains("noc-secondary"));
    }

    @Test
    public void emptyRoleListSerializesWithoutError() throws Exception {
        RoleList list = new RoleList();
        String json = mapper.writeValueAsString(list);
        assertNotNull(json);
        // An empty list should not contain any role names
        assertFalse(json.contains("Network-On-Call"));
    }
}
