import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  getCatalogOfferings,
  getCatalogSchoolBySlug,
  getCatalogSchools,
  getCourseGroupsForSchool,
  getDepartmentAggregatesForSchool,
  getHiddenGemsForSchool,
  getSchoolTrendSpotlight,
} from "@/lib/catalog";
import type {
  ProfessorCourseSummary,
  SearchHit,
  SearchHitType,
  School,
} from "@/lib/types";

interface DirectorySchoolRecord {
  school_id: number;
  slug: string;
  name: string;
  alias?: string | null;
  city: string;
  state: string;
  website?: string | null;
  control?: string | null;
  student_size?: number | null;
}

interface SearchDirectoryOptions {
  limit?: number;
  type?: SearchHitType | "all";
  schoolSlug?: string;
}

const DIRECTORY_OUTPUT_PATH = path.join(
  process.cwd(),
  "etl",
  "output",
  "college_scorecard_schools.json",
);

const CANONICAL_SLUG_OVERRIDES: Record<string, string> = {
  "the-university-of-texas-at-austin": "ut-austin",
  "texas-a-m-university-college-station": "texas-am",
  "university-of-california-berkeley": "uc-berkeley",
  "university-of-wisconsin-madison": "uw-madison",
  "the-ohio-state-university-main-campus": "ohio-state",
  "university-of-north-carolina-at-chapel-hill": "unc-chapel-hill",
  "university-of-washington-seattle-campus": "university-of-washington",
  "university-of-illinois-urbana-champaign": "uiuc",
};

const ALIAS_OVERRIDES: Record<string, string[]> = {
  "ut-austin": ["UT", "UT Austin", "University of Texas", "Texas Austin"],
  "texas-am": ["Texas A&M", "Texas A and M", "TAMU", "A&M", "Texas AM"],
  "uc-berkeley": ["UC Berkeley", "Berkeley", "Cal"],
  "uw-madison": ["UW-Madison", "UW Madison", "Wisconsin", "Madison"],
  "ohio-state": ["Ohio State", "OSU", "The Ohio State University"],
  "unc-chapel-hill": ["UNC", "UNC Chapel Hill", "Carolina"],
  "university-of-washington": ["UW", "University of Washington", "Washington Seattle"],
  uiuc: ["UIUC", "Illinois", "U of I", "University of Illinois"],
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildAliases(record: DirectorySchoolRecord, canonicalSlug: string) {
  const aliases = new Set<string>();
  aliases.add(record.name);

  if (record.alias) {
    aliases.add(record.alias);
  }

  for (const alias of ALIAS_OVERRIDES[canonicalSlug] ?? []) {
    aliases.add(alias);
  }

  return [...aliases]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);
}

function buildImportedSchool(record: DirectorySchoolRecord): School {
  const canonicalSlug = CANONICAL_SLUG_OVERRIDES[record.slug] ?? record.slug;
  const shortName = normalizeWhitespace(record.alias || record.name);

  return {
    id: `scorecard:${record.school_id}`,
    slug: canonicalSlug,
    name: normalizeWhitespace(record.name),
    shortName,
    city: record.city,
    state: record.state,
    kind: record.control?.includes("Private") ? "Private" : "Public",
    coverageTier: "rmp_only",
    aliases: buildAliases(record, canonicalSlug),
    directoryCount: 0,
    sourceStatus: {
      primary: "College Scorecard directory",
      fallback: "Rate My Professors",
      freshness: "Directory sync ready",
      note: "This school is live in the nationwide directory. Native course-grade coverage appears once its institutional adapter is ingested.",
    },
    descriptor:
      "Nationwide school directory coverage with transparent fallback mode until course-level grade data is added.",
    programs: [],
  };
}

function loadImportedSchools(): School[] {
  if (!fs.existsSync(DIRECTORY_OUTPUT_PATH)) {
    return [];
  }

  try {
    const payload = JSON.parse(
      fs.readFileSync(DIRECTORY_OUTPUT_PATH, "utf8"),
    ) as DirectorySchoolRecord[];

    return payload.map(buildImportedSchool);
  } catch {
    return [];
  }
}

export function getDirectorySchools() {
  const merged = new Map<string, School>();

  for (const school of loadImportedSchools()) {
    merged.set(school.slug, school);
  }

  for (const school of getCatalogSchools()) {
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

function scoreMatch(query: string, target: string, aliases: string[] = []) {
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
) {
  const base = dataCompletenessBoost(hit) + recencyBoost(hit.freshness);

  if (hit.type === "professor") {
    const offering = offeringLookup.get(hit.id);
    if (!offering) {
      return base;
    }

    return (
      base +
      Math.min(offering.sampleSize / 18, 16) +
      Math.min(offering.matchConfidence / 12, 8)
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

  const aliases = [hit.label, ...(school?.aliases ?? [])].map((value) =>
    value.toLowerCase().trim(),
  );

  if (aliases.some((value) => value === normalizedQuery)) {
    return 48;
  }

  if (aliases.some((value) => value.startsWith(normalizedQuery))) {
    return 18;
  }

  return 0;
}

function buildSchoolSearchHits(allSchools: School[]): SearchHit[] {
  return allSchools.map((school) => ({
    type: "school",
    id: school.id,
    label: school.shortName,
    school: `${school.city}, ${school.state}`,
    slug: school.slug,
    href: `/schools/${school.slug}`,
    coverageTier: school.coverageTier,
    highlight: school.descriptor,
    secondaryMetrics: [
      school.sourceStatus.primary,
      school.sourceStatus.freshness,
      school.coverageTier === "rmp_only"
        ? "RMP fallback enabled"
        : `${school.directoryCount}+ searchable professors`,
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
  }));
}

function buildCatalogSearchHits(schoolSlug?: string): SearchHit[] {
  const schoolLookup = new Map(getCatalogSchools().map((school) => [school.slug, school]));
  const offerings = [...getCatalogOfferings()]
    .filter((item) => !schoolSlug || item.schoolSlug === schoolSlug)
    .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0));
  const courseByKey = new Map<string, ProfessorCourseSummary>();

  for (const offering of offerings) {
    const key = `${offering.schoolSlug}:${offering.courseSlug}`;
    if (!courseByKey.has(key)) {
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

  const professorHits = offerings.map((offering) => ({
    type: "professor" as const,
    id: offering.id,
    label: offering.professorName,
    school: schoolLookup.get(offering.schoolSlug)?.shortName ?? offering.schoolSlug,
    slug: offering.professorSlug,
    href: `/schools/${offering.schoolSlug}/professors/${offering.professorSlug}`,
    coverageTier: offering.coverageTier,
    highlight: `${offering.courseCode} - ${offering.courseName}`,
    secondaryMetrics: [
      offering.classifyScore == null
        ? "Classify unavailable"
        : `Classify ${Math.round(offering.classifyScore)}`,
      offering.expectedGpa == null
        ? "No GPA data yet"
        : `Expected GPA ${offering.expectedGpa.toFixed(2)}`,
    ],
    freshness: offering.freshness,
    sourceLabels: offering.sourceLabels,
    dataCompleteness: offering.dataCompleteness,
    context: {
      schoolSlug: offering.schoolSlug,
      schoolShortName:
        schoolLookup.get(offering.schoolSlug)?.shortName ?? offering.schoolSlug,
      contextLabel: `${offering.courseCode} - ${offering.courseName}`,
      searchScope: "professor_course" as const,
    },
  }));

  return [...courseHits, ...professorHits];
}

export async function searchDirectory(
  query: string,
  options: SearchDirectoryOptions = {},
) {
  const { limit = 12, schoolSlug, type = "all" } = options;
  const allSchools = getDirectorySchools();
  const catalogSchools = getCatalogSchools();
  const catalogOfferings = getCatalogOfferings();
  const schoolLookup = new Map(catalogSchools.map((school) => [school.slug, school]));
  const offeringLookup = new Map(catalogOfferings.map((item) => [item.id, item]));
  const courseLookup = new Map(
    catalogOfferings.map((item) => [`${item.schoolSlug}:${item.courseSlug}`, item]),
  );
  const hits = [
    ...(type === "all" || type === "school" ? buildSchoolSearchHits(allSchools) : []),
    ...(type === "all" || type === "course" || type === "professor"
      ? buildCatalogSearchHits(schoolSlug).filter(
          (hit) => type === "all" || hit.type === type,
        )
      : []),
  ];

  const queryLooksSpecific =
    /\d/.test(query) || query.trim().length >= 4 || /\s/.test(query.trim());

  return hits
    .map((hit) => {
      const school =
        hit.type === "school"
          ? allSchools.find((item) => item.slug === hit.slug)
          : schoolLookup.get(hit.context.schoolSlug);

      return {
        hit,
        score:
          scoreMatch(query, `${hit.label} ${hit.school} ${hit.highlight}`, [
            ...(school?.aliases ?? []),
            hit.school,
            hit.highlight,
            hit.context.contextLabel,
          ]) +
          qualityBoost(hit, offeringLookup, courseLookup) +
          schoolMatchBoost(query, hit, school),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      const order = { school: 0, course: 1, professor: 2 };
      if (!queryLooksSpecific && order[left.hit.type] !== order[right.hit.type]) {
        return order[left.hit.type] - order[right.hit.type];
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (order[left.hit.type] !== order[right.hit.type]) {
        return order[left.hit.type] - order[right.hit.type];
      }

      return left.hit.label.localeCompare(right.hit.label);
    })
    .slice(0, limit)
    .map((item) => item.hit);
}

export async function getSuggestedHits(options: SearchDirectoryOptions = {}) {
  return searchDirectory("", { limit: 8, ...options });
}

export async function getSchoolHub(slug: string) {
  const school = getDirectorySchools().find((item) => item.slug === slug);
  if (!school) return undefined;

  if (!getCatalogSchoolBySlug(slug)) {
    return {
      school,
      offerings: [],
      courses: [],
      trending: [],
      departments: [],
      hiddenGems: [],
    };
  }

  const schoolOfferings = getCatalogOfferings().filter((item) => item.schoolSlug === slug);
  return {
    school,
    offerings: schoolOfferings,
    courses: getCourseGroupsForSchool(slug),
    trending: getSchoolTrendSpotlight(slug)?.trending ?? [],
    departments: getDepartmentAggregatesForSchool(slug),
    hiddenGems: getHiddenGemsForSchool(slug),
  };
}
