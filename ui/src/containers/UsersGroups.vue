<template>
  <div class="users-groups-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <FeatherTabContainer v-model="activeTab">
      <template v-slot:tabs>
        <FeatherTab>Users</FeatherTab>
        <FeatherTab>Groups</FeatherTab>
      </template>

      <!-- Users tab -->
      <FeatherTabPanel>
        <div class="users-groups-page__tab-header">
          <FeatherButton primary @click="openCreateUser">New User</FeatherButton>
        </div>
        <div v-if="usersLoading" class="users-groups-page__status">Loading…</div>
        <div v-else-if="usersError" class="users-groups-page__status">Failed to load users.</div>
        <div v-else-if="!users.length" class="users-groups-page__status">No users found.</div>
        <table v-else class="ug-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user['user-id']">
              <td>{{ user['user-id'] }}</td>
              <td>{{ user['full-name'] }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.role.join(', ') }}</td>
              <td class="ug-table__actions">
                <FeatherButton text @click="openEditUser(user)">Edit</FeatherButton>
                <FeatherButton text @click="confirmDeleteUser(user['user-id'])">Delete</FeatherButton>
              </td>
            </tr>
          </tbody>
        </table>
      </FeatherTabPanel>

      <!-- Groups tab -->
      <FeatherTabPanel>
        <div class="users-groups-page__tab-header">
          <FeatherButton primary @click="openCreateGroup">New Group</FeatherButton>
        </div>
        <div v-if="groupsLoading" class="users-groups-page__status">Loading…</div>
        <div v-else-if="groupsError" class="users-groups-page__status">Failed to load groups.</div>
        <div v-else-if="!groups.length" class="users-groups-page__status">No groups found.</div>
        <table v-else class="ug-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Comments</th>
              <th>Members</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in groups" :key="group.name">
              <td>{{ group.name }}</td>
              <td>{{ group.comments }}</td>
              <td>{{ group.user.join(', ') }}</td>
              <td class="ug-table__actions">
                <FeatherButton text @click="openEditGroup(group)">Edit</FeatherButton>
                <FeatherButton text @click="confirmDeleteGroup(group.name)">Delete</FeatherButton>
              </td>
            </tr>
          </tbody>
        </table>
      </FeatherTabPanel>
    </FeatherTabContainer>

    <UserEditDialog v-model="userDialogVisible" :user="selectedUser" @saved="onUserSaved" />
    <GroupEditDialog v-model="groupDialogVisible" :group="selectedGroup" :allUsers="users" @saved="onGroupSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
import { FeatherButton } from '@featherds/button'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import UserEditDialog from '@/components/UsersGroups/UserEditDialog.vue'
import GroupEditDialog from '@/components/UsersGroups/GroupEditDialog.vue'
import { listUsers, deleteUser, listGroups, deleteGroup } from '@/services/userGroupService'
import { OnmsUser, OnmsGroup, BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Users & Groups', to: '#', position: 'last' }
])

const activeTab = ref(0)

// Users state
const users = ref<OnmsUser[]>([])
const usersLoading = ref(false)
const usersError = ref(false)
const userDialogVisible = ref(false)
const selectedUser = ref<OnmsUser | null>(null)

// Groups state
const groups = ref<OnmsGroup[]>([])
const groupsLoading = ref(false)
const groupsError = ref(false)
const groupDialogVisible = ref(false)
const selectedGroup = ref<OnmsGroup | null>(null)

const loadUsers = async () => {
  usersLoading.value = true
  usersError.value = false
  const result = await listUsers()
  usersLoading.value = false
  if (result === false) {
    usersError.value = true
  } else {
    users.value = result
  }
}

const loadGroups = async () => {
  groupsLoading.value = true
  groupsError.value = false
  const result = await listGroups()
  groupsLoading.value = false
  if (result === false) {
    groupsError.value = true
  } else {
    groups.value = result
  }
}

onMounted(() => {
  loadUsers()
  loadGroups()
})

// User actions
const openCreateUser = () => {
  selectedUser.value = null
  userDialogVisible.value = true
}

const openEditUser = (user: OnmsUser) => {
  selectedUser.value = user
  userDialogVisible.value = true
}

const confirmDeleteUser = async (id: string) => {
  if (!window.confirm(`Are you sure you want to delete user "${id}"?`)) return
  const ok = await deleteUser(id)
  if (ok) {
    showSnackBar({ msg: `User "${id}" deleted.` })
    await loadUsers()
  } else {
    showSnackBar({ msg: `Failed to delete user "${id}".`, error: true })
  }
}

const onUserSaved = async () => {
  userDialogVisible.value = false
  await loadUsers()
}

// Group actions
const openCreateGroup = () => {
  selectedGroup.value = null
  groupDialogVisible.value = true
}

const openEditGroup = (group: OnmsGroup) => {
  selectedGroup.value = group
  groupDialogVisible.value = true
}

const confirmDeleteGroup = async (name: string) => {
  if (!window.confirm(`Are you sure you want to delete group "${name}"?`)) return
  const ok = await deleteGroup(name)
  if (ok) {
    showSnackBar({ msg: `Group "${name}" deleted.` })
    await loadGroups()
  } else {
    showSnackBar({ msg: `Failed to delete group "${name}".`, error: true })
  }
}

const onGroupSaved = async () => {
  groupDialogVisible.value = false
  await loadGroups()
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.users-groups-page {
  padding: 0 20px 20px;
  background: var($surface);
  min-height: 100%;

  &__tab-header {
    display: flex;
    justify-content: flex-end;
    padding: 12px 0;
  }

  &__status {
    padding: 16px 0;
    color: var($secondary-text-on-surface);
  }
}

.ug-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 2px solid var($border-on-surface);
    color: var($secondary-text-on-surface);
    font-weight: 600;
  }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid var($border-on-surface);
    color: var($primary-text-on-surface);
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  &__actions {
    white-space: nowrap;
    text-align: right;
  }
}
</style>
