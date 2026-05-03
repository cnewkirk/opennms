<template>
  <div class="ksc-detail-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div v-if="loading" class="feather-row">
      <div class="feather-col-12 ksc-detail-page__status">Loading…</div>
    </div>

    <div v-else-if="!report" class="feather-row">
      <div class="feather-col-12 ksc-detail-page__status">Report not found.</div>
    </div>

    <template v-else>
      <div class="feather-row">
        <div class="feather-col-12">
          <h2 class="ksc-detail-page__title">{{ report.label }}</h2>
        </div>
      </div>

      <div v-if="!graphs.length" class="feather-row">
        <div class="feather-col-12 ksc-detail-page__status">No graphs in this report.</div>
      </div>

      <div v-else class="ksc-detail-page__grid">
        <div v-for="(graph, idx) in graphs" :key="idx" class="graph-card">
          <div class="graph-card__title">{{ graph.title || 'Graph' }}</div>
          <div class="graph-card__body">
            <img
              :src="graphUrl(graph)"
              :alt="graph.title || 'KSC Graph'"
              class="graph-card__img"
              loading="lazy"
            />
          </div>
          <div class="graph-card__meta">
            <span>{{ graph.graphtype }}</span>
            <span>{{ graph.timespan }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { useMenuStore } from '@/stores/menuStore'
import { getReport, type KscReport, type KscGraph } from '@/services/kscReportService'
import { type BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()

const id = Number(route.params.id)
const report = ref<KscReport | null>(null)
const loading = ref(true)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const graphs = computed<KscGraph[]>(() => {
  const raw = report.value?.kscGraph
  return Array.isArray(raw) ? raw : raw ? [raw] : []
})

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'KSC Reports', to: '/ksc-reports' },
  { label: report.value?.label ?? `Report ${id}`, to: '#', position: 'last' }
])

const graphUrl = (graph: KscGraph): string => {
  const base = '/opennms/graph/graph.png'
  const params = new URLSearchParams({
    resourceId: graph.resourceId,
    report: graph.graphtype,
    timespan: graph.timespan
  })
  return `${base}?${params.toString()}`
}

onMounted(async () => {
  try {
    report.value = await getReport(id)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.ksc-detail-page {
  padding: 0 0 40px;

  &__title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 16px;
    color: var($primary-text-on-surface);
  }

  &__status {
    padding: 24px;
    color: var($secondary-text-on-surface);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 16px;
  }
}

.graph-card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;

  &__title {
    padding: 10px 14px;
    font-weight: 600;
    font-size: 13px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__body {
    padding: 12px;
    display: flex;
    justify-content: center;
    background: var($surface);
  }

  &__img {
    max-width: 100%;
    height: auto;
    display: block;
  }

  &__meta {
    padding: 6px 14px;
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var($secondary-text-on-surface);
    border-top: 1px solid var($shade-3);
  }
}
</style>
