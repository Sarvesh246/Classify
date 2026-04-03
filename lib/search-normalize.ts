import type { ProfessorCourseSummary } from "@/lib/types";

const SUBJECT_NUM_RE = /([A-Z&]{2,12})[\s-]*(\d{2,4}[A-Z]?)/;

/** Collapse a course identifier like FINC 422, finc-422, FINC422 to one comparable key. */
export function courseCodeKeyFromString(raw: string): string | null {
  const upper = raw.toUpperCase();
  const embedded = upper.match(SUBJECT_NUM_RE);
  if (embedded) return `${embedded[1]}${embedded[2]}`;
  const compact = upper.replace(/[^A-Z0-9&]/g, "");
  const direct = compact.match(/^([A-Z&]{2,12})(\d{2,4}[A-Z]?)$/);
  if (direct) return `${direct[1]}${direct[2]}`;
  return null;
}

/** Try to pull a course key from a full user query (possibly with extra words). */
export function extractCourseCodeKeyFromQuery(query: string): string | null {
  return courseCodeKeyFromString(query);
}

export function courseCodeKeyFromOffering(courseCode: string): string | null {
  return courseCodeKeyFromString(courseCode.trim());
}

/** Extra searchable strings so registrar and display variants converge (mirrors TAMU name patterns loosely). */
export function expandProfessorSearchHaystack(offering: ProfessorCourseSummary): string[] {
  const out = new Set<string>();
  const add = (s?: string | null) => {
    const t = s?.trim();
    if (t) out.add(t);
  };

  add(offering.professorName);
  add(offering.professorSlug.replace(/-/g, " "));
  add(offering.professorSlug.replace(/-/g, ""));
  add(offering.courseCode);
  add(offering.courseName);
  add(offering.department);

  const n = offering.professorName?.trim() ?? "";
  const dotted = n.match(/^([A-Z]{1,2})\.([A-Z])\.?\s+(.+)$/i);
  if (dotted) {
    const a = dotted[1].toUpperCase();
    const b = dotted[2].toUpperCase();
    const fam = dotted[3].toUpperCase().replace(/\s+/g, " ");
    add(`${fam} ${a}${b}`);
    add(`${a}${b} ${fam}`);
  }
  const singleIni = n.match(/^([A-Z]{1,2})\.?\s+(.+)$/i);
  if (singleIni && !dotted) {
    const ini = singleIni[1].toUpperCase();
    const fam = singleIni[2].toUpperCase().replace(/\s+/g, " ");
    add(`${fam} ${ini}`);
    add(`${ini} ${fam}`);
  }

  return [...out];
}

export function buildCourseSearchHaystack(
  offering: ProfessorCourseSummary,
  courseSlug: string,
): string[] {
  const parts = new Set<string>();
  const add = (s?: string | null) => {
    const t = s?.trim();
    if (t) parts.add(t);
  };
  add(offering.courseCode);
  add(offering.courseName);
  add(courseSlug.replace(/-/g, " "));
  add(offering.department);
  add(offering.professorName);
  const key = courseCodeKeyFromOffering(offering.courseCode);
  if (key) parts.add(key);
  return [...parts];
}
