const NAME_TOKEN = /^[A-Za-z][A-Za-z'\-]*$/;

function titleWord(word: string): string {
  if (word.includes("'")) {
    return word.split("'").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("'");
  }
  if (word.includes("-")) {
    return word.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-");
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleParts(tokens: string[]): string {
  return tokens.map(titleWord).join(" ");
}

function looksLikeNameParts(parts: string[]): boolean {
  return parts.length > 0 && parts.every((p) => NAME_TOKEN.test(p));
}

/**
 * Normalize registrar-style names to a single display form: given initials + family
 * (e.g. "W. Chu", "D. Bhargava"). Mirrors etl/classly_etl/tamu_names.py for ALL-CAPS tokens.
 */
export function formatProfessorDisplayName(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) {
    return "Unknown instructor";
  }

  const s = String(raw).trim().replace(/\s+/g, " ");
  const looksAllCapsRegistrar = s === s.toUpperCase() && /[A-Z]{2,}/.test(s);
  if (!looksAllCapsRegistrar) {
    return s
      .split(/\s+/)
      .map((w) => titleWord(w))
      .join(" ");
  }

  const upper = s.toUpperCase();

  if (s.includes(",")) {
    const [left, right] = s.split(",", 2).map((p) => p.trim());
    const familyTokens = left.split(/\s+/);
    const givenTokens = right.split(/\s+/).filter(Boolean);
    const family = titleParts(familyTokens.map((t) => t.toUpperCase()));
    if (!givenTokens.length) {
      return family || titleParts([left]);
    }
    const g0 = givenTokens[0].toUpperCase();
    if (givenTokens.length === 1 && g0.length <= 2 && /^[A-Z]+$/.test(g0)) {
      const initials = g0;
      const display =
        initials.length === 1
          ? `${initials[0]}. ${family}`
          : `${initials[0]}.${initials[1]}. ${family}`;
      return display;
    }
    const given = titleParts(givenTokens.map((t) => t.toUpperCase()));
    return `${given} ${family}`;
  }

  const tokens = upper.split(/\s+/);
  if (tokens.length === 1) {
    return titleParts(tokens);
  }

  const last = tokens[tokens.length - 1];
  const first = tokens[0];

  if (
    last.length <= 2 &&
    /^[A-Z]+$/.test(last) &&
    looksLikeNameParts(tokens.slice(0, -1))
  ) {
    const familyRaw = tokens.slice(0, -1);
    const initials = last;
    const family = titleParts(familyRaw);
    const display =
      initials.length === 1
        ? `${initials[0]}. ${family}`
        : `${initials[0]}.${initials[1]}. ${family}`;
    return display;
  }

  if (
    first.length <= 2 &&
    /^[A-Z]+$/.test(first) &&
    looksLikeNameParts(tokens.slice(1))
  ) {
    const restRaw = tokens.slice(1);
    const family = titleParts(restRaw);
    const display =
      first.length === 1 ? `${first[0]}. ${family}` : `${first[0]}.${first[1]}. ${family}`;
    return display;
  }

  return titleParts(tokens);
}

function normalizeComparableName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z'\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitComparableName(value: string) {
  return normalizeComparableName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function getFamilyName(value: string) {
  const parts = splitComparableName(value);
  return parts.at(-1) ?? "";
}

function getGivenName(value: string) {
  const parts = splitComparableName(value);
  return parts[0] ?? "";
}

function hasLeadingInitialName(value: string) {
  return /^([A-Z]\.){1,2}\s+/.test(value.trim());
}

function isLikelyFullProfessorName(value: string) {
  const parts = splitComparableName(value);
  if (parts.length < 2) {
    return false;
  }

  const given = parts[0] ?? "";
  return given.length > 1;
}

function scoreFullNameCandidate(candidate: string) {
  const comparable = splitComparableName(candidate);
  const nonInitialTokens = comparable.filter((token) => token.length > 1).length;
  return nonInitialTokens * 10 + candidate.length;
}

/**
 * Keep abbreviated list names stable, but use the fullest trustworthy name on the
 * dedicated professor profile when related source rows expose it.
 */
export function resolveProfessorProfileName(
  abbreviatedName: string | null | undefined,
  candidates: Array<string | null | undefined>,
): string {
  const formattedPrimary = formatProfessorDisplayName(abbreviatedName);
  if (!hasLeadingInitialName(formattedPrimary)) {
    return formattedPrimary;
  }

  const primaryFamily = getFamilyName(formattedPrimary);
  const primaryGiven = getGivenName(formattedPrimary);
  const primaryInitial = primaryGiven.charAt(0);
  if (!primaryFamily || !primaryInitial) {
    return formattedPrimary;
  }

  const matches = candidates
    .map((candidate) => formatProfessorDisplayName(candidate))
    .filter((candidate) => candidate && candidate !== "Unknown instructor")
    .filter((candidate) => isLikelyFullProfessorName(candidate))
    .filter((candidate) => getFamilyName(candidate) === primaryFamily)
    .filter((candidate) => getGivenName(candidate).charAt(0) === primaryInitial)
    .sort((left, right) => scoreFullNameCandidate(right) - scoreFullNameCandidate(left));

  const uniqueMatches = [...new Map(
    matches.map((candidate) => [normalizeComparableName(candidate), candidate]),
  ).values()];

  if (uniqueMatches.length !== 1) {
    return formattedPrimary;
  }

  return uniqueMatches[0];
}
