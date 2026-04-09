import "server-only";

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { serverLog } from "@/lib/server-logger";
import type { PublishedCatalogSnapshot } from "@/lib/types";

export interface PublishedCatalogFileSourceInfo {
  kind: "file" | "fallback";
  path: string;
  exists: boolean;
}

const PUBLISHED_CATALOG_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "etl",
  "output",
  "published_catalog.json",
);
const PUBLISHED_CATALOG_PARTS_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "etl",
  "output",
  ".published_catalog_parts",
);

let publishedCatalogMissingWarningLogged = false;
let publishedCatalogCache:
  | {
      path: string;
      mtimeMs: number;
      snapshot: PublishedCatalogSnapshot;
    }
  | null = null;

function readPart<T>(fileName: string, fallback: T): T {
  const partPath = path.join(PUBLISHED_CATALOG_PARTS_DIR, fileName);
  if (!fs.existsSync(/* turbopackIgnore: true */ partPath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ partPath, "utf8")) as T;
}

function hasFreshSnapshotParts(stat: fs.Stats) {
  const requiredParts = ["updatedAt.json", "schools.json", "offerings.json"];
  return requiredParts.every((fileName) => {
    const partPath = path.join(PUBLISHED_CATALOG_PARTS_DIR, fileName);
    return (
      fs.existsSync(/* turbopackIgnore: true */ partPath) &&
      fs.statSync(/* turbopackIgnore: true */ partPath).mtimeMs >= stat.mtimeMs
    );
  });
}

function readSnapshotFromParts(stat: fs.Stats): PublishedCatalogSnapshot {
  return {
    updatedAt: readPart<string | null>("updatedAt.json", null) ?? new Date(stat.mtimeMs).toISOString(),
    schools: readPart("schools.json", [] as PublishedCatalogSnapshot["schools"]),
    offerings: readPart("offerings.json", [] as PublishedCatalogSnapshot["offerings"]),
    professorDirectory: readPart("professorDirectory.json", [] as NonNullable<PublishedCatalogSnapshot["professorDirectory"]>),
    sections: readPart("sections.json", [] as NonNullable<PublishedCatalogSnapshot["sections"]>),
    departmentAggregates: readPart(
      "departmentAggregates.json",
      [] as NonNullable<PublishedCatalogSnapshot["departmentAggregates"]>,
    ),
    gradeDistributionSeries: readPart(
      "gradeDistributionSeries.json",
      [] as NonNullable<PublishedCatalogSnapshot["gradeDistributionSeries"]>,
    ),
    sectionMeetings: readPart(
      "sectionMeetings.json",
      [] as NonNullable<PublishedCatalogSnapshot["sectionMeetings"]>,
    ),
    publishMetadata: readPart("publishMetadata.json", undefined as PublishedCatalogSnapshot["publishMetadata"]),
  };
}

export function getPublishedCatalogFileSourceInfo(): PublishedCatalogFileSourceInfo {
  const exists = fs.existsSync(/* turbopackIgnore: true */ PUBLISHED_CATALOG_PATH);
  if (!exists && !publishedCatalogMissingWarningLogged) {
    publishedCatalogMissingWarningLogged = true;
    serverLog.warn("published_catalog_missing", {
      path: PUBLISHED_CATALOG_PATH,
    });
  }

  return {
    kind: exists ? "file" : "fallback",
    path: PUBLISHED_CATALOG_PATH,
    exists,
  };
}

export function readPublishedCatalogSnapshotFromFile<T>(): T | null {
  const source = getPublishedCatalogFileSourceInfo();
  if (!source.exists) {
    return null;
  }

  const stat = fs.statSync(/* turbopackIgnore: true */ PUBLISHED_CATALOG_PATH);
  if (
    publishedCatalogCache &&
    publishedCatalogCache.path === source.path &&
    publishedCatalogCache.mtimeMs === stat.mtimeMs
  ) {
    return publishedCatalogCache.snapshot as T;
  }

  if (hasFreshSnapshotParts(stat)) {
    const snapshot = readSnapshotFromParts(stat);
    publishedCatalogCache = {
      path: source.path,
      mtimeMs: stat.mtimeMs,
      snapshot,
    };
    return snapshot as T;
  }

  try {
    const snapshot = JSON.parse(
      fs.readFileSync(/* turbopackIgnore: true */ PUBLISHED_CATALOG_PATH, "utf8"),
    ) as PublishedCatalogSnapshot;
    publishedCatalogCache = {
      path: source.path,
      mtimeMs: stat.mtimeMs,
      snapshot,
    };
    return snapshot as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/string longer than|invalid string length/i.test(message)) {
      try {
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
        const result = spawnSync("python", ["-c", script, source.path, PUBLISHED_CATALOG_PARTS_DIR], {
          cwd: /* turbopackIgnore: true */ process.cwd(),
          encoding: "utf8",
          maxBuffer: 1024 * 1024 * 1024,
        });
        if (result.status === 0) {
          const snapshot = readSnapshotFromParts(stat);
          publishedCatalogCache = {
            path: source.path,
            mtimeMs: stat.mtimeMs,
            snapshot,
          };
          return snapshot as T;
        }
        serverLog.warn("published_catalog_python_fallback_failed", {
          path: source.path,
          error: result.stderr?.trim() || "unknown",
        });
      } catch (fallbackErr) {
        serverLog.warn("published_catalog_python_fallback_failed", {
          path: source.path,
          error: String(fallbackErr),
        });
      }
    }
    serverLog.warn("published_catalog_read_failed", {
      path: source.path,
      error: String(err),
    });
    return null;
  }
}
