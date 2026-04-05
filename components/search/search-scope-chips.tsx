"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SearchHitType } from "@/lib/types";

export type SearchFilterType = SearchHitType | "all";

function buildSearchHref(args: {
  q: string;
  type: SearchFilterType;
  /** `null` removes school; omit keeps current scoped school */
  school?: string | null;
  currentSchool?: string;
}): string {
  const p = new URLSearchParams();
  if (args.q.trim()) p.set("q", args.q.trim());

  let schoolOut: string | undefined;
  if (args.school === null) {
    schoolOut = undefined;
  } else if (args.school !== undefined) {
    schoolOut = args.school.trim() || undefined;
  } else {
    schoolOut = args.currentSchool?.trim() || undefined;
  }
  if (schoolOut) p.set("school", schoolOut);

  if (args.type !== "all") p.set("type", args.type);

  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

export function SearchScopeChips({
  query,
  schoolSlug,
  filterType,
  schoolShortName,
}: {
  query: string;
  schoolSlug?: string;
  filterType: SearchFilterType;
  schoolShortName?: string;
}) {
  const scoped = schoolSlug?.trim();
  const chips: Array<{ key: string; label: string; href: string; active: boolean }> = [];

  if (scoped) {
    chips.push(
      {
        key: "scope-school",
        label: schoolShortName ? `Only ${schoolShortName}` : "This school only",
        href: buildSearchHref({
          q: query,
          type: filterType,
          school: scoped,
          currentSchool: scoped,
        }),
        active: true,
      },
      {
        key: "scope-all-schools",
        label: "All schools",
        href: buildSearchHref({ q: query, type: filterType, school: null }),
        active: false,
      },
    );
  }

  chips.push(
    {
      key: "type-all",
      label: "All types",
      href: buildSearchHref({ q: query, type: "all", currentSchool: scoped }),
      active: filterType === "all",
    },
    {
      key: "type-school",
      label: "Schools",
      href: buildSearchHref({ q: query, type: "school", currentSchool: scoped }),
      active: filterType === "school",
    },
    {
      key: "type-course",
      label: "Courses",
      href: buildSearchHref({ q: query, type: "course", currentSchool: scoped }),
      active: filterType === "course",
    },
    {
      key: "type-professor",
      label: "Professors",
      href: buildSearchHref({ q: query, type: "professor", currentSchool: scoped }),
      active: filterType === "professor",
    },
  );

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
            chip.active
              ? "border-deep-ink bg-deep-ink text-ivory shadow-[0_8px_20px_rgba(8,25,44,0.18)]"
              : "border-border bg-white/72 text-ink hover:bg-white",
          )}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
