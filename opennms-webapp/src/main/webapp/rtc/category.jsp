<%
String cat = request.getParameter("category");
String dest = request.getContextPath() + "/ui/rtc/category";
if (cat != null && !cat.isEmpty()) {
    dest += "?category=" + java.net.URLEncoder.encode(cat, "UTF-8");
}
response.sendRedirect(dest);
%>
