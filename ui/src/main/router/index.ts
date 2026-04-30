///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { createRouter, createWebHistory } from 'vue-router'
import { Plugin } from '@/types'
import DeviceConfigBackup from '@/containers/DeviceConfigBackup.vue'
import Home from '@/containers/Home.vue'
import FileEditor from '@/containers/FileEditor.vue'
import Graphs from '@/components/Resources/Graphs.vue'
import Resources from '@/components/Resources/Resources.vue'
import ZenithConnect from '@/containers/ZenithConnect.vue'
import ZenithConnectView from '@/components/ZenithConnect/ZenithConnectView.vue'
import ZenithConnectRegister from '@/components/ZenithConnect/ZenithConnectRegister.vue'
import ZenithConnectRegisterResult from '@/components/ZenithConnect/ZenithConnectRegisterResult.vue'
import useRole from '@/composables/useRole'
import useSnackbar from '@/composables/useSnackbar'
import useSpinner from '@/composables/useSpinner'
import { useMenuStore } from '@/stores/menuStore'

const { adminRole, filesystemEditorRole, dcbRole, rolesAreLoaded } = useRole()
const menuStore = computed(() => useMenuStore())
const { showSnackBar } = useSnackbar()
const { startSpinner, stopSpinner } = useSpinner()

// for backward compatibility with legacy OpenNMS plugins
// should eventually be removed when plugins are compliant with new schema
const isLegacyPlugin = (plugin: Plugin) => {
  if (
    plugin.extensionClass &&
    (plugin.extensionClass === 'org.opennms.plugins.cloud.ui.CloudUiExtension' ||
      plugin.menuEntry === 'Cloud Services') &&
    plugin.moduleFileName === 'uiextension.es.js'
  ) {
    return true
  }

  if (
    plugin.extensionClass &&
    (plugin.extensionClass === 'org.opennms.alec.ui.UIExtension' || plugin.menuEntry === 'ALEC') &&
    plugin.moduleFileName === 'uiextension.es.js'
  ) {
    return true
  }

  return false
}

const zenithConnectEnabled = computed<boolean>(() => menuStore.value?.mainMenu?.zenithConnectEnabled ?? false)

// Backwards compatibility: redirect legacy hash-based URLs to clean paths
// e.g. /opennms/ui/index.html#/alarms → /opennms/ui/alarms
const legacyHash = window.location.hash
if (legacyHash.startsWith('#/')) {
  history.replaceState(null, '', '/opennms/ui' + legacyHash.slice(1))
}

const router = createRouter({
  history: createWebHistory('/opennms/ui'),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/containers/Dashboard.vue')
    },
    {
      path: '/home',
      name: 'home',
      component: Home
    },
    {
      // for compatibility with legacy plugins
      // should be removed when all plugins have unique 'extensionId' and follow new pattern
      path: '/plugins/:extensionId/:resourceRootPath/:moduleFileName',
      name: 'Plugin',
      props: true,
      component: () => import('@/containers/Plugin.vue')
    },
    {
      path: '/file-editor',
      name: 'FileEditor',
      component: FileEditor,
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!filesystemEditorRole.value) {
            showSnackBar({ msg: 'No role access to file editor.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/configuration',
      name: 'Configuration',
      component: () => import('@/containers/ProvisionDConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'No role access to external requisitions.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/logs',
      name: 'Logs',
      component: () => import('@/containers/Logs.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'No role access to logs.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/snmp-collections-config',
      name: 'SnmpCollectionsConfig',
      component: () => import('@/containers/SnmpCollectionsConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'No role access to SNMP collections config.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/bsm-admin',
      name: 'BusinessServicesAdmin',
      component: () => import('@/containers/BusinessServicesAdmin.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'No role access to BSM admin.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/map',
      name: 'Map',
      component: () => import('@/containers/Map.vue'),
      children: [
        {
          path: '',
          name: 'MapAlarms',
          component: () => import('@/components/Map/MapAlarmsGrid.vue')
        },
        {
          path: 'nodes',
          name: 'MapNodes',
          component: () => import('@/components/Map/MapNodesGrid.vue')
        }
      ]
    },
    {
      path: '/nodes',
      name: 'Nodes',
      component: () => import('@/containers/Nodes.vue')
    },
    {
      path: '/alarms',
      name: 'Alarms',
      component: () => import('@/containers/Alarms.vue')
    },
    {
      path: '/events',
      name: 'Events',
      component: () => import('@/containers/Events.vue')
    },
    {
      path: '/node/:id',
      name: 'Node Details',
      component: () => import('@/containers/NodeDetails.vue')
    },
    {
      path: '/interface/:nodeId/:ipAddress',
      name: 'Interface Detail',
      component: () => import('@/containers/InterfaceDetail.vue')
    },
    {
      path: '/snmpinterface/:nodeId/:ifIndex',
      name: 'SNMP Interface Detail',
      component: () => import('@/containers/SnmpInterfaceDetail.vue')
    },
    {
      path: '/event/:id',
      name: 'Event Detail',
      component: () => import('@/containers/EventDetail.vue')
    },
    {
      path: '/alarm/:id',
      name: 'Alarm Detail',
      component: () => import('@/containers/AlarmDetail.vue')
    },
    {
      path: '/outages',
      name: 'Outages',
      component: () => import('@/containers/Outages.vue')
    },
    {
      path: '/outage/:id',
      name: 'Outage Detail',
      component: () => import('@/containers/OutageDetail.vue')
    },
    {
      path: '/resource-graphs',
      name: 'ResourceGraphs',
      component: () => import('@/containers/ResourceGraphs.vue'),
      children: [
        {
          path: '',
          name: 'Resources',
          component: Resources
        },
        {
          path: 'graphs/:label/:singleGraphDefinition/:singleGraphResourceId',
          component: Graphs,
          props: true
        },
        {
          path: 'graphs',
          name: 'Graphs',
          component: Graphs
        }
      ]
    },
    {
      path: '/open-api',
      name: 'OpenAPI',
      component: () => import('@/containers/OpenAPI.vue')
    },
    {
      path: '/device-config-backup',
      name: 'DeviceConfigBackup',
      component: DeviceConfigBackup,
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!dcbRole.value) {
            showSnackBar({ msg: 'No role access to DCB.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/scv',
      name: 'SCV',
      component: () => import('@/containers/SecureCredentialsVault.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access SCV.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/usage-statistics',
      name: 'Usage Statistics',
      component: () => import('@/containers/UsageStatistics.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Usage Statistics.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/zenith-connect',
      name: 'ZenithConnect',
      component: ZenithConnect,
      beforeEnter: (to, from) => {
        const checkZenith = () => {
          if (!zenithConnectEnabled.value) {
            showSnackBar({ msg: 'Zenith Connect must be enabled.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value && !!menuStore.value?.mainMenu?.baseHref) {
          checkZenith()
        } else {
          whenever(
            () => rolesAreLoaded && !!menuStore.value?.mainMenu?.baseHref,
            () => checkZenith()
          )
        }
      },
      children: [
        {
          path: '',
          name: 'View',
          component: ZenithConnectView
        },
        {
          path: 'register',
          name: 'Register',
          component: ZenithConnectRegister
        },
        {
          path: 'register-result',
          name: 'Register Result',
          component: ZenithConnectRegisterResult
        }
      ]
    },
    {
      path: '/event-config',
      name: 'Event Configuration',
      component: () => import('@/containers/EventConfiguration.vue')
    },
    {
      path: '/event-config/:id',
      name: 'Event Configuration Detail',
      component: () => import('@/containers/EventConfigurationDetail.vue')
    },
    {
      path: '/event-config/create',
      name: 'Event Configuration Create',
      component: () => import('@/containers/EventConfigEventCreate.vue')
    },
    {
      path: '/topology',
      name: 'Network Topology',
      component: () => import('@/containers/Topology.vue')
    },
    {
      path: '/jmx-config-generator',
      name: 'JMX Config Generator',
      component: () => import('@/containers/JmxConfigGenerator.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access JMX Config Generator.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/surveillance-views-config',
      name: 'Surveillance Views Config',
      component: () => import('@/containers/SurveillanceViewsConfig.vue')
    },
    {
      path: '/wallboard-config',
      name: 'Wallboard Config',
      component: () => import('@/containers/WallboardConfig.vue')
    },
    {
      path: '/surveillance-dashboard',
      name: 'Surveillance Dashboard',
      component: () => import('@/containers/SurveillanceDashboard.vue')
    },
    {
      path: '/mib-compiler',
      name: 'SNMP MIB Compiler',
      component: () => import('@/containers/MibCompiler.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access SNMP MIB Compiler.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/containers/Admin.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Admin.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/provision/quick-add',
      name: 'Quick Add Node',
      component: () => import('@/containers/Admin.vue') // temporary stub — provisioning phase replaces this
    },
    {
      path: '/provision/requisitions',
      name: 'Manage Requisitions',
      component: () => import('@/containers/Admin.vue') // temporary stub — provisioning phase replaces this
    },
    {
      path: '/system-config',
      name: 'System Configuration',
      component: () => import('@/containers/SystemConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access System Configuration.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/scheduled-outages',
      name: 'Scheduled Outages',
      component: () => import('@/containers/ScheduledOutages.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Scheduled Outages.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/discovery-config',
      name: 'Discovery Configuration',
      component: () => import('@/containers/DiscoveryConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Discovery Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/snmp-config',
      name: 'Configure SNMP by IP',
      component: () => import('@/containers/SnmpConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access SNMP Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/users-groups',
      name: 'Users and Groups',
      component: () => import('@/containers/UsersGroups.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Users and Groups.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/threshold-config',
      name: 'Threshold Configuration',
      component: () => import('@/containers/ThresholdConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Threshold Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/threshold-config/:groupName',
      name: 'Edit Threshold Group',
      component: () => import('@/containers/ThresholdGroupEdit.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Threshold Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config',
      name: 'Notification Configuration',
      component: () => import('@/containers/NotificationConfig.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Notification Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config/rules',
      name: 'Notification Rules',
      component: () => import('@/containers/NotificationRules.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Notification Rules.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config/rules/new',
      name: 'New Notification Rule',
      component: () => import('@/containers/NotificationRuleEdit.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Notification Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config/rules/:name',
      name: 'Edit Notification Rule',
      component: () => import('@/containers/NotificationRuleEdit.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Notification Configuration.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config/paths',
      name: 'Destination Paths',
      component: () => import('@/containers/DestinationPaths.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Destination Paths.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config/paths/new',
      name: 'New Destination Path',
      component: () => import('@/containers/DestinationPathEdit.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Destination Paths.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/notification-config/paths/:name',
      name: 'Edit Destination Path',
      component: () => import('@/containers/DestinationPathEdit.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Destination Paths.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/minions',
      name: 'Manage Minions',
      component: () => import('@/containers/Minions.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Minions.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/monitoring-locations',
      name: 'Monitoring Locations',
      component: () => import('@/containers/MonitoringLocations.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Monitoring Locations.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/flow-classification',
      name: 'Flow Classification',
      component: () => import('@/containers/FlowClassification.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Flow Classification.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/surveillance-categories',
      name: 'Surveillance Categories',
      component: () => import('@/containers/SurveillanceCategories.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access Surveillance Categories.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/send-event',
      name: 'Send Event',
      component: () => import('@/containers/SendEvent.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to send events.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/delete-nodes',
      name: 'Delete Nodes',
      component: () => import('@/containers/DeleteNodes.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to delete nodes.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/applications',
      name: 'Manage Applications',
      component: () => import('@/containers/Applications.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to manage applications.' })
            router.push(from.path)
          }
        }
        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
    {
      path: '/:pathMatch(.*)*', // catch other paths and redirect
      redirect: '/'
    }
  ]
})

router.beforeEach(() => startSpinner())
router.afterEach(() => stopSpinner())
export default router
export { isLegacyPlugin }

