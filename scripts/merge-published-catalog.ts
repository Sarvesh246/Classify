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

type CoverageTier =
  | "institutional_plus_rmp"
  | "institutional_only"
  | "rmp_only";

type SchoolRecord = {
  slug: string;
  coverageTier: CoverageTier;
  directoryCount: number;
  sourceStatus: {
    primary: string;
    fallback: string;
    freshness: string;
    note: string;
  };
};

type OfferingRecord = {
  schoolSlug: string;
  professorSlug: string;
  coverageTier: CoverageTier;
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

function buildReplacementMap(): Map<string, OfferingRecord[]> {
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

      replacements.set(getSchoolSlugFromEnrichedFile(fileName), offerings);
    }
  }

  return replacements;
}

async function main() {
  const { buildSeedCatalogSnapshot } = await import("../lib/catalog");
  const { loadScorecardDirectorySchools } = await import("../lib/scorecard-directory");
  const seed = buildSeedCatalogSnapshot();
  const replacements = buildReplacementMap();

  if (replacements.size === 0) {
    const seedSlugs = new Set(seed.schools.map((s) => s.slug));
    const directoryExtras = loadScorecardDirectorySchools().filter((s) => !seedSlugs.has(s.slug));
    if (directoryExtras.length === 0) {
      console.warn(
        "Skip merge: no reconciled school offerings and no extra College Scorecard schools (run import_school_directory or catalog:directory:fixture).",
      );
      process.exit(0);
    }

    const out = {
      updatedAt: new Date().toISOString(),
      schools: [...seed.schools, ...directoryExtras],
      offerings: seed.offerings,
    };

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.warn(
      `Wrote ${OUT_PATH} with ${directoryExtras.length} directory-only schools (${out.schools.length} total schools, ${out.offerings.length} offerings).`,
    );
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
  const schoolsWithDirectory = [...schools, ...directoryExtras];

  const out = {
    updatedAt: new Date().toISOString(),
    schools: schoolsWithDirectory,
    offerings,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.warn(
    `Wrote ${OUT_PATH} with ${incomingOfferings.length} reconciled rows across ${replacements.size} school slices (${offerings.length} offerings, ${schools.length} seed schools + ${directoryExtras.length} directory-only).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
