import type { School } from "@/lib/types";

/**
 * Cheap candidate filter before full search scoring on merged directory schools.
 * Requires every token of length ≥2 to appear as a substring in name/aliases/city/state.
 * If no narrowing is possible, returns the full list so fuzzy scoring is unchanged.
 */
export function prefilterSchoolsByTextQuery(schools: School[], query: string): School[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return schools;
  }

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  const significant = tokens.filter((t) => t.length >= 2);
  if (significant.length === 0) {
    return schools;
  }

  const haystack = (school: School) =>
    [school.shortName, school.name, ...(school.aliases ?? []), school.city, school.state]
      .join(" ")
      .toLowerCase();

  const narrowed = schools.filter((school) => {
    const hay = haystack(school);
    return significant.every((tok) => hay.includes(tok));
  });

  return narrowed.length > 0 ? narrowed : schools;
}
