<%@page language="java" contentType="text/html" session="true" %>
<%
  String alarmId = request.getParameter("id");
  if (alarmId == null || alarmId.isEmpty()) {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/alarms");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/alarm/" + alarmId);
  }
%>
