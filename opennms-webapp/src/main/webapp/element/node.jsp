<%--
  Redirects legacy node detail URL to the Vue SPA node detail page.
  Passes ?node=123 (numeric) or ?node=foreignSource:foreignId through as-is.
  The v2 REST API and Vue router both accept both formats.
--%>
<%
  String nodeId = request.getParameter("node");
  if (nodeId == null || nodeId.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing node parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/node/" + nodeId);
  }
%>
