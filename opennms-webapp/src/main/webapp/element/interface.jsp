<%
String nodeId = request.getParameter("node");
String intf = request.getParameter("intf");
if (nodeId == null || intf == null) {
    response.sendRedirect(request.getContextPath() + "/ui/nodes");
} else {
    response.sendRedirect(request.getContextPath() + "/ui/interface/" + nodeId + "/" + java.net.URLEncoder.encode(intf, "UTF-8"));
}
%>
