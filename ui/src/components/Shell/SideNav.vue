<template>
  <nav
    class="sidenav"
    :class="{ 'sidenav--collapsed': collapsed }"
    :aria-expanded="!collapsed"
  >
    <div class="sidenav__sections">
      <!-- nav sections injected in Task 4 -->
    </div>

    <button
      class="sidenav__toggle"
      :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggle"
      aria-label="Toggle sidebar"
    >
      <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
    </button>
  </nav>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'onms.sidenav.collapsed'

const collapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')

const toggle = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(STORAGE_KEY, String(collapsed.value))
  // update the grid column class on the app shell
  document.querySelector('.app-shell')?.classList.toggle('sidenav-collapsed', collapsed.value)
}

// Sync grid class on mount
onMounted(() => {
  document.querySelector('.app-shell')?.classList.toggle('sidenav-collapsed', collapsed.value)
})
</script>

<style lang="scss" scoped>
.sidenav {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--feather-surface);
  border-right: 1px solid var(--feather-border-light-on-surface);
  overflow: hidden;
  transition: width 200ms ease;

  &__sections {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 40px;
    border: none;
    border-top: 1px solid var(--feather-border-light-on-surface);
    background: transparent;
    cursor: pointer;
    color: var(--feather-secondary-text-on-surface);
    flex-shrink: 0;

    &:hover {
      background: var(--feather-state-text-hover);
    }
  }
}
</style>
