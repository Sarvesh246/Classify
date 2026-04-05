/**
 * Normalizes `next` / return paths for auth redirects.
 * Blocks protocol-relative URLs, absolute URLs, backslashes, and other open-redirect patterns.
 */
export function safeReturnPath(raw: string | null | undefined, fallback = "/"): string {
  if (raw == null || raw === "") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  try {
    const base = "https://example.invalid";
    const u = new URL(trimmed, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
