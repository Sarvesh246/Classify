/**
 * Merge the seed catalog with reconciled ETL school slices.
 *
 * Patches out `server-only` so `lib/catalog` can load under plain Node (tsx).
 *
 * Usage (from repo root): npx tsx scripts/merge-published-catalog.ts
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CoverageTier,
  ProfessorCourseSummary,
  ProfessorDirectoryRow,
  PublishedCatalogSnapshot,
  School,
} from "../lib/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const require = createRequire(import.meta.url);
try {
  const resolved = require.resolve("server-only");
  require.cache[resolved] = { exports: {} } as NodeModule;
} catch {
  /* optional dependency shape */
}

const OUTPUT_ROOT = path.join(ROOT, "etl", "output");
const RECONCILE_ROOT = path.join(OUTPUT_ROOT, "reconcile");
const MATCH_ROOT = path.join(OUTPUT_ROOT, "matches");
const TAMU_PATH = path.join(OUTPUT_ROOT, "tamu_offerings.json");
const OUT_PATH = path.join(OUTPUT_ROOT, "published_catalog.json");

function writeLargeJson(
  outPath: string,
  payload: {
    updatedAt: string;
    schools: unknown[];
    offerings: unknown[];
    professorDirectory?: unknown[];
  },
) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const fd = fs.openSync(outPath, "w");
  try {
    fs.writeSync(fd, "{\n");
    fs.writeSync(fd, `  "updatedAt": ${JSON.stringify(payload.updatedAt)},\n`);
    fs.writeSync(fd, `  "schools": ${JSON.stringify(payload.schools, null, 2).replace(/\n/g, "\n  ")},\n`);
    fs.writeSync(fd, `  "offerings": ${JSON.stringify(payload.offerings, null, 2).replace(/\n/g, "\n  ")},\n`);
    fs.writeSync(
      fd,
      `  "professorDirectory": ${JSON.stringify(payload.professorDirectory ?? [], null, 2).replace(/\n/g, "\n  ")}\n`,
    );
    fs.writeSync(fd, "}\n");
  } finally {
    fs.closeSync(fd);
  }
}

function writeExpansionReportJson(
  outPath: string,
  payload: {
    generatedAt: string;
    manifestVersion: number;
    rows: unknown[];
  },
) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const fd = fs.openSync(outPath, "w");
  try {
    fs.writeSync(fd, "{\n");
    fs.writeSync(fd, `  "generatedAt": ${JSON.stringify(payload.generatedAt)},\n`);
    fs.writeSync(fd, `  "manifestVersion": ${JSON.stringify(payload.manifestVersion)},\n`);
    fs.writeSync(fd, `  "rows": ${JSON.stringify(payload.rows, null, 2).replace(/\n/g, "\n  ")}\n`);
    fs.writeSync(fd, "}\n");
  } finally {
    fs.closeSync(fd);
  }
}

type SchoolRecord = School;
type OfferingRecord = ProfessorCourseSummary;

type RmpRecord = {
  school_slug: string;
  professor_name: string;
  rating: number | null;
  difficulty: number | null;
  review_count: number;
  department?: string | null;
  tags?: string[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function getCoverageTier(offerings: OfferingRecord[]): CoverageTier {
  if (offerings.some((item) => item.coverageTier === "institutional_plus_rmp")) {
    return "institutional_plus_rmp";
  }
  if (offerings.some((item) => item.coverageTier === "institutional_only")) {
    return "institutional_only";
  }
  return "rmp_only";
}

function getSchoolSlugFromEnrichedFile(fileName: string) {
  return fileName.replace(/_enriched\.json$/i, "");
}

function dedupeSchoolsBySlug(schools: SchoolRecord[]) {
  return [...new Map(schools.map((school) => [school.slug, school])).values()];
}

function buildAuditNote(slug: string, existingNote: string) {
  const matchesPath = path.join(MATCH_ROOT, `${slug}.json`);
  if (!fs.existsSync(matchesPath)) {
    return existingNote;
  }

  const payload = readJson<{
    summary?: {
      autoLinkedCount?: number;
      reviewCount?: number;
      unmatchedCount?: number;
    };
  }>(matchesPath);
  const summary = payload.summary;
  if (!summary) {
    return existingNote;
  }

  const autoLinkedCount = summary.autoLinkedCount ?? 0;
  const reviewCount = summary.reviewCount ?? 0;
  const unmatchedCount = summary.unmatchedCount ?? 0;

  return `${existingNote} Live RMP reconciliation: ${autoLinkedCount} auto-linked, ${reviewCount} queued for review, ${unmatchedCount} unmatched.`;
}

/**
 * Reconcile shards are named with College Scorecard directory slugs; seed/catalog schools use
 * canonical slugs (e.g. `university-of-michigan-ann-arbor` → `umich`). Map filenames through
 * the same canonicalizer as RMP rows so replacements attach to the correct school.
 */
function buildReplacementMap(canonicalDirectorySlug: (raw: string) => string): Map<string, OfferingRecord[]> {
  const replacements = new Map<string, OfferingRecord[]>();

  if (fs.existsSync(TAMU_PATH)) {
    const tamuOfferings = readJson<OfferingRecord[]>(TAMU_PATH);
    if (Array.isArray(tamuOfferings) && tamuOfferings.length > 0) {
      replacements.set("texas-am", tamuOfferings);
    }
  }

  if (fs.existsSync(RECONCILE_ROOT)) {
    const enrichedFiles = fs
      .readdirSync(RECONCILE_ROOT)
      .filter((fileName) => fileName.endsWith("_enriched.json"));

    for (const fileName of enrichedFiles) {
      const filePath = path.join(RECONCILE_ROOT, fileName);
      const offerings = readJson<OfferingRecord[]>(filePath);
      if (!Array.isArray(offerings) || offerings.length === 0) {
        continue;
      }

      const rawSlug = getSchoolSlugFromEnrichedFile(fileName);
      const schoolSlug = canonicalDirectorySlug(rawSlug);
      const prior = replacements.get(schoolSlug);
      replacements.set(schoolSlug, prior ? [...prior, ...offerings] : offerings);
    }
  }

  return replacements;
}

function slugifyProfessor(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildRmpOnlyProfessorDirectory(
  schools: SchoolRecord[],
  seedDirectory: ProfessorDirectoryRow[],
  canonicalizeRmpSchoolSlug: (raw: string) => string,
): ProfessorDirectoryRow[] {
  const byKey = new Map(
    seedDirectory.map((row) => [`${row.schoolSlug}:${row.professorSlug}`, row]),
  );
  const schoolBySlug = new Map(schools.map((school) => [school.slug, school]));
  const rmpFiles = fs
    .readdirSync(OUTPUT_ROOT)
    .filter((fileName) => /^rmp_.+\.json$/i.test(fileName));

  for (const fileName of rmpFiles) {
    const rows = readJson<RmpRecord[]>(path.join(OUTPUT_ROOT, fileName));
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const school = schoolBySlug.get(canonicalizeRmpSchoolSlug(row.school_slug));
      if (!school) continue;
      if ((row.review_count ?? 0) < 3) continue;
      if (row.rating == null && row.difficulty == null) continue;

      const professorSlug = slugifyProfessor(row.professor_name);
      const key = `${school.slug}:${professorSlug}`;
      if (byKey.has(key)) continue;

      byKey.set(key, {
        id: `profdir:${school.slug}:${professorSlug}`,
        schoolSlug: school.slug,
        schoolName: school.shortName ?? school.name ?? school.slug,
        professorSlug,
        professorName: row.professor_name,
        professorTitle: row.department?.trim() || "Instructor",
        departments: row.department?.trim() ? [row.department.trim()] : [],
        coursePrefixes: [],
        courseCodes: [],
        courseCount: 0,
        sectionCount: 0,
        coverageTier: "rmp_only",
        coverageLevel: "stats_partial",
        statsAvailability: "rmp_only",
        evidenceFreshness: school.sourceStatus.freshness,
        sourceKinds: ["rmp"],
        hasInstitutionalStats: false,
        hasRmp: true,
        hasSchedulePresence: false,
        expectedGpa: null,
        aRate: null,
        classifyScore: null,
        rmpRating: row.rating,
        rmpDifficulty: row.difficulty,
        sampleSize: row.review_count ?? 0,
        trend: [],
        tags: row.tags ?? [],
        summary: row.department?.trim()
          ? `${row.department.trim()} instructor with published RMP evidence while local institutional data is still expanding.`
          : "Instructor profile is live from school-scoped RMP evidence while local institutional data is still expanding.",
      });
    }
  }

  return [...byKey.values()];
}

async function writeExpansionReportForSnapshot(snapshot: PublishedCatalogSnapshot) {
  try {
    const { buildExpansionReportRows, loadExpansionPriorityManifest } = await import(
      "../lib/expansion-priority",
    );
    const manifest = loadExpansionPriorityManifest();
    const report = {
      generatedAt: new Date().toISOString(),
      manifestVersion: manifest.version,
      rows: buildExpansionReportRows(snapshot.schools, snapshot.offerings),
    };
    const reportPath = path.join(OUTPUT_ROOT, "expansion_report.json");
    writeExpansionReportJson(reportPath, report);
    console.warn(`Wrote expansion report: ${reportPath}`);
  } catch (reportErr) {
    console.warn(`Expansion report skipped: ${reportErr}`);
  }
}

async function main() {
  const { buildSeedCatalogSnapshot, enrichSnapshotSchoolsWithSupport } = await import("../lib/catalog");
  const { canonicalScorecardSchoolSlug, loadScorecardDirectorySchools } = await import(
    "../lib/scorecard-directory",
  );
  const seed = buildSeedCatalogSnapshot();
  const replacements = buildReplacementMap(canonicalScorecardSchoolSlug);

  if (replacements.size === 0) {
    const seedSlugs = new Set(seed.schools.map((s) => s.slug));
    const directoryExtras = loadScorecardDirectorySchools().filter((s) => !seedSlugs.has(s.slug));
    if (directoryExtras.length === 0) {
      console.warn(
        "Skip merge: no reconciled school offerings and no extra College Scorecard schools (run import_school_directory or catalog:directory:fixture).",
      );
      process.exit(0);
    }

    const schools = dedupeSchoolsBySlug([...seed.schools, ...directoryExtras]);
    const professorDirectory = buildRmpOnlyProfessorDirectory(
      schools,
      seed.professorDirectory ?? [],
      canonicalScorecardSchoolSlug,
    );
    const out = enrichSnapshotSchoolsWithSupport({
      updatedAt: new Date().toISOString(),
      schools,
      offerings: seed.offerings,
      professorDirectory,
    });

    writeLargeJson(OUT_PATH, out);
    console.warn(
      `Wrote ${OUT_PATH} with ${directoryExtras.length} directory-only schools (${out.schools.length} total schools, ${out.offerings.length} offerings).`,
    );
    await writeExpansionReportForSnapshot(out);
    return;
  }

  const keep = seed.offerings.filter((offering) => !replacements.has(offering.schoolSlug));
  const incomingOfferings = [...replacements.values()].flat();
  const offerings = [...keep, ...incomingOfferings];

  const freshness = new Date().toISOString().slice(0, 10);
  const schools = seed.schools.map((school) => {
    const replacement = replacements.get(school.slug);
    if (!replacement) {
      return school;
    }

    const uniqueProfessors = new Set(replacement.map((item) => item.professorSlug)).size;

    return {
      ...school,
      coverageTier: getCoverageTier(replacement),
      directoryCount: Math.max(school.directoryCount, uniqueProfessors),
      sourceStatus: {
        ...school.sourceStatus,
        freshness,
        note: buildAuditNote(school.slug, school.sourceStatus.note),
      },
    } satisfies SchoolRecord;
  });

  const mergedSlugs = new Set(schools.map((s) => s.slug));
  const directoryExtras = loadScorecardDirectorySchools().filter((s) => !mergedSlugs.has(s.slug));
  const schoolsWithDirectory = dedupeSchoolsBySlug([...schools, ...directoryExtras]);

  const professorDirectory = buildRmpOnlyProfessorDirectory(
    schoolsWithDirectory,
    seed.professorDirectory ?? [],
    canonicalScorecardSchoolSlug,
  );
  const out = enrichSnapshotSchoolsWithSupport({
    updatedAt: new Date().toISOString(),
    schools: schoolsWithDirectory,
    offerings,
    professorDirectory,
  });

  writeLargeJson(OUT_PATH, out);
  console.warn(
    `Wrote ${OUT_PATH} with ${incomingOfferings.length} reconciled rows across ${replacements.size} school slices (${offerings.length} offerings, ${schools.length} seed schools + ${directoryExtras.length} directory-only).`,
  );
  await writeExpansionReportForSnapshot(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
