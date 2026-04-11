<%--
  Redirects legacy event detail URL to the Vue SPA event detail page.
  Reads ?id=123 from the original request and redirects to /#/event/123.
--%>
<%@ page contentType="text/html" %>
<%
  String eventId = request.getParameter("id");
  if (eventId == null || eventId.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing id parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/event/" + eventId);
  }
%>
