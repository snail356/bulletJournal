import { formatDate } from "@/utils/date";
import {
  BACKUP_PREFS_KEY,
  loadFromStorage,
  saveToStorage,
} from "@/utils/storage";

export type BackupFrequency = "weekly" | "monthly";

export interface BackupPrefs {
  autoEnabled: boolean;
  frequency: BackupFrequency;
  /** 0 = 星期日 … 6 = 星期六（與 Date#getDay 相同） */
  weeklyDay: number;
  /** 每月幾號（1–31；該月沒有此日時改用該月最後一天） */
  monthlyDate: number;
  lastDownloadedAt: string | null;
  folderName: string | null;
}

export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" },
  { value: 0, label: "星期日" },
];

export const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

export function defaultBackupPrefs(): BackupPrefs {
  return {
    autoEnabled: false,
    frequency: "weekly",
    weeklyDay: 0,
    monthlyDate: 1,
    lastDownloadedAt: null,
    folderName: null,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) && !Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

export function normalizeBackupPrefs(raw: unknown): BackupPrefs {
  const defaults = defaultBackupPrefs();
  const incoming =
    raw && typeof raw === "object" ? (raw as Partial<BackupPrefs>) : {};
  return {
    autoEnabled: incoming.autoEnabled === true,
    frequency: incoming.frequency === "monthly" ? "monthly" : "weekly",
    weeklyDay: clampInt(incoming.weeklyDay, 0, 6, defaults.weeklyDay),
    monthlyDate: clampInt(incoming.monthlyDate, 1, 31, defaults.monthlyDate),
    lastDownloadedAt:
      typeof incoming.lastDownloadedAt === "string" && incoming.lastDownloadedAt
        ? incoming.lastDownloadedAt
        : null,
    folderName:
      typeof incoming.folderName === "string" && incoming.folderName.trim()
        ? incoming.folderName.trim()
        : null,
  };
}

export function loadBackupPrefs(): BackupPrefs {
  return normalizeBackupPrefs(loadFromStorage(BACKUP_PREFS_KEY, null));
}

export function saveBackupPrefs(prefs: BackupPrefs): void {
  saveToStorage(BACKUP_PREFS_KEY, normalizeBackupPrefs(prefs));
}

export function updateBackupPrefs(patch: Partial<BackupPrefs>): BackupPrefs {
  const next = normalizeBackupPrefs({ ...loadBackupPrefs(), ...patch });
  saveBackupPrefs(next);
  return next;
}

export function markBackupDownloaded(at = new Date()): BackupPrefs {
  return updateBackupPrefs({ lastDownloadedAt: at.toISOString() });
}

function localDateOf(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(date);
}

/** 本週／本月應執行備份的日期（YYYY-MM-DD，當地時間） */
export function scheduledBackupDate(prefs: BackupPrefs, now = new Date()): string {
  if (prefs.frequency === "weekly") {
    const delta = (now.getDay() - prefs.weeklyDay + 7) % 7;
    const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate() - delta);
    return formatDate(scheduled);
  }
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = Math.min(prefs.monthlyDate, lastDay);
  return formatDate(new Date(now.getFullYear(), now.getMonth(), day));
}

export function isAutoBackupDue(prefs: BackupPrefs, now = new Date()): boolean {
  if (!prefs.autoEnabled) return false;
  const scheduled = scheduledBackupDate(prefs, now);
  const today = formatDate(now);
  if (today < scheduled) return false;
  const last = localDateOf(prefs.lastDownloadedAt);
  if (last && last >= scheduled) return false;
  return true;
}

export function formatLastDownloadedAt(iso: string | null): string {
  if (!iso) return "尚無";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "尚無";
  return date.toLocaleString("zh-TW");
}

export function weekdayLabel(day: number): string {
  return WEEKDAY_OPTIONS.find((item) => item.value === day)?.label ?? "星期日";
}
