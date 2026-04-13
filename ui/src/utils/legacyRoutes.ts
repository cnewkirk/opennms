/**
 * Maps legacy OpenNMS JSP/HTM menu URLs to Vue SPA paths.
 * Used by SideNav to resolve server-provided menu item URLs.
 */
export const legacyToVueRoutes: Record<string, string> = {
  'alarm/index.htm':                   '/alarms',
  'dashboard.jsp':                     '/surveillance-dashboard',
  'surveillance-view.jsp':             '/surveillance-dashboard',
  'element/nodeList.htm':              '/nodes',
  'outage/index.jsp':                  '/outages',
  'graph/index.jsp':                   '/resource-graphs',
  'topology':                          '/topology',
  'admin/jmxConfigGenerator.jsp':      '/jmx-config-generator',
  'admin/mibCompiler.jsp':             '/mib-compiler',
  'admin/wallboardConfig.jsp':         '/wallboard-config',
  'admin/surveillanceViewsConfig.jsp': '/surveillance-views-config',
  'admin/manageSnmpCollections.jsp':   '/snmp-collections-config',
  'vaadin-wallboard':                  '/wallboard-config',
  'admin/bsm/adminpage.jsp':           '/bsm-admin',
  'admin/manageEvents.jsp':            '/event-config',
  'admin/index.jsp':                   '/admin'
}

/**
 * Resolves a menu item URL from the server to a Vue SPA path if known,
 * otherwise returns null (caller should fall back to absolute href).
 */
export function resolveVueRoute(url: string): string | null {
  return legacyToVueRoutes[url] ?? null
}
