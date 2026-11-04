import { ref } from "vue";
import {
  applyAccent,
  loadAccent,
  saveAccent,
  type AccentId,
} from "@/utils/accent";
import { ACCENT_KEY } from "@/utils/storage";

const accent = ref<AccentId>(loadAccent());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== ACCENT_KEY) return;
    const next = loadAccent();
    accent.value = next;
    applyAccent(next);
  });
}

export function useAccent() {
  function setAccent(next: AccentId) {
    accent.value = next;
    saveAccent(next);
  }

  return { accent, setAccent };
}
