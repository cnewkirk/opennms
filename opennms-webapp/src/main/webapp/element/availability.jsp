<%
String nodeId = request.getParameter("node");
if (nodeId == null) {
    response.sendRedirect(request.getContextPath() + "/ui/nodes");
} else {
    response.sendRedirect(request.getContextPath() + "/ui/node/" + nodeId + "?tab=overview");
}
%>
