<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useTaskStore } from '@/stores/taskStore'
import {
  fetchBacklogIssues,
  fetchBacklogMyself,
  fetchBacklogProjects,
  fetchBacklogProjectMilestones,
  fetchBacklogProjectStatuses,
  filterAllowedBacklogProjects,
  filterMilestoneSourceProjects,
  formatBacklogError,
  hasBacklogCredentials,
  issueMilestoneLabel,
  isBacklogIssueClosed,
  isBacklogMilestoneProjectExcluded,
  type BacklogIssue,
  type BacklogMilestone,
  type BacklogProject,
  type BacklogStatus,
  type BacklogUser,
} from '@/utils/backlog'

const PAGE_SIZE = 100
const store = useTaskStore()
const router = useRouter()

const configured = ref(hasBacklogCredentials())
const loading = ref(false)
const loadingMore = ref(false)
const importing = ref(false)
const error = ref('')
const notice = ref('')
const me = ref<BacklogUser | null>(null)
const projects = ref<BacklogProject[]>([])
const projectStatuses = ref<BacklogStatus[]>([])
const milestones = ref<BacklogMilestone[]>([])
const issues = ref<BacklogIssue[]>([])
const projectId = ref<number | 'all'>('all')
const statusFilter = ref<number | 'open' | 'all'>('open')
const milestoneId = ref<number | 'all'>('all')
const offset = ref(0)
const hasMore = ref(false)
const selectedIds = ref<Set<number>>(new Set())

type IssueSortKey = 'issueKey' | 'milestone' | 'status' | 'dueDate'
const sortKey = ref<IssueSortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function issueDueDate(issue: BacklogIssue): string {
  return issue.dueDate ? issue.dueDate.slice(0, 10) : ''
}

function compareIssues(a: BacklogIssue, b: BacklogIssue, key: IssueSortKey): number {
  if (key === 'dueDate') {
    const aDate = issueDueDate(a)
    const bDate = issueDueDate(b)
    if (!aDate && !bDate) return a.issueKey.localeCompare(b.issueKey, 'zh-Hant', { numeric: true })
    if (!aDate) return 1
    if (!bDate) return -1
    return aDate.localeCompare(bDate) || a.issueKey.localeCompare(b.issueKey, 'zh-Hant', { numeric: true })
  }
  const aText =
    key === 'issueKey'
      ? a.issueKey
      : key === 'milestone'
        ? issueMilestoneLabel(a)
        : a.status.name
  const bText =
    key === 'issueKey'
      ? b.issueKey
      : key === 'milestone'
        ? issueMilestoneLabel(b)
        : b.status.name
  const dashA = aText === '—' ? '' : aText
  const dashB = bText === '—' ? '' : bText
  if (!dashA && dashB) return 1
  if (dashA && !dashB) return -1
  return dashA.localeCompare(dashB, 'zh-Hant', { numeric: true })
}

function toggleSort(key: IssueSortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = 'asc'
}

function sortIcon(key: IssueSortKey): 'arrow-up' | 'arrow-down' {
  return sortKey.value === key && sortDir.value === 'desc' ? 'arrow-down' : 'arrow-up'
}

const visibleIssues = computed(() => {
  const filtered =
    statusFilter.value === 'open'
      ? issues.value.filter((issue) => !isBacklogIssueClosed(issue))
      : issues.value
  if (!sortKey.value) return filtered
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => compareIssues(a, b, key) * dir)
})

const statusOptions = computed(() => {
  if (projectStatuses.value.length) return projectStatuses.value
  const byId = new Map<number, BacklogStatus>()
  for (const issue of issues.value) {
    if (!byId.has(issue.status.id)) {
      byId.set(issue.status.id, { id: issue.status.id, name: issue.status.name })
    }
  }
  return [...byId.values()]
})

const milestoneOptions = computed(() => {
  const byId = new Map<number, BacklogMilestone>()
  for (const item of milestones.value) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
})

function milestoneOptionLabel(item: BacklogMilestone): string {
  if (projectId.value !== 'all') return item.name
  const project = projects.value.find((entry) => entry.id === item.projectId)
  return project ? `${item.name}（${project.projectKey}）` : item.name
}

const selectableIssues = computed(() =>
  visibleIssues.value.filter((issue) => !store.isBacklogIssueImported(issue.id)),
)

const selectedCount = computed(() => selectedIds.value.size)
const allVisibleSelected = computed(
  () =>
    selectableIssues.value.length > 0 &&
    selectableIssues.value.every((issue) => selectedIds.value.has(issue.id)),
)

function goSettings() {
  void router.push({ path: '/settings', query: { tab: 'backlog' } })
}

function goToday() {
  void router.push('/today')
}

function isSelected(id: number) {
  return selectedIds.value.has(id)
}

function toggleIssue(id: number, imported: boolean) {
  if (imported) return
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  const next = new Set(selectedIds.value)
  if (allVisibleSelected.value) {
    for (const issue of selectableIssues.value) next.delete(issue.id)
  } else {
    for (const issue of selectableIssues.value) next.add(issue.id)
  }
  selectedIds.value = next
}

function pruneSelection() {
  const allowed = new Set(selectableIssues.value.map((issue) => issue.id))
  const next = new Set<number>()
  for (const id of selectedIds.value) {
    if (allowed.has(id)) next.add(id)
  }
  selectedIds.value = next
}

function selectedIssues(): BacklogIssue[] {
  return visibleIssues.value.filter((issue) => selectedIds.value.has(issue.id))
}

async function loadStatuses() {
  projectStatuses.value = []
  if (projectId.value === 'all') return
  try {
    projectStatuses.value = await fetchBacklogProjectStatuses(projectId.value)
  } catch {
    projectStatuses.value = []
  }
}

async function loadMilestones() {
  const sourceProjects =
    projectId.value === 'all'
      ? filterMilestoneSourceProjects(projects.value)
      : projects.value.filter(
          (project) =>
            project.id === projectId.value && !isBacklogMilestoneProjectExcluded(project),
        )
  const targetIds = sourceProjects.map((project) => project.id)
  if (!targetIds.length) {
    milestones.value = []
    if (milestoneId.value !== 'all') milestoneId.value = 'all'
    return
  }
  const lists = await Promise.all(
    targetIds.map(async (id) => {
      try {
        return await fetchBacklogProjectMilestones(id)
      } catch {
        return [] as BacklogMilestone[]
      }
    }),
  )
  milestones.value = lists.flat()
  if (
    milestoneId.value !== 'all' &&
    !milestones.value.some((item) => item.id === milestoneId.value)
  ) {
    milestoneId.value = 'all'
  }
}

async function loadIssues(reset: boolean) {
  if (!me.value) return
  if (reset) {
    issues.value = []
    offset.value = 0
    hasMore.value = false
    selectedIds.value = new Set()
  }
  const allowedIds = projects.value.map((project) => project.id)
  if (!allowedIds.length) {
    issues.value = []
    hasMore.value = false
    pruneSelection()
    return
  }
  const page = await fetchBacklogIssues({
    assigneeId: me.value.id,
    projectId: projectId.value === 'all' ? undefined : projectId.value,
    projectIds: projectId.value === 'all' ? allowedIds : undefined,
    statusId: typeof statusFilter.value === 'number' ? statusFilter.value : undefined,
    milestoneId: milestoneId.value === 'all' ? undefined : milestoneId.value,
    offset: offset.value,
    count: PAGE_SIZE,
  })
  const scoped = page.filter((issue) => {
    if (!allowedIds.includes(issue.projectId)) return false
    if (milestoneId.value === 'all') return true
    return (issue.milestone ?? []).some((item) => item.id === milestoneId.value)
  })
  issues.value = reset ? scoped : [...issues.value, ...scoped]
  offset.value += page.length
  hasMore.value = page.length === PAGE_SIZE
  pruneSelection()
}

async function refresh() {
  configured.value = hasBacklogCredentials()
  error.value = ''
  notice.value = ''
  if (!configured.value) {
    me.value = null
    projects.value = []
    issues.value = []
    milestones.value = []
    projectStatuses.value = []
    return
  }
  loading.value = true
  try {
    me.value = await fetchBacklogMyself()
    projects.value = filterAllowedBacklogProjects(await fetchBacklogProjects())
    if (
      projectId.value !== 'all' &&
      !projects.value.some((project) => project.id === projectId.value)
    ) {
      projectId.value = 'all'
    }
    await loadStatuses()
    await loadMilestones()
    await loadIssues(true)
  } catch (e) {
    error.value = formatBacklogError(e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  error.value = ''
  try {
    await loadIssues(false)
  } catch (e) {
    error.value = formatBacklogError(e)
  } finally {
    loadingMore.value = false
  }
}

async function onFilterChange() {
  if (!configured.value || !me.value) return
  loading.value = true
  error.value = ''
  try {
    await loadIssues(true)
  } catch (e) {
    error.value = formatBacklogError(e)
  } finally {
    loading.value = false
  }
}

async function onProjectChange() {
  if (typeof statusFilter.value === 'number') statusFilter.value = 'open'
  milestoneId.value = 'all'
  await loadStatuses()
  await loadMilestones()
  await onFilterChange()
}

function onMilestoneSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  milestoneId.value = value === 'all' ? 'all' : Number(value)
  void onFilterChange()
}

function clearMilestone() {
  if (milestoneId.value === 'all') return
  milestoneId.value = 'all'
  void onFilterChange()
}

function clearStatus() {
  if (statusFilter.value === 'all') return
  statusFilter.value = 'all'
  void onFilterChange()
}

function importSelected() {
  const picked = selectedIssues()
  if (!picked.length) return
  importing.value = true
  const result = store.importBacklogIssues(picked)
  selectedIds.value = new Set()
  notice.value =
    result.skipped > 0
      ? `已新增 ${result.created} 項主任務，略過 ${result.skipped} 項已匯入`
      : `已新增 ${result.created} 項主任務到 ${store.selectedDate}`
  importing.value = false
}

function onProjectSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  projectId.value = value === 'all' ? 'all' : Number(value)
  void onProjectChange()
}

function clearProject() {
  if (projectId.value === 'all') return
  projectId.value = 'all'
  void onProjectChange()
}

function onStatusSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  statusFilter.value = value === 'open' || value === 'all' ? value : Number(value)
  void onFilterChange()
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="backlog-view">
    <header class="page-header">
      <div>
        <h1>Backlog</h1>
        <p class="subtitle">
          預設顯示指派給我的任務，可再以專案／milestone／狀態篩選。勾選後會新增為
          {{ store.selectedDate }} 的主任務。
        </p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn-secondary" @click="goSettings">連線設定</button>
        <button type="button" class="btn-secondary" :disabled="loading || !configured" @click="refresh">
          重新載入
        </button>
      </div>
    </header>

    <div v-if="!configured" class="empty-card">
      <p>尚未設定 Space 與 API Key。</p>
      <button type="button" class="btn-primary" @click="goSettings">前往設定</button>
    </div>

    <template v-else>
      <div class="toolbar">
        <label class="filter">
          <span>專案</span>
          <div class="filter-control">
            <select :value="String(projectId)" :disabled="loading" @change="onProjectSelect">
              <option value="all">指定專案全部</option>
              <option v-for="project in projects" :key="project.id" :value="String(project.id)">
                {{ project.projectKey }} {{ project.name }}
              </option>
            </select>
            <button
              type="button"
              class="filter-clear"
              :disabled="loading || projectId === 'all'"
              aria-label="重置專案為全部"
              @click="clearProject"
            >
              <AppIcon name="xmark" size="xs" />
            </button>
          </div>
        </label>
        <label class="filter">
          <span>milestone</span>
          <div class="filter-control">
            <select :value="String(milestoneId)" :disabled="loading" @change="onMilestoneSelect">
              <option value="all">全部</option>
              <option v-for="item in milestoneOptions" :key="item.id" :value="String(item.id)">
                {{ milestoneOptionLabel(item) }}
              </option>
            </select>
            <button
              type="button"
              class="filter-clear"
              :disabled="loading || milestoneId === 'all'"
              aria-label="重置 milestone 為全部"
              @click="clearMilestone"
            >
              <AppIcon name="xmark" size="xs" />
            </button>
          </div>
        </label>
        <label class="filter">
          <span>狀態</span>
          <div class="filter-control">
            <select :value="String(statusFilter)" :disabled="loading" @change="onStatusSelect">
              <option value="open">進行中</option>
              <option value="all">全部狀態</option>
              <option v-for="status in statusOptions" :key="status.id" :value="String(status.id)">
                {{ status.name }}
              </option>
            </select>
            <button
              type="button"
              class="filter-clear"
              :disabled="loading || statusFilter === 'all'"
              aria-label="重置狀態為全部狀態"
              @click="clearStatus"
            >
              <AppIcon name="xmark" size="xs" />
            </button>
          </div>
        </label>
        <p v-if="me" class="whoami">登入：{{ me.name }}</p>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="notice" class="notice">
        {{ notice }}
        <button type="button" class="link-btn" @click="goToday">前往今日任務</button>
      </p>

      <div class="table-card">
        <div class="table-toolbar">
          <label class="check-all">
            <input
              type="checkbox"
              :checked="allVisibleSelected"
              :disabled="!selectableIssues.length"
              @change="toggleSelectAll"
            />
            全選可匯入
          </label>
          <button
            type="button"
            class="btn-primary"
            :disabled="!selectedCount || importing"
            @click="importSelected"
          >
            將選取項目新增為主任務（{{ selectedCount }}）
          </button>
        </div>

        <p v-if="loading" class="empty">載入中…</p>
        <p v-else-if="!visibleIssues.length" class="empty">沒有符合條件的 Backlog 任務</p>
        <table v-else>
          <thead>
            <tr>
              <th class="check-col"></th>
              <th>
                <button type="button" class="sort-btn" :class="{ active: sortKey === 'issueKey' }" @click="toggleSort('issueKey')">
                  Key
                  <AppIcon v-if="sortKey === 'issueKey'" :name="sortIcon('issueKey')" size="xs" />
                </button>
              </th>
              <th>標題</th>
              <th>
                <button type="button" class="sort-btn" :class="{ active: sortKey === 'milestone' }" @click="toggleSort('milestone')">
                  milestone
                  <AppIcon v-if="sortKey === 'milestone'" :name="sortIcon('milestone')" size="xs" />
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" :class="{ active: sortKey === 'status' }" @click="toggleSort('status')">
                  狀態
                  <AppIcon v-if="sortKey === 'status'" :name="sortIcon('status')" size="xs" />
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" :class="{ active: sortKey === 'dueDate' }" @click="toggleSort('dueDate')">
                  期限
                  <AppIcon v-if="sortKey === 'dueDate'" :name="sortIcon('dueDate')" size="xs" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="issue in visibleIssues"
              :key="issue.id"
              :class="{ imported: store.isBacklogIssueImported(issue.id) }"
            >
              <td class="check-col">
                <input
                  type="checkbox"
                  :checked="isSelected(issue.id)"
                  :disabled="store.isBacklogIssueImported(issue.id)"
                  @change="toggleIssue(issue.id, store.isBacklogIssueImported(issue.id))"
                />
              </td>
              <td class="key">{{ issue.issueKey }}</td>
              <td class="summary">
                {{ issue.summary }}
                <span v-if="store.isBacklogIssueImported(issue.id)" class="imported-tag">已匯入</span>
              </td>
              <td>{{ issueMilestoneLabel(issue) }}</td>
              <td>{{ issue.status.name }}</td>
              <td>{{ issueDueDate(issue) || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="hasMore && !loading" class="more">
          <button type="button" class="btn-secondary" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '載入中…' : '載入更多' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
  line-height: 1.5;
}

.header-actions,
.actions,
.table-toolbar,
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar {
  margin-bottom: 16px;
}

.filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: $text-muted;

  select {
    box-sizing: border-box;
    width: 200px;
    max-width: 200px;
    padding: 6px 10px;
    border: 1px solid $border;
    border-radius: $radius-sm;
    background: $surface;
    color: $text;
    text-overflow: ellipsis;
  }
}

.filter-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-clear {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text-muted;
  background: $surface;

  &:hover:not(:disabled) {
    border-color: $primary;
    color: $primary;
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.whoami {
  margin-left: auto;
  font-size: 12px;
  color: $text-muted;
}

.empty-card,
.table-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 24px;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  color: $text-muted;
}

.table-toolbar {
  justify-content: space-between;
  margin-bottom: 12px;
}

.check-all {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid $border;
  font-size: 13px;
}

th {
  color: $text-muted;
  font-size: 12px;
  font-weight: 600;
  background: $bg;
}

.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &.active {
    color: $primary;
  }
}

.check-col {
  width: 36px;
}

.key {
  font-weight: 600;
  white-space: nowrap;
}

.summary {
  min-width: 0;
}

.imported {
  opacity: 0.65;
}

.imported-tag {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 600;
  color: $primary;
  background: $primary-light;
  border-radius: 20px;
  padding: 1px 8px;
}

.empty {
  padding: 32px 8px;
  text-align: center;
  color: $text-muted;
}

.more {
  padding-top: 16px;
}

.error {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 12px;
}

.notice {
  color: $primary;
  font-size: 13px;
  margin-bottom: 12px;
}

.link-btn {
  margin-left: 8px;
  color: $primary;
  font-weight: 600;
  text-decoration: underline;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: $radius-sm;
  background: $primary;
  color: white;
  font-weight: 500;

  &:hover:not(:disabled) {
    background: $primary-dark;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;

  &:hover:not(:disabled) {
    border-color: $primary;
    color: $primary;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}
</style>
