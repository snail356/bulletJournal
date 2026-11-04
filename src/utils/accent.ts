import { loadFromStorage, saveToStorage, ACCENT_KEY } from "@/utils/storage";

export const ACCENT_IDS = [
  "violet",
  "blue",
  "teal",
  "green",
  "orange",
  "rose",
] as const;

export type AccentId = (typeof ACCENT_IDS)[number];

export const DEFAULT_ACCENT: AccentId = "violet";

export const ACCENT_PALETTES: Record<
  AccentId,
  { id: AccentId; label: string; swatch: string }
> = {
  violet: { id: "violet", label: "紫", swatch: "#7c3aed" },
  blue: { id: "blue", label: "藍", swatch: "#2563eb" },
  teal: { id: "teal", label: "青", swatch: "#0d9488" },
  green: { id: "green", label: "綠", swatch: "#16a34a" },
  orange: { id: "orange", label: "橙", swatch: "#ea580c" },
  rose: { id: "rose", label: "玫紅", swatch: "#e11d48" },
};

export const ACCENT_OPTIONS = ACCENT_IDS.map((id) => ACCENT_PALETTES[id]);

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === "string" && ACCENT_IDS.includes(value as AccentId);
}

export function parseAccent(value: unknown): AccentId {
  return isAccentId(value) ? value : DEFAULT_ACCENT;
}

export function loadAccent(): AccentId {
  return parseAccent(loadFromStorage<unknown>(ACCENT_KEY, DEFAULT_ACCENT));
}

export function accentSwatch(accent: AccentId): string {
  return ACCENT_PALETTES[accent].swatch;
}

export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset.accent = accent;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const theme = document.documentElement.dataset.theme;
  if (theme === "dark") return;
  meta.setAttribute("content", accentSwatch(accent));
}

export function saveAccent(accent: AccentId): void {
  saveToStorage(ACCENT_KEY, accent);
  applyAccent(accent);
}
