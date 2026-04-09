/**
 * Writes etl/output/expansion_report.json from the merged published catalog.
 * Patches server-only for lib/catalog under plain Node (same as merge-published-catalog).
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
  /* optional */
}

const OUT_PATH = path.join(ROOT, "etl", "output", "published_catalog.json");
const REPORT_PATH = path.join(ROOT, "etl", "output", "expansion_report.json");

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
  const mergedRaw = JSON.parse(fs.readFileSync(OUT_PATH, "utf8")) as PublishedCatalogSnapshot;
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
