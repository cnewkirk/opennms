<%@ page language="java" %>
<%
  String nodeId = request.getParameter("node");
  String dest = "/ui/assets";
  if (nodeId != null && !nodeId.isEmpty()) {
    try {
      Integer.parseInt(nodeId);
      dest = "/ui/asset/" + nodeId + "/edit";
    } catch (NumberFormatException e) { /* fall through to assets list */ }
  }
  response.sendRedirect(request.getContextPath() + dest);
%>
