import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { mockLabels, mockTasks } from "@/mock/data";
import type {
  Attachment,
  AttachmentOwnerType,
  DailyReflection,
  DailyReflectionInput,
  GeminiUsageState,
  Label,
  MigrationCandidate,
  MigrationRecord,
  MigrationReviewAction,
  MigrationReviewState,
  Note,
  ReflectionPromptState,
  SidebarCarouselImage,
  SidebarCarouselMode,
  SidebarCarouselState,
  StatusItem,
  StatusSortOnSelect,
  SubTask,
  Task,
  TaskAvatar,
  TaskDayView,
  TaskStatus,
  TodayJournalState,
  TodayProgress,
  ToolboxItem,
  ToolboxList,
} from "@/types";
import type { BackupSource } from "@/utils/backup";
import { createAttachmentFromFile } from "@/utils/attachment";
import { resolveContentType } from "@/utils/detectContentType";
import {
  addDays,
  daysBetween,
  getTaskEndDate,
  normalizeEndDate,
  todayString,
} from "@/utils/date";
import { generateAiManagerAdvice as requestAiManagerAdvice } from "@/utils/gemini";
import { generateId } from "@/utils/id";
import {
  AI_MANAGER_PROMPT_KEY,
  DAILY_REFLECTIONS_KEY,
  EXPAND_IMAGES_KEY,
  EXPAND_TASKS_KEY,
  GEMINI_USAGE_KEY,
  LABELS_KEY,
  MIGRATION_REVIEW_KEY,
  NAV_FEATURES_KEY,
  NAV_FEATURE_ORDER_KEY,
  REFLECTION_PROMPT_KEY,
  SELECTED_DATE_KEY,
  SIDEBAR_CAROUSEL_KEY,
  STATUS_ITEMS_KEY,
  TASK_AVATARS_KEY,
  TASKS_KEY,
  TOOLBOX_LISTS_KEY,
  defaultGeminiUsageState,
  defaultMigrationReviewState,
  defaultReflectionPromptState,
  loadFromStorage,
  removeFromStorage,
  saveToStorage,
} from "@/utils/storage";
import {
  DEFAULT_TASK_AVATARS,
  fileToAvatarDataUrl,
  findTaskAvatar,
  isDefaultTaskAvatar,
  normalizeTaskAvatars,
} from "@/utils/taskAvatars";
import {
  clampCarouselIntervalHours,
  defaultSidebarCarouselState,
  fileToCarouselDataUrl,
  normalizeSidebarCarouselState,
  SIDEBAR_CAROUSEL_MAX_IMAGES,
} from "@/utils/sidebarCarousel";
import {
  COMPLETED_STATUS_ID,
  createDefaultStatusItems,
  createUnknownStatusItem,
  DEFAULT_STATUS_ID,
  getStatusBgForColor,
  isCompletedStatus,
  normalizeStatusItems,
} from "@/utils/status";
import {
  NAV_FEATURES,
  defaultNavFeatureOrder,
  defaultNavFeatureVisibility,
  getOrderedNavFeatures,
  normalizeNavFeatureOrder,
  normalizeNavFeatureVisibility,
  type NavFeatureId,
  type NavFeatureVisibility,
} from "@/utils/navFeatures";

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task;
}

function normalizeSubTask(sub: SubTask): SubTask {
  return {
    ...sub,
    note: sub.note ?? "",
    noteContentType: sub.noteContentType ?? "text",
  };
}

function normalizeNote(note: Note): Note {
  return {
    ...note,
    contentType: note.contentType ?? "text",
  };
}

function normalizeTask(task: Task & { carriedFromDate?: string; difficultyNote?: string }): Task {
  const migrationHistory = task.migrationHistory ?? [];
  if (task.carriedFromDate && !migrationHistory.length) {
    migrationHistory.push({
      fromDate: task.carriedFromDate,
      toDate: task.date,
      migratedAt: task.updatedAt,
    });
  }
  const { carriedFromDate: _, difficultyNote: __, ...rest } = task;
  return {
    ...rest,
    migrationHistory,
    endDate: normalizeEndDate(rest.date, task.endDate),
    statusHours: task.statusHours ?? null,
    bodyContent: task.bodyContent ?? "",
    bodyContentType: task.bodyContentType ?? "text",
    subtasks: task.subtasks.map(normalizeSubTask),
    notes: (task.notes ?? []).map(normalizeNote),
    avatarId: task.avatarId ?? null,
  };
}

function isMigratedAwayFromDate(task: Task, date: string): boolean {
  return (
    task.date !== date && task.migrationHistory.some((m) => m.fromDate === date)
  );
}

function normalizeDailyReflection(
  reflection: DailyReflection & {
    status?: DailyReflection["status"];
    summaryContent?: string;
    aiManagerAdvice?: string;
    aiGeneratedAt?: string | null;
  },
): DailyReflection {
  return {
    ...reflection,
    summaryContent: reflection.summaryContent ?? "",
    aiManagerAdvice: reflection.aiManagerAdvice ?? "",
    aiGeneratedAt: reflection.aiGeneratedAt ?? null,
    status: reflection.status ?? "submitted",
  };
}

function normalizeToolboxItem(item: ToolboxItem): ToolboxItem {
  return {
    ...item,
    content: item.content ?? "",
    contentType: item.contentType ?? "text",
  };
}

function normalizeToolboxList(list: ToolboxList): ToolboxList {
  return {
    ...list,
    title: list.title ?? "",
    purpose: list.purpose ?? "",
    items: (list.items ?? []).map(normalizeToolboxItem),
  };
}

function migrateLegacyDuplicates(taskList: Task[]): Task[] {
  const normalized = taskList.map(normalizeTask);
  const carried = normalized.filter((t) =>
    t.migrationHistory.some(
      (m) =>
        m.toDate === t.date &&
        normalized.some(
          (other) =>
            other.id !== t.id &&
            other.date === m.fromDate &&
            other.title === t.title &&
            !other.completed,
        ),
    ),
  );
  const idsToRemove = new Set<string>();

  for (const copy of carried) {
    const lastMigration =
      copy.migrationHistory[copy.migrationHistory.length - 1];
    if (!lastMigration) continue;
    const source = normalized.find(
      (t) =>
        t.id !== copy.id &&
        !idsToRemove.has(t.id) &&
        t.date === lastMigration.fromDate &&
        t.title === copy.title &&
        !t.completed,
    );
    if (!source) continue;

    source.date = copy.date;
    source.migrationHistory = [
      ...source.migrationHistory,
      { ...lastMigration, migratedAt: copy.createdAt },
    ];
    source.subtasks = copy.subtasks.map((s) => ({ ...s, taskId: source.id }));
    source.notes = copy.notes.map((n) => ({ ...n, taskId: source.id }));
    source.attachments = copy.attachments.map((a) => ({
      ...a,
      ownerId: source.id,
      ownerType: "task" as const,
    }));
    source.status = copy.status;
    source.statusHours = copy.statusHours;
    source.labels = [...copy.labels];
    source.updatedAt = copy.updatedAt;
    idsToRemove.add(copy.id);
  }

  return normalized.filter((t) => !idsToRemove.has(t.id));
}

function sortByCompleted<T extends { completed: boolean }>(items: T[]): T[] {
  const pending = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  return [...pending, ...done];
}

function reorderInGroup<T extends { id: string; completed: boolean }>(
  items: T[],
  fromId: string,
  toId: string,
): T[] | null {
  const sorted = sortByCompleted([...items]);
  const fromIdx = sorted.findIndex((i) => i.id === fromId);
  const toIdx = sorted.findIndex((i) => i.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;

  const fromItem = sorted[fromIdx];
  const toItem = sorted[toIdx];
  if (fromItem.completed !== toItem.completed) return null;

  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved);
  return sorted;
}

export const useTaskStore = defineStore("task", () => {
  const initialized = ref(false);
  const tasks = ref<Task[]>([]);
  const labels = ref<Label[]>([]);
  const selectedDate = ref(todayString());
  /** 響應式的「今天」：頁面跨日仍開著時，喚醒檢查會更新它，讓相關 computed 重新計算 */
  const currentDate = ref(todayString());

  function refreshCurrentDate() {
    const today = todayString();
    if (currentDate.value !== today) currentDate.value = today;
  }
  const expandImages = ref(loadFromStorage(EXPAND_IMAGES_KEY, false));
  const expandAllTasks = ref(loadFromStorage(EXPAND_TASKS_KEY, true));
  const migrationReviewState = ref<MigrationReviewState>(
    loadFromStorage(MIGRATION_REVIEW_KEY, defaultMigrationReviewState),
  );
  const migrationReviewVisible = ref(false);
  const dailyReflections = ref<DailyReflection[]>(
    loadFromStorage(DAILY_REFLECTIONS_KEY, [] as DailyReflection[]).map(
      normalizeDailyReflection,
    ),
  );
  const reflectionPromptState = ref<ReflectionPromptState>(
    loadFromStorage(REFLECTION_PROMPT_KEY, defaultReflectionPromptState),
  );
  const geminiUsage = ref<GeminiUsageState>(
    loadFromStorage(GEMINI_USAGE_KEY, defaultGeminiUsageState),
  );
  const aiManagerPrompt = ref(loadFromStorage(AI_MANAGER_PROMPT_KEY, ""));
  const aiAdviceLoading = ref(false);
  const reflectionModalVisible = ref(false);
  /** 彈窗正在編輯的日誌日期（prompt 為昨日；手動新增為當日） */
  const reflectionModalDate = ref(addDays(todayString(), -1));
  const reflectionModalMode = ref<"prompt" | "manual">("prompt");
  const statusItems = ref<StatusItem[]>(
    normalizeStatusItems(
      loadFromStorage<StatusItem[] | null>(STATUS_ITEMS_KEY, null),
    ),
  );
  const toolboxLists = ref<ToolboxList[]>(
    loadFromStorage(TOOLBOX_LISTS_KEY, [] as ToolboxList[]).map(
      normalizeToolboxList,
    ),
  );
  const navFeatureVisibility = ref<NavFeatureVisibility>(
    normalizeNavFeatureVisibility(
      loadFromStorage<Partial<NavFeatureVisibility> | null>(
        NAV_FEATURES_KEY,
        null,
      ),
    ),
  );
  const navFeatureOrder = ref<NavFeatureId[]>(
    normalizeNavFeatureOrder(
      loadFromStorage<NavFeatureId[] | null>(NAV_FEATURE_ORDER_KEY, null),
    ),
  );
  const orderedNavFeatures = computed(() =>
    getOrderedNavFeatures(navFeatureOrder.value),
  );
  const taskAvatars = ref<TaskAvatar[]>(
    normalizeTaskAvatars(
      loadFromStorage<TaskAvatar[] | null>(TASK_AVATARS_KEY, null),
    ),
  );
  const sidebarCarousel = ref<SidebarCarouselState>(
    normalizeSidebarCarouselState(
      loadFromStorage<SidebarCarouselState | null>(SIDEBAR_CAROUSEL_KEY, null),
    ),
  );

  function persistStatusItems() {
    saveToStorage(STATUS_ITEMS_KEY, statusItems.value);
  }

  function persistToolboxLists() {
    saveToStorage(TOOLBOX_LISTS_KEY, toolboxLists.value);
  }

  function persistNavFeatures() {
    saveToStorage(NAV_FEATURES_KEY, navFeatureVisibility.value);
  }

  function persistNavFeatureOrder() {
    saveToStorage(NAV_FEATURE_ORDER_KEY, navFeatureOrder.value);
  }

  function persistTaskAvatars() {
    saveToStorage(TASK_AVATARS_KEY, taskAvatars.value);
  }

  function persistSidebarCarousel() {
    try {
      saveToStorage(SIDEBAR_CAROUSEL_KEY, sidebarCarousel.value);
      return true;
    } catch {
      return false;
    }
  }

  function isNavFeatureEnabled(id: NavFeatureId): boolean {
    const feature = NAV_FEATURES.find((item) => item.id === id);
    if (feature?.alwaysEnabled) return true;
    return navFeatureVisibility.value[id] !== false;
  }

  function setNavFeatureEnabled(id: NavFeatureId, enabled: boolean) {
    const feature = NAV_FEATURES.find((item) => item.id === id);
    if (!feature || feature.alwaysEnabled) return;
    navFeatureVisibility.value = {
      ...navFeatureVisibility.value,
      [id]: enabled,
    };
    persistNavFeatures();
    if (!enabled && id === "reflections") {
      reflectionModalVisible.value = false;
    }
  }

  function reorderNavFeatures(fromId: string, toId: string) {
    const fromIdx = navFeatureOrder.value.findIndex((id) => id === fromId);
    const toIdx = navFeatureOrder.value.findIndex((id) => id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const updated = [...navFeatureOrder.value];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    navFeatureOrder.value = updated;
    persistNavFeatureOrder();
  }

  const firstEnabledNavPath = computed(() => {
    const feature = orderedNavFeatures.value.find(
      (item) => item.showInSidebar !== false && isNavFeatureEnabled(item.id),
    );
    return feature?.path ?? "/settings";
  });

  function persistMigrationReviewState() {
    saveToStorage(MIGRATION_REVIEW_KEY, migrationReviewState.value);
  }

  function persistDailyReflections() {
    saveToStorage(DAILY_REFLECTIONS_KEY, dailyReflections.value);
  }

  function persistReflectionPromptState() {
    saveToStorage(REFLECTION_PROMPT_KEY, reflectionPromptState.value);
  }

  function persistGeminiUsage() {
    saveToStorage(GEMINI_USAGE_KEY, geminiUsage.value);
  }

  function setAiManagerPrompt(prompt: string) {
    aiManagerPrompt.value = prompt.trim();
    saveToStorage(AI_MANAGER_PROMPT_KEY, aiManagerPrompt.value);
  }

  function persist() {
    saveToStorage(TASKS_KEY, tasks.value);
    saveToStorage(LABELS_KEY, labels.value);
    saveToStorage(SELECTED_DATE_KEY, selectedDate.value);
    saveToStorage(EXPAND_IMAGES_KEY, expandImages.value);
    saveToStorage(EXPAND_TASKS_KEY, expandAllTasks.value);
  }

  function init() {
    if (initialized.value) return;
    const storedTasks = loadFromStorage<Task[] | null>(TASKS_KEY, null);
    const storedLabels = loadFromStorage<Label[] | null>(LABELS_KEY, null);
    const storedDate = loadFromStorage<string | null>(SELECTED_DATE_KEY, null);

    tasks.value = migrateLegacyDuplicates(storedTasks ?? [...mockTasks]);
    labels.value = storedLabels ?? [...mockLabels];
    selectedDate.value = storedDate ?? todayString();

    removeFromStorage("bullet-journal-difficulty-notes");

    checkDailyPrompts();

    initialized.value = true;
    persist();
  }

  watch([tasks, labels, selectedDate, expandImages, expandAllTasks], persist, {
    deep: true,
  });

  watch(statusItems, persistStatusItems, { deep: true });
  watch(toolboxLists, persistToolboxLists, { deep: true });
  watch(taskAvatars, persistTaskAvatars, { deep: true });
  watch(sidebarCarousel, persistSidebarCarousel, { deep: true });

  const tasksForSelectedDate = computed(() =>
    getTasksByDate(selectedDate.value),
  );

  function calcProgress(date: string): TodayProgress {
    const dayTasks = tasks.value.filter((t) => t.date === date);
    let total = dayTasks.length;
    let completed = dayTasks.filter((t) => t.completed).length;
    for (const task of dayTasks) {
      total += task.subtasks.length;
      completed += task.subtasks.filter((s) => s.completed).length;
    }
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }

  const todayProgress = computed(() => calcProgress(selectedDate.value));

  function getTasksByDate(date: string): TaskDayView[] {
    const active = tasks.value.filter((t) => t.date === date);
    const migrated = tasks.value.filter((t) => isMigratedAwayFromDate(t, date));
    const views: TaskDayView[] = [
      ...sortByCompleted([...active]).map((task) => ({
        task,
        migratedAway: false,
      })),
      ...migrated.map((task) => ({ task, migratedAway: true })),
    ];
    return views;
  }

  function getTaskDatesWithActivity(): Set<string> {
    const set = new Set<string>();
    for (const task of tasks.value) {
      let cursor = task.date;
      const end = getTaskEndDate(task);
      while (cursor <= end) {
        set.add(cursor);
        cursor = addDays(cursor, 1);
      }
      for (const record of task.migrationHistory) {
        set.add(record.fromDate);
      }
    }
    return set;
  }

  function getMigrationCandidates(
    today: string = todayString(),
  ): MigrationCandidate[] {
    const kept = new Set(
      migrationReviewState.value.keptTodayTaskIds[today] ?? [],
    );
    return tasks.value
      .filter((t) => {
        if (t.completed || kept.has(t.id)) return false;
        return getTaskEndDate(t) < today;
      })
      .map((task) => ({
        task,
        overdueFrom: getTaskEndDate(task),
        daysOverdue: daysBetween(getTaskEndDate(task), today),
      }))
      .sort((a, b) => a.overdueFrom.localeCompare(b.overdueFrom));
  }

  const migrationCandidates = computed(() =>
    getMigrationCandidates(currentDate.value),
  );

  const overdueTaskCount = computed(() => migrationCandidates.value.length);

  function shouldShowMigrationReview(today: string = todayString()): boolean {
    if (migrationReviewState.value.snoozedUntil === today) return false;
    return getMigrationCandidates(today).length > 0;
  }

  function checkMigrationReview() {
    refreshCurrentDate();
    if (shouldShowMigrationReview()) {
      migrationReviewVisible.value = true;
    }
  }

  /** 優先處理延期任務；完成後再觸發每日回顧 */
  function checkDailyPrompts() {
    refreshCurrentDate();
    if (shouldShowMigrationReview()) {
      reflectionModalVisible.value = false;
      migrationReviewVisible.value = true;
      return;
    }
    checkReflectionPrompt();
  }

  function openMigrationReview() {
    refreshCurrentDate();
    if (getMigrationCandidates().length > 0) {
      reflectionModalVisible.value = false;
      migrationReviewVisible.value = true;
    }
  }

  function snoozeMigrationReview() {
    migrationReviewState.value.snoozedUntil = todayString();
    persistMigrationReviewState();
    migrationReviewVisible.value = false;
  }

  function applyMigrationReview(actions: MigrationReviewAction[]) {
    const today = todayString();
    const keptIds: string[] = [];

    for (const { taskId, action, targetDate } of actions) {
      const task = findTask(taskId);
      if (!task) continue;
      switch (action) {
        case "migrate":
          rescheduleTask(task, targetDate ?? today);
          break;
        case "complete": {
          const completedId = getCompletedStatusId();
          if (completedId) {
            applyTaskStatus(taskId, completedId);
          } else {
            task.completed = true;
            touchTask(task);
            reorderCompletedToBottom(task.date);
          }
          break;
        }
        case "keep":
          keptIds.push(taskId);
          break;
      }
    }

    if (keptIds.length) {
      const existing = migrationReviewState.value.keptTodayTaskIds[today] ?? [];
      migrationReviewState.value.keptTodayTaskIds[today] = [
        ...existing,
        ...keptIds,
      ];
    }

    migrationReviewState.value.lastReviewedDate = today;
    migrationReviewState.value.snoozedUntil = null;
    persistMigrationReviewState();
    migrationReviewVisible.value = false;
    checkReflectionPrompt();
  }

  function getReflectionByDate(date: string): DailyReflection | undefined {
    return dailyReflections.value.find((item) => item.date === date);
  }

  const dailyReflectionsSorted = computed(() =>
    // 已提交與未完成草稿皆顯示，未完成也可檢視並呼叫 AI 主管
    [...dailyReflections.value].sort((a, b) => b.date.localeCompare(a.date)),
  );

  const todayJournalState = computed<TodayJournalState>(() => {
    const reflection = getReflectionByDate(currentDate.value);
    if (!reflection) return "new";
    if (reflection.status === "submitted") return "done";
    return "edit";
  });

  function yesterdayString(today: string = todayString()): string {
    return addDays(today, -1);
  }

  function shouldShowReflectionPrompt(today: string = todayString()): boolean {
    const yesterday = yesterdayString(today);
    const yesterdayReflection = getReflectionByDate(yesterday);
    // 僅在前一日「已完成提交」時才不再彈窗；草稿要帶到隔日彈窗繼續填
    if (yesterdayReflection?.status === "submitted") return false;
    if (reflectionPromptState.value.lastReflectedDate === today) return false;
    if (reflectionPromptState.value.snoozedUntil === today) return false;
    // 仍有未處理的延期任務時，先等遷移完成再回顧
    if (getMigrationCandidates(today).length > 0) return false;
    return true;
  }

  function openReflectionModal(
    date: string,
    mode: "prompt" | "manual" = "manual",
  ) {
    reflectionModalDate.value = date;
    reflectionModalMode.value = mode;
    reflectionModalVisible.value = true;
  }

  function openTodayReflectionEditor() {
    const date = todayString();
    if (!getReflectionByDate(date)) {
      openReflectionModal(date, "manual");
      return;
    }
    openReflectionEditor(date);
  }

  /** 開啟回顧編輯；已提交者會先退回草稿 */
  function openReflectionEditor(date: string) {
    const reflection = getReflectionByDate(date);
    if (!reflection) return;
    if (reflection.status === "submitted") {
      reflection.status = "draft";
      reflection.updatedAt = new Date().toISOString();
      persistDailyReflections();
    }
    openReflectionModal(date, "manual");
  }

  /** @deprecated 請改用 openReflectionEditor */
  function openDraftReflectionEditor(date: string) {
    openReflectionEditor(date);
  }

  function checkReflectionPrompt() {
    if (!isNavFeatureEnabled("reflections")) return;
    if (migrationReviewVisible.value) return;
    if (!shouldShowReflectionPrompt()) return;
    openReflectionModal(yesterdayString(), "prompt");
  }

  function hasReflectionContent(input: DailyReflectionInput): boolean {
    return [
      input.morningContent,
      input.afternoon1to3Content,
      input.afternoonAfter3Content,
      input.summaryContent,
    ].some((text) => text.trim().length > 0);
  }

  function snoozeReflectionPrompt() {
    reflectionModalVisible.value = false;
  }

  /**
   * 取消／關閉：若尚未完成提交且有內容，自動存成草稿，隔日彈窗可接續顯示
   */
  function dismissReflectionModal(input: DailyReflectionInput) {
    const date = reflectionModalDate.value;
    const existing = getReflectionByDate(date);

    if (existing?.status !== "submitted" && hasReflectionContent(input)) {
      upsertDailyReflection(date, input, "draft");
    }

    if (reflectionModalMode.value === "prompt") {
      reflectionPromptState.value.snoozedUntil = todayString();
      persistReflectionPromptState();
    }
    reflectionModalVisible.value = false;
  }

  function upsertDailyReflection(
    date: string,
    input: DailyReflectionInput,
    status: DailyReflection["status"],
  ) {
    const now = new Date().toISOString();
    const existing = getReflectionByDate(date);

    if (existing) {
      existing.morningContent = input.morningContent;
      existing.afternoon1to3Content = input.afternoon1to3Content;
      existing.afternoonAfter3Content = input.afternoonAfter3Content;
      existing.summaryContent = input.summaryContent;
      existing.status = status;
      existing.updatedAt = now;
    } else {
      dailyReflections.value.push({
        id: generateId(),
        date,
        morningContent: input.morningContent,
        afternoon1to3Content: input.afternoon1to3Content,
        afternoonAfter3Content: input.afternoonAfter3Content,
        summaryContent: input.summaryContent,
        aiManagerAdvice: "",
        aiGeneratedAt: null,
        status,
        createdAt: now,
        updatedAt: now,
      });
    }

    persistDailyReflections();
  }

  function saveDailyReflectionDraft(input: DailyReflectionInput) {
    upsertDailyReflection(reflectionModalDate.value, input, "draft");
    reflectionModalVisible.value = false;
  }

  function submitDailyReflection(input: DailyReflectionInput) {
    const date = reflectionModalDate.value;
    const today = todayString();
    upsertDailyReflection(date, input, "submitted");

    if (reflectionModalMode.value === "prompt") {
      reflectionPromptState.value.lastReflectedDate = today;
      reflectionPromptState.value.snoozedUntil = null;
      persistReflectionPromptState();
    }

    reflectionModalVisible.value = false;
  }

  function deleteDailyReflection(id: string) {
    dailyReflections.value = dailyReflections.value.filter(
      (item) => item.id !== id,
    );
    persistDailyReflections();
  }

  async function generateAiManagerAdvice(date: string): Promise<void> {
    const reflection = getReflectionByDate(date);
    if (!reflection) {
      throw new Error("找不到該日回顧，請先新增或編輯日誌後再試");
    }
    if (aiAdviceLoading.value) return;

    aiAdviceLoading.value = true;
    geminiUsage.value.lastError = null;
    persistGeminiUsage();

    try {
      const dayTasks = tasks.value
        .filter((task) => task.date === date)
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return a.title.localeCompare(b.title, "zh-Hant");
        });
      const advice = await requestAiManagerAdvice(
        reflection,
        aiManagerPrompt.value,
        dayTasks,
        statusItems.value,
      );
      reflection.aiManagerAdvice = advice;
      reflection.aiGeneratedAt = new Date().toISOString();
      reflection.updatedAt = reflection.aiGeneratedAt;
      persistDailyReflections();

      geminiUsage.value.totalSuccessCalls += 1;
      geminiUsage.value.lastCalledAt = reflection.aiGeneratedAt;
      geminiUsage.value.lastError = null;
      persistGeminiUsage();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "產生 AI 主管建議失敗";
      geminiUsage.value.lastError = message;
      persistGeminiUsage();
      throw error;
    } finally {
      aiAdviceLoading.value = false;
    }
  }

  function rescheduleTask(task: Task, newDate: string) {
    if (task.date === newDate) return;
    const delta = daysBetween(task.date, newDate);
    const record: MigrationRecord = {
      fromDate: task.date,
      toDate: newDate,
      migratedAt: new Date().toISOString(),
    };
    task.migrationHistory.push(record);
    task.date = newDate;
    if (task.endDate) {
      task.endDate = addDays(task.endDate, delta);
    }
    touchTask(task);
  }

  function setTaskStatusHours(taskId: string, hours: number | null) {
    updateTask(taskId, { statusHours: hours });
  }

  function findTask(taskId: string): Task | undefined {
    return tasks.value.find((t) => t.id === taskId);
  }

  function touchTask(task: Task) {
    task.updatedAt = new Date().toISOString();
  }

  function createTask(payload: {
    date: string;
    title: string;
    status?: TaskStatus;
    labels?: string[];
    endDate?: string | null;
    avatarId?: string | null;
  }): Task {
    const now = new Date().toISOString();
    const status = payload.status ?? getDefaultStatusId();
    const task: Task = {
      id: generateId(),
      date: payload.date,
      endDate: normalizeEndDate(payload.date, payload.endDate),
      title: payload.title,
      status,
      statusHours: null,
      bodyContent: "",
      bodyContentType: "text",
      completed: isCompletedStatus(status),
      subtasks: [],
      notes: [],
      attachments: [],
      labels: payload.labels ?? [],
      avatarId: payload.avatarId ?? null,
      migrationHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    tasks.value.unshift(task);
    return task;
  }

  function updateTask(id: string, payload: Partial<Omit<Task, "id">>) {
    const task = findTask(id);
    if (!task) return;
    const { date, endDate, ...rest } = payload;
    if (date && date !== task.date) {
      rescheduleTask(task, date);
    }
    Object.assign(task, rest);
    if (endDate !== undefined) {
      task.endDate = normalizeEndDate(task.date, endDate);
    }
    touchTask(task);
  }

  function setTaskDateRange(
    taskId: string,
    startDate: string,
    endDate: string | null,
  ) {
    updateTask(taskId, { date: startDate, endDate });
  }

  function deleteTask(id: string) {
    const task = findTask(id);
    if (!task) return;
    const attachmentIds: string[] = [];
    for (const attachment of task.attachments)
      attachmentIds.push(attachment.id);
    for (const sub of task.subtasks) {
      for (const attachment of sub.attachments)
        attachmentIds.push(attachment.id);
    }
    for (const note of task.notes) {
      for (const attachment of note.attachments)
        attachmentIds.push(attachment.id);
    }
    for (const attachmentId of attachmentIds) {
      deleteAttachment(attachmentId);
    }
    tasks.value = tasks.value.filter((t) => t.id !== id);
  }

  function duplicateTask(taskId: string, targetDate?: string): Task | null {
    const source = findTask(taskId);
    if (!source) return null;
    const copy = cloneTask(source);
    const now = new Date().toISOString();
    const newId = generateId();
    copy.id = newId;
    copy.date = targetDate ?? source.date;
    copy.endDate = source.endDate
      ? targetDate && targetDate !== source.date
        ? addDays(source.endDate, daysBetween(source.date, targetDate))
        : source.endDate
      : null;
    copy.migrationHistory = [];
    copy.completed = false;
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.subtasks = copy.subtasks.map((s) => {
      const subId = generateId();
      return {
        ...s,
        id: subId,
        taskId: newId,
        completed: false,
        createdAt: now,
        updatedAt: now,
        attachments: s.attachments.map((a) => ({
          ...a,
          id: generateId(),
          ownerId: subId,
          ownerType: "subtask" as const,
        })),
      };
    });
    copy.notes = copy.notes.map((n) => {
      const noteId = generateId();
      return {
        ...n,
        id: noteId,
        taskId: newId,
        createdAt: now,
        updatedAt: now,
        attachments: n.attachments.map((a) => ({
          ...a,
          id: generateId(),
          ownerId: noteId,
          ownerType: "note" as const,
        })),
      };
    });
    copy.attachments = copy.attachments.map((a) => ({
      ...a,
      id: generateId(),
      ownerId: newId,
      ownerType: "task" as const,
    }));
    tasks.value.push(copy);
    return copy;
  }

  function moveTask(taskId: string, newDate: string) {
    const task = findTask(taskId);
    if (!task) return;
    rescheduleTask(task, newDate);
  }

  function toggleTask(taskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed) {
      const completedId = getCompletedStatusId();
      if (completedId) task.status = completedId;
    } else if (isCompletedStatus(task.status)) {
      task.status = getDefaultStatusId();
    }
    touchTask(task);
    reorderCompletedToBottom(task.date);
  }

  function completeTaskWithSubtasks(taskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    const now = new Date().toISOString();
    const pending = task.subtasks.filter((s) => !s.completed);
    const done = task.subtasks.filter((s) => s.completed);
    task.subtasks = [
      ...done,
      ...pending.map((s) => ({ ...s, completed: true, updatedAt: now })),
    ];
    task.completed = true;
    task.status = getCompletedStatusId() ?? task.status;
    touchTask(task);
    reorderCompletedToBottom(task.date);
  }

  function createSubTask(taskId: string, title: string): SubTask | null {
    const task = findTask(taskId);
    if (!task) return null;
    const now = new Date().toISOString();
    const sub: SubTask = {
      id: generateId(),
      taskId,
      title,
      note: "",
      noteContentType: "text",
      completed: false,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    task.subtasks = [
      ...task.subtasks.filter((s) => !s.completed),
      sub,
      ...task.subtasks.filter((s) => s.completed),
    ];
    touchTask(task);
    return sub;
  }

  function updateSubTask(
    taskId: string,
    subTaskId: string,
    payload: Partial<
      Pick<SubTask, "title" | "note" | "noteContentType" | "completed">
    >,
  ) {
    const task = findTask(taskId);
    if (!task) return;
    const sub = task.subtasks.find((s) => s.id === subTaskId);
    if (!sub) return;
    Object.assign(sub, payload);
    sub.updatedAt = new Date().toISOString();
    touchTask(task);
  }

  function deleteSubTask(taskId: string, subTaskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    task.subtasks = task.subtasks.filter((s) => s.id !== subTaskId);
    touchTask(task);
  }

  function toggleSubTask(taskId: string, subTaskId: string) {
    const task = findTask(taskId);
    if (!task) return;
    const sub = task.subtasks.find((s) => s.id === subTaskId);
    if (!sub) return;
    const wasCompleted = sub.completed;
    sub.completed = !sub.completed;
    sub.updatedAt = new Date().toISOString();

    if (sub.completed && !wasCompleted) {
      const pending = task.subtasks.filter((s) => !s.completed);
      const done = task.subtasks.filter(
        (s) => s.completed && s.id !== subTaskId,
      );
      task.subtasks = [...pending, ...done, sub];
    } else {
      task.subtasks = sortByCompleted(task.subtasks);
    }

    touchTask(task);
  }

  function createNote(
    taskId: string,
    content: string,
    color: Note["color"] = "purple",
    contentType?: Note["contentType"],
  ): Note | null {
    const task = findTask(taskId);
    if (!task) return null;
    const now = new Date().toISOString();
    const note: Note = {
      id: generateId(),
      taskId,
      content,
      contentType: contentType ?? resolveContentType(content),
      color,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    task.notes.push(note);
    touchTask(task);
    return note;
  }

  function updateNote(
    taskId: string,
    noteId: string,
    payload: Partial<Pick<Note, "content" | "contentType" | "color">>,
  ) {
    const task = findTask(taskId);
    if (!task) return;
    const note = task.notes.find((n) => n.id === noteId);
    if (!note) return;
    Object.assign(note, payload);
    note.updatedAt = new Date().toISOString();
    touchTask(task);
  }

  function deleteNote(taskId: string, noteId: string) {
    const task = findTask(taskId);
    if (!task) return;
    task.notes = task.notes.filter((n) => n.id !== noteId);
    touchTask(task);
  }

  async function addAttachment(
    ownerType: AttachmentOwnerType,
    ownerId: string,
    file: File,
  ) {
    const attachment = await createAttachmentFromFile(ownerType, ownerId, file);

    if (ownerType === "task") {
      const task = findTask(ownerId);
      if (!task) return attachment;
      task.attachments.push(attachment);
      touchTask(task);
    } else if (ownerType === "subtask") {
      for (const task of tasks.value) {
        const sub = task.subtasks.find((s) => s.id === ownerId);
        if (sub) {
          sub.attachments.push(attachment);
          touchTask(task);
          break;
        }
      }
    } else {
      for (const task of tasks.value) {
        const note = task.notes.find((n) => n.id === ownerId);
        if (note) {
          note.attachments.push(attachment);
          touchTask(task);
          break;
        }
      }
    }
    return attachment;
  }

  function findAttachment(
    attachmentId: string,
  ): { attachment: Attachment; task: Task } | null {
    for (const task of tasks.value) {
      const direct = task.attachments.find((a) => a.id === attachmentId);
      if (direct) return { attachment: direct, task };
      for (const sub of task.subtasks) {
        const subAtt = sub.attachments.find((a) => a.id === attachmentId);
        if (subAtt) return { attachment: subAtt, task };
      }
      for (const note of task.notes) {
        const noteAtt = note.attachments.find((a) => a.id === attachmentId);
        if (noteAtt) return { attachment: noteAtt, task };
      }
    }
    return null;
  }

  function shouldRemoveAttachment(
    candidate: Attachment,
    target: Attachment,
    parentTask: Task,
    task: Task,
  ): boolean {
    if (candidate.url !== target.url) return false;
    if (
      candidate.ownerType === target.ownerType &&
      candidate.ownerId === target.ownerId
    ) {
      return true;
    }
    if (
      target.ownerType !== "task" &&
      task.id === parentTask.id &&
      candidate.ownerType === "task" &&
      candidate.ownerId === parentTask.id
    ) {
      return true;
    }
    return false;
  }

  function deleteAttachment(attachmentId: string) {
    const found = findAttachment(attachmentId);
    if (!found) return;
    const { attachment: target, task: parentTask } = found;

    for (const task of tasks.value) {
      let changed = false;
      const filterList = (list: Attachment[]) => {
        const next = list.filter(
          (a) => !shouldRemoveAttachment(a, target, parentTask, task),
        );
        if (next.length !== list.length) changed = true;
        return next;
      };

      task.attachments = filterList(task.attachments);
      for (const sub of task.subtasks) {
        sub.attachments = filterList(sub.attachments);
      }
      for (const note of task.notes) {
        note.attachments = filterList(note.attachments);
      }
      if (changed) touchTask(task);
    }
  }

  function catchUpUnfinishedTasksToToday(today: string = todayString()) {
    const unfinished = tasks.value.filter(
      (t) => !t.completed && getTaskEndDate(t) < today,
    );
    for (const task of unfinished) {
      rescheduleTask(task, today);
    }
  }

  function carryOverUnfinishedTasks(fromDate: string, toDate: string) {
    if (fromDate === toDate) return;

    const unfinished = tasks.value.filter(
      (t) => t.date === fromDate && !t.completed,
    );

    for (const task of unfinished) {
      const alreadyMigrated = task.migrationHistory.some(
        (m) => m.fromDate === fromDate && m.toDate === toDate,
      );
      if (alreadyMigrated) continue;
      rescheduleTask(task, toDate);
    }
  }

  /** 將任務移至該日清單最上方（已完成任務仍維持在底部） */
  function moveTaskToPendingTop(taskId: string) {
    const task = findTask(taskId);
    if (!task || task.completed) return;
    const date = task.date;
    const others = tasks.value.filter((t) => t.date !== date);
    const dayTasks = tasks.value.filter((t) => t.date === date);
    const rest = dayTasks.filter((t) => t.id !== taskId);
    const pending = rest.filter((t) => !t.completed);
    const done = rest.filter((t) => t.completed);
    tasks.value = [...others, task, ...pending, ...done];
  }

  /** 將任務移至該日「未完成任務」的最下方（仍在已完成任務之上） */
  function moveTaskToPendingBottom(taskId: string) {
    const task = findTask(taskId);
    if (!task || task.completed) return;
    const date = task.date;
    const others = tasks.value.filter((t) => t.date !== date);
    const dayTasks = tasks.value.filter((t) => t.date === date);
    const rest = dayTasks.filter((t) => t.id !== taskId);
    const pending = rest.filter((t) => !t.completed);
    const done = rest.filter((t) => t.completed);
    tasks.value = [...others, ...pending, task, ...done];
  }

  function reorderCompletedToBottom(date?: string) {
    if (date) {
      const dayTasks = tasks.value.filter((t) => t.date === date);
      const others = tasks.value.filter((t) => t.date !== date);
      tasks.value = [...others, ...sortByCompleted(dayTasks)];
      return;
    }
    const grouped = new Map<string, Task[]>();
    for (const task of tasks.value) {
      const list = grouped.get(task.date) ?? [];
      list.push(task);
      grouped.set(task.date, list);
    }
    tasks.value = Array.from(grouped.entries()).flatMap(([, list]) =>
      sortByCompleted(list),
    );
  }

  function getTodayProgress(date?: string): TodayProgress {
    return calcProgress(date ?? selectedDate.value);
  }

  function setSelectedDate(date: string) {
    selectedDate.value = date;
  }

  function createLabel(name: string, color: string): Label {
    const label: Label = { id: generateId(), name, color };
    labels.value.push(label);
    return label;
  }

  function updateLabel(
    id: string,
    payload: Partial<Pick<Label, "name" | "color">>,
  ) {
    const label = labels.value.find((l) => l.id === id);
    if (label) Object.assign(label, payload);
  }

  function deleteLabel(id: string) {
    labels.value = labels.value.filter((l) => l.id !== id);
    tasks.value.forEach((t) => {
      t.labels = t.labels.filter((lid) => lid !== id);
    });
  }

  function reorderTasks(date: string, fromId: string, toId: string) {
    const dayTasks = tasks.value.filter((t) => t.date === date);
    const reordered = reorderInGroup(dayTasks, fromId, toId);
    if (!reordered) return;
    const others = tasks.value.filter((t) => t.date !== date);
    tasks.value = [...others, ...reordered];
  }

  function reorderSubTasks(taskId: string, fromId: string, toId: string) {
    const task = findTask(taskId);
    if (!task) return;
    const reordered = reorderInGroup(task.subtasks, fromId, toId);
    if (!reordered) return;
    task.subtasks = reordered;
    touchTask(task);
  }

  function reorderLabels(fromId: string, toId: string) {
    const fromIdx = labels.value.findIndex((l) => l.id === fromId);
    const toIdx = labels.value.findIndex((l) => l.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const updated = [...labels.value];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    labels.value = updated;
  }

  function getDefaultStatusId(): TaskStatus {
    const items = statusItems.value;
    const inProgress = items.find((item) => item.id === DEFAULT_STATUS_ID);
    if (inProgress) return inProgress.id;
    const notCompleted = items.find((item) => !isCompletedStatus(item.id));
    return notCompleted?.id ?? items[0]?.id ?? DEFAULT_STATUS_ID;
  }

  function getCompletedStatusId(): TaskStatus | null {
    return statusItems.value.some((item) => isCompletedStatus(item.id))
      ? COMPLETED_STATUS_ID
      : null;
  }

  function applyTaskStatus(taskId: string, status: TaskStatus) {
    const task = findTask(taskId);
    if (!task) return;
    const item = getStatusItem(status);
    const completed = isCompletedStatus(status);
    updateTask(taskId, { status, completed });
    if (completed) {
      reorderCompletedToBottom(task.date);
      return;
    }
    if (item.sortOnSelect === "top") {
      moveTaskToPendingTop(taskId);
    } else if (item.sortOnSelect === "bottom") {
      moveTaskToPendingBottom(taskId);
    }
  }

  function getStatusItem(id: TaskStatus): StatusItem {
    return (
      statusItems.value.find((item) => item.id === id) ??
      createDefaultStatusItems().find((item) => item.id === id) ??
      createUnknownStatusItem(id)
    );
  }

  function createStatusItem(
    name: string,
    color: string,
    sortOnSelect: StatusSortOnSelect = "none",
  ): StatusItem | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const item: StatusItem = {
      id: generateId(),
      name: trimmed,
      color,
      bgColor: getStatusBgForColor(color),
      sortOnSelect,
    };
    const doneIdx = statusItems.value.findIndex((s) =>
      isCompletedStatus(s.id),
    );
    if (doneIdx >= 0) {
      const updated = [...statusItems.value];
      updated.splice(doneIdx, 0, item);
      statusItems.value = updated;
    } else {
      statusItems.value.push(item);
    }
    return item;
  }

  function updateStatusItem(
    id: TaskStatus,
    payload: Partial<
      Pick<StatusItem, "name" | "color" | "bgColor" | "sortOnSelect">
    >,
  ) {
    const item = statusItems.value.find((s) => s.id === id);
    if (!item) return;
    const next = { ...payload };
    if (next.color && next.bgColor === undefined) {
      next.bgColor = getStatusBgForColor(next.color);
    }
    Object.assign(item, next);
  }

  function deleteStatusItem(id: TaskStatus) {
    if (statusItems.value.length <= 1) return;
    const remaining = statusItems.value.filter((item) => item.id !== id);
    if (remaining.length === statusItems.value.length) return;
    const fallback =
      remaining.find((item) => item.id === DEFAULT_STATUS_ID)?.id ??
      remaining.find((item) => !isCompletedStatus(item.id))?.id ??
      remaining[0].id;
    statusItems.value = remaining;
    for (const task of tasks.value) {
      if (task.status === id) {
        task.status = fallback;
        touchTask(task);
      }
    }
  }

  function reorderStatusItems(fromId: TaskStatus, toId: TaskStatus) {
    const fromIdx = statusItems.value.findIndex((item) => item.id === fromId);
    const toIdx = statusItems.value.findIndex((item) => item.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const updated = [...statusItems.value];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    statusItems.value = updated;
  }

  function getStatusTaskCount(id: TaskStatus): number {
    return tasks.value.filter((task) => task.status === id).length;
  }

  function getAllTasksFiltered(status?: TaskStatus | "all") {
    let list = [...tasks.value];
    if (status && status !== "all") {
      list = list.filter((t) => t.status === status);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  function getTaskStats() {
    const byStatus: Record<string, number> = {};
    for (const task of tasks.value) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    }
    return {
      total: tasks.value.length,
      completed: tasks.value.filter((t) => t.completed).length,
      byStatus,
    };
  }

  const toolboxListsSorted = computed(() =>
    [...toolboxLists.value].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  );

  function findToolboxList(listId: string): ToolboxList | undefined {
    return toolboxLists.value.find((list) => list.id === listId);
  }

  function createToolboxList(title = "", purpose = ""): ToolboxList {
    const now = new Date().toISOString();
    const list: ToolboxList = {
      id: generateId(),
      title: title.trim() || "未命名清單",
      purpose: purpose.trim(),
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    toolboxLists.value.unshift(list);
    return list;
  }

  function updateToolboxList(
    listId: string,
    payload: Partial<Pick<ToolboxList, "title" | "purpose">>,
  ) {
    const list = findToolboxList(listId);
    if (!list) return;
    if (payload.title !== undefined) {
      list.title = payload.title.trim() || "未命名清單";
    }
    if (payload.purpose !== undefined) {
      list.purpose = payload.purpose.trim();
    }
    list.updatedAt = new Date().toISOString();
  }

  function deleteToolboxList(listId: string) {
    toolboxLists.value = toolboxLists.value.filter(
      (list) => list.id !== listId,
    );
  }

  function createToolboxItem(listId: string, content = ""): ToolboxItem | null {
    const list = findToolboxList(listId);
    if (!list) return null;
    const now = new Date().toISOString();
    const trimmed = content.trim();
    const item: ToolboxItem = {
      id: generateId(),
      content: trimmed,
      contentType: resolveContentType(trimmed),
      createdAt: now,
      updatedAt: now,
    };
    list.items.push(item);
    list.updatedAt = now;
    return item;
  }

  function updateToolboxItem(
    listId: string,
    itemId: string,
    payload: Partial<Pick<ToolboxItem, "content" | "contentType">>,
  ) {
    const list = findToolboxList(listId);
    if (!list) return;
    const item = list.items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (payload.content !== undefined) {
      item.content = payload.content.trim();
      item.contentType =
        payload.contentType ?? resolveContentType(item.content);
    } else if (payload.contentType !== undefined) {
      item.contentType = payload.contentType;
    }
    item.updatedAt = new Date().toISOString();
    list.updatedAt = item.updatedAt;
  }

  function deleteToolboxItem(listId: string, itemId: string) {
    const list = findToolboxList(listId);
    if (!list) return;
    list.items = list.items.filter((item) => item.id !== itemId);
    list.updatedAt = new Date().toISOString();
  }

  function reorderToolboxItems(listId: string, fromId: string, toId: string) {
    const list = findToolboxList(listId);
    if (!list || fromId === toId) return;
    const fromIdx = list.items.findIndex((item) => item.id === fromId);
    const toIdx = list.items.findIndex((item) => item.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const updated = [...list.items];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    list.items = updated;
    list.updatedAt = new Date().toISOString();
  }

  function getTaskAvatar(avatarId: string | null | undefined) {
    return findTaskAvatar(taskAvatars.value, avatarId);
  }

  function updateTaskAvatar(
    id: string,
    payload: Partial<Pick<TaskAvatar, "name" | "icon" | "imageUrl">>,
  ) {
    const avatar = taskAvatars.value.find((item) => item.id === id);
    if (!avatar) return;
    if (payload.name !== undefined) {
      avatar.name = payload.name.trim() || avatar.name;
    }
    if (payload.icon !== undefined) {
      avatar.icon = payload.icon;
    }
    if (payload.imageUrl !== undefined) {
      avatar.imageUrl = payload.imageUrl;
    }
  }

  async function setTaskAvatarImage(id: string, file: File) {
    const avatar = taskAvatars.value.find((item) => item.id === id);
    if (!avatar) return;
    avatar.imageUrl = await fileToAvatarDataUrl(file);
  }

  function clearTaskAvatarImage(id: string) {
    updateTaskAvatar(id, { imageUrl: null });
  }

  async function createUploadedTaskAvatar(file: File, name = ""): Promise<TaskAvatar> {
    const imageUrl = await fileToAvatarDataUrl(file);
    const fromName = file.name.replace(/\.[^.]+$/, "").trim();
    const avatar: TaskAvatar = {
      id: generateId(),
      name: name.trim() || fromName || "自訂頭像",
      icon: "star",
      imageUrl,
    };
    taskAvatars.value = [...taskAvatars.value, avatar];
    return avatar;
  }

  function deleteCustomTaskAvatar(id: string) {
    if (isDefaultTaskAvatar(id)) {
      clearTaskAvatarImage(id);
      return;
    }
    taskAvatars.value = taskAvatars.value.filter((item) => item.id !== id);
    for (const task of tasks.value) {
      if (task.avatarId === id) task.avatarId = null;
    }
  }

  function setSidebarCarouselEnabled(enabled: boolean) {
    sidebarCarousel.value = { ...sidebarCarousel.value, enabled };
  }

  function setSidebarCarouselMode(mode: SidebarCarouselMode) {
    sidebarCarousel.value = { ...sidebarCarousel.value, mode };
  }

  function setSidebarCarouselIntervalHours(hours: number) {
    sidebarCarousel.value = {
      ...sidebarCarousel.value,
      intervalHours: clampCarouselIntervalHours(hours),
    };
  }

  async function addSidebarCarouselImages(files: File[]) {
    const remaining =
      SIDEBAR_CAROUSEL_MAX_IMAGES - sidebarCarousel.value.images.length;
    if (remaining <= 0) {
      throw new Error(`最多上傳 ${SIDEBAR_CAROUSEL_MAX_IMAGES} 張圖片`);
    }
    const selected = files.slice(0, remaining);
    const added: SidebarCarouselImage[] = [];
    for (const file of selected) {
      added.push({
        id: generateId(),
        fileName: file.name || `image-${Date.now()}.png`,
        imageUrl: await fileToCarouselDataUrl(file),
        createdAt: new Date().toISOString(),
      });
    }
    const previous = sidebarCarousel.value;
    sidebarCarousel.value = {
      ...previous,
      images: [...previous.images, ...added],
    };
    if (!persistSidebarCarousel()) {
      sidebarCarousel.value = previous;
      throw new Error("儲存空間不足，請刪除部分圖片後再試");
    }
    if (files.length > remaining) {
      throw new Error(`已達上限，僅新增前 ${remaining} 張`);
    }
  }

  function deleteSidebarCarouselImage(id: string) {
    sidebarCarousel.value = {
      ...sidebarCarousel.value,
      images: sidebarCarousel.value.images.filter((item) => item.id !== id),
    };
  }

  function reorderSidebarCarouselImages(fromId: string, toId: string) {
    const fromIdx = sidebarCarousel.value.images.findIndex(
      (item) => item.id === fromId,
    );
    const toIdx = sidebarCarousel.value.images.findIndex(
      (item) => item.id === toId,
    );
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const updated = [...sidebarCarousel.value.images];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    sidebarCarousel.value = { ...sidebarCarousel.value, images: updated };
  }

  function taskDedupeKey(task: Task): string {
    return `${task.date}::${task.title.trim()}`;
  }

  function mergeImportedBackup(source: BackupSource) {
    const summary = {
      labelsAdded: 0,
      labelsSkipped: 0,
      tasksAdded: 0,
      tasksSkipped: 0,
      toolboxListsAdded: 0,
      toolboxListsSkipped: 0,
      toolboxItemsAdded: 0,
      toolboxItemsSkipped: 0,
    };

    const labelIdMap = new Map<string, string>();
    const labelsById = new Map(labels.value.map((label) => [label.id, label]));
    const labelsByName = new Map(
      labels.value.map((label) => [label.name.trim(), label]),
    );

    for (const label of source.labels) {
      const name = label.name.trim();
      if (!name) {
        summary.labelsSkipped += 1;
        continue;
      }
      const existing = labelsById.get(label.id) ?? labelsByName.get(name);
      if (existing) {
        labelIdMap.set(label.id, existing.id);
        summary.labelsSkipped += 1;
        continue;
      }
      const next: Label = { ...label, name };
      labels.value.push(next);
      labelsById.set(next.id, next);
      labelsByName.set(name, next);
      labelIdMap.set(label.id, next.id);
      summary.labelsAdded += 1;
    }

    const taskIds = new Set(tasks.value.map((task) => task.id));
    const taskKeys = new Set(tasks.value.map(taskDedupeKey));
    const addedTasks: Task[] = [];

    for (const incoming of source.tasks.map(normalizeTask)) {
      const key = taskDedupeKey(incoming);
      if (taskIds.has(incoming.id) || taskKeys.has(key)) {
        summary.tasksSkipped += 1;
        continue;
      }
      const mappedLabels = [
        ...new Set(
          incoming.labels
            .map((id) => labelIdMap.get(id) ?? (labelsById.has(id) ? id : ""))
            .filter(Boolean),
        ),
      ];
      addedTasks.push({ ...incoming, labels: mappedLabels });
      taskIds.add(incoming.id);
      taskKeys.add(key);
      summary.tasksAdded += 1;
    }

    if (addedTasks.length) {
      tasks.value = [...addedTasks, ...tasks.value];
    }

    const listsById = new Map(
      toolboxLists.value.map((list) => [list.id, list]),
    );
    const listsByTitle = new Map(
      toolboxLists.value.map((list) => [list.title.trim(), list]),
    );
    const addedLists: ToolboxList[] = [];

    for (const incoming of source.toolboxLists.map(normalizeToolboxList)) {
      const title = incoming.title.trim() || "未命名清單";
      const existing = listsById.get(incoming.id) ?? listsByTitle.get(title);
      if (existing) {
        summary.toolboxListsSkipped += 1;
        const itemIds = new Set(existing.items.map((item) => item.id));
        const itemContents = new Set(
          existing.items.map((item) => item.content.trim()).filter(Boolean),
        );
        let changed = false;
        for (const item of incoming.items) {
          const content = item.content.trim();
          if (itemIds.has(item.id) || (content && itemContents.has(content))) {
            summary.toolboxItemsSkipped += 1;
            continue;
          }
          existing.items.push(normalizeToolboxItem(item));
          itemIds.add(item.id);
          if (content) itemContents.add(content);
          summary.toolboxItemsAdded += 1;
          changed = true;
        }
        if (changed) existing.updatedAt = new Date().toISOString();
        continue;
      }

      const next = { ...incoming, title };
      addedLists.push(next);
      listsById.set(next.id, next);
      listsByTitle.set(title, next);
      summary.toolboxListsAdded += 1;
    }

    if (addedLists.length) {
      toolboxLists.value = [...addedLists, ...toolboxLists.value];
    }

    return summary;
  }

  function clearAllData() {
    tasks.value = [];
    labels.value = [];
    selectedDate.value = todayString();
    expandImages.value = false;
    expandAllTasks.value = true;
    migrationReviewState.value = { ...defaultMigrationReviewState };
    migrationReviewVisible.value = false;
    dailyReflections.value = [];
    reflectionPromptState.value = { ...defaultReflectionPromptState };
    aiManagerPrompt.value = "";
    reflectionModalVisible.value = false;
    statusItems.value = createDefaultStatusItems();
    toolboxLists.value = [];
    navFeatureVisibility.value = { ...defaultNavFeatureVisibility };
    navFeatureOrder.value = [...defaultNavFeatureOrder];
    taskAvatars.value = [...DEFAULT_TASK_AVATARS];
    sidebarCarousel.value = { ...defaultSidebarCarouselState, images: [] };
    persist();
    removeFromStorage("bullet-journal-difficulty-notes");
    persistMigrationReviewState();
    persistDailyReflections();
    persistReflectionPromptState();
    saveToStorage(AI_MANAGER_PROMPT_KEY, aiManagerPrompt.value);
    persistStatusItems();
    persistToolboxLists();
    persistNavFeatures();
    persistNavFeatureOrder();
    persistTaskAvatars();
    persistSidebarCarousel();
  }

  return {
    tasks,
    labels,
    statusItems,
    selectedDate,
    expandImages,
    expandAllTasks,
    migrationReviewVisible,
    migrationCandidates,
    overdueTaskCount,
    dailyReflections,
    dailyReflectionsSorted,
    todayJournalState,
    reflectionModalVisible,
    reflectionModalDate,
    reflectionModalMode,
    geminiUsage,
    aiManagerPrompt,
    aiAdviceLoading,
    toolboxLists,
    toolboxListsSorted,
    navFeatureVisibility,
    navFeatureOrder,
    orderedNavFeatures,
    taskAvatars,
    sidebarCarousel,
    firstEnabledNavPath,
    isNavFeatureEnabled,
    setNavFeatureEnabled,
    reorderNavFeatures,
    init,
    getTasksByDate,
    getTaskDatesWithActivity,
    getMigrationCandidates,
    setTaskStatusHours,
    checkMigrationReview,
    checkDailyPrompts,
    openMigrationReview,
    snoozeMigrationReview,
    applyMigrationReview,
    getReflectionByDate,
    checkReflectionPrompt,
    openTodayReflectionEditor,
    openReflectionEditor,
    openDraftReflectionEditor,
    snoozeReflectionPrompt,
    dismissReflectionModal,
    saveDailyReflectionDraft,
    submitDailyReflection,
    deleteDailyReflection,
    generateAiManagerAdvice,
    setAiManagerPrompt,
    tasksForSelectedDate,
    todayProgress,
    createTask,
    updateTask,
    setTaskDateRange,
    deleteTask,
    duplicateTask,
    moveTask,
    toggleTask,
    completeTaskWithSubtasks,
    createSubTask,
    updateSubTask,
    deleteSubTask,
    toggleSubTask,
    createNote,
    updateNote,
    deleteNote,
    addAttachment,
    deleteAttachment,
    carryOverUnfinishedTasks,
    catchUpUnfinishedTasksToToday,
    reorderCompletedToBottom,
    moveTaskToPendingTop,
    moveTaskToPendingBottom,
    applyTaskStatus,
    getTodayProgress,
    setSelectedDate,
    createLabel,
    updateLabel,
    deleteLabel,
    reorderTasks,
    reorderSubTasks,
    reorderLabels,
    getStatusItem,
    createStatusItem,
    updateStatusItem,
    deleteStatusItem,
    reorderStatusItems,
    getStatusTaskCount,
    getAllTasksFiltered,
    getTaskStats,
    findTask,
    createToolboxList,
    updateToolboxList,
    deleteToolboxList,
    createToolboxItem,
    updateToolboxItem,
    deleteToolboxItem,
    reorderToolboxItems,
    getTaskAvatar,
    updateTaskAvatar,
    setTaskAvatarImage,
    clearTaskAvatarImage,
    createUploadedTaskAvatar,
    deleteCustomTaskAvatar,
    setSidebarCarouselEnabled,
    setSidebarCarouselMode,
    setSidebarCarouselIntervalHours,
    addSidebarCarouselImages,
    deleteSidebarCarouselImage,
    reorderSidebarCarouselImages,
    mergeImportedBackup,
    clearAllData,
  };
});
