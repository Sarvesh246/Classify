import {
  buildPayload,
  createSupabaseAdminClient,
  isDirectScriptRun,
  readSnapshot,
  validatePublishSupport,
  validateAgainstDb,
  validateSnapshot,
} from "./catalog-publish-lib";

export async function main() {
  const allowRegression = process.argv.includes("--allow-regression");
  const snapshot = readSnapshot();
  const payload = buildPayload(snapshot);
  const snapshotValidation = validateSnapshot(snapshot, payload);
  if (!snapshotValidation.ok) {
    throw new Error(`Snapshot validation failed: ${snapshotValidation.failures.join(" | ")}`);
  }

  const client = createSupabaseAdminClient();
  const dbValidation = await validateAgainstDb(client, payload, {
    allowRegression,
    requireExactCounts: true,
  });
  const publishSupport = await validatePublishSupport(client);
  const databaseEmpty =
    snapshotValidation.summary.required.schools > 0 &&
    dbValidation.currentCounts.schools === 0 &&
    dbValidation.currentCounts.professors === 0 &&
    dbValidation.currentCounts.courses === 0 &&
    dbValidation.currentCounts.published_professor_course_summaries === 0;

  if (!dbValidation.ok || !publishSupport.ok || databaseEmpty) {
    const failures = [...dbValidation.failures, ...publishSupport.failures];
    if (databaseEmpty) {
      failures.push(
        "Published catalog tables are reachable but empty. Run catalog:publish:supabase to populate the DB-backed runtime path.",
      );
    }
    throw new Error(`DB validation failed: ${failures.join(" | ")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        snapshotUpdatedAt: snapshot.updatedAt,
        summary: snapshotValidation.summary,
        currentCounts: dbValidation.currentCounts,
        databaseEmpty,
        publishSupportOk: publishSupport.ok,
      },
      null,
      2,
    ),
  );
}

if (isDirectScriptRun(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
