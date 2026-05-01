<template>
  <div class="usage-stats-header">
    <div>
      <p>
        OpenNMS anonymously sends usage statistics data to <a href="https://stats.opennms.org" target="_blank">OpenNMS Statistics</a>.
        We use this data to help us improve your OpenNMS software, subject to the <a href="https://www.opennms.com/privacy/" target="_blank">privacy policy</a>.
      </p>
    </div>
    <div class="spacer-medium"></div>
    <div class="flex title-padding">
      <div id="status-chip-wrapper">
        <Chip
          :id="status.enabled ? 'chip-status-enabled' : 'chip-status-disabled'"
          :label="status.enabled ? 'Enabled' : 'Disabled'"
          :icon="status.enabled ? 'pi pi-check-circle' : 'pi pi-minus-circle'"
        />
      </div>
      <div
        class="flex button-wrapper"
      >
        <Button
          class="button"
          severity="secondary"
          :label="status.enabled ? 'Disable' : 'Enable'"
          @click="updateStatus"
        />
      </div>
    </div>
    <div class="spacer-large"></div>
    <div>
      <h2>List of data points</h2>
    </div>
    <div class="flex title-padding">
      <p>
        Copy the full JSON payload to your clipboard
      </p>
      <div
        class="flex button-wrapper"
      >
        <Button
          class="button"
          severity="secondary"
          label="Copy Json"
          @click="copyJson"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import { ConfigurationHelper } from '../Configuration/ConfigurationHelper'
import useSnackbar from '@/composables/useSnackbar'
import { useUsageStatisticsStore } from '@/stores/usageStatisticsStore'
import { UsageStatisticsData, UsageStatisticsStatus } from '@/types/usageStatistics'

const { showSnackBar } = useSnackbar()
const usageStatisticsStore = useUsageStatisticsStore()
const status = computed<UsageStatisticsStatus>(() => usageStatisticsStore.status )
const statistics = computed<UsageStatisticsData>(() => usageStatisticsStore.statistics )

const copyJson = async () => {
  const json = JSON.stringify(statistics.value, null, 2)

  try {
    await ConfigurationHelper.copyToClipboard(json)

    showSnackBar({
      msg: 'Copied Usage Statistics Json to clipboard'
    })
  } catch (err) {
    showSnackBar({
      msg: `Could not copy to clipboard. Your environment may be insecure. (${err})`,
      error: true
    })
  }
}

const updateStatus = () => {
  if (status.value.enabled) {
    usageStatisticsStore.disableSharing()
  } else {
    usageStatisticsStore.enableSharing()
  }
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";
@import "@/styles/tokens";

.usage-stats-header {
  display: flex;
  flex-direction: column;
  margin-left: 20px;
  max-width: 760px;
}

.flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spacer-medium {
  margin-bottom: 0.25rem;
}
.spacer-large {
  margin-bottom: 2rem;
}

#chip-status-enabled {
  background-color: rgb(201, 220, 205);
  color: rgb(51, 112, 33);

  .p-chip-icon {
    color: rgb(51, 112, 33);
  }
}

#chip-status-disabled {
  background-color: rgb(219, 221, 224);
  color: rgb(117, 117, 117);

  .p-chip-icon {
    color: rgb(117, 117, 117);
  }
}
</style>
