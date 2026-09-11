import JSZip from "jszip";
import type {
  Attachment,
  AttachmentOwnerType,
  ContentFormat,
  DailyReflection,
  FavoriteStock,
  Label,
  Note,
  SidebarCarouselState,
  StatusItem,
  SubTask,
  Task,
  TaskAvatar,
  ToolboxList,
} from "@/types";
import { writeBlobToDirectory } from "@/utils/backupDirectory";
import type { NavFeatureId, NavFeatureVisibility } from "@/utils/navFeatures";
import { getBuiltinStatusName, STATUS_SORT_BACKUP_LABELS } from "@/utils/status";

export const BACKUP_JSON_FILE = "data.json";
export const BACKUP_FORMAT = "bullet-journal-md-webp";
export const BACKUP_VERSION = 2;

export interface BackupSource {
  tasks: Task[];
  labels: Label[];
  statusItems: StatusItem[];
  toolboxLists: ToolboxList[];
  dailyReflections?: DailyReflection[];
  taskAvatars?: TaskAvatar[];
  sidebarCarousel?: SidebarCarouselState;
  stockFavorites?: FavoriteStock[];
  aiManagerPrompt?: string;
  navFeatureVisibility?: NavFeatureVisibility;
  navFeatureOrder?: NavFeatureId[];
}

export interface BackupFileAttachment {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  mimeType: string;
  file: string;
  createdAt: string;
}

export interface BackupFileTask extends Omit<
  Task,
  "attachments" | "subtasks" | "notes"
> {
  attachments: BackupFileAttachment[];
  subtasks: Array<
    Omit<SubTask, "attachments"> & { attachments: BackupFileAttachment[] }
  >;
  notes: Array<
    Omit<Note, "attachments"> & { attachments: BackupFileAttachment[] }
  >;
}

export interface BackupFileTaskAvatar {
  id: string;
  name: string;
  icon: TaskAvatar["icon"];
  imageFile: string | null;
}

export interface BackupFileCarouselImage {
  id: string;
  fileName: string;
  imageFile: string;
  createdAt: string;
}

export interface BackupFileCarousel {
  enabled: boolean;
  mode: SidebarCarouselState["mode"];
  intervalHours: number;
  selectedImageId: string | null;
  images: BackupFileCarouselImage[];
}

export interface BackupPayload {
  version: number;
  format: string;
  exportedAt: string;
  labels: Label[];
  statusItems: StatusItem[];
  toolboxLists: ToolboxList[];
  tasks: BackupFileTask[];
  dailyReflections: DailyReflection[];
  taskAvatars: BackupFileTaskAvatar[];
  sidebarCarousel: BackupFileCarousel;
  stockFavorites: FavoriteStock[];
  aiManagerPrompt: string;
  navFeatureVisibility?: NavFeatureVisibility;
  navFeatureOrder?: NavFeatureId[];
}

export interface BackupResult {
  fileName: string;
  savedToFolder: boolean;
  taskCount: number;
  labelCount: number;
  statusCount: number;
  toolboxCount: number;
  reflectionCount: number;
  photoCount: number;
}

export interface DownloadBackupOptions {
  directoryHandle?: FileSystemDirectoryHandle | null;
}

const NOTE_COLOR_LABEL: Record<Note["color"], string> = {
  yellow: "黃",
  red: "紅",
  purple: "紫",
  orange: "橙",
  green: "綠",
  blue: "藍",
  gray: "灰",
};

interface PhotoFile {
  zipPath: string;
  blob: Blob;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function backupStamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-TW");
}

function sanitizeFileName(name: string, fallback = "untitled"): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function createUniqueName(): (base: string, ext: string) => string {
  const used = new Set<string>();
  return (base: string, ext: string) => {
    let name = `${base}${ext}`;
    let i = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base}-${i}${ext}`;
      i += 1;
    }
    used.add(name.toLowerCase());
    return name;
  };
}

function mdLink(label: string, path: string): string {
  return `[${label.replace(/[[\]]/g, "")}](<${path}>)`;
}

function mdImage(alt: string, path: string): string {
  return `![${alt.replace(/[[\]]/g, "")}](<${path}>)`;
}

function renderBody(content: string, type: ContentFormat): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (type === "code") return `\`\`\`\n${trimmed}\n\`\`\``;
  return trimmed;
}

function joinSections(parts: Array<string | false | null | undefined>): string {
  return (
    parts
      .filter((part): part is string => Boolean(part && part.trim()))
      .join("\n\n")
      .trim() + "\n"
  );
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

function collectTaskAttachments(task: Task): Attachment[] {
  return [
    ...task.attachments,
    ...task.subtasks.flatMap((sub) => sub.attachments),
    ...task.notes.flatMap((note) => note.attachments),
  ];
}

function extensionForMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("svg")) return ".svg";
  if (mime.includes("webp")) return ".webp";
  return ".bin";
}

function decodeBase64DataUrl(
  dataUrl: string,
): { mime: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mime: match[1], bytes };
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("無法載入圖片"));
    img.src = src;
  });
}

function canvasToWebp(img: HTMLImageElement, quality = 0.85): Promise<Blob> {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    return Promise.reject(new Error("圖片尺寸無效"));
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("無法建立畫布"));
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("無法轉成 WebP"))),
      "image/webp",
      quality,
    );
  });
}

async function convertDataUrlToPhoto(
  id: string,
  dataUrl: string,
): Promise<PhotoFile | null> {
  if (!dataUrl) return null;

  const decoded = decodeBase64DataUrl(dataUrl);
  if (decoded?.mime === "image/webp") {
    return {
      zipPath: `photos/${id}.webp`,
      blob: bytesToBlob(decoded.bytes, "image/webp"),
    };
  }

  try {
    const img = await loadImage(dataUrl);
    const blob = await canvasToWebp(img);
    return {
      zipPath: `photos/${id}.webp`,
      blob,
    };
  } catch {
    if (!decoded) return null;
    const ext = extensionForMime(decoded.mime);
    return {
      zipPath: `photos/${id}${ext}`,
      blob: bytesToBlob(decoded.bytes, decoded.mime),
    };
  }
}

async function convertAttachmentToPhoto(
  attachment: Attachment,
): Promise<PhotoFile | null> {
  if (!attachment.url) return null;
  return convertDataUrlToPhoto(attachment.id, attachment.url);
}

async function collectPhotoFromDataUrl(
  id: string,
  dataUrl: string | null | undefined,
  photos: Map<string, string>,
  photoFiles: PhotoFile[],
): Promise<string | null> {
  if (!dataUrl) return null;
  const existing = photos.get(id);
  if (existing) return existing;
  const photo = await convertDataUrlToPhoto(id, dataUrl);
  if (!photo) return null;
  photos.set(id, photo.zipPath);
  photoFiles.push(photo);
  return photo.zipPath;
}

function photoMarkdown(
  attachments: Attachment[],
  photos: Map<string, string>,
  prefix: string,
): string {
  const lines = attachments
    .map((att) => {
      const path = photos.get(att.id);
      if (!path) return "";
      return mdImage(att.fileName || "照片", `${prefix}${path}`);
    })
    .filter(Boolean);
  return lines.join("\n\n");
}

function renderSubTask(sub: SubTask, photos: Map<string, string>): string {
  const check = sub.completed ? "x" : " ";
  const lines = [`- [${check}] ${sub.title.trim() || "未命名子任務"}`];
  const note = renderBody(sub.note, sub.noteContentType);
  if (note) {
    lines.push("");
    for (const line of note.split("\n")) {
      lines.push(`  ${line}`);
    }
  }
  const images = photoMarkdown(sub.attachments, photos, "../");
  if (images) {
    lines.push("");
    for (const line of images.split("\n")) {
      lines.push(line ? `  ${line}` : "");
    }
  }
  return lines.join("\n");
}

function buildTaskMarkdown(
  task: Task,
  labelsById: Map<string, Label>,
  statusItems: StatusItem[],
  photos: Map<string, string>,
): string {
  const statusName =
    statusItems.find((item) => item.id === task.status)?.name ??
    getBuiltinStatusName(task.status) ??
    task.status;
  const labelNames = task.labels
    .map((id) => labelsById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  const hours =
    task.statusHours === null || task.statusHours === undefined
      ? "—"
      : String(task.statusHours);

  const meta = [
    `| 欄位 | 內容 |`,
    `| --- | --- |`,
    `| 開始日期 | ${escapeTableCell(task.date)} |`,
    `| 結束日期 | ${escapeTableCell(task.endDate ?? "—")} |`,
    `| 日期 | ${escapeTableCell(task.date)} |`,
    `| 狀態 | ${escapeTableCell(statusName)} |`,
    `| 完成 | ${task.completed ? "是" : "否"} |`,
    `| 狀態時數 | ${escapeTableCell(hours)} |`,
    `| 標籤 | ${escapeTableCell(labelNames.join("、") || "—")} |`,
    `| 頭像 | ${escapeTableCell(task.avatarId ?? "—")} |`,
    `| 建立時間 | ${escapeTableCell(formatDateTime(task.createdAt))} |`,
    `| 更新時間 | ${escapeTableCell(formatDateTime(task.updatedAt))} |`,
  ].join("\n");

  const body = renderBody(task.bodyContent, task.bodyContentType);
  const taskPhotos = photoMarkdown(task.attachments, photos, "../");
  const subtasks = task.subtasks
    .map((sub) => renderSubTask(sub, photos))
    .join("\n\n");
  const notes = task.notes
    .map((note, index) => {
      const color = NOTE_COLOR_LABEL[note.color] ?? note.color;
      const content = renderBody(note.content, note.contentType);
      const images = photoMarkdown(note.attachments, photos, "../");
      return joinSections([
        `### 備註 ${index + 1}（${color}）`,
        content || "_（無內容）_",
        images,
      ]);
    })
    .join("\n");
  const migrations = task.migrationHistory
    .map(
      (record) =>
        `- \`${record.fromDate}\` → \`${record.toDate}\`（${formatDateTime(record.migratedAt)}）`,
    )
    .join("\n");

  return joinSections([
    `# ${task.title.trim() || "未命名任務"}`,
    meta,
    body ? `## 內容\n\n${body}` : "",
    taskPhotos ? `## 照片\n\n${taskPhotos}` : "",
    subtasks ? `## 子任務\n\n${subtasks}` : "",
    notes ? `## 備註\n\n${notes}` : "",
    migrations ? `## 遷移紀錄\n\n${migrations}` : "",
  ]);
}

function buildLabelsMarkdown(
  labels: Label[],
  statusItems: StatusItem[],
): string {
  const labelRows = labels.length
    ? [
        "| 名稱 | 顏色 |",
        "| --- | --- |",
        ...labels.map(
          (label) => `| ${escapeTableCell(label.name)} | ${label.color} |`,
        ),
      ].join("\n")
    : "_尚無任務標籤_";

  const statusRows = statusItems.length
    ? [
        "| 名稱 | 代碼 | 顏色 | 套用時排序 |",
        "| --- | --- | --- | --- |",
        ...statusItems.map(
          (item) =>
            `| ${escapeTableCell(item.name)} | \`${item.id}\` | ${item.color} | ${STATUS_SORT_BACKUP_LABELS[item.sortOnSelect] ?? STATUS_SORT_BACKUP_LABELS.none} |`,
        ),
      ].join("\n")
    : "_尚無狀態標籤_";

  return joinSections([
    "# 標籤",
    "## 任務標籤",
    labelRows,
    "## 狀態標籤",
    statusRows,
  ]);
}

function buildToolboxMarkdown(list: ToolboxList): string {
  const purpose = list.purpose.trim();
  const items = list.items
    .map((item, index) => {
      const body = renderBody(item.content, item.contentType);
      return joinSections([`### ${index + 1}`, body || "_（無內容）_"]);
    })
    .join("\n");

  return joinSections([
    `# ${list.title.trim() || "未命名清單"}`,
    [
      `| 欄位 | 內容 |`,
      `| --- | --- |`,
      `| 建立時間 | ${escapeTableCell(formatDateTime(list.createdAt))} |`,
      `| 更新時間 | ${escapeTableCell(formatDateTime(list.updatedAt))} |`,
    ].join("\n"),
    purpose ? `## 何時使用\n\n${purpose}` : "",
    items ? `## 思考點\n\n${items}` : "## 思考點\n\n_尚無思考點_",
  ]);
}

function buildReflectionMarkdown(item: DailyReflection): string {
  return joinSections([
    `# ${item.date} 回顧`,
    [
      `| 欄位 | 內容 |`,
      `| --- | --- |`,
      `| 狀態 | ${item.status === "draft" ? "暫存" : "已提交"} |`,
      `| 建立時間 | ${escapeTableCell(formatDateTime(item.createdAt))} |`,
      `| 更新時間 | ${escapeTableCell(formatDateTime(item.updatedAt))} |`,
      `| AI 建議時間 | ${item.aiGeneratedAt ? escapeTableCell(formatDateTime(item.aiGeneratedAt)) : "—"} |`,
    ].join("\n"),
    item.morningContent.trim()
      ? `## 上午\n\n${item.morningContent.trim()}`
      : "",
    item.afternoon1to3Content.trim()
      ? `## 下午 13–15\n\n${item.afternoon1to3Content.trim()}`
      : "",
    item.afternoonAfter3Content.trim()
      ? `## 下午 15 之後\n\n${item.afternoonAfter3Content.trim()}`
      : "",
    item.summaryContent.trim()
      ? `## 當日總結\n\n${item.summaryContent.trim()}`
      : "",
    item.aiManagerAdvice.trim()
      ? `## AI 主管建議\n\n${item.aiManagerAdvice.trim()}`
      : "",
  ]);
}

function buildExtrasMarkdown(params: {
  taskAvatars: TaskAvatar[];
  avatarPhotos: Map<string, string>;
  carousel: SidebarCarouselState;
  carouselPhotos: Map<string, string>;
  stockFavorites: FavoriteStock[];
  aiManagerPrompt: string;
}): string {
  const avatarRows = params.taskAvatars.length
    ? [
        "| 名稱 | 圖示 | 圖片 |",
        "| --- | --- | --- |",
        ...params.taskAvatars.map((avatar) => {
          const path = params.avatarPhotos.get(avatar.id);
          const image = path ? mdImage(avatar.name || "頭像", path) : "—";
          return `| ${escapeTableCell(avatar.name)} | ${escapeTableCell(avatar.icon)} | ${image} |`;
        }),
      ].join("\n")
    : "_尚無任務頭像_";

  const carouselImages = params.carousel.images
    .map((image) => {
      const path = params.carouselPhotos.get(image.id);
      if (!path) return "";
      return `### ${escapeTableCell(image.fileName)}\n\n${mdImage(image.fileName, path)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const stockRows = params.stockFavorites.length
    ? [
        "| 代碼 | 名稱 | 市場 | 置頂 |",
        "| --- | --- | --- | --- |",
        ...params.stockFavorites.map(
          (stock) =>
            `| ${escapeTableCell(stock.code)} | ${escapeTableCell(stock.name)} | ${stock.market === "tpex" ? "櫃買" : "上市"} | ${stock.pinned ? "是" : "否"} |`,
        ),
      ].join("\n")
    : "_尚無自選股_";

  return joinSections([
    "# 其他資料",
    "## 任務頭像",
    avatarRows,
    "## 側邊圖片輪播",
    [
      `| 欄位 | 內容 |`,
      `| --- | --- |`,
      `| 啟用 | ${params.carousel.enabled ? "是" : "否"} |`,
      `| 模式 | ${params.carousel.mode === "interval" ? "間隔輪播" : "每日切換"} |`,
      `| 間隔時數 | ${params.carousel.intervalHours} |`,
    ].join("\n"),
    carouselImages || "_尚無側邊圖片_",
    "## 小股力自選",
    stockRows,
    params.aiManagerPrompt.trim()
      ? `## AI 主管 Prompt\n\n${params.aiManagerPrompt.trim()}`
      : "",
  ]);
}

function buildReadme(params: {
  exportedAt: string;
  taskCount: number;
  labelCount: number;
  statusCount: number;
  toolboxCount: number;
  reflectionCount: number;
  avatarCount: number;
  carouselCount: number;
  stockCount: number;
  photoCount: number;
  taskEntries: Array<{ date: string; title: string; path: string }>;
  toolboxEntries: Array<{ title: string; path: string }>;
}): string {
  const tasksByDate = new Map<string, Array<{ title: string; path: string }>>();
  for (const entry of params.taskEntries) {
    const list = tasksByDate.get(entry.date) ?? [];
    list.push(entry);
    tasksByDate.set(entry.date, list);
  }
  const dates = [...tasksByDate.keys()].sort((a, b) => b.localeCompare(a));
  const taskToc = dates.length
    ? dates
        .map((date) => {
          const links = (tasksByDate.get(date) ?? [])
            .map((item) => `- ${mdLink(item.title, item.path)}`)
            .join("\n");
          return `### ${date}\n\n${links}`;
        })
        .join("\n\n")
    : "_尚無任務_";

  const toolboxToc = params.toolboxEntries.length
    ? params.toolboxEntries
        .map((item) => `- ${mdLink(item.title, item.path)}`)
        .join("\n")
    : "_尚無清單_";

  return joinSections([
    "# Bullet Journal 備份",
    "此備份以 Markdown 撰寫，照片另存為 WebP（若轉換失敗則保留原格式）並放在 `photos/`。請用設定頁「匯入備份」還原；已存在的任務、標籤、狀態標籤、清單、回顧日誌、頭像、側邊圖片與自選股會跳過、不會重複新增。",
    [
      `| 項目 | 數量 |`,
      `| --- | --- |`,
      `| 匯出時間 | ${params.exportedAt} |`,
      `| 任務 | ${params.taskCount} |`,
      `| 任務標籤 | ${params.labelCount} |`,
      `| 狀態標籤 | ${params.statusCount} |`,
      `| 工具箱與思考清單 | ${params.toolboxCount} |`,
      `| 回顧日誌 | ${params.reflectionCount} |`,
      `| 任務頭像 | ${params.avatarCount} |`,
      `| 側邊圖片 | ${params.carouselCount} |`,
      `| 自選股 | ${params.stockCount} |`,
      `| 照片 | ${params.photoCount} |`,
    ].join("\n"),
    "## 檔案",
    [
      `- ${mdLink("標籤", "標籤.md")}`,
      `- ${mdLink("其他資料", "其他資料.md")}`,
      `- ${mdLink("還原用資料 data.json", BACKUP_JSON_FILE)}`,
      `- 任務/`,
      `- 工具箱與思考清單/`,
      `- 回顧日誌/`,
      `- photos/`,
    ].join("\n"),
    "## 任務目錄",
    taskToc,
    "## 工具箱與思考清單目錄",
    toolboxToc,
  ]);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function serializeAttachment(
  attachment: Attachment,
  photos: Map<string, string>,
): BackupFileAttachment {
  const file = photos.get(attachment.id) ?? "";
  return {
    id: attachment.id,
    ownerType: attachment.ownerType,
    ownerId: attachment.ownerId,
    fileName: attachment.fileName,
    mimeType: file.endsWith(".webp") ? "image/webp" : attachment.mimeType,
    file,
    createdAt: attachment.createdAt,
  };
}

function buildBackupPayload(
  source: BackupSource,
  photos: Map<string, string>,
  exportedAt: Date,
  avatarPhotos: Map<string, string>,
  carouselPhotos: Map<string, string>,
): BackupPayload {
  const carousel = source.sidebarCarousel ?? {
    enabled: false,
    mode: "daily" as const,
    intervalHours: 6,
    images: [],
    selectedImageId: null,
  };
  return {
    version: BACKUP_VERSION,
    format: BACKUP_FORMAT,
    exportedAt: exportedAt.toISOString(),
    labels: source.labels,
    statusItems: source.statusItems,
    toolboxLists: source.toolboxLists,
    tasks: source.tasks.map((task) => ({
      ...task,
      attachments: task.attachments.map((item) =>
        serializeAttachment(item, photos),
      ),
      subtasks: task.subtasks.map((sub) => ({
        ...sub,
        attachments: sub.attachments.map((item) =>
          serializeAttachment(item, photos),
        ),
      })),
      notes: task.notes.map((note) => ({
        ...note,
        attachments: note.attachments.map((item) =>
          serializeAttachment(item, photos),
        ),
      })),
    })),
    dailyReflections: source.dailyReflections ?? [],
    taskAvatars: (source.taskAvatars ?? []).map((avatar) => ({
      id: avatar.id,
      name: avatar.name,
      icon: avatar.icon,
      imageFile: avatarPhotos.get(avatar.id) ?? null,
    })),
    sidebarCarousel: {
      enabled: carousel.enabled,
      mode: carousel.mode,
      intervalHours: carousel.intervalHours,
      selectedImageId: carousel.selectedImageId,
      images: carousel.images.map((image) => ({
        id: image.id,
        fileName: image.fileName,
        imageFile: carouselPhotos.get(image.id) ?? "",
        createdAt: image.createdAt,
      })),
    },
    stockFavorites: source.stockFavorites ?? [],
    aiManagerPrompt: source.aiManagerPrompt ?? "",
    navFeatureVisibility: source.navFeatureVisibility,
    navFeatureOrder: source.navFeatureOrder,
  };
}

export async function downloadBackupZip(
  source: BackupSource,
  options?: DownloadBackupOptions,
): Promise<BackupResult> {
  const exportedAt = new Date();
  const labelsById = new Map(source.labels.map((label) => [label.id, label]));
  const uniqueTaskName = createUniqueName();
  const uniqueToolboxName = createUniqueName();
  const uniqueReflectionName = createUniqueName();
  const reflections = source.dailyReflections ?? [];
  const taskAvatars = source.taskAvatars ?? [];
  const carousel = source.sidebarCarousel ?? {
    enabled: false,
    mode: "daily" as const,
    intervalHours: 6,
    images: [],
    selectedImageId: null,
  };
  const stockFavorites = source.stockFavorites ?? [];

  const attachments = source.tasks.flatMap(collectTaskAttachments);
  const photos = new Map<string, string>();
  const photoFiles: PhotoFile[] = [];

  for (const attachment of attachments) {
    if (photos.has(attachment.id)) continue;
    const photo = await convertAttachmentToPhoto(attachment);
    if (!photo) continue;
    photos.set(attachment.id, photo.zipPath);
    photoFiles.push(photo);
  }

  const avatarPhotos = new Map<string, string>();
  for (const avatar of taskAvatars) {
    const path = await collectPhotoFromDataUrl(
      `task-avatar-${avatar.id}`,
      avatar.imageUrl,
      photos,
      photoFiles,
    );
    if (path) avatarPhotos.set(avatar.id, path);
  }

  const carouselPhotos = new Map<string, string>();
  for (const image of carousel.images) {
    const path = await collectPhotoFromDataUrl(
      `sidebar-${image.id}`,
      image.imageUrl,
      photos,
      photoFiles,
    );
    if (path) carouselPhotos.set(image.id, path);
  }

  const sortedTasks = [...source.tasks].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const taskEntries: Array<{ date: string; title: string; path: string }> = [];
  const zip = new JSZip();

  for (const task of sortedTasks) {
    const title = task.title.trim() || "未命名任務";
    const fileName = uniqueTaskName(
      sanitizeFileName(`${task.date}-${title}`, `${task.date}-task`),
      ".md",
    );
    const path = `任務/${fileName}`;
    zip.file(
      path,
      buildTaskMarkdown(task, labelsById, source.statusItems, photos),
    );
    taskEntries.push({ date: task.date, title, path });
  }

  const sortedLists = [...source.toolboxLists].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const toolboxEntries: Array<{ title: string; path: string }> = [];

  for (const list of sortedLists) {
    const title = list.title.trim() || "未命名清單";
    const fileName = uniqueToolboxName(sanitizeFileName(title, "list"), ".md");
    const path = `工具箱與思考清單/${fileName}`;
    zip.file(path, buildToolboxMarkdown(list));
    toolboxEntries.push({ title, path });
  }

  for (const reflection of [...reflections].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const fileName = uniqueReflectionName(
      sanitizeFileName(reflection.date, "reflection"),
      ".md",
    );
    zip.file(`回顧日誌/${fileName}`, buildReflectionMarkdown(reflection));
  }

  zip.file("標籤.md", buildLabelsMarkdown(source.labels, source.statusItems));
  zip.file(
    "其他資料.md",
    buildExtrasMarkdown({
      taskAvatars,
      avatarPhotos,
      carousel,
      carouselPhotos,
      stockFavorites,
      aiManagerPrompt: source.aiManagerPrompt ?? "",
    }),
  );
  zip.file(
    BACKUP_JSON_FILE,
    JSON.stringify(
      buildBackupPayload(
        source,
        photos,
        exportedAt,
        avatarPhotos,
        carouselPhotos,
      ),
      null,
      2,
    ),
  );
  zip.file(
    "README.md",
    buildReadme({
      exportedAt: formatDateTime(exportedAt.toISOString()),
      taskCount: source.tasks.length,
      labelCount: source.labels.length,
      statusCount: source.statusItems.length,
      toolboxCount: source.toolboxLists.length,
      reflectionCount: reflections.length,
      avatarCount: taskAvatars.length,
      carouselCount: carousel.images.length,
      stockCount: stockFavorites.length,
      photoCount: photoFiles.length,
      taskEntries,
      toolboxEntries,
    }),
  );

  for (const photo of photoFiles) {
    zip.file(photo.zipPath, photo.blob);
  }

  const fileName = `bullet-journal-backup-${backupStamp(exportedAt)}.zip`;
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  let savedToFolder = false;
  if (options?.directoryHandle) {
    try {
      await writeBlobToDirectory(options.directoryHandle, fileName, blob);
      savedToFolder = true;
    } catch {
      triggerDownload(blob, fileName);
    }
  } else {
    triggerDownload(blob, fileName);
  }

  return {
    fileName,
    savedToFolder,
    taskCount: source.tasks.length,
    labelCount: source.labels.length,
    statusCount: source.statusItems.length,
    toolboxCount: source.toolboxLists.length,
    reflectionCount: reflections.length,
    photoCount: photoFiles.length,
  };
}
