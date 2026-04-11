<%@ page language="java" contentType="text/html" session="true" %>
<%
    String contextPath = request.getContextPath();
    response.sendRedirect(contextPath + "/ui/discovery-config");
%>
