<template>
  <div style="display: none">
    <slot v-if="ready"></slot>
  </div>
</template>

<script>
// @ts-nocheck
// Leaflet removed — imports suppressed pending Task 7 deletion
// import 'leaflet.markercluster/dist/MarkerCluster.css'
// import { propsBinder, remapEvents } from '@vue-leaflet/vue-leaflet/src/utils'
// import { render, setup as layerSetup } from '@vue-leaflet/vue-leaflet/src/functions/layer'
const propsBinder = () => {}
const remapEvents = () => ({})
const render = () => null
const layerSetup = () => ({ methods: {} })

const props = {
  options: {
    type: Object,
    default() {
      return {}
    }
  },
  onClusterClick: {
    type: Function
  }
}

export default {
  name: 'MarkerCluster',

  props,

  setup(props, context) {
    const leafletRef = ref({})
    const ready = ref(false)

    const addLayerToMainMap = inject('addLayer')
    const removeLayerFromMainMap = inject('removeLayer')

    provide('canSetParentHtml', () => !!leafletRef.value.getElement())
    provide(
      'setParentHtml',
      (html) => (leafletRef.value.getElement().innerHTML = html)
    )
    provide('addLayer', (layer) => {
      leafletRef.value.addLayer(layer.leafletObject)
    })
    provide('removeLayer', (layer) => {
      leafletRef.value.removeLayer(layer.leafletObject)
    })

    const { methods } = layerSetup(props, leafletRef, context)

    onMounted(async () => {
      // Leaflet removed — this component is dead code pending Task 7 deletion
      ready.value = true
      nextTick(() => context.emit('ready', leafletRef.value))
    })

    onBeforeUnmount(
      () =>
        leafletRef.value &&
        leafletRef.value._leaflet_id &&
        removeLayerFromMainMap({ leafletObject: leafletRef.value })
    )

    return { ready, leafletObject: leafletRef }
  },
  render() {
    return render(this.ready, this.$slots)
  }
}
</script>
