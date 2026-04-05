import type { SearchHit, SearchHitType } from "@/lib/types";

const STORAGE_KEY = "classify:recent-searches";
const MAX_RECENT = 8;

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

export function readRecentSearches(): RecentSearchEntry[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
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
  } catch {
    return [];
  }
}

function writeRecentSearches(entries: RecentSearchEntry[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota/storage errors
  }
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
  } catch {
    // ignore
  }
}
