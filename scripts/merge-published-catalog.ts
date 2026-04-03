/**
 * Merge seed catalog with TAMU offerings from ETL output.
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

const TAMU_PATH = path.join(ROOT, "etl", "output", "tamu_offerings.json");
const OUT_PATH = path.join(ROOT, "etl", "output", "published_catalog.json");

async function main() {
  if (!fs.existsSync(TAMU_PATH)) {
    console.warn(`Skip merge: ${TAMU_PATH} not found. Run aggregate_tamu_records after fetch_tamu_batch.`);
    process.exit(0);
  }

  const { buildSeedCatalogSnapshot } = await import("../lib/catalog");
  const seed = buildSeedCatalogSnapshot();

  const raw = JSON.parse(fs.readFileSync(TAMU_PATH, "utf8")) as typeof seed.offerings;
  if (!Array.isArray(raw) || !raw.length) {
    console.warn("tamu_offerings.json empty; skip.");
    process.exit(0);
  }

  const keep = seed.offerings.filter((o) => o.schoolSlug !== "texas-am");
  const offerings = [...keep, ...raw];

  const schools = seed.schools.map((s) =>
    s.slug === "texas-am"
      ? {
          ...s,
          coverageTier: "institutional_only" as const,
          directoryCount: Math.max(
            s.directoryCount,
            new Set(raw.map((t) => t.professorSlug)).size,
          ),
          sourceStatus: {
            ...s.sourceStatus,
            note: `Expanded from TAMU registrar imports (${raw.length} professor–course rows).`,
            freshness: new Date().toISOString().slice(0, 10),
          },
        }
      : s,
  );

  const out = {
    updatedAt: new Date().toISOString(),
    schools,
    offerings,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.warn(`Wrote ${OUT_PATH} with ${raw.length} TAMU offerings (${offerings.length} total).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
