import { beforeAll, describe, expect, it } from "vitest";

let validateAgainstDb: (
  client: unknown,
  payload: unknown,
  options?: { allowRegression?: boolean; requireExactCounts?: boolean },
) => Promise<{ ok: boolean; failures: string[] }>;

beforeAll(async () => {
  const publishLibModule = await import("../scripts/catalog-publish-lib");
  const lib = (publishLibModule as Record<string, unknown>).default ??
    (publishLibModule as Record<string, unknown>)["module.exports"] ??
    publishLibModule;

  validateAgainstDb = (
    lib as {
      validateAgainstDb: typeof validateAgainstDb;
    }
  ).validateAgainstDb;
});

function makeCountClient(counts: Record<string, number>) {
  return {
    from(table: string) {
      return {
        select(_columns: string, options?: { head?: boolean }) {
          if (!options?.head) {
            throw new Error(`Unexpected non-head count query for ${table}`);
          }

          return Promise.resolve({
            count: counts[table] ?? 0,
            error: null,
          });
        },
      };
    },
  };
}

function makePayload(counts: {
  schools: number;
  professors: number;
  courses: number;
  summaries: number;
}) {
  return {
    schools: Array.from({ length: counts.schools }, (_, index) => ({ id: `school:${index}` })),
    professors: Array.from({ length: counts.professors }, (_, index) => ({ id: `prof:${index}` })),
    courses: Array.from({ length: counts.courses }, (_, index) => ({ id: `course:${index}` })),
    sections: [],
    rmpRatings: [],
    summaries: Array.from({ length: counts.summaries }, (_, index) => ({ id: `summary:${index}` })),
    departmentAggregates: [],
    gradeSeries: [],
  };
}

describe("validateAgainstDb", () => {
  it("flags exact-count mismatches when validation requires parity", async () => {
    const client = makeCountClient({
      schools: 3,
      professors: 5,
      courses: 9,
      published_professor_course_summaries: 8,
    });

    const result = await validateAgainstDb(
      client,
      makePayload({ schools: 3, professors: 5, courses: 7, summaries: 8 }),
      { requireExactCounts: true },
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("courses count mismatch: current=9, snapshot=7");
  });

  it("keeps publish preflight permissive when counts differ but do not regress", async () => {
    const client = makeCountClient({
      schools: 3,
      professors: 5,
      courses: 9,
      published_professor_course_summaries: 8,
    });

    const result = await validateAgainstDb(
      client,
      makePayload({ schools: 3, professors: 5, courses: 7, summaries: 8 }),
      {},
    );

    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});
