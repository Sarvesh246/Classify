import type { SearchHit, SearchHitType } from "@/lib/types";

const STORAGE_KEY = "classify:recent-searches";
const MAX_RECENT = 8;
const RECENT_SEARCHES_EVENT = "classify:recent-searches-updated";
const EMPTY_RECENT_SEARCHES: RecentSearchEntry[] = [];

let cachedRawRecentSearches: string | null | undefined;
let cachedRecentSearches: RecentSearchEntry[] = EMPTY_RECENT_SEARCHES;

export type RecentSearchEntry = {
  id: string;
  label: string;
  href: string;
  type: SearchHitType;
  school: string;
  timestamp: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitRecentSearchesChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
}

export function readRecentSearches(): RecentSearchEntry[] {
  if (!canUseStorage()) {
    return EMPTY_RECENT_SEARCHES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRawRecentSearches) {
      return cachedRecentSearches;
    }

    if (!raw) {
      cachedRawRecentSearches = raw;
      cachedRecentSearches = EMPTY_RECENT_SEARCHES;
      return cachedRecentSearches;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cachedRawRecentSearches = raw;
      cachedRecentSearches = EMPTY_RECENT_SEARCHES;
      return cachedRecentSearches;
    }

    cachedRawRecentSearches = raw;
    cachedRecentSearches = parsed
      .filter((entry): entry is RecentSearchEntry => {
        return (
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RecentSearchEntry).id === "string" &&
          typeof (entry as RecentSearchEntry).label === "string" &&
          typeof (entry as RecentSearchEntry).href === "string" &&
          typeof (entry as RecentSearchEntry).type === "string" &&
          typeof (entry as RecentSearchEntry).school === "string" &&
          typeof (entry as RecentSearchEntry).timestamp === "number"
        );
      })
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, MAX_RECENT);
    return cachedRecentSearches;
  } catch {
    cachedRawRecentSearches = undefined;
    cachedRecentSearches = EMPTY_RECENT_SEARCHES;
    return cachedRecentSearches;
  }
}

function writeRecentSearches(entries: RecentSearchEntry[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
    emitRecentSearchesChange();
  } catch {
    // ignore quota/storage errors
  }
}

export function subscribeRecentSearches(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(RECENT_SEARCHES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(RECENT_SEARCHES_EVENT, handler);
  };
}

export function pushRecentSearch(item: SearchHit) {
  const nextEntry: RecentSearchEntry = {
    id: item.id,
    label: item.label,
    href: item.href,
    type: item.type,
    school: item.school,
    timestamp: Date.now(),
  };

  const current = readRecentSearches().filter(
    (entry) => entry.href !== item.href && entry.id !== item.id,
  );

  writeRecentSearches([nextEntry, ...current]);
}

export function clearRecentSearches() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    cachedRawRecentSearches = null;
    cachedRecentSearches = EMPTY_RECENT_SEARCHES;
    emitRecentSearchesChange();
  } catch {
    // ignore
  }
}
