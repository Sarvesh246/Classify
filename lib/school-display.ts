export function normalizeSchoolText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function splitAliasParts(value: string | null | undefined) {
  return normalizeSchoolText(value)
    .split(/\s*[,;|/]\s*/)
    .map((part) => normalizeSchoolText(part))
    .filter(Boolean);
}

function countInstitutionTerms(value: string) {
  return (
    value.match(
      /\b(?:university|college|school|campus|institute|medical|graduate|allied|health)\b/gi,
    )?.length ?? 0
  );
}

export function isMalformedSchoolAlias(value: string | null | undefined) {
  const alias = normalizeSchoolText(value);
  if (!alias) return false;
  if (/^[A-Z]{2}$/.test(alias)) return true;
  if (alias.length > 72) return true;
  if (/[|;/]/.test(alias)) return true;
  if (alias.split(/\s+/).length > 10) return true;
  return countInstitutionTerms(alias) >= 4;
}

function compactSchoolNameFromOfficialName(name: string) {
  const normalized = normalizeSchoolText(name);
  if (!normalized) return normalized;

  const matchedRules: Array<[RegExp, (tail: string) => string]> = [
    [/^the university of texas at (.+)$/i, (tail) => `UT ${tail}`],
    [/^university of texas at (.+)$/i, (tail) => `UT ${tail}`],
    [/^the university of texas health science center at (.+)$/i, (tail) => `UT Health ${tail}`],
    [/^university of texas health science center at (.+)$/i, (tail) => `UT Health ${tail}`],
    [/^the university of texas southwestern medical center$/i, () => "UT Southwestern"],
    [/^university of texas southwestern medical center$/i, () => "UT Southwestern"],
    [/^the university of texas rio grande valley$/i, () => "UT Rio Grande Valley"],
    [/^university of texas rio grande valley$/i, () => "UT Rio Grande Valley"],
    [/^university of california,?\s+(.+)$/i, (tail) => `UC ${tail}`],
    [/^university of wisconsin[- ](.+)$/i, (tail) => `UW-${tail}`],
    [/^the ohio state university(?: main campus)?$/i, () => "Ohio State"],
    [/^university of north carolina at (.+)$/i, (tail) => `UNC ${tail}`],
    [/^university of washington[- ](.+)$/i, (tail) => `UW ${tail}`],
  ];

  for (const [pattern, formatter] of matchedRules) {
    const match = normalized.match(pattern);
    if (match) {
      return normalizeSchoolText(formatter(normalizeSchoolText(match[1] ?? "")));
    }
  }

  const withoutArticle = normalized.replace(/^The\s+/i, "");
  if (
    /^(?!University of ).+\s(?:University|College|Institute)$/i.test(withoutArticle) &&
    withoutArticle.split(/\s+/).length <= 3
  ) {
    return withoutArticle.replace(/\s(?:University|College|Institute)$/i, "");
  }
  return withoutArticle;
}

export function deriveSchoolShortName(
  name: string,
  alias?: string | null,
) {
  const officialName = normalizeSchoolText(name);
  const cleanAlias = splitAliasParts(alias).find(
    (part) =>
      !isMalformedSchoolAlias(part) &&
      part.length <= Math.max(officialName.length, 24),
  );

  if (
    cleanAlias &&
    cleanAlias.length <= Math.max(officialName.length, 24)
  ) {
    return cleanAlias;
  }

  return compactSchoolNameFromOfficialName(officialName);
}

export function buildSchoolAliases(
  name: string,
  alias: string | null | undefined,
  extraAliases: string[] = [],
  shortName?: string,
) {
  const aliases = new Set<string>();
  const normalizedName = normalizeSchoolText(name);
  const normalizedShortName = normalizeSchoolText(shortName);

  if (normalizedName) aliases.add(normalizedName);
  if (normalizedShortName) aliases.add(normalizedShortName);
  for (const aliasPart of splitAliasParts(alias)) {
    if (!isMalformedSchoolAlias(aliasPart)) {
      aliases.add(aliasPart);
    }
  }

  for (const extraAlias of extraAliases) {
    const normalized = normalizeSchoolText(extraAlias);
    if (normalized) aliases.add(normalized);
  }

  return [...aliases];
}
