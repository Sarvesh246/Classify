import type { School } from "@/lib/types";

const SCHOOL_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
]);

export function normalizeSchoolSearchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSchoolInitialism(value: string | null | undefined) {
  const tokens = normalizeSchoolSearchText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length > 0 &&
        !SCHOOL_STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
  if (tokens.length < 2) {
    return "";
  }
  return tokens.map((token) => token[0]).join("");
}

export function buildSchoolSearchText(school: School) {
  const parts = new Set<string>();
  const add = (value: string | null | undefined) => {
    const normalized = normalizeSchoolSearchText(value);
    if (normalized) {
      parts.add(normalized);
    }
    const initialism = buildSchoolInitialism(value);
    if (initialism) {
      parts.add(initialism);
    }
  };

  add(school.shortName);
  add(school.name);
  for (const alias of school.aliases ?? []) {
    add(alias);
  }
  add(school.city);
  add(school.state);
  add(`${school.city} ${school.state}`);

  return [...parts].join(" ");
}

/**
 * Cheap candidate filter before full search scoring on merged directory schools.
 * Requires every significant token to appear in the normalized school search text.
 * If no narrowing is possible, returns the full list so fuzzy scoring is unchanged.
 */
export function prefilterSchoolsByTextQuery(schools: School[], query: string): School[] {
  const trimmed = normalizeSchoolSearchText(query);
  if (!trimmed) {
    return schools;
  }

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  const significant = tokens.filter(
    (t) => t.length >= 2 && !SCHOOL_STOP_WORDS.has(t),
  );
  if (significant.length === 0) {
    return schools;
  }

  const narrowed = schools.filter((school) => {
    const hay = buildSchoolSearchText(school);
    return significant.every((tok) => hay.includes(tok));
  });

  return narrowed.length > 0 ? narrowed : schools;
}
