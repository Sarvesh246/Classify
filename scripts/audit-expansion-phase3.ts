/**
 * Phase 3 release gate: `data/expansion-priority.json` vs merged `published_catalog.json`.
 *
 * Ensures every manifest school is in the published snapshot with planner-tier data
 * appropriate to `dataTier` (institutional vs rmp_national).
 *
 * Usage: npm run catalog:audit:phase3
 * Options:
 *   --published=<path>   Override path to merged JSON (default: etl/output/published_catalog.json)
 *   --strict-institutional  Require institutional-tier schools to be schedule_ready or evidence_ready
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const require = createRequire(import.meta.url);
try {
  const resolved = require.resolve("server-only");
  require.cache[resolved] = { exports: {} } as NodeModule;
} catch {
  /* optional */
}

const DEFAULT_PUBLISHED = path.join(ROOT, "etl", "output", "published_catalog.json");
const PARTS_DIR = path.join(ROOT, "etl", "output", ".audit_phase3_parts");

function readLargeSnapshotViaPython(snapshotPath: string) {
  const script = `
import json
import sys
from pathlib import Path

snapshot_path = Path(sys.argv[1])
parts_dir = Path(sys.argv[2])
parts_dir.mkdir(parents=True, exist_ok=True)
snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
(parts_dir / "schools.json").write_text(json.dumps(snapshot.get("schools", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "offerings.json").write_text(json.dumps(snapshot.get("offerings", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "professorDirectory.json").write_text(json.dumps(snapshot.get("professorDirectory", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "sections.json").write_text(json.dumps(snapshot.get("sections", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "sectionMeetings.json").write_text(json.dumps(snapshot.get("sectionMeetings", []), separators=(",", ":")), encoding="utf-8")
`.trim();

  const result = spawnSync("python", ["-c", script, snapshotPath, PARTS_DIR], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "Python snapshot read failed.");
  }

  const readPart = <T>(fileName: string, fallback: T): T => {
    const partPath = path.join(PARTS_DIR, fileName);
    if (!fs.existsSync(partPath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(partPath, "utf8")) as T;
  };

  return {
    schools: readPart("schools.json", []),
    offerings: readPart("offerings.json", []),
    professorDirectory: readPart("professorDirectory.json", []),
    sections: readPart("sections.json", []),
    sectionMeetings: readPart("sectionMeetings.json", []),
  };
}

function readPublishedSnapshot(snapshotPath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/string longer than|invalid string length/i.test(message)) {
      throw error;
    }
    const parts = readLargeSnapshotViaPython(snapshotPath);
    return {
      schools: parts.schools,
      offerings: parts.offerings,
      professorDirectory: parts.professorDirectory,
      sections: parts.sections,
      sectionMeetings: parts.sectionMeetings,
    };
  }
}

function parseArgs() {
  let published = DEFAULT_PUBLISHED;
  let strictInstitutional = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--published=")) {
      published = arg.slice("--published=".length).trim() || published;
    } else if (arg === "--strict-institutional") {
      strictInstitutional = true;
    }
  }
  return { published, strictInstitutional };
}

async function main() {
  const { published, strictInstitutional } = parseArgs();

  if (!fs.existsSync(published)) {
    console.error(`Missing published catalog: ${published}\nRun: npm run catalog:merge`);
    process.exit(1);
  }

  console.log("Loading catalog helpers…");
  const { enrichSnapshotForExpansionPhase3Audit } = await import("../lib/catalog");
  const { auditExpansionPhase3, loadExpansionPriorityManifest } = await import("../lib/expansion-priority");
  type PublishedCatalogSnapshot = import("../lib/types").PublishedCatalogSnapshot;

  const manifest = loadExpansionPriorityManifest();
  const manifestSlugs = manifest.schools.map((row) => row.slug);

  const raw = readPublishedSnapshot(published) as PublishedCatalogSnapshot & {
    schools?: unknown[];
    offerings?: unknown[];
  };
  const mergedRaw = {
    updatedAt: (raw as { updatedAt?: string }).updatedAt ?? new Date().toISOString(),
    schools: raw.schools ?? [],
    offerings: raw.offerings ?? [],
    professorDirectory: (raw as { professorDirectory?: unknown }).professorDirectory ?? [],
    sections: (raw as { sections?: unknown }).sections ?? [],
    sectionMeetings: (raw as { sectionMeetings?: unknown }).sectionMeetings ?? [],
  } as PublishedCatalogSnapshot;

  console.log(
    `Enriching support profiles for ${manifestSlugs.length} manifest schools only (not the full national catalog)…`,
  );
  const enriched = enrichSnapshotForExpansionPhase3Audit(mergedRaw, manifestSlugs);
  const entries = auditExpansionPhase3(enriched.schools, enriched.offerings, manifest, {
    institutionalRequiresScheduleOrEvidence: strictInstitutional,
  });

  const failed = entries.filter((e) => !e.ok);
  const byTier = (tier: string) => entries.filter((e) => e.dataTier === tier);

  console.log("Phase 3 expansion manifest audit");
  console.log(`- Published: ${published}`);
  console.log(`- Manifest version: ${manifest.version} (${manifest.schools.length} schools)`);
  console.log(
    `- Institutional tier extra bar: ${strictInstitutional ? "schedule_ready or evidence_ready (--strict-institutional)" : "off (use --strict-institutional for registrar-depth gate)"}`,
  );
  console.log(`- Passed: ${entries.length - failed.length} / ${entries.length}`);

  for (const row of entries) {
    const status = row.ok ? "OK" : "FAIL";
    console.log(
      `  [${status}] #${row.priorityRank} ${row.slug} (${row.dataTier}) readiness=${row.plannerReadiness} offerings=${row.offeringCount}`,
    );
    for (const msg of row.failures) {
      console.log(`         - ${msg}`);
    }
  }

  console.log(
    `\nSummary by tier: rmp_national ${byTier("rmp_national").filter((e) => e.ok).length}/${byTier("rmp_national").length} ok, institutional ${byTier("institutional").filter((e) => e.ok).length}/${byTier("institutional").length} ok`,
  );

  if (failed.length) {
    console.error(`\nPhase 3 gate failed for ${failed.length} school(s). Fix ETL/merge/publish, then re-run.`);
    process.exit(1);
  }

  console.log("\nPhase 3 expansion manifest gate passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
