export const THEME_STORAGE_KEY = "classify-theme";

export type ThemePreference = "light" | "dark";

export function getIsDarkFromClass(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function applyThemeClass(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = pref === "dark";
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Used by inline script before paint and client after hydration. */
export function resolveStoredOrSystemTheme(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* private mode */
  }
  // Product default: dark mode when no explicit preference was chosen.
  return "dark";
}

export function readStoredTheme(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* ignore */
  }
  return null;
}
