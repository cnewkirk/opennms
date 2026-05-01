package org.opennms.web.rest.support;

import org.opennms.netmgt.config.groups.Role;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@XmlRootElement(name = "roles")
public class RoleList {
    private List<Role> m_roles = new ArrayList<>();

    public RoleList() {}

    public RoleList(Collection<Role> roles) {
        m_roles.addAll(roles);
    }

    @XmlElement(name = "role")
    public List<Role> getRoles() { return m_roles; }
    public void setRoles(List<Role> roles) { m_roles = roles; }
}
