export type CompareSetRow = {
  id: string;
  name: string | null;
  offering_ids: string[];
  school_slug: string | null;
  updated_at: string;
  created_at: string;
};

export type PlannerDraftRow = {
  id: string;
  name: string;
  school_slug: string;
  term_label: string | null;
  course_slugs: string[];
  ranking_mode: "expected_gpa" | "ease_score" | "planner_fit";
  updated_at: string;
  created_at: string;
};

export type SavedItemRow = {
  id: string;
  item_type: "professor" | "course";
  school_slug: string;
  professor_slug: string | null;
  course_slug: string | null;
  created_at: string;
};

export async function fetchShortlist(schoolSlug: string): Promise<{
  courseSlugs: string[];
} | null> {
  const res = await fetch(
    `/api/me/shortlist?${new URLSearchParams({ schoolSlug })}`,
    { credentials: "include" },
  );
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ courseSlugs: string[] }>;
}

export async function putShortlist(schoolSlug: string, courseSlugs: string[]): Promise<void> {
  const res = await fetch("/api/me/shortlist", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolSlug, courseSlugs }),
  });
  if (res.status === 401) return;
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchCompareSets(): Promise<{ sets: CompareSetRow[] } | null> {
  const res = await fetch("/api/me/compare-sets", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ sets: CompareSetRow[] }>;
}

export async function postCompareSet(payload: {
  name?: string;
  offeringIds: string[];
  schoolSlug?: string;
}): Promise<{ set: CompareSetRow } | null> {
  const res = await fetch("/api/me/compare-sets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ set: CompareSetRow }>;
}

export async function deleteCompareSet(id: string): Promise<void> {
  const res = await fetch(`/api/me/compare-sets?${new URLSearchParams({ id })}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) return;
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchSavedItems(): Promise<{ items: SavedItemRow[] } | null> {
  const res = await fetch("/api/me/saved", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: SavedItemRow[] }>;
}

export async function fetchPlannerDrafts(
  schoolSlug: string,
): Promise<{ drafts: PlannerDraftRow[] } | null> {
  const res = await fetch(
    `/api/me/planner-drafts?${new URLSearchParams({ schoolSlug })}`,
    { credentials: "include" },
  );
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ drafts: PlannerDraftRow[] }>;
}

export async function postPlannerDraft(payload: {
  schoolSlug: string;
  courseSlugs: string[];
  rankingMode: "expected_gpa" | "ease_score" | "planner_fit";
  name?: string;
  termLabel?: string;
}): Promise<{ draft: PlannerDraftRow } | null> {
  const res = await fetch("/api/me/planner-drafts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ draft: PlannerDraftRow }>;
}

export async function deletePlannerDraft(id: string): Promise<void> {
  const res = await fetch(`/api/me/planner-drafts?${new URLSearchParams({ id })}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) return;
  if (!res.ok) throw new Error(await res.text());
}

export async function postSavedItem(payload: {
  itemType: "professor" | "course";
  schoolSlug: string;
  professorSlug?: string;
  courseSlug?: string;
}): Promise<{ ok: boolean; alreadySaved?: boolean } | null> {
  const res = await fetch("/api/me/saved", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; alreadySaved?: boolean }>;
}

export async function deleteSavedItem(id: string): Promise<void> {
  const res = await fetch(`/api/me/saved?${new URLSearchParams({ id })}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) return;
  if (!res.ok) throw new Error(await res.text());
}
