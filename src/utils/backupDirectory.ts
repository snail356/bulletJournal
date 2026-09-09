const DB_NAME = "bullet-journal-fs";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const HANDLE_KEY = "backup-directory";

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("無法開啟備份資料夾儲存"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("備份資料夾儲存失敗"));
  });
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("無法儲存備份資料夾"));
      tx.onabort = () => reject(tx.error ?? new Error("儲存備份資料夾已中止"));
    });
  } finally {
    db.close();
  }
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const value = await requestToPromise(
      tx.objectStore(STORE_NAME).get(HANDLE_KEY),
    );
    return value instanceof FileSystemDirectoryHandle ? value : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("無法清除備份資料夾"));
      tx.onabort = () => reject(tx.error ?? new Error("清除備份資料夾已中止"));
    });
  } catch {
    // ignore
  } finally {
    db.close();
  }
}

async function queryWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState | "unsupported"> {
  const withPermission = handle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  };
  if (typeof withPermission.queryPermission !== "function") return "granted";
  try {
    return await withPermission.queryPermission({ mode: "readwrite" });
  } catch {
    return "unsupported";
  }
}

async function requestWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const withPermission = handle as FileSystemDirectoryHandle & {
    requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  };
  if (typeof withPermission.requestPermission !== "function") return true;
  try {
    return (await withPermission.requestPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

export async function ensureDirectoryWriteAccess(
  handle: FileSystemDirectoryHandle,
  interactive: boolean,
): Promise<boolean> {
  const current = await queryWritePermission(handle);
  if (current === "granted" || current === "unsupported") return true;
  if (!interactive) return false;
  return requestWritePermission(handle);
}

export async function pickBackupDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isDirectoryPickerSupported()) {
    throw new Error("此瀏覽器不支援選擇資料夾，將使用系統預設下載位置");
  }
  const picker = window.showDirectoryPicker.bind(window) as (
    options?: DirectoryPickerOptions,
  ) => Promise<FileSystemDirectoryHandle>;
  const handle = await picker({
    id: "bullet-journal-backup",
    mode: "readwrite",
    startIn: "downloads",
  });
  const allowed = await ensureDirectoryWriteAccess(handle, true);
  if (!allowed) {
    throw new Error("未授權寫入此資料夾");
  }
  await saveDirectoryHandle(handle);
  return handle;
}

export async function getUsableBackupDirectory(
  interactive: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadDirectoryHandle();
  if (!handle) return null;
  const allowed = await ensureDirectoryWriteAccess(handle, interactive);
  return allowed ? handle : null;
}

export async function writeBlobToDirectory(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}
