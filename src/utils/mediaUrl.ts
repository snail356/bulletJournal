const liveObjectUrls = new Set<string>();

export function isDisplayMediaUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("data:") || value.startsWith("blob:"))
  );
}

export function rememberObjectUrl(url: string): string {
  liveObjectUrls.add(url);
  return url;
}

export function revokeTrackedObjectUrls(): void {
  for (const url of liveObjectUrls) {
    URL.revokeObjectURL(url);
  }
  liveObjectUrls.clear();
}

export async function urlToBlob(url: string): Promise<Blob | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export function blobToObjectUrl(blob: Blob): string {
  return rememberObjectUrl(URL.createObjectURL(blob));
}
