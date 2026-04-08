import "server-only";

import {
  getCatalogOfferings,
  getCatalogOfferingsForSchool,
  getProfessorDirectoryRows,
  getCatalogSchoolBySlug,
  getCatalogSchools,
  getHiddenGemsForSchool,
  getSchoolTrendSpotlight,
} from "@/lib/catalog";
import type {
  CourseGroup,
  DataCompleteness,
  DepartmentAggregate,
  ProfessorCourseSummary,
  ProfessorDirectoryRow,
  SearchHit,
  SearchHitType,
  School,
} from "@/lib/types";
import {
  computeCatalogSearchScoreParts,
  scoreMatch,
  type CatalogHitSearchContext,
} from "@/lib/search-scoring";
import { SMALL_SAMPLE_THRESHOLD } from "@/lib/data-trust";
import { professorLastNameSortKey } from "@/lib/professor-sort";
import { loadScorecardDirectorySchools } from "@/lib/scorecard-directory";
import { applyCacheLife } from "@/lib/cache-utils";

type ScoredSearchRow = {
  hit: SearchHit;
  score: number;
  parts?: ReturnType<typeof computeCatalogSearchScoreParts>;
  offering?: ProfessorCourseSummary;
};

function dedupeSchoolRows(rows: ScoredSearchRow[]) {
  const deduped = new Map<string, ScoredSearchRow>();

  for (const row of rows) {
    if (row.hit.type !== "school") {
      deduped.set(`row:${deduped.size}:${row.hit.id}`, row);
      continue;
    }

    const key = `${row.hit.label.toLowerCase()}|${row.hit.school.toLowerCase()}`;
    const existing = deduped.get(key);
    if (!existing || row.score > existing.score) {
      deduped.set(key, row);
    }
  }

  return [...deduped.values()];
}

function applyComboboxSchoolIntentFilter(
  rows: ScoredSearchRow[],
  query: string,
  surface: "combobox" | "page",
) {
  const trimmed = query.trim().toLowerCase();
  if (surface !== "combobox" || trimmed.length < 4 || !/\s/.test(trimmed)) {
    return rows;
  }

  const topSchool = rows.find((row) => row.hit.type === "school");
  if (!topSchool || topSchool.score < 72) {
    return rows;
  }

  return rows.filter(
    (row) => row.hit.type === "school" || row.hit.context.schoolSlug === topSchool.hit.slug,
  );
}

function finalizeSearchHit(
  hit: SearchHit,
  schoolsWithCatalogRows: Set<string>,
  row: Pick<ScoredSearchRow, "parts" | "offering">,
  query: string,
): SearchHit {
  const active = query.trim().length > 0;

  if (hit.type === "school") {
    if (!active) {
      return hit;
    }
    const rankHints = hit.supportProfile?.plannerReadiness === "schedule_ready"
      || hit.supportProfile?.plannerReadiness === "evidence_ready"
      ? ["Schedule planning ready"]
      : schoolsWithCatalogRows.has(hit.slug) || hit.supportProfile?.plannerReadiness === "catalog_ready"
        ? ["Course shortlist ready"]
        : ["School profile live"];
    return { ...hit, rankHints };
  }

  const { parts, offering } = row;
  if (!offering || !parts || !active) {
    return hit;
  }

  const rankHints: string[] = [];
  if (parts.courseBoost >= 55) rankHints.push("Course code match");
  if (parts.fuzzyMatched) rankHints.push("Close spelling match");
  if (
    hit.dataCompleteness === "institutional_full" ||
    hit.dataCompleteness === "institutional_partial"
  ) {
    rankHints.push("Institutional grade data");
  }
  if (offering.sampleSize < SMALL_SAMPLE_THRESHOLD) {
    rankHints.push("Small sample");
  }

  const secondaryMetrics = [
    ...hit.secondaryMetrics,
    `n~${offering.sampleSize}`,
    offering.latestTerm,
  ];

  return { ...hit, rankHints, secondaryMetrics };
}

function minimumSchoolTextScore(query: string, surface: "combobox" | "page") {
  const trimmed = query.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.length <= 2) {
    return surface === "combobox" ? 92 : 88;
  }
  if (trimmed.length <= 3) {
    return surface === "combobox" ? 80 : 72;
  }
  return surface === "combobox" ? 32 : 24;
}

function minimumCatalogTextScore(
  query: string,
  hitType: SearchHitType,
  schoolScoped: boolean,
) {
  const trimmed = query.trim();
  if (!trimmed) {
    return 0;
  }

  if (/\d/.test(trimmed)) {
    return hitType === "course" ? 18 : 24;
  }

  if (trimmed.length <= 2) {
    return hitType === "course" ? 72 : 88;
  }

  if (trimmed.length <= 3) {
    return schoolScoped ? 54 : 48;
  }

  return schoolScoped ? 24 : 18;
}

interface SearchDirectoryOptions {
  limit?: number;
  /** For full search page pagination; omit for API/combobox (offset 0). */
  offset?: number;
  type?: SearchHitType | "all";
  schoolSlug?: string;
  surface?: "combobox" | "page";
}

export async function getDirectorySchools() {
  "use cache";

  applyCacheLife("hours");
  const merged = new Map<string, School>();

  for (const school of loadScorecardDirectorySchools()) {
    merged.set(school.slug, school);
  }

  for (const school of await getCatalogSchools()) {
    const existing = merged.get(school.slug);
    if (!existing) {
      merged.set(school.slug, school);
      continue;
    }

    merged.set(school.slug, {
      ...school,
      aliases: [...new Set([...school.aliases, ...existing.aliases])],
      sourceStatus: school.sourceStatus,
    });
  }

  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function getDirectorySchoolBySlug(slug: string) {
  "use cache";

  applyCacheLife("hours");
  return (await getDirectorySchools()).find((school) => school.slug === slug);
}

function dataCompletenessBoost(hit: SearchHit) {
  switch (hit.dataCompleteness) {
    case "institutional_full":
      return 32;
    case "institutional_partial":
      return 24;
    case "rmp_only":
      return 10;
    case "directory_only":
    default:
      return 2;
  }
}

function recencyBoost(freshness: string) {
  const yearMatch = freshness.match(/20\d{2}/g);
  if (!yearMatch?.length) {
    return freshness.toLowerCase().includes("snapshot") ? 4 : 0;
  }

  const newestYear = Math.max(...yearMatch.map(Number));
  return Math.max(newestYear - 2022, 0) * 3;
}

function qualityBoost(
  hit: SearchHit,
  offeringLookup: Map<string, ProfessorCourseSummary>,
  courseLookup: Map<string, ProfessorCourseSummary>,
  professorLookup: Map<string, ProfessorDirectoryRow>,
) {
  const base = dataCompletenessBoost(hit) + recencyBoost(hit.freshness);

  if (hit.type === "professor") {
    const offering = offeringLookup.get(hit.id);
    if (offering) {
      return (
        base +
        Math.min(offering.sampleSize / 18, 16) +
        Math.min(offering.matchConfidence / 12, 8)
      );
    }

    const professor = professorLookup.get(hit.id);
    if (!professor) {
      return base;
    }
    return (
      base +
      Math.min(professor.sampleSize / 18, 16) +
      (professor.hasInstitutionalStats ? 8 : professor.hasRmp ? 4 : 0)
    );
  }

  if (hit.type === "course") {
    const offering = courseLookup.get(hit.id);
    if (!offering) {
      return base;
    }

    return base + Math.min(offering.sampleSize / 22, 14);
  }

  return base;
}

function schoolMatchBoost(query: string, hit: SearchHit, school: School | undefined) {
  if (hit.type !== "school") {
    return 0;
  }

  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return 0;
  }

  const canonicalLabel = hit.label.toLowerCase().trim();
  const aliases = (school?.aliases ?? [])
    .map((value) => value.toLowerCase().trim())
    .filter((value) => value !== canonicalLabel);

  if (canonicalLabel === normalizedQuery) {
    return 72;
  }

  if (canonicalLabel.startsWith(normalizedQuery)) {
    return 42;
  }

  if (aliases.some((value) => value === normalizedQuery)) {
    return 28;
  }

  if (aliases.some((value) => value.startsWith(normalizedQuery))) {
    return 12;
  }

  return 0;
}

function buildSchoolSearchHits(allSchools: School[], catalogSchools: School[]): SearchHit[] {
  const catalogSchoolLookup = new Map(catalogSchools.map((school) => [school.slug, school]));
  return allSchools.map((school) => {
    const catalogSchool = catalogSchoolLookup.get(school.slug);
    const coverageLine = catalogSchool
      ? "Planner baseline available"
      : "School profile ready";
    return {
    type: "school",
    id: school.id,
    label: school.shortName,
    school: `${school.city}, ${school.state}`,
    slug: school.slug,
    href: `/schools/${school.slug}`,
    coverageTier: school.coverageTier,
    highlight: school.descriptor,
    secondaryMetrics: [
      coverageLine,
      school.sourceStatus.primary,
      school.sourceStatus.freshness,
      school.supportProfile?.plannerReadiness === "schedule_ready"
        || school.supportProfile?.plannerReadiness === "evidence_ready"
        ? "Schedule planner ready"
        : school.supportProfile?.plannerReadiness === "catalog_ready"
          ? "Course planner ready"
          : "Catalog sync expanding",
    ],
    freshness: school.sourceStatus.freshness,
    sourceLabels: [school.sourceStatus.primary, school.sourceStatus.fallback],
    dataCompleteness:
      school.sourceStatus.primary === "College Scorecard directory"
        ? "directory_only"
        : school.coverageTier === "rmp_only"
          ? "rmp_only"
          : "institutional_full",
    context: {
      schoolSlug: school.slug,
      schoolShortName: school.shortName,
      contextLabel: `${school.city}, ${school.state}`,
      searchScope: "directory" as const,
    },
    supportProfile: school.supportProfile,
  };
  });
}

async function buildCatalogSearchHits(schoolSlug?: string): Promise<SearchHit[]> {
  const catalogSchools = await getCatalogSchools();
  const schoolLookup = new Map(catalogSchools.map((school) => [school.slug, school]));
  const offerings = (await getCatalogOfferings()).filter(
    (item) => !schoolSlug || item.schoolSlug === schoolSlug,
  );
  const courseByKey = new Map<string, ProfessorCourseSummary>();

  for (const offering of offerings) {
    const key = `${offering.schoolSlug}:${offering.courseSlug}`;
    const existing = courseByKey.get(key);
    if (!existing || (offering.classifyScore ?? 0) > (existing.classifyScore ?? 0)) {
      courseByKey.set(key, offering);
    }
  }

  const courseHits = [...courseByKey.values()].map((offering) => ({
    type: "course" as const,
    id: `${offering.schoolSlug}:${offering.courseSlug}`,
    label: `${offering.courseCode} - ${offering.courseName}`,
    school: schoolLookup.get(offering.schoolSlug)?.shortName ?? offering.schoolSlug,
    slug: offering.courseSlug,
    href: `/schools/${offering.schoolSlug}/courses/${offering.courseSlug}`,
    coverageTier: offering.coverageTier,
    highlight: offering.courseSummary,
    secondaryMetrics: [
      offering.professorName,
      offering.classifyScore == null
        ? "Classify score unavailable"
        : `Top Classify ${Math.round(offering.classifyScore)}`,
    ],
    freshness: offering.freshness,
    sourceLabels: offering.sourceLabels,
    dataCompleteness: offering.dataCompleteness,
    context: {
      schoolSlug: offering.schoolSlug,
      schoolShortName:
        schoolLookup.get(offering.schoolSlug)?.shortName ?? offering.schoolSlug,
      contextLabel: `Top pick ${offering.professorName}`,
      searchScope: "course" as const,
    },
  }));

  const professorDirectory = [...(await getProfessorDirectoryRows())]
    .filter((row) => !schoolSlug || row.schoolSlug === schoolSlug);

  const professorHits = professorDirectory.map((professor) => {
    const dataCompleteness: DataCompleteness = professor.hasInstitutionalStats
      ? "institutional_partial"
      : professor.hasRmp
        ? "rmp_only"
        : "directory_only";

    return {
      type: "professor" as const,
      id: professor.id,
      label: professor.professorName,
      school: schoolLookup.get(professor.schoolSlug)?.shortName ?? professor.schoolSlug,
      slug: professor.professorSlug,
      href: `/schools/${professor.schoolSlug}/professors/${professor.professorSlug}`,
      coverageTier: professor.coverageTier,
      highlight:
        professor.courseCodes.length > 0
          ? `${professor.courseCodes.slice(0, 2).join(" / ")}${professor.courseCodes.length > 2 ? " +" : ""}`
          : professor.summary,
      secondaryMetrics: [
        professor.classifyScore == null
          ? "Classify unavailable"
          : `Classify ${Math.round(professor.classifyScore)}`,
        professor.expectedGpa == null
          ? professor.hasRmp
            ? "RMP-backed profile"
            : "Stats expanding"
          : `Expected GPA ${professor.expectedGpa.toFixed(2)}`,
      ],
      freshness: professor.evidenceFreshness,
      sourceLabels: professor.sourceKinds,
      dataCompleteness,
      context: {
        schoolSlug: professor.schoolSlug,
        schoolShortName:
          schoolLookup.get(professor.schoolSlug)?.shortName ?? professor.schoolSlug,
        contextLabel:
          professor.courseCodes.length > 0
            ? `${professor.courseCodes.slice(0, 2).join(", ")}`
            : professor.departments[0] ?? "Instructor directory",
        searchScope: "professor_course" as const,
      },
    };
  });

  return [...courseHits, ...professorHits];
}

/** One hit per professor when browsing (empty query); avoids filling the cap with the same person across courses. */
function dedupeProfessorHitsForBrowse(
  hits: SearchHit[],
  offeringLookup: Map<string, ProfessorCourseSummary>,
): SearchHit[] {
  const nonProfessors = hits.filter((h) => h.type !== "professor");
  const professors = hits.filter((h) => h.type === "professor");
  const rankHit = (hit: SearchHit) => {
    const o = offeringLookup.get(hit.id);
    const score = o?.classifyScore ?? -1;
    const n = o?.sampleSize ?? 0;
    return score * 1_000_000 + n;
  };
  const bestByKey = new Map<string, SearchHit>();
  for (const hit of professors) {
    const key = `${hit.context.schoolSlug}:${hit.slug}`;
    const prev = bestByKey.get(key);
    if (!prev || rankHit(hit) > rankHit(prev)) {
      bestByKey.set(key, hit);
    }
  }
  return [...nonProfessors, ...bestByKey.values()];
}

async function collectSchoolOnlySortedSearchRows(
  query: string,
  options: SearchDirectoryOptions,
): Promise<{ rows: ScoredSearchRow[]; schoolsWithCatalogRows: Set<string> }> {
  const { schoolSlug } = options;
  const surface = options.surface ?? "page";
  const [allSchools, catalogSchools, catalogOfferings] = await Promise.all([
    getDirectorySchools(),
    getCatalogSchools(),
    getCatalogOfferings(),
  ]);
  const schoolsWithCatalogRows = new Set(catalogOfferings.map((item) => item.schoolSlug));
  const directorySchoolLookup = new Map(allSchools.map((school) => [school.slug, school]));
  const emptyOfferingLookup = new Map<string, ProfessorCourseSummary>();
  const emptyCourseLookup = new Map<string, ProfessorCourseSummary>();
  const emptyProfessorLookup = new Map<string, ProfessorDirectoryRow>();

  const schoolHits = buildSchoolSearchHits(allSchools, catalogSchools).filter(
    (hit) => !schoolSlug || hit.slug === schoolSlug,
  );
  const hits = schoolHits;

  const queryLooksSpecific =
    /\d/.test(query) || query.trim().length >= 4 || /\s/.test(query.trim());

  const rows = hits
    .map((hit): ScoredSearchRow => {
      const school = directorySchoolLookup.get(hit.slug);

      const aliasList = [
        ...(school?.aliases ?? []),
        hit.school,
        hit.highlight,
        hit.context.contextLabel,
      ];

      const textScore =
        scoreMatch(query, `${hit.label} ${hit.school} ${hit.highlight}`, aliasList) +
        schoolMatchBoost(query, hit, school);

      if (query.trim() && textScore < minimumSchoolTextScore(query, surface)) {
        return { hit, score: 0 };
      }

      return {
        hit,
        score:
          textScore +
          qualityBoost(hit, emptyOfferingLookup, emptyCourseLookup, emptyProfessorLookup),
      };
    })
    .filter((item) => item.score > 0);

  const dedupedRows = applyComboboxSchoolIntentFilter(
    dedupeSchoolRows(rows),
    query,
    surface,
  ).sort((left, right) => {
    const order = { school: 0, course: 1, professor: 2 };
    if (!queryLooksSpecific && order[left.hit.type] !== order[right.hit.type]) {
      return order[left.hit.type] - order[right.hit.type];
    }

    const bothProfessor =
      left.hit.type === "professor" && right.hit.type === "professor";
    const browseAlphaProf = bothProfessor && !query.trim();
    const cmpLast = (a: ScoredSearchRow, b: ScoredSearchRow) => {
      const c = professorLastNameSortKey(a.hit.label).localeCompare(
        professorLastNameSortKey(b.hit.label),
        undefined,
        { sensitivity: "base" },
      );
      if (c !== 0) return c;
      return a.hit.label.localeCompare(b.hit.label, undefined, { sensitivity: "base" });
    };

    if (browseAlphaProf) {
      return cmpLast(left, right);
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (bothProfessor) {
      return cmpLast(left, right);
    }

    if (order[left.hit.type] !== order[right.hit.type]) {
      return order[left.hit.type] - order[right.hit.type];
    }

    return left.hit.label.localeCompare(right.hit.label, undefined, { sensitivity: "base" });
  });

  return { rows: dedupedRows, schoolsWithCatalogRows };
}

async function collectSortedSearchRows(
  query: string,
  options: SearchDirectoryOptions,
): Promise<{ rows: ScoredSearchRow[]; schoolsWithCatalogRows: Set<string> }> {
  const { schoolSlug, type = "all" } = options;
  const surface = options.surface ?? "page";
  const trimmedQuery = query.trim();

  if (type === "school") {
    return collectSchoolOnlySortedSearchRows(query, options);
  }

  const broadSchoolOnlyQuery =
    !schoolSlug &&
    type === "all" &&
    trimmedQuery.length > 0 &&
    trimmedQuery.length <= 2 &&
    !/\d/.test(trimmedQuery) &&
    !/\s/.test(trimmedQuery);
  const [allSchools, catalogSchools, catalogOfferings] = await Promise.all([
    getDirectorySchools(),
    getCatalogSchools(),
    getCatalogOfferings(),
  ]);
  const professorDirectory = await getProfessorDirectoryRows();
  const schoolLookup = new Map(catalogSchools.map((school) => [school.slug, school]));
  const directorySchoolLookup = new Map(allSchools.map((school) => [school.slug, school]));
  const offeringLookup = new Map(catalogOfferings.map((item) => [item.id, item]));
  const courseLookup = new Map(
    catalogOfferings.map((item) => [`${item.schoolSlug}:${item.courseSlug}`, item]),
  );
  const professorLookup = new Map(
    professorDirectory.map((item) => [item.id, item]),
  );
  const schoolsWithCatalogRows = new Set(catalogOfferings.map((item) => item.schoolSlug));
  const schoolHits = buildSchoolSearchHits(allSchools, catalogSchools).filter(
    (hit) => !schoolSlug || hit.slug === schoolSlug,
  );
  let catalogHits = broadSchoolOnlyQuery
    ? []
    : (await buildCatalogSearchHits(schoolSlug)).filter(
        (hit) => type === "all" || hit.type === type,
      );
  if (!query.trim() && (type === "professor" || type === "all")) {
    catalogHits = dedupeProfessorHitsForBrowse(catalogHits, offeringLookup);
  }
  const hits = [
    ...(type === "all" || type === "school" ? schoolHits : []),
    ...(type === "all" || type === "course" || type === "professor" ? catalogHits : []),
  ];

  const queryLooksSpecific =
    /\d/.test(query) || query.trim().length >= 4 || /\s/.test(query.trim());

  const rows = hits
    .map((hit): ScoredSearchRow => {
      const school =
        hit.type === "school"
          ? directorySchoolLookup.get(hit.slug)
          : schoolLookup.get(hit.context.schoolSlug);

      const aliasList = [
        ...(school?.aliases ?? []),
        hit.school,
        hit.highlight,
        hit.context.contextLabel,
      ];

      if (hit.type === "school") {
        const textScore =
          scoreMatch(query, `${hit.label} ${hit.school} ${hit.highlight}`, aliasList) +
          schoolMatchBoost(query, hit, school);

        if (query.trim() && textScore < minimumSchoolTextScore(query, surface)) {
          return { hit, score: 0 };
        }

        return {
          hit,
          score: textScore + qualityBoost(hit, offeringLookup, courseLookup, professorLookup),
        };
      }

      const offering =
        hit.type === "course"
          ? courseLookup.get(hit.id)
          : offeringLookup.get(hit.id);
      if (!offering && hit.type === "professor") {
        const textScore = scoreMatch(
          query,
          `${hit.label} ${hit.highlight} ${hit.context.contextLabel}`,
          aliasList,
        );
        if (
          query.trim() &&
          textScore < minimumCatalogTextScore(query, hit.type, Boolean(schoolSlug))
        ) {
          return { hit, score: 0 };
        }

        return {
          hit,
          score: textScore + qualityBoost(hit, offeringLookup, courseLookup, professorLookup),
        };
      }

      if (!offering) {
        return { hit, score: 0 };
      }

      const ctx: CatalogHitSearchContext =
        hit.type === "course"
          ? { type: "course", offering, courseSlug: hit.slug }
          : { type: "professor", offering };

      const parts = computeCatalogSearchScoreParts(query, ctx, aliasList, offering);
      const textScore = parts.base + parts.courseBoost + parts.fuzzyBonus;

      if (
        query.trim() &&
        textScore < minimumCatalogTextScore(query, hit.type, Boolean(schoolSlug))
      ) {
        return { hit, score: 0, parts, offering };
      }

      return {
        hit,
        parts,
        offering,
        score: textScore + qualityBoost(hit, offeringLookup, courseLookup, professorLookup),
      };
    })
    .filter((item) => item.score > 0);

  const dedupedRows = applyComboboxSchoolIntentFilter(
    dedupeSchoolRows(rows),
    query,
    surface,
  )
    .sort((left, right) => {
      const order = { school: 0, course: 1, professor: 2 };
      if (!queryLooksSpecific && order[left.hit.type] !== order[right.hit.type]) {
        return order[left.hit.type] - order[right.hit.type];
      }

      const bothProfessor =
        left.hit.type === "professor" && right.hit.type === "professor";
      const browseAlphaProf = bothProfessor && !query.trim();
      const cmpLast = (a: ScoredSearchRow, b: ScoredSearchRow) => {
        const c = professorLastNameSortKey(a.hit.label).localeCompare(
          professorLastNameSortKey(b.hit.label),
          undefined,
          { sensitivity: "base" },
        );
        if (c !== 0) return c;
        return a.hit.label.localeCompare(b.hit.label, undefined, { sensitivity: "base" });
      };

      if (browseAlphaProf) {
        return cmpLast(left, right);
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (bothProfessor) {
        return cmpLast(left, right);
      }

      if (order[left.hit.type] !== order[right.hit.type]) {
        return order[left.hit.type] - order[right.hit.type];
      }

      return left.hit.label.localeCompare(right.hit.label, undefined, { sensitivity: "base" });
    });

  return { rows: dedupedRows, schoolsWithCatalogRows };
}

export async function searchDirectoryWithTotal(
  query: string,
  options: SearchDirectoryOptions = {},
): Promise<{ results: SearchHit[]; total: number }> {
  "use cache";

  applyCacheLife("minutes");
  const limit = options.limit ?? 12;
  const offset = options.offset ?? 0;
  const { rows, schoolsWithCatalogRows } = await collectSortedSearchRows(query, options);
  const total = rows.length;
  const paged = rows.slice(offset, offset + limit);
  const results = paged.map((row) =>
    finalizeSearchHit(row.hit, schoolsWithCatalogRows, row, query),
  );
  return { results, total };
}

export async function searchDirectory(
  query: string,
  options: SearchDirectoryOptions = {},
): Promise<SearchHit[]> {
  const { results } = await searchDirectoryWithTotal(query, options);
  return results;
}

export async function getSuggestedHits(options: SearchDirectoryOptions = {}) {
  "use cache";

  applyCacheLife("minutes");
  return searchDirectory("", { limit: 8, ...options });
}

export async function getSchoolHub(slug: string): Promise<
  | {
      school: School;
      offerings: ProfessorCourseSummary[];
      courses: CourseGroup[];
      trending: ProfessorCourseSummary[];
      departments: DepartmentAggregate[];
      hiddenGems: ProfessorCourseSummary[];
    }
  | undefined
> {
  "use cache";

  applyCacheLife("minutes");
  const [school, catalogSchool] = await Promise.all([
    getDirectorySchoolBySlug(slug),
    getCatalogSchoolBySlug(slug),
  ]);
  if (!school) return undefined;

  if (!catalogSchool) {
    return {
      school,
      offerings: [],
      courses: [],
      trending: [],
      departments: [],
      hiddenGems: [],
    };
  }

  const [schoolOfferings, spotlight, hiddenGems] = await Promise.all([
    getCatalogOfferingsForSchool(slug),
    getSchoolTrendSpotlight(slug),
    getHiddenGemsForSchool(slug),
  ]);

  return {
    school,
    offerings: schoolOfferings,
    courses: spotlight?.courses ?? [],
    trending: spotlight?.trending ?? [],
    departments: spotlight?.departments ?? [],
    hiddenGems,
  };
}
