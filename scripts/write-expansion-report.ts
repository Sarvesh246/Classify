/**
 * Writes etl/output/expansion_report.json from the merged published catalog.
 * Patches server-only for lib/catalog under plain Node (same as merge-published-catalog).
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

const OUT_PATH = path.join(ROOT, "etl", "output", "published_catalog.json");
const REPORT_PATH = path.join(ROOT, "etl", "output", "expansion_report.json");
const PARTS_DIR = path.join(ROOT, "etl", "output", ".expansion_report_parts");

function readLargeSnapshotViaPython(snapshotPath: string) {
  const script = `
import json
import sys
from pathlib import Path

snapshot_path = Path(sys.argv[1])
parts_dir = Path(sys.argv[2])
parts_dir.mkdir(parents=True, exist_ok=True)
snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
(parts_dir / "updatedAt.json").write_text(json.dumps(snapshot.get("updatedAt")), encoding="utf-8")
(parts_dir / "schools.json").write_text(json.dumps(snapshot.get("schools", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "offerings.json").write_text(json.dumps(snapshot.get("offerings", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "professorDirectory.json").write_text(json.dumps(snapshot.get("professorDirectory", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "sections.json").write_text(json.dumps(snapshot.get("sections", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "departmentAggregates.json").write_text(json.dumps(snapshot.get("departmentAggregates", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "gradeDistributionSeries.json").write_text(json.dumps(snapshot.get("gradeDistributionSeries", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "sectionMeetings.json").write_text(json.dumps(snapshot.get("sectionMeetings", []), separators=(",", ":")), encoding="utf-8")
(parts_dir / "publishMetadata.json").write_text(json.dumps(snapshot.get("publishMetadata")), encoding="utf-8")
`.trim();

  const result = spawnSync("python", ["-c", script, snapshotPath, PARTS_DIR], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "Python snapshot fallback failed.");
  }

  const readPart = <T>(fileName: string, fallback: T): T => {
    const partPath = path.join(PARTS_DIR, fileName);
    if (!fs.existsSync(partPath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(partPath, "utf8")) as T;
  };

  return {
    updatedAt: readPart<string | null>("updatedAt.json", null) ?? new Date().toISOString(),
    schools: readPart("schools.json", []),
    offerings: readPart("offerings.json", []),
    professorDirectory: readPart("professorDirectory.json", []),
    sections: readPart("sections.json", []),
    departmentAggregates: readPart("departmentAggregates.json", []),
    gradeDistributionSeries: readPart("gradeDistributionSeries.json", []),
    sectionMeetings: readPart("sectionMeetings.json", []),
    publishMetadata: readPart("publishMetadata.json", null),
  };
}

function readSnapshot(snapshotPath: string) {
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/string longer than|invalid string length/i.test(message)) {
      throw error;
    }
    return readLargeSnapshotViaPython(snapshotPath);
  }
}

async function main() {
  if (!fs.existsSync(OUT_PATH)) {
    console.error(`Missing ${OUT_PATH}; run catalog:merge first.`);
    process.exit(1);
  }
  const { enrichSnapshotSchoolsWithSupport } = await import("../lib/catalog");
  const { buildExpansionReportRows, loadExpansionPriorityManifest } = await import(
    "../lib/expansion-priority",
  );
  type PublishedCatalogSnapshot = import("../lib/types").PublishedCatalogSnapshot;
  const mergedRaw = readSnapshot(OUT_PATH) as PublishedCatalogSnapshot;
  const enriched = enrichSnapshotSchoolsWithSupport(mergedRaw);
  const manifest = loadExpansionPriorityManifest();
  const report = {
    generatedAt: new Date().toISOString(),
    manifestVersion: manifest.version,
    rows: buildExpansionReportRows(enriched.schools, enriched.offerings),
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.warn(`Wrote ${REPORT_PATH} (${report.rows.length} schools).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
