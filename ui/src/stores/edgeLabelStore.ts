import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'opennms-edge-label-config'

export const useEdgeLabelStore = defineStore('edgeLabelStore', () => {
  const _load = (): Record<string, boolean> => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  const _saved = _load()

  const showUtilization = ref<boolean>(_saved.showUtilization ?? true)
  const showLocalPort   = ref<boolean>(_saved.showLocalPort   ?? false)
  const showRemotePort  = ref<boolean>(_saved.showRemotePort  ?? false)
  const showIp          = ref<boolean>(_saved.showIp          ?? false)
  const showMac         = ref<boolean>(_saved.showMac         ?? false)
  const showSpeed       = ref<boolean>(_saved.showSpeed       ?? false)

  watch([showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      showUtilization: showUtilization.value,
      showLocalPort:   showLocalPort.value,
      showRemotePort:  showRemotePort.value,
      showIp:          showIp.value,
      showMac:         showMac.value,
      showSpeed:       showSpeed.value
    }))
  })

  return { showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed }
})
