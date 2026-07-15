import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { mockLabels, mockTasks } from "@/mock/data";
import type {
  Attachment,
  AttachmentOwnerType,
  DailyReflection,
  DailyReflectionInput,
  DifficultyNoteRecord,
  GeminiUsageState,
  Label,
  MigrationCandidate,
  MigrationRecord,
  MigrationReviewAction,
  MigrationReviewState,
  Note,
  ReflectionPromptState,
  StatusItem,
  SubTask,
  Task,
  TaskDayView,
  TaskStatus,
  TodayJournalState,
  TodayProgress,
} from "@/types";
import { createAttachmentFromFile } from "@/utils/attachment";
import { addDays, daysBetween, todayString } from "@/utils/date";
import {
  generateAiManagerAdvice as requestAiManagerAdvice,
} from "@/utils/gemini";
import { generateId } from "@/utils/id";
import {
  AI_MANAGER_PROMPT_KEY,
  DAILY_REFLECTIONS_KEY,
  DIFFICULTY_NOTES_KEY,
  EXPAND_IMAGES_KEY,
  EXPAND_TASKS_KEY,
  GEMINI_USAGE_KEY,
  LABELS_KEY,
  MIGRATION_REVIEW_KEY,
  REFLECTION_PROMPT_KEY,
  SELECTED_DATE_KEY,
  STATUS_ITEMS_KEY,
  TASKS_KEY,
  defaultGeminiUsageState,
  defaultMigrationReviewState,
  defaultReflectionPromptState,
  hasStorageKey,
  loadFromStorage,
  saveToStorage,
} from "@/utils/storage";
import {
  createDefaultStatusItems,
  getStatusBgForColor,
  normalizeStatusItems,
} from "@/utils/status";

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task;
}

function normalizeSubTask(sub: SubTask): SubTask {
  return { ...sub, note: sub.note ?? "" };
}

function normalizeTask(task: Task & { carriedFromDate?: string }): Task {
  const migrationHistory = task.migrationHistory ?? [];
  if (task.carriedFromDate && !migrationHistory.length) {
    migrationHistory.push({
      fromDate: task.carriedFromDate,
      toDate: task.date,
      migratedAt: task.updatedAt,
    });
  }
  const { carriedFromDate: _, ...rest } = task;
  return {
    ...rest,
    migrationHistory,
    statusHours: task.statusHours ?? null,
    difficultyNote: task.difficultyNote ?? "",
    subtasks: task.subtasks.map(normalizeSubTask),
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
    source.difficultyNote = copy.difficultyNote;
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
  const expandImages = ref(loadFromStorage(EXPAND_IMAGES_KEY, false));
  const expandAllTasks = ref(loadFromStorage(EXPAND_TASKS_KEY, true));
  const migrationReviewState = ref<MigrationReviewState>(
    loadFromStorage(MIGRATION_REVIEW_KEY, defaultMigrationReviewState),
  );
  const migrationReviewVisible = ref(false);
  const difficultyNoteRecords = ref<DifficultyNoteRecord[]>(
    loadFromStorage(DIFFICULTY_NOTES_KEY, [] as DifficultyNoteRecord[]),
  );
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
  const aiManagerPrompt = ref(
    loadFromStorage(AI_MANAGER_PROMPT_KEY, ""),
  );
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

  function persistDifficultyNotes() {
    saveToStorage(DIFFICULTY_NOTES_KEY, difficultyNoteRecords.value);
  }

  function persistStatusItems() {
    saveToStorage(STATUS_ITEMS_KEY, statusItems.value);
  }

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

    // 困難點資料頁為單一資料來源，僅在首次（尚無獨立儲存）時從既有任務匯入一次
    if (!hasStorageKey(DIFFICULTY_NOTES_KEY)) {
      syncDifficultyNotesFromTasks();
    } else {
      // 校正過去因重複 commit 膨脹的使用次數
      reconcileDifficultyNoteUsage();
    }

    checkDailyPrompts();

    initialized.value = true;
    persist();
  }

  watch([tasks, labels, selectedDate, expandImages, expandAllTasks], persist, {
    deep: true,
  });

  watch(statusItems, persistStatusItems, { deep: true });

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
      set.add(task.date);
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
      .filter((t) => !t.completed && t.date < today && !kept.has(t.id))
      .map((task) => ({
        task,
        overdueFrom: task.date,
        daysOverdue: daysBetween(task.date, today),
      }))
      .sort((a, b) => a.overdueFrom.localeCompare(b.overdueFrom));
  }

  const migrationCandidates = computed(() => getMigrationCandidates());

  const overdueTaskCount = computed(() => migrationCandidates.value.length);

  function shouldShowMigrationReview(today: string = todayString()): boolean {
    if (migrationReviewState.value.snoozedUntil === today) return false;
    return getMigrationCandidates(today).length > 0;
  }

  function checkMigrationReview() {
    if (shouldShowMigrationReview()) {
      migrationReviewVisible.value = true;
    }
  }

  /** 優先處理延期任務；完成後再觸發每日回顧 */
  function checkDailyPrompts() {
    if (shouldShowMigrationReview()) {
      reflectionModalVisible.value = false;
      migrationReviewVisible.value = true;
      return;
    }
    checkReflectionPrompt();
  }

  function openMigrationReview() {
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
        case "complete":
          task.completed = true;
          task.status = "done";
          touchTask(task);
          reorderCompletedToBottom(task.date);
          break;
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
    [...dailyReflections.value]
      .filter((item) => item.status === "submitted")
      .sort((a, b) => b.date.localeCompare(a.date)),
  );

  const todayJournalState = computed<TodayJournalState>(() => {
    const reflection = getReflectionByDate(todayString());
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
    if (todayJournalState.value === "done") return;
    openReflectionModal(todayString(), "manual");
  }

  function checkReflectionPrompt() {
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
    if (!reflection || reflection.status !== "submitted") {
      throw new Error("僅能對已完成提交的回顧產生 AI 主管建議");
    }
    if (aiAdviceLoading.value) return;

    aiAdviceLoading.value = true;
    geminiUsage.value.lastError = null;
    persistGeminiUsage();

    try {
      const advice = await requestAiManagerAdvice(
        reflection,
        aiManagerPrompt.value,
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
    const record: MigrationRecord = {
      fromDate: task.date,
      toDate: newDate,
      migratedAt: new Date().toISOString(),
    };
    task.migrationHistory.push(record);
    task.date = newDate;
    touchTask(task);
  }

  function registerDifficultyNote(content: string, options?: { bumpUsage?: boolean }) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const taskCount = getDifficultyNoteTaskCount(trimmed);
    const existing = difficultyNoteRecords.value.find(
      (record) => record.content === trimmed,
    );
    if (existing) {
      // 使用次數以「目前綁定此困難點的任務數」為準
      existing.usageCount = taskCount;
      if (options?.bumpUsage !== false) {
        existing.lastUsedAt = now;
      }
      persistDifficultyNotes();
      return;
    }
    difficultyNoteRecords.value.push({
      id: generateId(),
      content: trimmed,
      usageCount: Math.max(taskCount, 1),
      createdAt: now,
      lastUsedAt: now,
    });
    persistDifficultyNotes();
  }

  function syncDifficultyNotesFromTasks() {
    const contents = new Set<string>();
    for (const task of tasks.value) {
      const trimmed = task.difficultyNote.trim();
      if (trimmed) contents.add(trimmed);
    }
    for (const content of contents) {
      registerDifficultyNote(content, { bumpUsage: false });
    }
    reconcileDifficultyNoteUsage();
  }

  function reconcileDifficultyNoteUsage() {
    for (const record of difficultyNoteRecords.value) {
      record.usageCount = getDifficultyNoteTaskCount(record.content);
    }
    persistDifficultyNotes();
  }

  function deleteDifficultyNote(id: string) {
    difficultyNoteRecords.value = difficultyNoteRecords.value.filter(
      (record) => record.id !== id,
    );
    persistDifficultyNotes();
  }

  const difficultyNoteRecordsSorted = computed(() =>
    [...difficultyNoteRecords.value].sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    }),
  );

  function getDifficultyNoteTaskCount(content: string): number {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return tasks.value.filter((task) => task.difficultyNote.trim() === trimmed)
      .length;
  }

  function getDifficultyNoteOptions(query = ""): string[] {
    const normalizedQuery = query.trim().toLowerCase();
    const sorted = [...difficultyNoteRecords.value].sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    });
    const contents = sorted.map((record) => record.content);
    if (!normalizedQuery) return contents;
    return contents.filter((content) =>
      content.toLowerCase().includes(normalizedQuery),
    );
  }

  const difficultyNoteOptions = computed(() => getDifficultyNoteOptions());

  function setTaskStatusHours(taskId: string, hours: number | null) {
    updateTask(taskId, { statusHours: hours });
  }

  function setTaskDifficultyNote(taskId: string, content: string) {
    const task = findTask(taskId);
    if (!task) return;
    const trimmed = content.trim();
    const previous = task.difficultyNote.trim();
    updateTask(taskId, { difficultyNote: trimmed });

    if (previous && previous !== trimmed) {
      // 同步舊內容的使用次數（可能變 0）
      const prevRecord = difficultyNoteRecords.value.find(
        (record) => record.content === previous,
      );
      if (prevRecord) {
        prevRecord.usageCount = getDifficultyNoteTaskCount(previous);
        persistDifficultyNotes();
      }
    }

    if (trimmed) {
      registerDifficultyNote(trimmed, { bumpUsage: trimmed !== previous });
    }
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
  }): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      date: payload.date,
      title: payload.title,
      status: payload.status ?? "in_progress",
      statusHours: null,
      difficultyNote: "",
      completed: false,
      subtasks: [],
      notes: [],
      attachments: [],
      labels: payload.labels ?? [],
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
    if (payload.date && payload.date !== task.date) {
      rescheduleTask(task, payload.date);
      const { date: _, ...rest } = payload;
      Object.assign(task, rest);
    } else {
      Object.assign(task, payload);
    }
    touchTask(task);
  }

  function deleteTask(id: string) {
    const task = findTask(id)
    if (!task) return
    const attachmentIds: string[] = []
    for (const attachment of task.attachments) attachmentIds.push(attachment.id)
    for (const sub of task.subtasks) {
      for (const attachment of sub.attachments) attachmentIds.push(attachment.id)
    }
    for (const note of task.notes) {
      for (const attachment of note.attachments) attachmentIds.push(attachment.id)
    }
    for (const attachmentId of attachmentIds) {
      deleteAttachment(attachmentId)
    }
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  function duplicateTask(taskId: string, targetDate?: string): Task | null {
    const source = findTask(taskId);
    if (!source) return null;
    const copy = cloneTask(source);
    const now = new Date().toISOString();
    const newId = generateId();
    copy.id = newId;
    copy.date = targetDate ?? source.date;
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
      task.status = "done";
    } else if (task.status === "done") {
      task.status = "in_progress";
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
    task.status = "done";
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
    payload: Partial<Pick<SubTask, "title" | "note" | "completed">>,
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
  ): Note | null {
    const task = findTask(taskId);
    if (!task) return null;
    const now = new Date().toISOString();
    const note: Note = {
      id: generateId(),
      taskId,
      content,
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
    payload: Partial<Pick<Note, "content" | "color">>,
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
      (t) => !t.completed && t.date < today,
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

  function getStatusItem(id: TaskStatus): StatusItem {
    return (
      statusItems.value.find((item) => item.id === id) ??
      createDefaultStatusItems().find((item) => item.id === id)!
    );
  }

  function updateStatusItem(
    id: TaskStatus,
    payload: Partial<Pick<StatusItem, "name" | "color" | "bgColor">>,
  ) {
    const item = statusItems.value.find((s) => s.id === id);
    if (!item) return;
    const next = { ...payload };
    if (next.color && next.bgColor === undefined) {
      next.bgColor = getStatusBgForColor(next.color);
    }
    Object.assign(item, next);
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

  function clearAllData() {
    tasks.value = [];
    labels.value = [];
    selectedDate.value = todayString();
    expandImages.value = false;
    expandAllTasks.value = true;
    migrationReviewState.value = { ...defaultMigrationReviewState };
    migrationReviewVisible.value = false;
    difficultyNoteRecords.value = [];
    dailyReflections.value = [];
    reflectionPromptState.value = { ...defaultReflectionPromptState };
    aiManagerPrompt.value = "";
    reflectionModalVisible.value = false;
    statusItems.value = createDefaultStatusItems();
    persist();
    persistMigrationReviewState();
    persistDifficultyNotes();
    persistDailyReflections();
    persistReflectionPromptState();
    saveToStorage(AI_MANAGER_PROMPT_KEY, aiManagerPrompt.value);
    persistStatusItems();
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
    difficultyNoteRecords,
    difficultyNoteRecordsSorted,
    difficultyNoteOptions,
    dailyReflections,
    dailyReflectionsSorted,
    todayJournalState,
    reflectionModalVisible,
    reflectionModalDate,
    reflectionModalMode,
    geminiUsage,
    aiManagerPrompt,
    aiAdviceLoading,
    init,
    getTasksByDate,
    getTaskDatesWithActivity,
    getMigrationCandidates,
    getDifficultyNoteOptions,
    getDifficultyNoteTaskCount,
    registerDifficultyNote,
    deleteDifficultyNote,
    setTaskStatusHours,
    setTaskDifficultyNote,
    checkMigrationReview,
    checkDailyPrompts,
    openMigrationReview,
    snoozeMigrationReview,
    applyMigrationReview,
    getReflectionByDate,
    checkReflectionPrompt,
    openTodayReflectionEditor,
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
    moveTaskToPendingBottom,
    getTodayProgress,
    setSelectedDate,
    createLabel,
    updateLabel,
    deleteLabel,
    reorderTasks,
    reorderSubTasks,
    reorderLabels,
    getStatusItem,
    updateStatusItem,
    reorderStatusItems,
    getStatusTaskCount,
    getAllTasksFiltered,
    getTaskStats,
    findTask,
    clearAllData,
  };
});
