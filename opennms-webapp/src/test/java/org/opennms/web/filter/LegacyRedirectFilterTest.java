package org.opennms.web.filter;

import static org.mockito.Mockito.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.junit.Before;
import org.junit.Test;

public class LegacyRedirectFilterTest {

    private LegacyRedirectFilter filter;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private FilterChain chain;

    @Before
    public void setUp() throws ServletException {
        filter = new LegacyRedirectFilter();
        filter.init(null);
        request  = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        chain    = mock(FilterChain.class);
        when(request.getContextPath()).thenReturn("/opennms");
        when(request.getMethod()).thenReturn("GET");
        when(request.getHeader("X-Requested-With")).thenReturn(null);
        when(request.getHeader("Accept")).thenReturn("text/html");
    }

    // --- Simple path redirects ---

    @Test
    public void alarmListHtm_redirectsToVueAlarms() throws Exception {
        when(request.getServletPath()).thenReturn("/alarm/list.htm");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/alarms");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void alarmListNoExtension_redirectsToVueAlarms() throws Exception {
        when(request.getServletPath()).thenReturn("/alarm/list");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/alarms");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void eventListHtm_redirectsToVueEvents() throws Exception {
        when(request.getServletPath()).thenReturn("/event/list.htm");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/events");
    }

    @Test
    public void outageListHtm_redirectsToVueOutages() throws Exception {
        when(request.getServletPath()).thenReturn("/outage/list.htm");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/outages");
    }

    @Test
    public void notificationBrowse_redirectsToVueNotifications() throws Exception {
        when(request.getServletPath()).thenReturn("/notification/browse");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/notifications");
    }

    @Test
    public void topologyJsp_redirectsToVueTopology() throws Exception {
        when(request.getServletPath()).thenReturn("/topology.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/topology");
    }

    @Test
    public void adminIndex_redirectsToVueAdmin() throws Exception {
        when(request.getServletPath()).thenReturn("/admin/index.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/admin");
    }

    @Test
    public void dashboardJsp_redirectsToSurveillanceDashboard() throws Exception {
        when(request.getServletPath()).thenReturn("/dashboard.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/surveillance-dashboard");
    }

    @Test
    public void frontPageJsp_redirectsToDashboard() throws Exception {
        when(request.getServletPath()).thenReturn("/frontPage.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/dashboard");
    }

    // --- Parameterized redirects ---

    @Test
    public void nodeJsp_withNodeParam_redirectsToNodeDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/element/node.jsp");
        when(request.getParameter("node")).thenReturn("42");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/node/42");
    }

    @Test
    public void nodeJsp_withForeignId_redirectsToNodeDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/element/node.jsp");
        when(request.getParameter("node")).thenReturn("Topology-Lab:topo-spine-1");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/node/Topology-Lab:topo-spine-1");
    }

    @Test
    public void nodeJsp_withoutNodeParam_redirectsToNodesList() throws Exception {
        when(request.getServletPath()).thenReturn("/element/node.jsp");
        when(request.getParameter("node")).thenReturn(null);
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/nodes");
    }

    @Test
    public void interfaceJsp_withBothParams_redirectsToInterfaceDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/element/interface.jsp");
        when(request.getParameter("node")).thenReturn("5");
        when(request.getParameter("intf")).thenReturn("192.168.1.1");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/interface/5/192.168.1.1");
    }

    @Test
    public void interfaceJsp_missingIntfParam_redirectsToNodes() throws Exception {
        when(request.getServletPath()).thenReturn("/element/interface.jsp");
        when(request.getParameter("node")).thenReturn("5");
        when(request.getParameter("intf")).thenReturn(null);
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/nodes");
    }

    @Test
    public void snmpInterfaceJsp_withParams_redirectsToSnmpInterfaceDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/element/snmpinterface.jsp");
        when(request.getParameter("node")).thenReturn("3");
        when(request.getParameter("ifindex")).thenReturn("7");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/snmpinterface/3/7");
    }

    @Test
    public void alarmDetailHtm_withId_redirectsToAlarmDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/alarm/detail.htm");
        when(request.getParameter("id")).thenReturn("99");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/alarm/99");
    }

    @Test
    public void alarmDetailHtm_withoutId_fallsBackToAlarmList() throws Exception {
        when(request.getServletPath()).thenReturn("/alarm/detail.htm");
        when(request.getParameter("id")).thenReturn(null);
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/alarms");
    }

    @Test
    public void eventDetailJsp_withId_redirectsToEventDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/event/detail.jsp");
        when(request.getParameter("id")).thenReturn("123");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/event/123");
    }

    @Test
    public void outageDetailHtm_withId_redirectsToOutageDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/outage/detail.htm");
        when(request.getParameter("id")).thenReturn("77");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/outage/77");
    }

    @Test
    public void notificationDetailJsp_withNotice_redirectsToNotificationDetail() throws Exception {
        when(request.getServletPath()).thenReturn("/notification/detail.jsp");
        when(request.getParameter("notice")).thenReturn("55");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/notification/55");
    }

    @Test
    public void assetModifyJsp_withNode_redirectsToAssetEdit() throws Exception {
        when(request.getServletPath()).thenReturn("/asset/modify.jsp");
        when(request.getParameter("node")).thenReturn("12");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/asset/12/edit");
    }

    @Test
    public void assetModifyJsp_withoutNode_fallsBackToAssets() throws Exception {
        when(request.getServletPath()).thenReturn("/asset/modify.jsp");
        when(request.getParameter("node")).thenReturn(null);
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/assets");
    }

    // --- Pass-through cases ---

    @Test
    public void postRequest_passesThrough() throws Exception {
        when(request.getMethod()).thenReturn("POST");
        when(request.getServletPath()).thenReturn("/alarm/list.htm");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    @Test
    public void ajaxRequest_xRequestedWith_passesThrough() throws Exception {
        when(request.getServletPath()).thenReturn("/alarm/list.htm");
        when(request.getHeader("X-Requested-With")).thenReturn("XMLHttpRequest");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    @Test
    public void jsonOnlyAcceptHeader_passesThrough() throws Exception {
        when(request.getServletPath()).thenReturn("/alarm/list.htm");
        when(request.getHeader("X-Requested-With")).thenReturn(null);
        when(request.getHeader("Accept")).thenReturn("application/json");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    @Test
    public void restApiPath_passesThrough() throws Exception {
        when(request.getServletPath()).thenReturn("/rest/alarms");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    @Test
    public void vueUiPath_passesThrough() throws Exception {
        when(request.getServletPath()).thenReturn("/ui/alarms");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    @Test
    public void unknownLegacyPath_passesThrough() throws Exception {
        when(request.getServletPath()).thenReturn("/some/unknown/page.jsp");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    @Test
    public void loginPage_passesThrough() throws Exception {
        when(request.getServletPath()).thenReturn("/login.jsp");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verify(response, never()).sendRedirect(any());
    }

    // --- Graph / KSC / Trend legacy paths (Task 4) ---

    @Test
    public void testChooseResourceRedirects() throws Exception {
        when(request.getServletPath()).thenReturn("/graph/chooseresource.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/resource-graphs");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void testAdhoc2Redirects() throws Exception {
        when(request.getServletPath()).thenReturn("/graph/adhoc2.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/resource-graphs");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void testGraphForecastRedirects() throws Exception {
        when(request.getServletPath()).thenReturn("/graph/forecast.jsp");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/resource-graphs");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void testKscCustomReportRedirects() throws Exception {
        when(request.getServletPath()).thenReturn("/KSC/customReport.htm");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/ksc-reports");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void testKscFormProcMainRedirects() throws Exception {
        when(request.getServletPath()).thenReturn("/KSC/formProcMain.htm");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/ksc-reports");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    public void testTrendTrendHtmRedirects() throws Exception {
        when(request.getServletPath()).thenReturn("/trend/trend.htm");
        filter.doFilter(request, response, chain);
        verify(response).sendRedirect("/opennms/ui/resource-graphs");
        verify(chain, never()).doFilter(any(), any());
    }
}
