"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bookmark, Scale, Search } from "lucide-react";
import { SearchCombobox } from "@/components/search/search-combobox";

/**
 * Mobile-only home hero: single focused card (search + shortcuts).
 * Heavier modules (recent searches, school grids, featured lists) live on Search / hubs.
 */
export function MobileHomeLaunchpad({
  searchableSchools,
  plannerReadySchools,
  evidenceReadySchools,
}: {
  searchableSchools: number;
  plannerReadySchools: number;
  evidenceReadySchools: number;
}) {
  return (
    <div className="space-y-4 md:hidden">
      <div className="home-dark-tile rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.74),rgba(8,25,44,0.58))] p-4 text-white shadow-[0_24px_50px_rgba(4,12,24,0.28)] backdrop-blur-xl">
        <p className="eyebrow">Classify</p>
        <h1 className="display-title mt-2 text-[2.3rem] font-semibold leading-[0.94] tracking-[-0.08em] text-white">
          Grade outcomes by course and instructor.
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/80">
          Search a school, course, or professor to get started.
        </p>
        <div className="mt-4">
          <SearchCombobox placeholder="Search a school, course, or professor" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <QuickAction href="/search" icon={<Search className="h-4 w-4" />} label="Search" />
          <QuickAction href="/compare" icon={<Scale className="h-4 w-4" />} label="Compare" />
          <QuickAction href="/saved" icon={<Bookmark className="h-4 w-4" />} label="Saved" />
        </div>
      </div>

      <div className="home-dark-tile rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.66),rgba(8,25,44,0.52))] p-3 text-white shadow-[0_14px_30px_rgba(4,12,24,0.2)] backdrop-blur-xl">
        <p className="eyebrow">Coverage</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <MobileProof value={searchableSchools} label="schools" />
          <MobileProof value={plannerReadySchools} label="planner-ready" />
          <MobileProof value={evidenceReadySchools} label="evidence-ready" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[3.35rem] flex-col items-center justify-center gap-1 rounded-[20px] border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium !text-white"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MobileProof({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/8 px-2.5 py-2.5">
      <p className="text-base font-semibold text-white">{value}</p>
      <p className="mt-0.5 truncate text-[0.64rem] uppercase tracking-[0.16em] text-white/72">
        {label}
      </p>
    </div>
  );
}
