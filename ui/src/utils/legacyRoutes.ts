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
  'admin/index.jsp':                   '/admin',
  'admin/classification/index.jsp':    '/flow-classification'
}

/**
 * Resolves a menu item URL from the server to a Vue Router path if known,
 * otherwise returns null (caller should navigate to absolute href instead).
 * Returned paths use leading `/` and are intended for router.push() — NOT href fragments.
 */
export function resolveVueRoute(url: string): string | null {
  return legacyToVueRoutes[url] ?? null
}
