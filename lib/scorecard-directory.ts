import fs from "node:fs";
import path from "node:path";

import type { School } from "@/lib/types";
import {
  buildSchoolAliases,
  deriveSchoolShortName,
  normalizeSchoolText,
} from "@/lib/school-display";

export const SCORECARD_DIRECTORY_JSON_PATH = path.join(
  process.cwd(),
  "etl",
  "output",
  "college_scorecard_schools.json",
);

/** Raw row shape written by `etl.scripts.import_school_directory`. */
export type ScorecardDirectoryRecord = {
  school_id: number;
  slug: string;
  name: string;
  alias?: string | null;
  city: string;
  state: string;
  website?: string | null;
  control?: string | null;
  student_size?: number | null;
};

export const SCORECARD_SCHOOL_SLUG_CANONICAL: Record<string, string> = {
  "the-university-of-texas-at-austin": "ut-austin",
  "texas-a-m-university-college-station": "texas-am",
  "university-of-california-berkeley": "uc-berkeley",
  "university-of-wisconsin-madison": "uw-madison",
  "the-ohio-state-university-main-campus": "ohio-state",
  "university-of-north-carolina-at-chapel-hill": "unc-chapel-hill",
  "university-of-washington-seattle-campus": "university-of-washington",
  "university-of-illinois-urbana-champaign": "uiuc",
};

const SCORECARD_SCHOOL_ALIAS_EXTRAS: Record<string, string[]> = {
  "ut-austin": ["UT", "UT Austin", "University of Texas", "Texas Austin"],
  "texas-am": ["Texas A&M", "Texas A and M", "TAMU", "A&M", "Texas AM"],
  "uc-berkeley": ["UC Berkeley", "Berkeley", "Cal"],
  "uw-madison": ["UW-Madison", "UW Madison", "Wisconsin", "Madison"],
  "ohio-state": ["Ohio State", "OSU", "The Ohio State University"],
  "unc-chapel-hill": ["UNC", "UNC Chapel Hill", "Carolina"],
  "university-of-washington": ["UW", "University of Washington", "Washington Seattle"],
  uiuc: ["UIUC", "Illinois", "U of I", "University of Illinois"],
};

export function canonicalScorecardSchoolSlug(rawSlug: string): string {
  return SCORECARD_SCHOOL_SLUG_CANONICAL[rawSlug] ?? rawSlug;
}

function buildAliases(record: ScorecardDirectoryRecord, canonicalSlug: string) {
  return buildSchoolAliases(
    record.name,
    record.alias,
    SCORECARD_SCHOOL_ALIAS_EXTRAS[canonicalSlug] ?? [],
    deriveSchoolShortName(record.name, record.alias),
  );
}

function scorecardRecordToSchool(record: ScorecardDirectoryRecord): School {
  const canonicalSlug = canonicalScorecardSchoolSlug(record.slug);
  const shortName = deriveSchoolShortName(record.name, record.alias);

  return {
    id: `scorecard:${record.school_id}`,
    slug: canonicalSlug,
    name: normalizeSchoolText(record.name),
    shortName,
    city: normalizeSchoolText(record.city),
    state: normalizeSchoolText(record.state),
    kind: record.control?.includes("Private") ? "Private" : "Public",
    coverageTier: "rmp_only",
    aliases: buildAliases(record, canonicalSlug),
    directoryCount: 0,
    sourceStatus: {
      primary: "College Scorecard directory",
      fallback: "Rate My Professors",
      freshness: "Directory coverage active",
      note: "This school profile is live. Catalog, schedule, and evidence layers attach as local data is published.",
    },
    supportProfile: {
      plannerReadiness: "directory_ready",
      hasCatalog: false,
      hasSections: false,
      hasInstructorDirectory: false,
      hasPlanner: true,
      hasOfficialGrades: false,
      hasRmp: false,
      hasCommunityEvidence: false,
      evidenceFreshness: "Directory coverage active",
      sourceAvailability: [],
      catalogCompletenessPct: 0,
      sectionCompletenessPct: 0,
      meetingTimeCompletenessPct: 0,
      evidenceCompletenessPct: 0,
      readinessReason:
        "School directory is live, but local catalog and schedule data have not been published yet.",
    },
    descriptor:
      "Universal school profile with the same Classify planning workflow. Course and schedule depth expands as school data is published.",
    programs: [],
  };
}

let scorecardSchoolsCache: School[] | undefined;
let scorecardSchoolsMissingLogged = false;

/** Clears cached Scorecard directory load (e.g. after generating `college_scorecard_schools.json`). */
export function invalidateScorecardDirectoryCache() {
  scorecardSchoolsCache = undefined;
}

/**
 * Reads `etl/output/college_scorecard_schools.json` when present (same source as nationwide search).
 * Returns [] if missing; logs once per process at warn level.
 */
export function loadScorecardDirectorySchools(): School[] {
  if (scorecardSchoolsCache !== undefined) {
    return scorecardSchoolsCache;
  }

  if (!fs.existsSync(SCORECARD_DIRECTORY_JSON_PATH)) {
    if (!scorecardSchoolsMissingLogged) {
      scorecardSchoolsMissingLogged = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "directory_schools_missing",
          path: SCORECARD_DIRECTORY_JSON_PATH,
        }),
      );
    }
    scorecardSchoolsCache = [];
    return scorecardSchoolsCache;
  }

  try {
    const payload = JSON.parse(
      fs.readFileSync(SCORECARD_DIRECTORY_JSON_PATH, "utf8"),
    ) as ScorecardDirectoryRecord[];

    scorecardSchoolsCache = payload.map(scorecardRecordToSchool);
    return scorecardSchoolsCache;
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "directory_schools_read_failed",
        path: SCORECARD_DIRECTORY_JSON_PATH,
        error: String(err),
      }),
    );
    scorecardSchoolsCache = [];
    return scorecardSchoolsCache;
  }
}
