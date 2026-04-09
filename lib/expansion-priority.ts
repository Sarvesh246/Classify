import fs from "node:fs";
import path from "node:path";

import type { PlannerReadiness, School, SchoolSupportProfile } from "@/lib/types";

/** Manifest cohort: institutional = seeded / registrar-grade path; rmp_national = RMP breadth until feeds land. */
export type ExpansionDataTier = "institutional" | "rmp_national";

export type ExpansionSchoolTarget = {
  slug: string;
  dataTier?: ExpansionDataTier;
  minOfferings?: number;
  minSectionCourses?: number;
  minMeetingTimePct?: number;
  notes?: string;
};

export type ExpansionPriorityManifest = {
  version: number;
  description?: string;
  schools: ExpansionSchoolTarget[];
};

let cachedManifest: ExpansionPriorityManifest | null = null;
let cachedPath: string | null = null;

function defaultManifestPath() {
  return path.join(process.cwd(), "data", "expansion-priority.json");
}

/** Committed Phase 3 expansion order and optional per-school targets. */
export function loadExpansionPriorityManifest(
  filePath: string = defaultManifestPath(),
): ExpansionPriorityManifest {
  if (cachedManifest && cachedPath === filePath) {
    return cachedManifest;
  }
  if (!fs.existsSync(filePath)) {
    cachedManifest = { version: 1, schools: [] };
    cachedPath = filePath;
    return cachedManifest;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as ExpansionPriorityManifest;
  if (!raw || !Array.isArray(raw.schools)) {
    cachedManifest = { version: raw?.version ?? 1, schools: [] };
  } else {
    cachedManifest = {
      version: raw.version ?? 1,
      description: raw.description,
      schools: raw.schools
        .map((row) => {
          const rawTier = (row as { dataTier?: unknown }).dataTier;
          const dataTier: ExpansionDataTier | undefined =
            rawTier === "institutional" || rawTier === "rmp_national" ? rawTier : undefined;
          return {
            slug: String((row as ExpansionSchoolTarget).slug ?? "").trim(),
            dataTier,
            minOfferings: (row as ExpansionSchoolTarget).minOfferings,
            minSectionCourses: (row as ExpansionSchoolTarget).minSectionCourses,
            minMeetingTimePct: (row as ExpansionSchoolTarget).minMeetingTimePct,
            notes: (row as ExpansionSchoolTarget).notes,
          };
        })
        .filter((row) => row.slug.length > 0),
    };
  }
  cachedPath = filePath;
  return cachedManifest;
}

export function getExpansionPriorityIndex(
  manifest: ExpansionPriorityManifest = loadExpansionPriorityManifest(),
): Map<string, number> {
  const map = new Map<string, number>();
  manifest.schools.forEach((row, idx) => {
    map.set(row.slug, idx);
  });
  return map;
}

export function getExpansionTargetForSlug(
  slug: string,
  manifest: ExpansionPriorityManifest = loadExpansionPriorityManifest(),
): ExpansionSchoolTarget | undefined {
  return manifest.schools.find((row) => row.slug === slug);
}

/**
 * Sort: manifest order first (unknown slugs last, alphabetical), then tie-break by short name.
 */
export function compareSchoolsByExpansionPriority(
  left: Pick<School, "slug" | "shortName">,
  right: Pick<School, "slug" | "shortName">,
  priorityIndex: Map<string, number> = getExpansionPriorityIndex(),
): number {
  const li = priorityIndex.has(left.slug) ? priorityIndex.get(left.slug)! : 10_000;
  const ri = priorityIndex.has(right.slug) ? priorityIndex.get(right.slug)! : 10_000;
  if (li !== ri) return li - ri;
  return left.shortName.localeCompare(right.shortName);
}

export type ExpansionReportRow = {
  priorityRank: number | null;
  slug: string;
  shortName: string;
  plannerReadiness: PlannerReadiness;
  catalogCompletenessPct: number;
  sectionCompletenessPct: number;
  meetingTimeCompletenessPct: number;
  evidenceCompletenessPct: number;
  offeringCount: number;
  distinctCourseSlugs: number;
  blockers: string[];
  targets?: ExpansionSchoolTarget;
};

function pushBlocker(
  blockers: string[],
  condition: boolean,
  message: string,
) {
  if (condition) blockers.push(message);
}

/** Build stakeholder report rows: manifest order first, then remaining planner-tier schools. */
export function buildExpansionReportRows(
  schools: School[],
  offerings: { schoolSlug: string; courseSlug: string }[],
  manifest: ExpansionPriorityManifest = loadExpansionPriorityManifest(),
): ExpansionReportRow[] {
  const bySlug = new Map(schools.map((s) => [s.slug, s]));
  const offeringCountBySchool = new Map<string, number>();
  const coursesBySchool = new Map<string, Set<string>>();

  for (const row of offerings) {
    offeringCountBySchool.set(row.schoolSlug, (offeringCountBySchool.get(row.schoolSlug) ?? 0) + 1);
    if (!coursesBySchool.has(row.schoolSlug)) {
      coursesBySchool.set(row.schoolSlug, new Set());
    }
    coursesBySchool.get(row.schoolSlug)!.add(row.courseSlug);
  }

  const buildRow = (school: School, rank: number | null): ExpansionReportRow => {
    const sp: SchoolSupportProfile | undefined = school.supportProfile;
    const target = getExpansionTargetForSlug(school.slug, manifest);
    const offeringCount = offeringCountBySchool.get(school.slug) ?? 0;
    const distinctCourseSlugs = coursesBySchool.get(school.slug)?.size ?? 0;
    const blockers: string[] = [];

    if (sp?.plannerReadiness === "directory_ready") {
      blockers.push("No merged catalog offerings yet");
    }
    pushBlocker(blockers, (sp?.sectionCompletenessPct ?? 0) < 50, "Section coverage below 50%");
    pushBlocker(blockers, (sp?.meetingTimeCompletenessPct ?? 0) < 40, "Meeting time coverage below 40%");
    pushBlocker(blockers, (sp?.evidenceCompletenessPct ?? 0) < 60, "Evidence completeness below 60% (not evidence_ready)");
    pushBlocker(blockers, !sp?.hasRmp, "No RMP-linked offering signals in snapshot");
    if (target?.minOfferings != null && offeringCount < target.minOfferings) {
      blockers.push(`Offerings ${offeringCount} < target ${target.minOfferings}`);
    }
    if (
      target?.minMeetingTimePct != null &&
      (sp?.meetingTimeCompletenessPct ?? 0) < target.minMeetingTimePct
    ) {
      blockers.push(
        `Meeting time ${sp?.meetingTimeCompletenessPct ?? 0}% < target ${target.minMeetingTimePct}%`,
      );
    }

    return {
      priorityRank: rank,
      slug: school.slug,
      shortName: school.shortName,
      plannerReadiness: sp?.plannerReadiness ?? "directory_ready",
      catalogCompletenessPct: sp?.catalogCompletenessPct ?? 0,
      sectionCompletenessPct: sp?.sectionCompletenessPct ?? 0,
      meetingTimeCompletenessPct: sp?.meetingTimeCompletenessPct ?? 0,
      evidenceCompletenessPct: sp?.evidenceCompletenessPct ?? 0,
      offeringCount,
      distinctCourseSlugs,
      blockers,
      targets: target,
    };
  };

  const manifestRows: ExpansionReportRow[] = [];
  manifest.schools.forEach((entry, idx) => {
    const school = bySlug.get(entry.slug);
    if (school) {
      manifestRows.push(buildRow(school, idx + 1));
    }
  });

  const inManifest = new Set(manifest.schools.map((s) => s.slug));
  const extra = schools
    .filter((s) => !inManifest.has(s.slug))
    .sort((a, b) => a.shortName.localeCompare(b.shortName))
    .map((school) => buildRow(school, null));

  return [...manifestRows, ...extra];
}

export type ExpansionPhase3AuditOptions = {
  /**
   * When true, manifest rows with `dataTier: institutional` must be at least
   * `schedule_ready` or `evidence_ready` (runbook §3 depth proxy — not RMP-only catalog breadth).
   * Default false so merging catalog + offerings passes; opt in when registrar sections/evidence are required.
   */
  institutionalRequiresScheduleOrEvidence?: boolean;
};

export type ExpansionPhase3AuditEntry = {
  priorityRank: number;
  slug: string;
  dataTier: ExpansionDataTier;
  ok: boolean;
  failures: string[];
  plannerReadiness: PlannerReadiness;
  offeringCount: number;
};

/**
 * Release gate: every school in `data/expansion-priority.json` must be present in the merged
 * published catalog with planner-tier depth appropriate to its `dataTier`.
 */
export function auditExpansionPhase3(
  schools: School[],
  offerings: { schoolSlug: string; courseSlug: string }[],
  manifest: ExpansionPriorityManifest = loadExpansionPriorityManifest(),
  options: ExpansionPhase3AuditOptions = {},
): ExpansionPhase3AuditEntry[] {
  const institutionalRequiresScheduleOrEvidence = options.institutionalRequiresScheduleOrEvidence ?? false;
  const bySlug = new Map(schools.map((s) => [s.slug, s]));
  const reportRows = buildExpansionReportRows(schools, offerings, manifest);
  const reportBySlug = new Map(reportRows.map((r) => [r.slug, r]));

  return manifest.schools.map((target, idx) => {
    const tier: ExpansionDataTier = target.dataTier ?? "rmp_national";
    const rank = idx + 1;
    const school = bySlug.get(target.slug);
    const row = reportBySlug.get(target.slug);
    const failures: string[] = [];

    if (!school || !row) {
      return {
        priorityRank: rank,
        slug: target.slug,
        dataTier: tier,
        ok: false,
        failures: ["Not in published catalog schools list (merge + publish may be incomplete)"],
        plannerReadiness: "directory_ready",
        offeringCount: 0,
      };
    }

    const sp = school.supportProfile;
    const minOff = target.minOfferings ?? 1;

    if (row.plannerReadiness === "directory_ready") {
      failures.push("Still directory_ready — no merged catalog offerings for this school");
    }
    if (row.offeringCount < minOff) {
      failures.push(`offeringCount ${row.offeringCount} < manifest minimum ${minOff}`);
    }

    if (tier === "rmp_national") {
      if (!sp?.hasRmp) {
        failures.push("hasRmp is false — RMP breadth not present in snapshot (sync/materialize/merge?)");
      }
    }

    if (tier === "institutional" && institutionalRequiresScheduleOrEvidence) {
      if (row.plannerReadiness !== "schedule_ready" && row.plannerReadiness !== "evidence_ready") {
        failures.push(
          `Institutional tier expects schedule_ready or evidence_ready (got ${row.plannerReadiness}); registrar/section depth not shipped`,
        );
      }
    }

    return {
      priorityRank: rank,
      slug: target.slug,
      dataTier: tier,
      ok: failures.length === 0,
      failures,
      plannerReadiness: row.plannerReadiness,
      offeringCount: row.offeringCount,
    };
  });
}
