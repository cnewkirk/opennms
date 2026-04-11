<%@page language="java" contentType="text/html" session="true" %>
<%
  String outageId = request.getParameter("id");
  if (outageId == null || outageId.isEmpty()) {
    response.sendRedirect(request.getContextPath() + "/ui/outages");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/outage/" + outageId);
  }
%>
