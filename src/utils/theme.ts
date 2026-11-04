import { loadFromStorage, saveToStorage, THEME_KEY } from "@/utils/storage";

export type Theme = "light" | "dark";

export const LIGHT_THEME_COLOR = "#7c3aed";
export const DARK_THEME_COLOR = "#111827";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : "light";
}

export function loadTheme(): Theme {
  return parseTheme(loadFromStorage<unknown>(THEME_KEY, "light"));
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }
}

export function saveTheme(theme: Theme): void {
  saveToStorage(THEME_KEY, theme);
  applyTheme(theme);
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
