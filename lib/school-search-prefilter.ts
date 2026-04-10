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

function buildSchoolInitialisms(value: string | null | undefined) {
  const normalized = normalizeSchoolSearchText(value);
  const tokens = normalized
    .split(" ")
    .filter(
      (token) =>
        token.length > 0 &&
        !SCHOOL_STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
  const forms = new Set<string>();

  if (tokens.length < 2) {
    return forms;
  }

  forms.add(tokens.map((token) => token[0]).join(""));

  const universityOfMatch = normalized.match(/^university of ([a-z0-9]+)/);
  if (universityOfMatch?.[1]) {
    const initial = universityOfMatch[1][0];
    forms.add(`u${initial}`);
    forms.add(`${initial}u`);
  }

  if (tokens[0] === "university" && tokens.length === 2) {
    forms.add(`${tokens[0][0]}${tokens[1][0]}`);
    forms.add(`${tokens[1][0]}${tokens[0][0]}`);
  }

  if (normalized.includes("a and m")) {
    forms.add("a and m");
    forms.add("a m");
    forms.add("am");
  }

  return forms;
}

function buildSchoolQueryVariants(value: string | null | undefined) {
  const normalized = normalizeSchoolSearchText(value);
  const forms = new Set<string>();

  if (!normalized) {
    return forms;
  }

  forms.add(normalized);

  for (const initialism of buildSchoolInitialisms(value)) {
    if (initialism) {
      forms.add(initialism);
    }
  }

  const universityOfMatch = normalized.match(/^university of ([a-z0-9]+)/);
  if (universityOfMatch?.[1]) {
    forms.add(`u of ${universityOfMatch[1]}`);
  }

  if (normalized.includes("a and m")) {
    forms.add("a and m");
    forms.add("a m");
    forms.add("am");
  }

  return forms;
}

export function buildSchoolSearchTerms(school: School) {
  const parts = new Set<string>();
  const add = (value: string | null | undefined) => {
    for (const variant of buildSchoolQueryVariants(value)) {
      parts.add(variant);
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

  return [...parts];
}

export function buildSchoolSearchText(school: School) {
  return buildSchoolSearchTerms(school).join(" ");
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
