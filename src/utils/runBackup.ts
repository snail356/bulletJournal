import { useStockStore } from "@/stores/stockStore";
import { useTaskStore } from "@/stores/taskStore";
import { downloadBackupZip, type BackupResult, type BackupSource } from "@/utils/backup";
import {
  clearDirectoryHandle,
  getUsableBackupDirectory,
  isDirectoryPickerSupported,
  loadDirectoryHandle,
  pickBackupDirectory,
} from "@/utils/backupDirectory";
import {
  isAutoBackupDue,
  loadBackupPrefs,
  markBackupDownloaded,
  updateBackupPrefs,
} from "@/utils/backupPrefs";

let backupRun: Promise<BackupResult> | null = null;

export function collectBackupSource(): BackupSource {
  const store = useTaskStore();
  const stockStore = useStockStore();
  return {
    tasks: store.tasks,
    labels: store.labels,
    statusItems: store.statusItems,
    toolboxLists: store.toolboxLists,
    dailyReflections: store.dailyReflections,
    taskAvatars: store.taskAvatars,
    sidebarCarousel: store.sidebarCarousel,
    stockFavorites: stockStore.favorites,
    aiManagerPrompt: store.aiManagerPrompt,
    navFeatureVisibility: store.navFeatureVisibility,
    navFeatureOrder: store.navFeatureOrder,
  };
}

export async function executeBackup(options?: {
  interactive?: boolean;
}): Promise<BackupResult> {
  if (backupRun) return backupRun;
  const interactive = options?.interactive !== false;
  backupRun = (async () => {
    const directoryHandle = await getUsableBackupDirectory(interactive);
    const result = await downloadBackupZip(collectBackupSource(), {
      directoryHandle,
    });
    markBackupDownloaded();
    return result;
  })();
  try {
    return await backupRun;
  } finally {
    backupRun = null;
  }
}

export async function maybeRunAutoBackup(): Promise<boolean> {
  const prefs = loadBackupPrefs();
  if (!isAutoBackupDue(prefs)) return false;
  await executeBackup({ interactive: false });
  return true;
}

export async function chooseBackupFolder(): Promise<string> {
  const handle = await pickBackupDirectory();
  updateBackupPrefs({ folderName: handle.name });
  return handle.name;
}

export async function clearBackupFolder(): Promise<void> {
  await clearDirectoryHandle();
  updateBackupPrefs({ folderName: null });
}

export async function syncBackupFolderState(): Promise<void> {
  const handle = await loadDirectoryHandle();
  const prefs = loadBackupPrefs();
  if (!handle && prefs.folderName) {
    updateBackupPrefs({ folderName: null });
    return;
  }
  if (handle && handle.name !== prefs.folderName) {
    updateBackupPrefs({ folderName: handle.name });
  }
}

export { isDirectoryPickerSupported };
