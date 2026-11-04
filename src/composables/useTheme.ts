import { computed, ref } from "vue";
import {
  applyTheme,
  loadTheme,
  nextTheme,
  saveTheme,
  type Theme,
} from "@/utils/theme";
import { THEME_KEY } from "@/utils/storage";

const theme = ref<Theme>(loadTheme());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_KEY) return;
    const next = loadTheme();
    theme.value = next;
    applyTheme(next);
  });
}

export function useTheme() {
  const isDark = computed(() => theme.value === "dark");

  function setTheme(next: Theme) {
    theme.value = next;
    saveTheme(next);
  }

  function toggleTheme() {
    setTheme(nextTheme(theme.value));
  }

  return { theme, isDark, setTheme, toggleTheme };
}
