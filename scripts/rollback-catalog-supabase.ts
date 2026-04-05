import {
  createSupabaseAdminClient,
  isDirectScriptRun,
  publishSnapshotToSupabase,
  readPublishedSnapshotArtifact,
  validateSnapshot,
  buildPayload,
} from "./catalog-publish-lib";

function readSnapshotIdArg() {
  const index = process.argv.findIndex((value) => value === "--snapshot-id");
  if (index === -1) {
    throw new Error("Missing --snapshot-id <value>.");
  }

  const snapshotId = process.argv[index + 1];
  if (!snapshotId) {
    throw new Error("Missing snapshot id after --snapshot-id.");
  }

  return snapshotId;
}

export async function main() {
  const snapshotId = readSnapshotIdArg();
  const client = createSupabaseAdminClient();
  const snapshot = await readPublishedSnapshotArtifact(client, snapshotId);
  const validation = validateSnapshot(snapshot, buildPayload(snapshot));
  if (!validation.ok) {
    throw new Error(`Stored snapshot failed validation: ${validation.failures.join(" | ")}`);
  }

  const result = await publishSnapshotToSupabase(client, snapshot, { snapshotId });
  console.log(
    JSON.stringify(
      {
        ok: true,
        rolledBackTo: snapshotId,
        publishedAt: snapshot.updatedAt,
        summary: result.summary,
        deleted: result.deleted,
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
