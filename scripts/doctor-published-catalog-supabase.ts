import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

type TableCheck = {
  name: string;
  select: string;
  required: boolean;
  category: "published" | "control" | "user";
};

const TABLES: TableCheck[] = [
  { name: "schools", select: "id", required: true, category: "published" },
  { name: "professors", select: "id", required: true, category: "published" },
  { name: "courses", select: "id", required: true, category: "published" },
  { name: "published_professor_course_summaries", select: "id", required: true, category: "published" },
  { name: "sections", select: "id", required: false, category: "published" },
  { name: "rmp_ratings", select: "professor_id", required: false, category: "published" },
  { name: "department_aggregates", select: "id", required: false, category: "published" },
  { name: "published_grade_distribution_series", select: "id", required: false, category: "published" },
  { name: "section_meetings", select: "id", required: false, category: "published" },
  { name: "raw_source_snapshots", select: "id", required: false, category: "control" },
  { name: "published_catalog_control", select: "slot", required: false, category: "control" },
  { name: "etl_job_runs", select: "id", required: false, category: "control" },
  { name: "user_course_shortlists", select: "user_id", required: false, category: "user" },
  { name: "user_compare_sets", select: "id", required: false, category: "user" },
  { name: "user_saved_items", select: "id", required: false, category: "user" },
  { name: "user_planner_drafts", select: "id", required: false, category: "user" },
];

function loadLocalEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function getEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function maskKey(value: string) {
  if (!value) {
    return "missing";
  }
  if (value.length <= 8) {
    return "present";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function main() {
  loadLocalEnvFile(".env.local");
  loadLocalEnvFile(".env");

  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey =
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const key = serviceRoleKey || publishableKey;
  const keyKind = serviceRoleKey ? "service_role" : publishableKey ? "publishable" : "missing";

  console.log("Classify published catalog doctor");
  console.log(`- Supabase URL: ${url || "missing"}`);
  console.log(`- Service role key: ${maskKey(serviceRoleKey)}`);
  console.log(`- Publishable key: ${maskKey(publishableKey)}`);
  console.log(`- Active credential: ${keyKind}`);

  if (!url || !key) {
    console.error(
      "\nMissing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.",
    );
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const failures: Array<{ table: string; required: boolean; error: string }> = [];
  let schoolsExtendedSchemaOk = true;

  for (const table of TABLES) {
    const { error, count, data } = await client
      .from(table.name)
      .select(table.select, { count: "exact" })
      .range(0, 0);

    if (error) {
      failures.push({
        table: table.name,
        required: table.required,
        error: error.message,
      });
      console.log(`- ${table.name}: FAIL (${table.required ? "required" : "optional"}) -> ${error.message}`);
      continue;
    }

    console.log(
      `- ${table.name}: OK (${table.required ? "required" : "optional"}) rows=${count ?? (Array.isArray(data) ? data.length : 0)}`,
    );
  }

  const { error: schoolsSchemaError } = await client
    .from("schools")
    .select("id, catalog_completeness_pct, section_completeness_pct, meeting_time_completeness_pct, evidence_completeness_pct, readiness_reason")
    .range(0, 0);

  if (schoolsSchemaError) {
    schoolsExtendedSchemaOk = false;
    console.log(`- schools schema extensions: FAIL -> ${schoolsSchemaError.message}`);
  } else {
    console.log("- schools schema extensions: OK");
  }

  if (!failures.length) {
    console.log("\nAll probed Supabase tables are reachable through the configured Supabase API.");
    if (!schoolsExtendedSchemaOk) {
      console.log("The core catalog is reachable, but the schools table is still on the legacy schema.");
    }
    process.exit(0);
  }

  const requiredFailures = failures.filter((failure) => failure.required);
  const optionalFailures = failures.filter((failure) => !failure.required);
  const controlFailures = optionalFailures.filter((failure) =>
    TABLES.find((table) => table.name === failure.table)?.category === "control",
  );
  const userFailures = optionalFailures.filter((failure) =>
    TABLES.find((table) => table.name === failure.table)?.category === "user",
  );
  const publishedOptionalFailures = optionalFailures.filter((failure) =>
    TABLES.find((table) => table.name === failure.table)?.category === "published",
  );

  console.error("\nPublished catalog health summary:");
  console.error(`- Required table failures: ${requiredFailures.length}`);
  console.error(`- Optional table failures: ${optionalFailures.length}`);

  if (requiredFailures.length) {
    console.error("\nThe app cannot stay on the DB path until the required tables are visible in Supabase:");
    for (const failure of requiredFailures) {
      console.error(`  - ${failure.table}: ${failure.error}`);
    }
    console.error(
      "\nRemediation (Supabase SQL Editor, idempotent):\n" +
        "  1) db/supabase_published_catalog.sql — creates schools, professors, courses, published_professor_course_summaries, …\n" +
        "  2) db/supabase_repair_current_drift.sql — user tables, publish control, schools column drift (after step 1).\n" +
        "Then load data: npm run catalog:publish:supabase (after merge) and npm run catalog:validate:supabase.",
    );
  }

  if (publishedOptionalFailures.length) {
    console.error("\nOptional published catalog tables are still unavailable:");
    for (const failure of publishedOptionalFailures) {
      console.error(`  - ${failure.table}: ${failure.error}`);
    }
  }

  if (controlFailures.length) {
    console.error("\nPublish-control tables are still unavailable:");
    for (const failure of controlFailures) {
      console.error(`  - ${failure.table}: ${failure.error}`);
    }
  }

  if (userFailures.length) {
    console.error("\nSupabase-backed user data tables are still unavailable:");
    for (const failure of userFailures) {
      console.error(`  - ${failure.table}: ${failure.error}`);
    }
  }

  if (!schoolsExtendedSchemaOk) {
    console.error("\nThe schools table is reachable but missing the newer readiness/completeness columns.");
  }

  process.exit(requiredFailures.length ? 1 : 0);
}

main().catch((error) => {
  console.error("Published catalog doctor failed.", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
