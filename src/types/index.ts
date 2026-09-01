/** 任務狀態 id（內建代碼或自訂新增） */
export type TaskStatus = string;

/** 套用此狀態時，將任務移至頂部或未完成區底部（已完成之上） */
export type StatusSortOnSelect = "none" | "top" | "bottom";

export type AttachmentOwnerType = "task" | "subtask" | "note";

/** 輸入區內容格式：text＝純文字；code＝程式碼區塊；markdown＝Markdown 渲染 */
export type ContentFormat = "text" | "code" | "markdown";

export interface Attachment {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  mimeType: string;
  url: string;
  thumbnailUrl: string;
  createdAt: string;
}

export interface Note {
  id: string;
  taskId: string;
  content: string;
  contentType: ContentFormat;
  color: "purple" | "orange" | "green" | "blue" | "gray";
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  note: string;
  noteContentType: ContentFormat;
  completed: boolean;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface MigrationRecord {
  fromDate: string;
  toDate: string;
  migratedAt: string;
}

export type MigrationReviewActionType = "migrate" | "keep" | "complete";

export interface MigrationReviewAction {
  taskId: string;
  action: MigrationReviewActionType;
  targetDate?: string;
}

export interface MigrationCandidate {
  task: Task;
  overdueFrom: string;
  daysOverdue: number;
}

export interface MigrationReviewState {
  snoozedUntil: string | null;
  keptTodayTaskIds: Record<string, string[]>;
  lastReviewedDate: string | null;
}

/** 每日回顧日誌（一天一份） */
export interface DailyReflection {
  id: string;
  date: string;
  morningContent: string;
  afternoon1to3Content: string;
  afternoonAfter3Content: string;
  /** 當日總結 */
  summaryContent: string;
  /** AI 主管建議 */
  aiManagerAdvice: string;
  /** AI 建議產生時間 */
  aiGeneratedAt: string | null;
  /** draft＝暫存（仍可在回顧日誌查看並呼叫 AI）；submitted＝完成提交 */
  status: "draft" | "submitted";
  createdAt: string;
  updatedAt: string;
}

export type TodayJournalState = "new" | "edit" | "done";

export interface DailyReflectionInput {
  morningContent: string;
  afternoon1to3Content: string;
  afternoonAfter3Content: string;
  summaryContent: string;
}

export interface ReflectionPromptState {
  snoozedUntil: string | null;
  lastReflectedDate: string | null;
}

/** Gemini API 本機呼叫用量（非 Google 帳單） */
export interface GeminiUsageState {
  totalSuccessCalls: number;
  lastCalledAt: string | null;
  lastError: string | null;
}

/** 任務頭像（設定頁預設 5 個，可上傳圖片） */
export interface TaskAvatar {
  id: string;
  name: string;
  icon: import("@/plugins/fontawesome").AppIconName;
  /** 上傳的頭像圖；有值時優先於 icon 顯示 */
  imageUrl: string | null;
}

export interface Task {
  id: string;
  /** 開始日期（Start Date）；亦為計畫執行日 */
  date: string;
  /** 結束日期（End Date）；未設定則為單日任務 */
  endDate: string | null;
  title: string;
  /** 任務頭像 id；未選則為 null */
  avatarId: string | null;
  status: TaskStatus;
  /** 此狀態累計／估計時數 */
  statusHours: number | null;
  /** 主任務內容區（唯一，不可新增刪除） */
  bodyContent: string;
  bodyContentType: ContentFormat;
  completed: boolean;
  subtasks: SubTask[];
  notes: Note[];
  attachments: Attachment[];
  labels: string[];
  migrationHistory: MigrationRecord[];
  createdAt: string;
  updatedAt: string;
}

/** 某日頁面上的任務呈現（含已遷移的歷史連結） */
export interface TaskDayView {
  task: Task;
  migratedAway: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

/** 任務狀態下拉選單的標籤項目 */
export interface StatusItem {
  id: TaskStatus;
  name: string;
  color: string;
  bgColor: string;
  sortOnSelect: StatusSortOnSelect;
}

export interface TodayProgress {
  total: number;
  completed: number;
  percentage: number;
}

/** 工具箱／思考清單中的單條項目 */
export interface ToolboxItem {
  id: string;
  content: string;
  contentType: ContentFormat;
  createdAt: string;
  updatedAt: string;
}

export type SidebarCarouselMode = "daily" | "interval";

export interface SidebarCarouselImage {
  id: string;
  fileName: string;
  imageUrl: string;
  createdAt: string;
}

export interface SidebarCarouselState {
  enabled: boolean;
  mode: SidebarCarouselMode;
  /** 間隔輪播時，幾小時換下一張 */
  intervalHours: number;
  images: SidebarCarouselImage[];
  /** 手動選中的顯示圖片；未設定時依輪播規則自動切換 */
  selectedImageId: string | null;
}

/** 工具箱與思考清單（遇到方向決策時可快速對照） */
export interface ToolboxList {
  id: string;
  title: string;
  /** 何時使用／適用方向說明 */
  purpose: string;
  items: ToolboxItem[];
  createdAt: string;
  updatedAt: string;
}

export type TwStockMarket = "twse" | "tpex";

export type DividendFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "none";

export interface FavoriteStock {
  code: string;
  name: string;
  market: TwStockMarket;
  addedAt: string;
  /** 點星號置頂後為 true，星號顯示黃色 */
  pinned: boolean;
}

export interface TwStockQuote {
  code: string;
  name: string;
  market: TwStockMarket;
  price: number | null;
  priceText: string;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  tradeDate: string | null;
}

export interface TwStockExEvent {
  /** 除權息日 YYYY-MM-DD */
  exDate: string;
  /** 現金股利（元／股） */
  cashDividend: number | null;
  /** 無償配股率 */
  stockDividendRatio: number | null;
  /** 息／權／權息 */
  kind: string;
  /** 除權息前收盤價，用來判斷填息 */
  preClose: number | null;
  /** 回填（填息）完成日 */
  fillDate: string | null;
  /** 是否已查過日線以判斷填息 */
  fillChecked: boolean;
}

export interface TwStockDividend {
  code: string;
  /** 現金股利（元／股） */
  cashDividend: number | null;
  cashDividendText: string;
  /** 無償配股率 */
  stockDividendRatio: number | null;
  /** 殖利率（%） */
  yieldPercent: number | null;
  /** 除權息日 YYYY-MM-DD（預告中的下一檔） */
  exDate: string | null;
  /** 最近一次除息日 */
  lastExDate: string | null;
  /** 最近一次現金股利 */
  lastCashDividend: number | null;
  /** 近一年現金股利合計（用來推算殖利率） */
  trailingCash: number | null;
  /** 息／權／權息 */
  exType: string;
  /** 月配／季配／半年配／年配／無配息 */
  frequency: DividendFrequency;
  /** 近一年除權息明細 */
  history: TwStockExEvent[];
}
