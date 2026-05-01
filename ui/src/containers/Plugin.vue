<template>
  <Container :script="externalJsUrl" :key="$route.fullPath" v-if="externalJsUrl" />
</template>

<script setup lang="ts">
import { getCSSPath, getJSPath } from '@/components/Plugin/utils'
import Container from '@/components/Plugin/Container.vue'

const baseRestUrl = import.meta.env.VITE_BASE_REST_URL
const externalJsUrl = ref<string>('')
let currentCssLink: HTMLLinkElement | null = null

const props = defineProps({
  extensionId: {
    required: true,
    type: String
  },
  resourceRootPath: {
    required: true,
    type: String
  },
  moduleFileName: {
    required: true,
    type: String
  }
})

const addResources = () => {
  externalJsUrl.value = getJSPath(baseRestUrl, props.extensionId, props.resourceRootPath, props.moduleFileName)

  const externalCssUrl = getCSSPath(baseRestUrl, props.extensionId)
  if (currentCssLink) {
    currentCssLink.remove()
    currentCssLink = null
  }
  const link = document.createElement('link')
  link.type = 'text/css'
  link.rel = 'stylesheet'
  link.href = externalCssUrl
  document.head.prepend(link)
  currentCssLink = link
}

watch(() => [props.extensionId, props.resourceRootPath, props.moduleFileName], () => addResources())
onMounted(() => addResources())
onBeforeUnmount(() => {
  if (currentCssLink) {
    currentCssLink.remove()
    currentCssLink = null
  }
})
</script>
