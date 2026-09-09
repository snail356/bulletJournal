import type {
  Attachment,
  DailyReflection,
  FavoriteStock,
  Label,
  SidebarCarouselImage,
  SidebarCarouselState,
  StatusItem,
  Task,
  TaskAvatar,
  ToolboxList,
} from "@/types";
import {
  idbClearAll,
  idbDeleteBlobs,
  idbGet,
  idbGetAllBlobIds,
  idbGetBlob,
  idbPutBlobs,
  idbSet,
} from "@/utils/idb";
import {
  blobToObjectUrl,
  isDisplayMediaUrl,
  revokeTrackedObjectUrls,
  urlToBlob,
} from "@/utils/mediaUrl";
import { defaultSidebarCarouselState } from "@/utils/sidebarCarousel";

export const IDB_TASKS_KEY = "tasks";
export const IDB_LABELS_KEY = "labels";
export const IDB_STATUS_ITEMS_KEY = "statusItems";
export const IDB_DAILY_REFLECTIONS_KEY = "dailyReflections";
export const IDB_TOOLBOX_LISTS_KEY = "toolboxLists";
export const IDB_TASK_AVATARS_KEY = "taskAvatars";
export const IDB_SIDEBAR_CAROUSEL_KEY = "sidebarCarousel";
export const IDB_STOCK_FAVORITES_KEY = "stockFavorites";
export const IDB_AI_MANAGER_PROMPT_KEY = "aiManagerPrompt";

const ATT_BLOB_PREFIX = "att:";
const AVATAR_BLOB_PREFIX = "avatar:";
const CAROUSEL_BLOB_PREFIX = "carousel:";

function attBlobId(id: string): string {
  return `${ATT_BLOB_PREFIX}${id}`;
}

function avatarBlobId(id: string): string {
  return `${AVATAR_BLOB_PREFIX}${id}`;
}

function carouselBlobId(id: string): string {
  return `${CAROUSEL_BLOB_PREFIX}${id}`;
}

function mapTaskAttachments(
  task: Task,
  map: (attachment: Attachment) => Attachment,
): Task {
  return {
    ...task,
    attachments: task.attachments.map(map),
    subtasks: task.subtasks.map((sub) => ({
      ...sub,
      attachments: sub.attachments.map(map),
    })),
    notes: task.notes.map((note) => ({
      ...note,
      attachments: note.attachments.map(map),
    })),
  };
}

function forEachTaskAttachment(
  tasks: Task[],
  visit: (attachment: Attachment) => void,
): void {
  for (const task of tasks) {
    task.attachments.forEach(visit);
    for (const sub of task.subtasks) sub.attachments.forEach(visit);
    for (const note of task.notes) note.attachments.forEach(visit);
  }
}

function stripAttachmentMedia(attachment: Attachment): Attachment {
  return { ...attachment, url: "", thumbnailUrl: "" };
}

async function collectUrlBlob(
  id: string,
  url: string | null | undefined,
  entries: Array<{ id: string; blob: Blob }>,
  used: Set<string>,
): Promise<void> {
  if (!url || !isDisplayMediaUrl(url)) return;
  used.add(id);
  const blob = await urlToBlob(url);
  if (blob) entries.push({ id, blob });
}

async function pruneUnusedBlobs(
  used: Set<string>,
  prefixes: string[],
): Promise<void> {
  const existing = await idbGetAllBlobIds();
  const stale = existing.filter(
    (id) => prefixes.some((prefix) => id.startsWith(prefix)) && !used.has(id),
  );
  await idbDeleteBlobs(stale);
}

async function hydrateAttachment(attachment: Attachment): Promise<Attachment> {
  const blob = await idbGetBlob(attBlobId(attachment.id));
  if (!blob) return attachment;
  const url = blobToObjectUrl(blob);
  return { ...attachment, url, thumbnailUrl: url };
}

export async function loadTasks(): Promise<Task[] | null> {
  const stored = await idbGet<Task[]>(IDB_TASKS_KEY);
  if (!stored) return null;
  return Promise.all(
    stored.map((task) =>
      Promise.resolve(task).then(async (item) => {
        const attachments = await Promise.all(item.attachments.map(hydrateAttachment));
        const subtasks = await Promise.all(
          item.subtasks.map(async (sub) => ({
            ...sub,
            attachments: await Promise.all(sub.attachments.map(hydrateAttachment)),
          })),
        );
        const notes = await Promise.all(
          item.notes.map(async (note) => ({
            ...note,
            attachments: await Promise.all(note.attachments.map(hydrateAttachment)),
          })),
        );
        return { ...item, attachments, subtasks, notes };
      }),
    ),
  );
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  const entries: Array<{ id: string; blob: Blob }> = [];
  const used = new Set<string>();
  const visits: Promise<void>[] = [];
  forEachTaskAttachment(tasks, (attachment) => {
    visits.push(
      collectUrlBlob(attBlobId(attachment.id), attachment.url, entries, used),
    );
  });
  await Promise.all(visits);
  await idbPutBlobs(entries);
  const stripped = tasks.map((task) => mapTaskAttachments(task, stripAttachmentMedia));
  await idbSet(IDB_TASKS_KEY, stripped);
  await pruneUnusedBlobs(used, [ATT_BLOB_PREFIX]);
}

export async function loadLabels(): Promise<Label[] | null> {
  return (await idbGet<Label[]>(IDB_LABELS_KEY)) ?? null;
}

export async function saveLabels(labels: Label[]): Promise<void> {
  await idbSet(IDB_LABELS_KEY, labels);
}

export async function loadStatusItems(): Promise<StatusItem[] | null> {
  return (await idbGet<StatusItem[]>(IDB_STATUS_ITEMS_KEY)) ?? null;
}

export async function saveStatusItems(items: StatusItem[]): Promise<void> {
  await idbSet(IDB_STATUS_ITEMS_KEY, items);
}

export async function loadDailyReflections(): Promise<DailyReflection[] | null> {
  return (await idbGet<DailyReflection[]>(IDB_DAILY_REFLECTIONS_KEY)) ?? null;
}

export async function saveDailyReflections(
  reflections: DailyReflection[],
): Promise<void> {
  await idbSet(IDB_DAILY_REFLECTIONS_KEY, reflections);
}

export async function loadToolboxLists(): Promise<ToolboxList[] | null> {
  return (await idbGet<ToolboxList[]>(IDB_TOOLBOX_LISTS_KEY)) ?? null;
}

export async function saveToolboxLists(lists: ToolboxList[]): Promise<void> {
  await idbSet(IDB_TOOLBOX_LISTS_KEY, lists);
}

export async function loadTaskAvatars(): Promise<TaskAvatar[] | null> {
  const stored = await idbGet<TaskAvatar[]>(IDB_TASK_AVATARS_KEY);
  if (!stored) return null;
  return Promise.all(
    stored.map(async (avatar) => {
      const blob = await idbGetBlob(avatarBlobId(avatar.id));
      if (!blob) return avatar;
      return { ...avatar, imageUrl: blobToObjectUrl(blob) };
    }),
  );
}

export async function saveTaskAvatars(avatars: TaskAvatar[]): Promise<void> {
  const entries: Array<{ id: string; blob: Blob }> = [];
  const used = new Set<string>();
  await Promise.all(
    avatars.map((avatar) =>
      collectUrlBlob(avatarBlobId(avatar.id), avatar.imageUrl, entries, used),
    ),
  );
  await idbPutBlobs(entries);
  const stripped = avatars.map((avatar) => ({
    ...avatar,
    imageUrl: avatar.imageUrl ? "" : null,
  }));
  await idbSet(IDB_TASK_AVATARS_KEY, stripped);
  await pruneUnusedBlobs(used, [AVATAR_BLOB_PREFIX]);
}

export async function loadSidebarCarousel(): Promise<SidebarCarouselState | null> {
  const stored = await idbGet<SidebarCarouselState>(IDB_SIDEBAR_CAROUSEL_KEY);
  if (!stored) return null;
  const images = await Promise.all(
    (stored.images ?? []).map(async (image) => {
      const blob = await idbGetBlob(carouselBlobId(image.id));
      if (!blob) return image;
      return { ...image, imageUrl: blobToObjectUrl(blob) };
    }),
  );
  return { ...defaultSidebarCarouselState, ...stored, images };
}

export async function saveSidebarCarousel(
  state: SidebarCarouselState,
): Promise<void> {
  const entries: Array<{ id: string; blob: Blob }> = [];
  const used = new Set<string>();
  await Promise.all(
    state.images.map((image: SidebarCarouselImage) =>
      collectUrlBlob(carouselBlobId(image.id), image.imageUrl, entries, used),
    ),
  );
  await idbPutBlobs(entries);
  const stripped: SidebarCarouselState = {
    ...state,
    images: state.images.map((image) => ({ ...image, imageUrl: "" })),
  };
  await idbSet(IDB_SIDEBAR_CAROUSEL_KEY, stripped);
  await pruneUnusedBlobs(used, [CAROUSEL_BLOB_PREFIX]);
}

export async function loadStockFavorites(): Promise<FavoriteStock[] | null> {
  return (await idbGet<FavoriteStock[]>(IDB_STOCK_FAVORITES_KEY)) ?? null;
}

export async function saveStockFavorites(
  favorites: FavoriteStock[],
): Promise<void> {
  await idbSet(IDB_STOCK_FAVORITES_KEY, favorites);
}

export async function loadAiManagerPrompt(): Promise<string | null> {
  const value = await idbGet<string>(IDB_AI_MANAGER_PROMPT_KEY);
  return typeof value === "string" ? value : null;
}

export async function saveAiManagerPrompt(prompt: string): Promise<void> {
  await idbSet(IDB_AI_MANAGER_PROMPT_KEY, prompt);
}

export async function clearAppData(): Promise<void> {
  revokeTrackedObjectUrls();
  await idbClearAll();
}

export function createDebouncedSaver(
  save: () => Promise<void>,
  delayMs = 150,
): {
  enable: () => void;
  schedule: () => void;
  flush: () => Promise<void>;
} {
  let enabled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queued = false;
  let runPromise: Promise<void> | null = null;

  async function run(): Promise<void> {
    queued = true;
    if (runPromise) {
      await runPromise;
      if (queued && enabled) await run();
      return;
    }
    runPromise = (async () => {
      while (queued) {
        queued = false;
        await save();
      }
    })();
    try {
      await runPromise;
    } finally {
      runPromise = null;
    }
  }

  return {
    enable() {
      enabled = true;
    },
    schedule() {
      if (!enabled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    async flush() {
      if (!enabled) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
        await run();
        return;
      }
      if (runPromise || queued) {
        await run();
      }
    },
  };
}
