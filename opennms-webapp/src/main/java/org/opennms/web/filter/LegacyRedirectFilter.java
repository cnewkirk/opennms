package org.opennms.web.filter;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class LegacyRedirectFilter implements Filter {

    static final Map<String, String> SIMPLE_REDIRECTS;
    static final Map<String, Function<HttpServletRequest, String>> PARAMETERIZED_REDIRECTS;

    static {
        Map<String, String> simple = new HashMap<>();

        // Monitoring
        simple.put("/alarm/list.htm",            "/alarms");
        simple.put("/alarm/list",                "/alarms");
        simple.put("/alarm/index.htm",           "/alarms");
        simple.put("/event/list.htm",            "/events");
        simple.put("/event/list",                "/events");
        simple.put("/event/index",               "/events");
        simple.put("/event/index.jsp",           "/events");
        simple.put("/outage/list.htm",           "/outages");
        simple.put("/outage/list",               "/outages");
        simple.put("/outage/index.jsp",          "/outages");
        simple.put("/notification/list.htm",     "/notifications");
        simple.put("/notification/browse",       "/notifications");
        simple.put("/notification/index.jsp",    "/notifications");

        // Inventory
        simple.put("/element/nodeList.htm",      "/nodes");
        simple.put("/element/index.jsp",         "/nodes");
        simple.put("/element/linkednode.jsp",    "/nodes");
        simple.put("/asset/index.jsp",           "/assets");
        simple.put("/hardware/list.jsp",         "/hardware");
        simple.put("/application/index.jsp",     "/applications");
        simple.put("/pathOutage/index.jsp",      "/path-outages");
        simple.put("/minion/index.jsp",          "/minions");
        simple.put("/locations/index.jsp",       "/monitoring-locations");

        // Dashboards / Views
        simple.put("/dashboard.jsp",             "/surveillance-dashboard");
        simple.put("/surveillance-view.jsp",     "/surveillance-dashboard");
        simple.put("/surveillance-box.jsp",      "/surveillance-dashboard");
        simple.put("/rtc/index.jsp",             "/surveillance-dashboard");
        simple.put("/rtc/category.jsp",          "/rtc/category");
        simple.put("/topology.jsp",              "/topology");

        // Graphs / Reports
        simple.put("/graph/index.jsp",           "/resource-graphs");
        simple.put("/KSC/index.jsp",             "/ksc-reports");
        simple.put("/report/database/index.jsp", "/reports");
        simple.put("/statisticsReports/index.htm", "/reports");

        // Help / About
        simple.put("/help/index.jsp",            "/help");
        simple.put("/support/index.jsp",         "/support");
        simple.put("/status/index.jsp",          "/status");
        simple.put("/about/index.jsp",           "/about");

        // Account
        simple.put("/account/selfService/index.jsp",        "/account");
        simple.put("/account/selfService/newPasswordEntry", "/account");

        // Front page / Home
        simple.put("/frontPage.jsp",             "/dashboard");
        simple.put("/index.jsp",                 "/dashboard");

        // Admin — General
        simple.put("/admin/index.jsp",                               "/admin");
        simple.put("/admin/sysconfig.jsp",                           "/system-config");
        simple.put("/admin/discovery/edit-config.jsp",               "/discovery-config");
        simple.put("/admin/discovery/index.jsp",                     "/discovery-config");
        simple.put("/admin/discovery/edit-scan.jsp",                 "/discovery-scan");
        simple.put("/admin/deleteNodes",                             "/delete-nodes");
        simple.put("/admin/newInterface.jsp",                        "/add-interface");
        simple.put("/admin/manage.jsp",                              "/manage-interfaces");

        // Admin — Users / Groups
        simple.put("/admin/userGroupView/index.jsp",                 "/users-groups");
        simple.put("/admin/userGroupView/users/list.jsp",            "/users-groups");
        simple.put("/admin/userGroupView/groups/list.htm",           "/users-groups");
        simple.put("/admin/userGroupView/roles",                     "/on-call-roles");
        simple.put("/roles/list.jsp",                                "/on-call-roles");

        // Admin — SNMP / Collection
        simple.put("/admin/snmpConfig",                              "/snmp-config");
        simple.put("/admin/snmpConfig.jsp",                          "/snmp-config");
        simple.put("/admin/snmpGetNodes",                            "/snmp-interfaces");
        simple.put("/admin/snmpInterfaces.jsp",                      "/snmp-interfaces");
        simple.put("/admin/manageSnmpCollections.jsp",               "/snmp-collections-config");

        // Admin — Thresholds / Notifications / Outages
        simple.put("/admin/thresholds/index.htm",                    "/threshold-config");
        simple.put("/admin/thresholds/index.jsp",                    "/threshold-config");
        simple.put("/admin/notification/index.jsp",                  "/notification-config");
        simple.put("/admin/notification/destinationPaths.jsp",       "/notification-config/paths");
        simple.put("/admin/sched-outages/index.jsp",                 "/scheduled-outages");

        // Admin — Events / Classification
        simple.put("/admin/manageEvents.jsp",                        "/event-config");
        simple.put("/admin/classification/index.jsp",                "/flow-classification");
        simple.put("/admin/sendevent.htm",                           "/send-event");
        simple.put("/admin/postevent.jsp",                           "/send-event");

        // Admin — Tools
        simple.put("/admin/jmxConfigGenerator.jsp",                  "/jmx-config-generator");
        simple.put("/admin/mibCompiler.jsp",                         "/mib-compiler");
        simple.put("/admin/wallboardConfig.jsp",                     "/wallboard-config");
        simple.put("/vaadin-wallboard",                              "/wallboard-config");
        simple.put("/admin/surveillanceViewsConfig.jsp",             "/surveillance-views-config");
        simple.put("/admin/bsm/adminpage.jsp",                       "/bsm-admin");
        simple.put("/admin/categories.htm",                          "/surveillance-categories");
        simple.put("/admin/applications.htm",                        "/applications");
        simple.put("/admin/endpoint/index.jsp",                      "/grafana-endpoints");
        simple.put("/admin/geoservice/index.jsp",                    "/geocoder-config");
        simple.put("/admin/nodemanagement/instrumentationLogReader.jsp", "/instrumentation-log");
        simple.put("/admin/asset/index.jsp",                         "/asset-management");

        SIMPLE_REDIRECTS = Collections.unmodifiableMap(simple);

        Map<String, Function<HttpServletRequest, String>> param = new HashMap<>();

        // Node-based: ?node=X → /node/X
        param.put("/element/node.jsp",              req -> nodeParam(req, "/nodes"));
        param.put("/element/availability.jsp",      req -> nodeParam(req, "/nodes"));
        param.put("/element/rescan.jsp",            req -> nodeParam(req, "/nodes"));
        param.put("/element/node-metadata.jsp",     req -> nodeParam(req, "/nodes"));
        param.put("/admin/nodelabel.jsp",           req -> nodeParam(req, "/nodes"));
        // Service detail has no Vue route; send to node detail
        param.put("/element/service.jsp",           req -> nodeParam(req, "/nodes"));

        // Interface: ?node=X&intf=Y → /interface/X/Y
        param.put("/element/interface.jsp",         req -> interfaceParam(req));
        param.put("/element/interface-metadata.jsp",req -> interfaceParam(req));

        // SNMP interface: ?node=X&ifindex=Y → /snmpinterface/X/Y
        param.put("/element/snmpinterface.jsp",     req -> snmpInterfaceParam(req));

        // Alarm detail: ?id=X → /alarm/X
        param.put("/alarm/detail.htm",              req -> idParam(req, "id", "/alarm/", "/alarms"));
        param.put("/alarm/detail.jsp",              req -> idParam(req, "id", "/alarm/", "/alarms"));

        // Event detail: ?id=X → /event/X
        param.put("/event/detail.jsp",              req -> idParam(req, "id", "/event/", "/events"));

        // Outage detail: ?id=X → /outage/X
        param.put("/outage/detail.htm",             req -> idParam(req, "id", "/outage/", "/outages"));
        param.put("/outage/detail.jsp",             req -> idParam(req, "id", "/outage/", "/outages"));

        // Notification detail: ?notice=X → /notification/X
        param.put("/notification/detail.jsp",       req -> idParam(req, "notice", "/notification/", "/notifications"));

        // Asset edit: ?node=X → /asset/X/edit
        param.put("/asset/modify.jsp",              req -> assetParam(req));

        PARAMETERIZED_REDIRECTS = Collections.unmodifiableMap(param);
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {}

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpReq  = (HttpServletRequest) request;
        HttpServletResponse httpResp = (HttpServletResponse) response;

        // Only intercept browser navigation — skip POST/PUT/DELETE and AJAX calls
        String method = httpReq.getMethod();
        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            chain.doFilter(request, response);
            return;
        }
        if (isAjaxRequest(httpReq)) {
            chain.doFilter(request, response);
            return;
        }

        String path = httpReq.getServletPath();

        // Fast-path: skip REST/API/SPA paths that are never legacy
        if (path.startsWith("/rest/") || path.startsWith("/api/")
                || path.startsWith("/nrt/") || path.startsWith("/ui/")) {
            chain.doFilter(request, response);
            return;
        }

        String vueRoute = SIMPLE_REDIRECTS.get(path);
        if (vueRoute == null) {
            Function<HttpServletRequest, String> resolver = PARAMETERIZED_REDIRECTS.get(path);
            if (resolver != null) {
                vueRoute = resolver.apply(httpReq);
            }
        }

        if (vueRoute != null) {
            httpResp.sendRedirect(httpReq.getContextPath() + "/ui" + vueRoute);
            return;
        }

        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {}

    private static boolean isAjaxRequest(HttpServletRequest req) {
        String xRequestedWith = req.getHeader("X-Requested-With");
        if ("XMLHttpRequest".equalsIgnoreCase(xRequestedWith)) {
            return true;
        }
        String accept = req.getHeader("Accept");
        return accept != null
                && accept.contains("application/json")
                && !accept.contains("text/html");
    }

    private static String nodeParam(HttpServletRequest req, String fallback) {
        String nodeId = req.getParameter("node");
        return (nodeId != null && !nodeId.isEmpty()) ? "/node/" + nodeId : fallback;
    }

    private static String interfaceParam(HttpServletRequest req) {
        String nodeId = req.getParameter("node");
        String intf   = req.getParameter("intf");
        return (nodeId != null && !nodeId.isEmpty() && intf != null && !intf.isEmpty())
                ? "/interface/" + nodeId + "/" + intf
                : "/nodes";
    }

    private static String snmpInterfaceParam(HttpServletRequest req) {
        String nodeId  = req.getParameter("node");
        String ifIndex = req.getParameter("ifindex");
        return (nodeId != null && !nodeId.isEmpty() && ifIndex != null && !ifIndex.isEmpty())
                ? "/snmpinterface/" + nodeId + "/" + ifIndex
                : "/nodes";
    }

    private static String idParam(HttpServletRequest req, String paramName,
                                   String prefix, String fallback) {
        String id = req.getParameter(paramName);
        return (id != null && !id.isEmpty()) ? prefix + id : fallback;
    }

    private static String assetParam(HttpServletRequest req) {
        String nodeId = req.getParameter("node");
        return (nodeId != null && !nodeId.isEmpty()) ? "/asset/" + nodeId + "/edit" : "/assets";
    }
}
