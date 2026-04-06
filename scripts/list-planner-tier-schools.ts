/**
 * Lists schools that have at least one catalog offering in seed data (same minimum bar as
 * having professor/course rows). Run: npx tsx scripts/list-planner-tier-schools.ts
 *
 * Production planner tiers also come from `supportProfile.plannerReadiness` after the
 * published catalog merge (see `buildSchoolSupportProfile` in lib/catalog.ts).
 */
import { getAllOfferings, getSchools } from "../lib/data";

function main() {
  const offerings = getAllOfferings();
  const slugsWithRows = new Set(offerings.map((o) => o.schoolSlug));
  const schools = getSchools().filter((s) => slugsWithRows.has(s.slug));
  schools.sort((a, b) => a.shortName.localeCompare(b.shortName));

  const lines: string[] = [];
  lines.push("Seed data — schools with at least one professor/course offering row:");
  lines.push("(These are not “directory-only”; they show catalog intelligence in dev seed.)");
  lines.push("");
  for (const s of schools) {
    const n = offerings.filter((o) => o.schoolSlug === s.slug).length;
    lines.push(`  • ${s.shortName} (${s.slug}) — ${n} offering row(s)`);
  }
  const noRows = getSchools().filter((s) => !slugsWithRows.has(s.slug));
  if (noRows.length) {
    lines.push("");
    lines.push("Seed schools with no offering rows yet (directory / search only in seed):");
    for (const s of noRows.sort((a, b) => a.shortName.localeCompare(b.shortName))) {
      lines.push(`  • ${s.shortName} (${s.slug})`);
    }
  }
  console.log(lines.join("\n"));
}

main();
