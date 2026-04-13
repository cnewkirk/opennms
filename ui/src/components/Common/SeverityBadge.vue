<template>
  <span :class="['severity-badge', severity.toLowerCase()]">{{ severity }}</span>
</template>

<script setup lang="ts">
defineProps<{ severity: string }>()
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';

// Outlined severity badge: severity color as border + text, subtle tinted background.
// Light mode overrides (solid fill) live in opennms-feather-styles.scss because
// :global(X) .child selectors lose the child when Vue transforms them.
$bg: 0.15;
.severity-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: vars.$border-radius-xs;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border: 1.5px solid transparent;

  &.critical      { color: var(--feather-error);         border-color: var(--feather-error);         background: utils.alpha(fvars.$error,         $bg); }
  &.major         { color: var(--feather-major);         border-color: var(--feather-major);         background: utils.alpha(fvars.$major,         $bg); }
  &.minor         { color: var(--feather-minor);         border-color: var(--feather-minor);         background: utils.alpha(fvars.$minor,         $bg); }
  &.warning       { color: var(--feather-warning);       border-color: var(--feather-warning);       background: utils.alpha(fvars.$warning,       $bg); }
  &.normal        { color: var(--feather-success);       border-color: var(--feather-success);       background: utils.alpha(fvars.$success,       $bg); }
  &.cleared,
  &.unacknowledged { color: var(--feather-cleared);      border-color: var(--feather-cleared);       background: utils.alpha(fvars.$cleared,       $bg); }
  &.indeterminate { color: var(--feather-indeterminate); border-color: var(--feather-indeterminate); background: utils.alpha(fvars.$indeterminate, $bg); }
}
</style>
