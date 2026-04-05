import "server-only";

import fs from "node:fs";
import path from "node:path";
import { serverLog } from "@/lib/server-logger";

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

let publishedCatalogMissingWarningLogged = false;

export function getPublishedCatalogFileSourceInfo(): PublishedCatalogFileSourceInfo {
  const exists = fs.existsSync(PUBLISHED_CATALOG_PATH);
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

  try {
    return JSON.parse(fs.readFileSync(source.path, "utf8")) as T;
  } catch (err) {
    serverLog.warn("published_catalog_read_failed", {
      path: source.path,
      error: String(err),
    });
    return null;
  }
}
