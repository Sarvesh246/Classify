"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bookmark, Scale, Search } from "lucide-react";
import { SearchCombobox } from "@/components/search/search-combobox";
/**
 * Mobile-only home hero: single focused card (search + shortcuts).
 * Heavier modules (recent searches, school grids, featured lists) live on Search / hubs.
 */
export function MobileHomeLaunchpad() {
  return (
    <div className="space-y-4 md:hidden">
      <div className="home-dark-tile rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.74),rgba(8,25,44,0.58))] p-4 text-white shadow-[0_24px_50px_rgba(4,12,24,0.28)] backdrop-blur-xl">
        <p className="eyebrow">Classify</p>
        <h1 className="display-title mt-2 text-[2.3rem] font-semibold leading-[0.94] tracking-[-0.08em] text-white">
          Find the professor who actually gives A&apos;s.
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/80">
          Grade-backed outcomes and instructor context—search to get started.
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
