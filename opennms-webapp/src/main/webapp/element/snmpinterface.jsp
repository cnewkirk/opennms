<%
String nodeId = request.getParameter("node");
String ifIndex = request.getParameter("ifindex");
if (nodeId == null || ifIndex == null) {
    response.sendRedirect(request.getContextPath() + "/ui/nodes");
} else {
    response.sendRedirect(request.getContextPath() + "/ui/snmpinterface/" + nodeId + "/" + ifIndex);
}
%>
