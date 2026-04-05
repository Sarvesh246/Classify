"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, GraduationCap, School, UserRound } from "lucide-react";
import { SearchCombobox } from "@/components/search/search-combobox";
import { SearchScopeChips, type SearchFilterType } from "@/components/search/search-scope-chips";
import { RecentSearchesPanel } from "@/components/search/recent-searches-panel";

export function MobileSearchCommand({
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
  return (
    <div className="space-y-4 md:hidden">
      <section className="rounded-[30px] border border-border/75 bg-white/72 p-4 shadow-[0_16px_36px_rgba(7,17,31,0.06)]">
        <p className="eyebrow">Search command</p>
        <h1 className="display-title mt-2 text-[2.15rem] font-semibold leading-[0.96] tracking-[-0.08em] text-ink">
          Search schools, courses, and professors in one place.
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Start with a school, jump into a course, or open a professor directly.
        </p>
        <div className="mt-4">
          <SearchCombobox
            initialQuery={query}
            searchType={filterType}
            schoolSlug={schoolSlug}
            syncSearchUrl
          />
        </div>
        <SearchScopeChips
          query={query}
          schoolSlug={schoolSlug}
          filterType={filterType}
          schoolShortName={schoolShortName}
        />
      </section>

      <RecentSearchesPanel
        title="Recent checks"
        subtitle="Reopen a school, course, or professor without typing again."
      />

      <section className="rounded-[28px] border border-border/75 bg-white/64 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Start here</p>
            <p className="mt-1 text-sm text-muted">Choose the kind of question you have.</p>
          </div>
          <Link href="/compare" className="inline-flex items-center gap-1 text-sm font-medium text-ink">
            Compare
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 grid gap-2">
          <StarterRow
            href="/search?type=school"
            icon={<School className="h-4 w-4" />}
            title="Search a school"
            body="Open the full school hub, instructors, and planner entry point."
          />
          <StarterRow
            href="/search?type=course"
            icon={<GraduationCap className="h-4 w-4" />}
            title="Jump into a course"
            body="See who teaches it and which option looks strongest."
          />
          <StarterRow
            href="/search?type=professor"
            icon={<UserRound className="h-4 w-4" />}
            title="Open a professor"
            body="Go straight to trends, evidence, and compare-ready details."
          />
        </div>
      </section>
    </div>
  );
}

function StarterRow({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-[24px] border border-border/70 bg-background/82 px-4 py-4 transition hover:bg-white"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{body}</span>
      </span>
    </Link>
  );
}
