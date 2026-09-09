const DB_NAME = "bullet-journal-data";
const DB_VERSION = 1;
const KV_STORE = "kv";
const BLOB_STORE = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("無法開啟 IndexedDB"));
    };
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB 操作失敗"));
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB 交易失敗"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB 交易已中止"));
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, "readonly");
  const value = await requestToPromise(tx.objectStore(KV_STORE).get(key));
  await waitForTransaction(tx);
  return value as T | undefined;
}

/** IndexedDB 只能存可 structured clone 的值；Vue Proxy 會導致 DataCloneError。 */
function cloneForIdb<T>(value: T): T {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Blob || value instanceof File) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, "readwrite");
  tx.objectStore(KV_STORE).put(cloneForIdb(value), key);
  await waitForTransaction(tx);
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, "readwrite");
  tx.objectStore(KV_STORE).delete(key);
  await waitForTransaction(tx);
}

export async function idbGetBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, "readonly");
  const value = await requestToPromise(tx.objectStore(BLOB_STORE).get(id));
  await waitForTransaction(tx);
  return value instanceof Blob ? value : undefined;
}

export async function idbPutBlobs(
  entries: Array<{ id: string; blob: Blob }>,
): Promise<void> {
  if (!entries.length) return;
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, "readwrite");
  const store = tx.objectStore(BLOB_STORE);
  for (const entry of entries) {
    store.put(entry.blob, entry.id);
  }
  await waitForTransaction(tx);
}

export async function idbGetAllBlobIds(): Promise<string[]> {
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, "readonly");
  const keys = await requestToPromise(tx.objectStore(BLOB_STORE).getAllKeys());
  await waitForTransaction(tx);
  return keys.map(String);
}

export async function idbDeleteBlobs(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, "readwrite");
  const store = tx.objectStore(BLOB_STORE);
  for (const id of ids) {
    store.delete(id);
  }
  await waitForTransaction(tx);
}

export async function idbClearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([KV_STORE, BLOB_STORE], "readwrite");
  tx.objectStore(KV_STORE).clear();
  tx.objectStore(BLOB_STORE).clear();
  await waitForTransaction(tx);
}
