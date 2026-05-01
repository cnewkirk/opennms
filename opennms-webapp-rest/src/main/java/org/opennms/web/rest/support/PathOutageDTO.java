package org.opennms.web.rest.support;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "pathOutage")
public class PathOutageDTO {
    private int nodeId;
    private String nodeLabel;
    private String criticalPathIp;
    private String criticalPathServiceName;

    public PathOutageDTO() {}

    @XmlElement public int getNodeId() { return nodeId; }
    public void setNodeId(int nodeId) { this.nodeId = nodeId; }

    @XmlElement public String getNodeLabel() { return nodeLabel; }
    public void setNodeLabel(String nodeLabel) { this.nodeLabel = nodeLabel; }

    @XmlElement public String getCriticalPathIp() { return criticalPathIp; }
    public void setCriticalPathIp(String criticalPathIp) { this.criticalPathIp = criticalPathIp; }

    @XmlElement public String getCriticalPathServiceName() { return criticalPathServiceName; }
    public void setCriticalPathServiceName(String criticalPathServiceName) {
        this.criticalPathServiceName = criticalPathServiceName;
    }
}
