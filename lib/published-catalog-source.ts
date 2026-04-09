import "server-only";

import { serverLog } from "@/lib/server-logger";
import {
  getPublishedCatalogDbHealth,
  hasPublishedCatalogDbConfig,
} from "@/lib/published-catalog-db-source";

export type PublishedCatalogSourceKind = "db" | "file" | "fallback";

export interface PublishedCatalogSourceInfo {
  kind: PublishedCatalogSourceKind;
  path: string;
  exists: boolean;
}

/** Where the last `readPublishedCatalogSnapshot` load got a non-null snapshot from (published layer only). */
export type PublishedCatalogDataOrigin = "db" | "file" | "none";

export interface PublishedCatalogReadTrace {
  dbConfigured: boolean;
  /** Origin of the last successful published snapshot load. */
  publishedDataFrom: PublishedCatalogDataOrigin;
  /** True if the last attempt loaded non-null published data (DB or file). */
  publishedSnapshotLoaded: boolean;
  lastAttemptAt: string | null;
}

let catalogReadTrace: PublishedCatalogReadTrace = {
  dbConfigured: false,
  publishedDataFrom: "none",
  publishedSnapshotLoaded: false,
  lastAttemptAt: null,
};

export function getPublishedCatalogReadTrace(): PublishedCatalogReadTrace {
  return { ...catalogReadTrace };
}

function allowFileCatalogFallback() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return process.env.ALLOW_PUBLISHED_CATALOG_FILE_FALLBACK !== "false";
}

export async function getPublishedCatalogSourceInfo(): Promise<PublishedCatalogSourceInfo> {
  if (hasPublishedCatalogDbConfig()) {
    const dbHealth = await getPublishedCatalogDbHealth();
    if (dbHealth.requiredTablesOk) {
      return {
        kind: "db",
        path: "supabase:published_tables",
        exists: true,
      };
    }

    if (!allowFileCatalogFallback()) {
      return {
        kind: "fallback",
        path: "seed:fallback_snapshot",
        exists: false,
      };
    }

    const fileSource = await import("@/lib/published-catalog-file-source");
    return {
      ...(await fileSource.getPublishedCatalogFileSourceInfo()),
      path: `file:fallback_after_db_unavailable`,
    };
  }

  if (!allowFileCatalogFallback()) {
    return {
      kind: "fallback",
      path: "seed:fallback_snapshot",
      exists: false,
    };
  }

  const fileSource = await import("@/lib/published-catalog-file-source");
  return fileSource.getPublishedCatalogFileSourceInfo();
}

export async function readPublishedCatalogSnapshot<T>(): Promise<T | null> {
  const dbConfigured = hasPublishedCatalogDbConfig();
  catalogReadTrace = {
    dbConfigured,
    publishedDataFrom: "none",
    publishedSnapshotLoaded: false,
    lastAttemptAt: new Date().toISOString(),
  };

  if (dbConfigured) {
    const dbSource = await import("@/lib/published-catalog-db-source");
    const snapshot = await dbSource.readPublishedCatalogSnapshotFromDb();
    if (snapshot) {
      catalogReadTrace.publishedDataFrom = "db";
      catalogReadTrace.publishedSnapshotLoaded = true;
      return snapshot as T;
    }

    serverLog.warn(
      allowFileCatalogFallback()
        ? "published_catalog_db_fallback_to_file"
        : "published_catalog_db_fallback_to_emergency_snapshot",
    );
  }

  if (!allowFileCatalogFallback()) {
    return null;
  }

  const fileSource = await import("@/lib/published-catalog-file-source");
  const fromFile = fileSource.readPublishedCatalogSnapshotFromFile<T>();
  if (fromFile) {
    catalogReadTrace.publishedDataFrom = "file";
    catalogReadTrace.publishedSnapshotLoaded = true;
  }
  return fromFile;
}
