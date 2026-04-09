<template>
  <div style="height: 1rem"></div>
  <div class="footer">
    <p>
      OpenNMS <a href="../about/index.jsp">Copyright</a> © {{ mainMenu.copyrightDates || '--' }}
      <a href="http://www.opennms.com/">The OpenNMS Group, Inc.</a>
      OpenNMS&reg; is a registered trademark of
      <a href="http://www.opennms.com">The OpenNMS Group, Inc.</a>
      - Version: {{ mainMenu.version || '--' }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useMenuStore } from '@/stores/menuStore'
import { MainMenu } from '@/types/mainMenu'

const menuStore = useMenuStore()

const mainMenu = computed<MainMenu>(() => menuStore.mainMenu)

</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.footer {
  display: block;
  text-align: center;
  margin-left: -15px;
  margin-right: -15px;
  padding: 0.25rem 0.42rem;
  background-color: var($surface);
  border-top: 1px solid var($border-light-on-surface);
  color: var($secondary-text-on-surface);
  font-size: 0.8rem;

  a {
    color: var($secondary-text-on-surface);
    text-decoration: none;
    &:hover {
      color: var($primary-text-on-surface);
      text-decoration: underline;
    }
  }
}
</style>
