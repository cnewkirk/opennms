<%@ page language="java" %>
<%
  String nodeId = request.getParameter("node");
  String dest = "/ui/nodes";
  if (nodeId != null && !nodeId.isEmpty()) {
    try {
      Integer.parseInt(nodeId);
      dest = "/ui/node/" + nodeId;
    } catch (NumberFormatException e) { /* fall through to nodes list */ }
  }
  response.sendRedirect(request.getContextPath() + dest);
%>
