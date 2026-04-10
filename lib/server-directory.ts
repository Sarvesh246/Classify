import "server-only";

import {
  getCatalogOfferingsForSearch,
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
  fuzzyTokenBonus,
  scoreMatch,
  type CatalogHitSearchContext,
} from "@/lib/search-scoring";
import { SMALL_SAMPLE_THRESHOLD } from "@/lib/data-trust";
import { professorLastNameSortKey } from "@/lib/professor-sort";
import { loadScorecardDirectorySchools } from "@/lib/scorecard-directory";
import {
  buildSchoolSearchTerms,
  buildSchoolSearchText,
  normalizeSchoolSearchText,
  prefilterSchoolsByTextQuery,
} from "@/lib/school-search-prefilter";
import { applyCacheLifeSearch } from "@/lib/cache-utils";

function patchSchoolForPublishedOfferings(
  school: School,
  offerings: ProfessorCourseSummary[],
): School {
  if (!offerings.length) {
    return school;
  }

  const currentProfile = school.supportProfile;
  if (currentProfile?.plannerReadiness && currentProfile.plannerReadiness !== "directory_ready") {
    return school;
  }

  const hasOfficialGrades = offerings.some(
    (item) => item.expectedGpa != null || item.aRate != null,
  );
  const hasRmp = offerings.some(
    (item) =>
      item.rmpRating != null ||
      item.rmpDifficulty != null ||
      item.sourceLabels.some((label) => /rate my professors|rmp/i.test(label)),
  );

  return {
    ...school,
    coverageTier:
      school.coverageTier === "rmp_only"
        ? "rmp_only"
        : hasOfficialGrades
          ? "institutional_plus_rmp"
          : "rmp_only",
    descriptor: hasOfficialGrades
      ? "Published course and instructor data with evidence-backed ranking signals."
      : "Published course and instructor data with a live planning workflow.",
    sourceStatus: {
      ...school.sourceStatus,
      note: hasOfficialGrades
        ? "Evidence-backed course and instructor rows are already live for this school."
        : "Course and instructor rows are already live for this school.",
    },
    supportProfile: {
      plannerReadiness: "catalog_ready",
      hasCatalog: true,
      hasSections: currentProfile?.hasSections ?? false,
      hasInstructorDirectory:
        currentProfile?.hasInstructorDirectory ?? offerings.length > 0,
      professorCoverageLevel:
        currentProfile?.professorCoverageLevel === "directory_only"
          ? "instructor_directory_ready"
          : (currentProfile?.professorCoverageLevel ?? "instructor_directory_ready"),
      hasPlanner: true,
      hasOfficialGrades,
      hasRmp,
      hasCommunityEvidence: currentProfile?.hasCommunityEvidence ?? false,
      evidenceFreshness: currentProfile?.evidenceFreshness ?? school.sourceStatus.freshness,
      sourceAvailability: [
        "catalog",
        ...(hasOfficialGrades ? (["official_grades"] as const) : []),
        ...(hasRmp ? (["rmp"] as const) : []),
      ],
      catalogCompletenessPct: 100,
      sectionCompletenessPct: currentProfile?.sectionCompletenessPct ?? 0,
      meetingTimeCompletenessPct: currentProfile?.meetingTimeCompletenessPct ?? 0,
      evidenceCompletenessPct:
        currentProfile?.evidenceCompletenessPct ??
        (offerings.filter(
          (item) =>
            item.expectedGpa != null ||
            item.aRate != null ||
            item.rmpRating != null ||
            item.rmpDifficulty != null,
        ).length /
          Math.max(offerings.length, 1)) *
          100,
      readinessReason:
        "Courses and instructors are published, but section timing is still incomplete.",
    },
  };
}

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

const SEARCH_DIRECTORY_CACHE_TTL_MS = 120_000;

let directorySchoolsPromise: Promise<School[]> | null = null;
let catalogSearchIndexPromise: Promise<{
  catalogSchools: School[];
  catalogOfferings: ProfessorCourseSummary[];
  professorDirectory: ProfessorDirectoryRow[];
  schoolLookup: Map<string, School>;
  offeringLookup: Map<string, ProfessorCourseSummary>;
  courseLookup: Map<string, ProfessorCourseSummary>;
  professorLookup: Map<string, ProfessorDirectoryRow>;
  schoolsWithCatalogRows: Set<string>;
  catalogHits: SearchHit[];
  catalogHitSearchText: Map<string, string>;
}> | null = null;
const searchDirectoryResultCache = new Map<
  string,
  {
    expiresAt: number;
    value: { results: SearchHit[]; total: number };
  }
>();
const inflightSearchDirectoryRequests = new Map<
  string,
  Promise<{ results: SearchHit[]; total: number }>
>();

function buildSearchDirectoryCacheKey(query: string, options: SearchDirectoryOptions) {
  return JSON.stringify([
    query,
    options.limit ?? 12,
    options.offset ?? 0,
    options.type ?? "all",
    options.schoolSlug ?? "",
    options.surface ?? "page",
  ]);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function prefilterCatalogHitsByQuery(
  hits: SearchHit[],
  searchTextById: Map<string, string>,
  query: string,
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return hits;
  }

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const strongTokens = tokens.filter((token) => token.length >= 2);
  if (!strongTokens.length) {
    return hits;
  }

  const ranked: Array<{ hit: SearchHit; quickScore: number }> = [];
  for (const hit of hits) {
    const haystack = searchTextById.get(hit.id) ?? "";
    let matched = 0;
    let starts = 0;
    for (const token of strongTokens) {
      if (haystack.includes(token)) {
        matched += 1;
      }
      if (
        haystack.startsWith(token) ||
        haystack.includes(` ${token}`) ||
        hit.label.toLowerCase().startsWith(token)
      ) {
        starts += 1;
      }
    }
    if (!matched) {
      continue;
    }
    ranked.push({
      hit,
      quickScore: matched * 100 + starts * 10 - Math.max(strongTokens.length - matched, 0) * 15,
    });
  }

  return ranked
    .sort((left, right) => right.quickScore - left.quickScore)
    .slice(0, 4000)
    .map((item) => item.hit);
}

export async function getDirectorySchools() {
  if (!directorySchoolsPromise) {
    directorySchoolsPromise = (async () => {
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
    })();
  }

  return directorySchoolsPromise;
}

export async function getDirectorySchoolBySlug(slug: string) {
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

  const normalizedQuery = normalizeSchoolSearchText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const canonicalLabel = normalizeSchoolSearchText(hit.label);
  const aliases = (school ? buildSchoolSearchTerms(school) : school?.aliases ?? [])
    .map((value) => normalizeSchoolSearchText(value))
    .filter((value) => value !== canonicalLabel);

  if (canonicalLabel === normalizedQuery) {
    return 72;
  }

  if (aliases.some((value) => value === normalizedQuery)) {
    return 64;
  }

  if (canonicalLabel.startsWith(normalizedQuery)) {
    return 42;
  }

  if (aliases.some((value) => value.startsWith(normalizedQuery))) {
    return 24;
  }

  return 0;
}

function scoreSchoolHitMatch(query: string, hit: SearchHit, school: School | undefined) {
  const normalizedQuery = normalizeSchoolSearchText(query);
  if (!normalizedQuery) {
    return 1;
  }

  const schoolSearchText = school
    ? buildSchoolSearchText(school)
    : normalizeSchoolSearchText(`${hit.label} ${hit.school} ${hit.highlight}`);
  const aliasList = [
    ...(school?.aliases ?? []),
    hit.school,
    hit.highlight,
    hit.context.contextLabel,
  ].map((value) => normalizeSchoolSearchText(value));
  const fuzzy = fuzzyTokenBonus(normalizedQuery, schoolSearchText);

  return (
    scoreMatch(normalizedQuery, schoolSearchText, aliasList) +
    schoolMatchBoost(normalizedQuery, hit, school) +
    fuzzy.bonus
  );
}

function estimateSchoolsWithCatalogRows(catalogSchools: School[]) {
  return new Set(
    catalogSchools
      .filter(
        (school) =>
          school.supportProfile?.hasCatalog ||
          school.supportProfile?.plannerReadiness === "catalog_ready" ||
          school.supportProfile?.plannerReadiness === "schedule_ready" ||
          school.supportProfile?.plannerReadiness === "evidence_ready",
      )
      .map((school) => school.slug),
  );
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

function buildCatalogSearchHitsFromData(
  catalogSchools: School[],
  catalogOfferings: ProfessorCourseSummary[],
  professorDirectoryRows: ProfessorDirectoryRow[],
  schoolSlug?: string,
): SearchHit[] {
  const schoolLookup = new Map(catalogSchools.map((school) => [school.slug, school]));
  const offerings = catalogOfferings.filter(
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

  const professorDirectory = [...professorDirectoryRows]
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

async function buildCatalogSearchHits(schoolSlug?: string): Promise<SearchHit[]> {
  const [catalogSchools, catalogOfferings, professorDirectoryRows] = await Promise.all([
    getCatalogSchools(),
    getCatalogOfferingsForSearch(),
    getProfessorDirectoryRows(),
  ]);
  return buildCatalogSearchHitsFromData(
    catalogSchools,
    catalogOfferings,
    professorDirectoryRows,
    schoolSlug,
  );
}

async function getCatalogSearchIndex() {
  if (!catalogSearchIndexPromise) {
    catalogSearchIndexPromise = (async () => {
      const [catalogSchools, catalogOfferings, professorDirectory] = await Promise.all([
        getCatalogSchools(),
        getCatalogOfferingsForSearch(),
        getProfessorDirectoryRows(),
      ]);
      const schoolLookup = new Map(catalogSchools.map((school) => [school.slug, school]));
      const offeringLookup = new Map(catalogOfferings.map((item) => [item.id, item]));
      const courseLookup = new Map(
        catalogOfferings.map((item) => [`${item.schoolSlug}:${item.courseSlug}`, item]),
      );
      const professorLookup = new Map(professorDirectory.map((item) => [item.id, item]));
      const schoolsWithCatalogRows = new Set(catalogOfferings.map((item) => item.schoolSlug));
      const catalogHits = buildCatalogSearchHitsFromData(
        catalogSchools,
        catalogOfferings,
        professorDirectory,
      );
      const catalogHitSearchText = new Map(
        catalogHits.map((hit) => [
          hit.id,
          normalizeSearchText(
            `${hit.label} ${hit.school} ${hit.highlight} ${hit.context.contextLabel}`,
          ),
        ]),
      );

      return {
        catalogSchools,
        catalogOfferings,
        professorDirectory,
        schoolLookup,
        offeringLookup,
        courseLookup,
        professorLookup,
        schoolsWithCatalogRows,
        catalogHits,
        catalogHitSearchText,
      };
    })();
  }

  return catalogSearchIndexPromise;
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
  const [allSchoolsMerged, catalogSchools] = await Promise.all([
    getDirectorySchools(),
    getCatalogSchools(),
  ]);
  const schoolsWithCatalogRows = estimateSchoolsWithCatalogRows(catalogSchools);
  const allSchools = prefilterSchoolsByTextQuery(allSchoolsMerged, query);
  const directorySchoolLookup = new Map(allSchoolsMerged.map((school) => [school.slug, school]));
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
      const textScore = scoreSchoolHitMatch(query, hit, school);

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

function looksLikeSchoolIntentQuery(query: string) {
  const normalizedQuery = normalizeSchoolSearchText(query);
  if (!normalizedQuery || /\d/.test(normalizedQuery)) {
    return false;
  }

  return (
    /&/.test(query) ||
    /\ba and m\b/.test(normalizedQuery) ||
    /\b(?:university|college|school|institute|academy|community|district|system|polytechnic|state|campus)\b/.test(
      normalizedQuery,
    )
  );
}

function shouldUseFastSchoolRows(rows: ScoredSearchRow[], query: string) {
  const normalizedQuery = normalizeSchoolSearchText(query);
  if (!normalizedQuery || !rows.length || /\d/.test(normalizedQuery)) {
    return false;
  }

  const topScore = rows[0]?.score ?? 0;
  const acronymQuery = !/\s/.test(normalizedQuery) && normalizedQuery.length <= 4;
  const exactishSchoolHit = topScore >= 156;

  return (
    exactishSchoolHit ||
    (looksLikeSchoolIntentQuery(query) && topScore >= 48) ||
    (acronymQuery && topScore >= 100)
  );
}

function collectFastSchoolSearchRows(
  query: string,
  options: SearchDirectoryOptions,
): { rows: ScoredSearchRow[]; schoolsWithCatalogRows: Set<string> } {
  const { schoolSlug } = options;
  const surface = options.surface ?? "page";
  const allSchools = prefilterSchoolsByTextQuery(loadScorecardDirectorySchools(), query);
  const directorySchoolLookup = new Map(allSchools.map((school) => [school.slug, school]));
  const schoolHits = buildSchoolSearchHits(allSchools, []).filter(
    (hit) => !schoolSlug || hit.slug === schoolSlug,
  );

  const rows = dedupeSchoolRows(
    schoolHits
      .map((hit): ScoredSearchRow => {
        const school = directorySchoolLookup.get(hit.slug);
        const textScore = scoreSchoolHitMatch(query, hit, school);

        if (query.trim() && textScore < minimumSchoolTextScore(query, surface)) {
          return { hit, score: 0 };
        }

        return { hit, score: textScore };
      })
      .filter((item) => item.score > 0),
  ).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.hit.label.localeCompare(right.hit.label, undefined, { sensitivity: "base" });
  });

  return { rows, schoolsWithCatalogRows: new Set<string>() };
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

  if (surface === "combobox" && type === "all" && !schoolSlug && trimmedQuery) {
    const fastSchoolRows = collectFastSchoolSearchRows(query, options);
    if (shouldUseFastSchoolRows(fastSchoolRows.rows, query)) {
      return fastSchoolRows;
    }
  }

  const maxBroadChars = surface === "combobox" ? 3 : 2;
  const broadSchoolOnlyQuery =
    !schoolSlug &&
    type === "all" &&
    trimmedQuery.length > 0 &&
    trimmedQuery.length <= maxBroadChars &&
    !/\d/.test(trimmedQuery) &&
    !/\s/.test(trimmedQuery);
  const [allSchoolsMerged, searchIndex] =
    await Promise.all([
      getDirectorySchools(),
      getCatalogSearchIndex(),
    ]);
  const {
    catalogSchools,
    catalogOfferings,
    professorDirectory,
    schoolLookup,
    offeringLookup,
    courseLookup,
    professorLookup,
    schoolsWithCatalogRows,
    catalogHits: allCatalogHits,
    catalogHitSearchText,
  } = searchIndex;
  const allSchools = prefilterSchoolsByTextQuery(allSchoolsMerged, query);
  const directorySchoolLookup = new Map(allSchoolsMerged.map((school) => [school.slug, school]));
  const schoolHits = buildSchoolSearchHits(allSchools, catalogSchools).filter(
    (hit) => !schoolSlug || hit.slug === schoolSlug,
  );
  let catalogHits = broadSchoolOnlyQuery
    ? []
    : prefilterCatalogHitsByQuery(
        allCatalogHits.filter(
          (hit) =>
            (!schoolSlug || hit.context.schoolSlug === schoolSlug) &&
            (type === "all" || hit.type === type),
        ),
        catalogHitSearchText,
        query,
      );
  if (!query.trim() && (type === "professor" || type === "all")) {
    catalogHits = dedupeProfessorHitsForBrowse(catalogHits, offeringLookup);
  }
  const hits = [
    ...(type === "all" ? schoolHits : []),
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
        const textScore = scoreSchoolHitMatch(query, hit, school);

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

  applyCacheLifeSearch();
  const cacheKey = buildSearchDirectoryCacheKey(query, options);
  const now = Date.now();
  const cached = searchDirectoryResultCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const inflight = inflightSearchDirectoryRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const limit = options.limit ?? 12;
  const offset = options.offset ?? 0;
  const work = collectSortedSearchRows(query, options).then(({ rows, schoolsWithCatalogRows }) => {
    const total = rows.length;
    const paged = rows.slice(offset, offset + limit);
    const results = paged.map((row) =>
      finalizeSearchHit(row.hit, schoolsWithCatalogRows, row, query),
    );
    const value = { results, total };
    searchDirectoryResultCache.set(cacheKey, {
      expiresAt: Date.now() + SEARCH_DIRECTORY_CACHE_TTL_MS,
      value,
    });
    inflightSearchDirectoryRequests.delete(cacheKey);
    return value;
  }).catch((error) => {
    inflightSearchDirectoryRequests.delete(cacheKey);
    throw error;
  });

  inflightSearchDirectoryRequests.set(cacheKey, work);
  return work;
}

export async function searchDirectory(
  query: string,
  options: SearchDirectoryOptions = {},
): Promise<SearchHit[]> {
  const { results } = await searchDirectoryWithTotal(query, options);
  return results;
}

export async function getSuggestedHits(options: SearchDirectoryOptions = {}) {
  if (
    (options.surface ?? "page") === "combobox" &&
    !options.schoolSlug &&
    (options.type == null || options.type === "all")
  ) {
    const limit = options.limit ?? 8;
    const { rows, schoolsWithCatalogRows } = collectFastSchoolSearchRows("", {
      ...options,
      limit,
      type: "all",
    });
    return rows
      .slice(0, limit)
      .map((row) => finalizeSearchHit(row.hit, schoolsWithCatalogRows, row, ""));
  }

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
  const [school, catalogSchool] = await Promise.all([
    getDirectorySchoolBySlug(slug),
    getCatalogSchoolBySlug(slug),
  ]);
  if (!school) return undefined;

  if (!catalogSchool) {
    const schoolOfferings = await getCatalogOfferingsForSchool(slug);
    if (!schoolOfferings.length) {
      return {
        school,
        offerings: [],
        courses: [],
        trending: [],
        departments: [],
        hiddenGems: [],
      };
    }
  }

  const [schoolOfferings, spotlight, hiddenGems] = await Promise.all([
    getCatalogOfferingsForSchool(slug),
    getSchoolTrendSpotlight(slug),
    getHiddenGemsForSchool(slug),
  ]);
  const displaySchool = patchSchoolForPublishedOfferings(catalogSchool ?? school, schoolOfferings);

  return {
    school: displaySchool,
    offerings: schoolOfferings,
    courses: spotlight?.courses ?? [],
    trending: spotlight?.trending ?? [],
    departments: spotlight?.departments ?? [],
    hiddenGems,
  };
}
