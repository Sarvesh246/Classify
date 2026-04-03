import {
  buildCourseSearchHaystack,
  courseCodeKeyFromOffering,
  extractCourseCodeKeyFromQuery,
  expandProfessorSearchHaystack,
} from "@/lib/search-normalize";
import type { ProfessorCourseSummary } from "@/lib/types";

/** Bounded Levenshtein; returns null if distance exceeds maxDist. */
export function levenshteinWithin(a: string, b: string, maxDist: number): number | null {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return null;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const curr = new Array<number>(n + 1);
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDist) return null;
    prev = curr;
  }
  const d = prev[n];
  return d <= maxDist ? d : null;
}

export function fuzzyTokenBonus(
  query: string,
  haystack: string,
): { bonus: number; matched: boolean } {
  const qTokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2);
  const hayLower = haystack.toLowerCase();
  const hayWords = hayLower.split(/\s+/).filter(Boolean);

  let bonus = 0;
  let matched = false;

  for (const token of qTokens) {
    if (token.length < 4) continue;
    if (hayLower.includes(token)) continue;
    const asWord = hayWords.some((w) => w === token || w.startsWith(token));
    if (asWord) continue;

    const maxDist = token.length <= 6 ? 2 : 3;
    let best = 0;
    for (const w of hayWords) {
      if (w.length < 3) continue;
      const d = levenshteinWithin(token, w, maxDist);
      if (d != null) best = Math.max(best, 38 - d * 14);
    }
    if (best > 0) {
      bonus += best;
      matched = true;
    }
  }

  return { bonus, matched };
}

export function exactCourseCodeBoost(
  queryKey: string | null,
  offeringKey: string | null,
  hitType: "course" | "professor",
): number {
  if (!queryKey || !offeringKey) return 0;
  if (queryKey === offeringKey) return hitType === "course" ? 120 : 88;
  if (offeringKey.startsWith(queryKey) || queryKey.startsWith(offeringKey)) return 55;
  return 0;
}

export function scoreMatch(query: string, target: string, aliases: string[] = []) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return 1;

  const haystack = [target, ...aliases].join(" ").toLowerCase();
  if (haystack.startsWith(normalized)) return 100;
  if (haystack.includes(` ${normalized}`)) return 88;
  if (haystack.includes(normalized)) return 72;

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, token) => score + (haystack.includes(token) ? 18 : 0), 0);
}

export type CatalogHitSearchContext =
  | { type: "course"; offering: ProfessorCourseSummary; courseSlug: string }
  | { type: "professor"; offering: ProfessorCourseSummary };

export function buildCatalogHitHaystack(ctx: CatalogHitSearchContext): string {
  if (ctx.type === "course") {
    return buildCourseSearchHaystack(ctx.offering, ctx.courseSlug).join(" ");
  }
  return expandProfessorSearchHaystack(ctx.offering).join(" ");
}

export function computeQueryCourseKey(query: string): string | null {
  return extractCourseCodeKeyFromQuery(query.trim());
}

export function computeCatalogSearchScoreParts(
  query: string,
  ctx: CatalogHitSearchContext,
  baseAliases: string[],
  offering: ProfessorCourseSummary,
): { base: number; courseBoost: number; fuzzyBonus: number; fuzzyMatched: boolean } {
  const haystackText = buildCatalogHitHaystack(ctx);
  const base = scoreMatch(query, haystackText, baseAliases);
  const queryKey = computeQueryCourseKey(query);
  const offeringKey = courseCodeKeyFromOffering(offering.courseCode);
  const courseBoost = exactCourseCodeBoost(
    queryKey,
    offeringKey,
    ctx.type === "course" ? "course" : "professor",
  );
  const fuzzy = fuzzyTokenBonus(query, haystackText);
  return {
    base,
    courseBoost,
    fuzzyBonus: fuzzy.bonus,
    fuzzyMatched: fuzzy.matched,
  };
}
