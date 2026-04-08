import {
  buildPayload,
  createSupabaseAdminClient,
  isDirectScriptRun,
  readSnapshot,
  validatePublishSupport,
  validateAgainstDb,
  validateSnapshot,
  publishSnapshotToSupabase,
} from "./catalog-publish-lib";

export async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const allowRegression = process.argv.includes("--allow-regression");
  const snapshot = readSnapshot();
  const payload = buildPayload(snapshot);
  const validation = validateSnapshot(snapshot, payload);

  if (!validation.ok) {
    throw new Error(`Snapshot validation failed: ${validation.failures.join(" | ")}`);
  }

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, summary: validation.summary }, null, 2));
    return;
  }

  const client = createSupabaseAdminClient();
  const dbValidation = await validateAgainstDb(client, payload, { allowRegression });
  if (!dbValidation.ok) {
    throw new Error(`DB validation failed: ${dbValidation.failures.join(" | ")}`);
  }
  const publishSupport = await validatePublishSupport(client);
  if (!publishSupport.ok) {
    throw new Error(`Publish preflight failed: ${publishSupport.failures.join(" | ")}`);
  }

  const result = await publishSnapshotToSupabase(client, snapshot);
  console.log(
    JSON.stringify(
      {
        ok: true,
        runId: result.runId,
        publishedAt: snapshot.updatedAt,
        summary: result.summary,
        deleted: result.deleted,
        readiness: validation.summary.readiness,
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
