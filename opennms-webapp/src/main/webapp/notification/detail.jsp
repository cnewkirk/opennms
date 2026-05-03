<%@ page language="java" %>
<%
  String noticeId = request.getParameter("notice");
  String dest = "/ui/notifications";
  if (noticeId != null && !noticeId.isEmpty()) {
    try {
      Integer.parseInt(noticeId);
      dest = "/ui/notification/" + noticeId;
    } catch (NumberFormatException e) { /* fall through to list */ }
  }
  response.sendRedirect(request.getContextPath() + dest);
%>
