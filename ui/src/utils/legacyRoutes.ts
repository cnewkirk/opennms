/**
 * Maps legacy OpenNMS JSP/HTM/servlet URLs to Vue SPA paths.
 * Consumed by Menu/utils.ts to resolve server-provided menu item URLs
 * so sidebar links navigate directly to the Vue route without the
 * intermediate JSP sendRedirect hop.
 *
 * Keys are the raw URL values returned by the /api/v2/menu endpoint
 * (relative, no leading slash, no context path).
 * Values are the Vue Router path (leading slash, no context path prefix).
 */
export const legacyToVueRoutes: Record<string, string> = {
  // ── Monitoring ──────────────────────────────────────────────────────────
  'alarm/index.htm':                                '/alarms',
  'event/index':                                    '/events',
  'outage/index.jsp':                               '/outages',
  'notification/index.jsp':                         '/notifications',
  'application/index.jsp':                          '/applications',
  'pathOutage/index.jsp':                           '/path-outages',

  // ── Inventory ────────────────────────────────────────────────────────────
  'element/nodeList.htm':                           '/nodes',
  'element/index.jsp':                              '/nodes',
  'asset/index.jsp':                                '/assets',
  'hardware/list.jsp':                              '/hardware',

  // ── Dashboards / Views ───────────────────────────────────────────────────
  'dashboard.jsp':                                  '/surveillance-dashboard',
  'surveillance-view.jsp':                          '/surveillance-dashboard',
  'surveillance-box.jsp':                           '/surveillance-dashboard',
  'rtc/index.jsp':                                  '/surveillance-dashboard',
  'rtc/category.jsp':                               '/rtc/category',

  // ── Metrics / Graphs ─────────────────────────────────────────────────────
  'graph/index.jsp':                                '/resource-graphs',
  'KSC/index.jsp':                                  '/ksc-reports',
  'report/database/index.jsp':                      '/reports',
  'statisticsReports/index.htm':                    '/reports',

  // ── Map / Topology ───────────────────────────────────────────────────────
  'topology':                                       '/topology',

  // ── Distributed Monitoring ───────────────────────────────────────────────
  'minion/index.jsp':                               '/minions',
  'locations/index.jsp':                            '/monitoring-locations',

  // ── Help / Support / About ───────────────────────────────────────────────
  'help/index.jsp':                                 '/help',
  'support/index.jsp':                              '/support',
  'status/index.jsp':                               '/status',
  'about/index.jsp':                                '/about',

  // ── Account ──────────────────────────────────────────────────────────────
  'account/selfService/index.jsp':                  '/account',
  'account/selfService/newPasswordEntry':           '/account',

  // ── Admin hub ────────────────────────────────────────────────────────────
  'admin/index.jsp':                                '/admin',
  'admin/sysconfig.jsp':                            '/system-config',

  // ── Admin — Provisioning ─────────────────────────────────────────────────
  'admin/discovery/edit-config.jsp':                '/discovery-config',
  'admin/discovery/index.jsp':                      '/discovery-config',
  'admin/discovery/edit-scan.jsp':                  '/discovery-scan',
  'admin/deleteNodes':                              '/delete-nodes',
  'admin/newInterface.jsp':                         '/add-interface',

  // ── Admin — Users / Groups / Roles ───────────────────────────────────────
  'admin/userGroupView/index.jsp':                  '/users-groups',
  'admin/userGroupView/users/list.jsp':             '/users-groups',
  'admin/userGroupView/groups/list.htm':            '/users-groups',
  'admin/userGroupView/roles':                      '/on-call-roles',
  'roles/list.jsp':                                 '/on-call-roles',

  // ── Admin — SNMP / Collection ─────────────────────────────────────────────
  'admin/snmpConfig':                               '/snmp-config',
  'admin/snmpConfig.jsp':                           '/snmp-config',
  'admin/snmpGetNodes':                             '/snmp-interfaces',
  'admin/snmpInterfaces.jsp':                       '/snmp-interfaces',
  'admin/manageSnmpCollections.jsp':                '/snmp-collections-config',

  // ── Admin — Thresholds / Notifications / Outages ────────────────────────
  'admin/thresholds/index.htm':                     '/threshold-config',
  'admin/thresholds/index.jsp':                     '/threshold-config',
  'admin/notification/index.jsp':                   '/notification-config',
  'admin/notification/destinationPaths.jsp':        '/notification-config/paths',
  'admin/sched-outages/index.jsp':                  '/scheduled-outages',

  // ── Admin — Events / Classification ─────────────────────────────────────
  'admin/manageEvents.jsp':                         '/event-config',
  'admin/classification/index.jsp':                 '/flow-classification',
  'admin/sendevent.htm':                            '/send-event',
  'admin/postevent.jsp':                            '/send-event',

  // ── Admin — Misc integrations / tools ────────────────────────────────────
  'admin/jmxConfigGenerator.jsp':                   '/jmx-config-generator',
  'admin/mibCompiler.jsp':                          '/mib-compiler',
  'admin/wallboardConfig.jsp':                      '/wallboard-config',
  'vaadin-wallboard':                               '/wallboard-config',
  'admin/surveillanceViewsConfig.jsp':              '/surveillance-views-config',
  'admin/bsm/adminpage.jsp':                        '/bsm-admin',
  'admin/categories.htm':                           '/surveillance-categories',
  'admin/applications.htm':                         '/applications',
  'admin/endpoint/index.jsp':                       '/grafana-endpoints',
  'admin/geoservice/index.jsp':                     '/geocoder-config',
  'admin/nodemanagement/instrumentationLogReader.jsp': '/instrumentation-log',
  'admin/asset/index.jsp':                          '/asset-management',
}

/**
 * Resolves a server menu item URL to the corresponding Vue Router path.
 * Returns null when the URL has no known Vue equivalent (caller should
 * navigate to the absolute JSP href instead).
 */
export function resolveVueRoute(url: string): string | null {
  return legacyToVueRoutes[url] ?? null
}
