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
