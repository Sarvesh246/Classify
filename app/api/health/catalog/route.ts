import { NextResponse } from "next/server";
import {
  getCatalogDataOriginTrace,
  getCatalogOfferings,
  getCatalogPublishMetadata,
  getCatalogReadinessSummary,
  getCatalogSourceInfo,
  getCatalogSchools,
} from "@/lib/catalog";
import { getPublishedCatalogDbHealth } from "@/lib/published-catalog-db-source";
import { getDirectorySchools } from "@/lib/server-directory";

export const dynamic = "force-dynamic";

/**
 * Operational check: env thinks DB is configured vs where the last published snapshot actually loaded.
 * Merged catalog still overlays published data on the local seed (see lib/catalog getSnapshot).
 */
export async function GET() {
  const [sourceInfo, schools, offerings, directorySchools, dbHealth, publishMetadata, readinessSummary] =
    await Promise.all([
      getCatalogSourceInfo(),
      getCatalogSchools(),
      getCatalogOfferings(),
      getDirectorySchools(),
      getPublishedCatalogDbHealth(),
      getCatalogPublishMetadata(),
      getCatalogReadinessSummary(),
    ]);
  const trace = getCatalogDataOriginTrace();
  const effectiveSource =
    trace.publishedDataFrom === "db"
      ? "db"
      : trace.publishedDataFrom === "file"
        ? "file"
        : "seed_or_directory";

  const dbPathOk =
    trace.dbConfigured &&
    trace.publishedDataFrom === "db" &&
    trace.publishedSnapshotLoaded &&
    dbHealth.requiredTablesOk;

  const needsPublishedSchema =
    dbHealth.configured &&
    !dbHealth.requiredTablesOk &&
    dbHealth.missingRequiredTables.length > 0;

  return NextResponse.json({
    environment: process.env.NODE_ENV ?? "unknown",
    configuredSource: sourceInfo,
    preferredPublishedSource: dbHealth.configured ? "db" : "file_or_seed",
    effectiveSource,
    /** True last load of readPublishedCatalogSnapshot (not merge). */
    publishedLayer: trace,
    publishMetadata,
    mergedCounts: {
      schools: schools.length,
      catalogSchoolCount: schools.length,
      directorySchoolCount: directorySchools.length,
      offerings: offerings.length,
    },
    readinessSummary,
    dbHealth,
    dbPathOk,
    ...(needsPublishedSchema
      ? {
          remediation: {
            summary:
              "Supabase is configured but required published-catalog tables are missing from this project (PostgREST schema cache).",
            verifyProject:
              "Confirm Dashboard project matches NEXT_PUBLIC_SUPABASE_URL (Settings → API).",
            steps: [
              "Supabase Dashboard → SQL → run the full script from repo file db/supabase_published_catalog.sql (creates public.schools, professors, courses, published_professor_course_summaries, etc., plus read policies).",
              "If you use auth/user tables from db/supabase_user_data.sql, apply that separately.",
              "Load data: set SUPABASE_SERVICE_ROLE_KEY, ensure etl/output/published_catalog.json exists, then npm run catalog:publish:supabase (or your ETL pipeline).",
              "Wait a few seconds and hit this endpoint again — dbHealth.tables[*].ok should be true for required tables.",
            ],
            repoFiles: {
              createTablesSql: "db/supabase_published_catalog.sql",
              publishScript: "npm run catalog:publish:supabase",
            },
          },
        }
      : {}),
  });
}
