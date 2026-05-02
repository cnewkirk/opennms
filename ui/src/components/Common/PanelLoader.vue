<template>
  <div
    :class="['panel-loader', { 'panel-loader--overlay': overlay }]"
    :style="overlay ? { background } : undefined"
    role="status"
    aria-label="Loading"
  >
    <div class="panel-loader__body">
      <svg
        class="panel-loader__icon"
        :width="size"
        :height="size"
        viewBox="0 0 70 70"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient :id="`${uid}-g1`" x1="38.51" y1="67.61" x2="-3.17" y2="25.53" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#0081ad" /><stop offset="1" stop-color="#14d1df" />
          </linearGradient>
          <linearGradient :id="`${uid}-g2`" x1="38.62" y1="67.5" x2="-3.06" y2="25.41" :href="`#${uid}-g1`" />
          <linearGradient :id="`${uid}-g3`" x1="25.87" y1="-3" x2="65.55" y2="37.08" :href="`#${uid}-g1`" />
          <linearGradient :id="`${uid}-g4`" x1="25.98" y1="-3.12" x2="65.67" y2="36.97" :href="`#${uid}-g1`" />
          <linearGradient :id="`${uid}-g5`" x1="8.32" y1="8.72" x2="53.79" y2="53.6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#14d1df" /><stop offset="1" stop-color="#85d9a5" />
          </linearGradient>
          <linearGradient :id="`${uid}-g6`" x1="8.33" y1="8.71" x2="53.81" y2="53.58" :href="`#${uid}-g5`" />
        </defs>
        <path :fill="`url(#${uid}-g1)`" d="M17.61,36a103.5,103.5,0,0,1-11-14,42.82,42.82,0,0,1-2.92-5.32A31.63,31.63,0,0,0,7.89,52.51C8.26,49.1,11.89,43,17.61,36Z" />
        <path :fill="`url(#${uid}-g2)`" d="M27.2,45.61c-7,5.73-13.07,9.36-16.49,9.72a31.65,31.65,0,0,0,35.83,4.16A49.57,49.57,0,0,1,38.83,55,114.14,114.14,0,0,1,27.2,45.61Z" />
        <path :fill="`url(#${uid}-g3)`" d="M36,17.61c7-5.72,13.08-9.35,16.49-9.72A31.63,31.63,0,0,0,16.68,3.74,49.16,49.16,0,0,1,24.4,8.23,111.51,111.51,0,0,1,36,17.61Z" />
        <path :fill="`url(#${uid}-g4)`" d="M55.33,10.71c-.36,3.42-4,9.53-9.72,16.49a105.09,105.09,0,0,1,11,14,43.44,43.44,0,0,1,2.91,5.33A31.65,31.65,0,0,0,55.33,10.71Z" />
        <path :fill="`url(#${uid}-g5)`" d="M31.61,21.42h0C20.75,11.6,10.93,6,8.44,8.44c-2.88,2.89,5.15,15.6,18,28.4,1.75,1.75,3.5,3.41,5.22,5Z" />
        <path :fill="`url(#${uid}-g6)`" d="M41.81,31.61h0c-1.56,1.73-3.22,3.48-5,5.23s-3.5,3.41-5.23,5c10.87,9.82,20.68,15.46,23.17,13S51.63,42.48,41.81,31.61Z" />
      </svg>
      <div class="panel-loader__dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  size?: number
  overlay?: boolean
  background?: string
}>(), {
  size: 36,
  overlay: false,
  background: 'var(--feather-surface)'
})

const uid = useId()
</script>

<style scoped lang="scss">
// Default: content-sized — works inside Buttons, inline next to text, and as
// a child of an already-centering wrapper. Use `overlay` for absolute fill.
.panel-loader {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &--overlay {
    display: flex;
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }
}

.panel-loader__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.panel-loader__icon {
  flex-shrink: 0;
  animation: panel-loader-pulse 1.6s ease-in-out infinite;
}

.panel-loader__dots {
  display: flex;
  gap: 6px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #14d1df;
    animation: panel-loader-bounce 1.2s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes panel-loader-pulse {
  0%, 100% { transform: scale(1);    opacity: 1;    }
  50%      { transform: scale(1.1); opacity: 0.85; }
}

@keyframes panel-loader-bounce {
  0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
  40%           { transform: translateY(-5px); opacity: 1;   }
}
</style>
