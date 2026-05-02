<%@ page language="java" %>
<%
  String name = request.getParameter("role");
  String target = "/ui/on-call-roles";
  if (name != null && !name.isEmpty()) {
    target = "/ui/on-call-role/" + java.net.URLEncoder.encode(name, "UTF-8");
  }
  response.sendRedirect(request.getContextPath() + target);
%>
