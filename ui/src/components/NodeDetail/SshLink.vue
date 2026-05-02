<template>
  <a
    :href="sshHref"
    :title="title"
    :aria-label="title"
    class="ssh-link"
    :class="`ssh-link--${variant}`"
    @click.stop
  >
    <svg viewBox="0 0 24 24" class="ssh-link__icon" aria-hidden="true">
      <path
        d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h14V7H5zm2.3 2.3 1.4-1.4L12 11.2l-3.3 3.3-1.4-1.4 1.9-1.9-1.9-1.9zM13 14h5v1.5h-5V14z"
      />
    </svg>
    <span v-if="variant === 'button'" class="ssh-link__label">SSH</span>
  </a>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  ip: string
  username?: string | null
  variant?: 'button' | 'icon'
}>(), {
  username: null,
  variant: 'icon'
})

const formatHost = (ip: string) => (ip.includes(':') ? `[${ip}]` : ip)

const sshHref = computed(() => {
  const host = formatHost(props.ip)
  return props.username ? `ssh://${props.username}@${host}` : `ssh://${host}`
})

const title = computed(() => {
  const target = props.username ? `${props.username}@${props.ip}` : props.ip
  return `Open SSH session to ${target}\nRequires a registered ssh:// handler (Terminal on macOS, GNOME/KDE on Linux, PuTTY on Windows)`
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.ssh-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var($clickable-normal);
  text-decoration: none;
  border-radius: vars.$border-radius-sm;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    color: var($clickable-selected);
    background: var($shade-4);
  }

  &__icon {
    width: 1em;
    height: 1em;
    fill: currentColor;
  }

  &--button {
    padding: 6px 12px;
    border: 1px solid var($border-on-surface);
    font-size: 0.9rem;
    font-weight: 500;
  }

  &--icon {
    padding: 4px;
    font-size: 1rem;
  }
}
</style>
