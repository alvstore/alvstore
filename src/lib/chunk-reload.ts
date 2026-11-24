const RELOAD_KEY = "alv_chunk_reload_at";
const COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    text
  );
}

/** Reload once when a deploy replaces client chunk hashes; never loop. */
export function reloadOnChunkError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
    if (now - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Proceed cleanly even if sessionStorage is restricted.
  }
  window.location.reload();
  return true;
}

export function reportBoundaryError(error: Error, boundary: string): void {
  fetch("/api/backend/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: boundary,
      message: error.message,
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.pathname : "",
    }),
    keepalive: true,
  }).catch(() => undefined);
}
