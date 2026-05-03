<template>
  <div class="system-config-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div v-if="loading" class="system-config__loading">
      <PanelLoader :size="40" />
    </div>

    <div v-else-if="error" class="system-config__error">
      <p class="body1">Failed to load system information. Please check your connection and try again.</p>
    </div>

    <div v-else class="system-config">
      <div class="system-config__grid">

        <!-- Left card: OpenNMS Configuration -->
        <div class="system-config__card">
          <div class="system-config__card-header">
            <h2 class="headline6">OpenNMS Configuration</h2>
          </div>
          <div class="system-config__card-body">
            <table class="system-config__table">
              <tbody>
                <tr>
                  <th>Version</th>
                  <td>{{ info!.displayVersion }}</td>
                </tr>
                <tr>
                  <th>Package</th>
                  <td>{{ info!.packageName }} ({{ info!.packageDescription }})</td>
                </tr>
                <tr>
                  <th>Ticketer Plugin</th>
                  <td>{{ info!.ticketerConfig.plugin ?? 'None' }}</td>
                </tr>
                <tr>
                  <th>Ticketer Enabled</th>
                  <td>{{ info!.ticketerConfig.enabled ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th>Datetime Zone</th>
                  <td>{{ info!.datetimeformatConfig.zoneId }}</td>
                </tr>
                <tr>
                  <th>Client Time</th>
                  <td>{{ clientTime }}</td>
                </tr>
              </tbody>
            </table>

            <div class="system-config__section-divider" />

            <h3 class="subtitle1 system-config__section-title">System Properties</h3>
            <div class="system-config__info-box">
              <p class="body2">
                Additional system properties (Java version, OS, Jetty config, RRD settings) require
                a server-side REST API extension. The legacy <code>admin/sysconfig.jsp</code> read
                these from <code>Vault.getProperty()</code> and <code>System.getProperty()</code>,
                which are not yet exposed via REST.
              </p>
              <!-- TODO: The following properties from admin/sysconfig.jsp require a new REST endpoint
                   to expose Vault.getProperty() and System.getProperty() values:
                   - opennms.home (Home Directory)
                   - org.opennms.rrd.storeByGroup / storeByForeignSource (RRD settings)
                   - opennms.report.dir (Reports directory)
                   - org.opennms.netmgt.jetty.host/port, https-host/port (Jetty config)
                   - SNMP trap port, syslog port
                   Extend InfoRestService in opennms-webapp-rest to expose these, then wire here. -->
            </div>
          </div>
        </div>

        <!-- Right card: Running Services -->
        <div class="system-config__card">
          <div class="system-config__card-header">
            <h2 class="headline6">Running Services</h2>
          </div>
          <div class="system-config__card-body">
            <table class="system-config__table system-config__table--services">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="svc in serviceRows" :key="svc.name">
                  <td>{{ svc.name }}</td>
                  <td>
                    <span
                      class="system-config__badge"
                      :class="svc.status === 'running' ? 'system-config__badge--running' : 'system-config__badge--stopped'"
                    >{{ svc.status }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import { useMenuStore } from '@/stores/menuStore'
import useRole from '@/composables/useRole'
import { getSystemInfo } from '@/services/infoService'
import { OnmsInfo, BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { adminRole } = useRole()

const loading = ref(true)
const error = ref(false)
const info = ref<OnmsInfo | null>(null)
const clientTime = ref(new Date().toString())
let _clockTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  _clockTimer = setInterval(() => { clientTime.value = new Date().toString() }, 1000)
  const result = await getSystemInfo()
  if (result === false) {
    error.value = true
  } else {
    info.value = result
  }
  loading.value = false
})

onBeforeUnmount(() => clearInterval(_clockTimer))

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'System Configuration', to: '#', position: 'last' }
])

const serviceRows = computed(() => {
  if (!info.value) return []
  return Object.entries(info.value.services)
    .map(([name, status]) => ({ name, status }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.system-config-page {
  padding: 0 20px 20px;
  background: var($surface);
  min-height: 100%;
}

.system-config {
  &__loading {
    display: flex;
    justify-content: center;
    padding: 3rem;
  }

  &__error {
    padding: 24px 0;
    color: var($secondary-text-on-surface);
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding-top: 16px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  }

  &__card {
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: 6px;
    overflow: hidden;
  }

  &__card-header {
    padding: 16px 20px;
    border-bottom: 1px solid var($border-on-surface);
    background: var($background);

    h2 {
      margin: 0;
      color: var($primary-text-on-surface);
    }
  }

  &__card-body {
    padding: 16px 20px;
  }

  &__section-divider {
    border: none;
    border-top: 1px solid var($border-on-surface);
    margin: 16px 0;
  }

  &__section-title {
    margin: 0 0 8px;
    color: var($secondary-text-on-surface);
  }

  &__info-box {
    background: var($background);
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    padding: 12px 16px;

    p {
      margin: 0;
      color: var($secondary-text-on-surface);
    }

    code {
      font-family: monospace;
      font-size: 0.85em;
      background: var($shade-4);
      padding: 1px 4px;
      border-radius: 3px;
    }
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;

    th,
    td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var($border-on-surface);
      vertical-align: top;
    }

    th {
      width: 40%;
      color: var($secondary-text-on-surface);
      font-weight: 600;
      white-space: nowrap;
    }

    td {
      color: var($primary-text-on-surface);
    }

    tbody tr:last-child th,
    tbody tr:last-child td {
      border-bottom: none;
    }

    &--services {
      thead th {
        color: var($secondary-text-on-surface);
        font-weight: 600;
        background: var($background);
        border-bottom: 2px solid var($border-on-surface);
      }

      th {
        width: auto;
      }
    }
  }

  &__badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: lowercase;

    &--running {
      background: var($success);
      color: #fff;
    }

    &--stopped {
      background: var($error);
      color: #fff;
    }
  }
}
</style>
