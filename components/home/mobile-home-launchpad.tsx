"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Bookmark, Scale, Search, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { SearchCombobox } from "@/components/search/search-combobox";
import { RecentSearchesPanel } from "@/components/search/recent-searches-panel";
import { CoverageBadge } from "@/components/coverage-badge";
import type { ProfessorCourseSummary, School } from "@/lib/types";
import { formatGpa, formatPercent, scoreToLabel } from "@/lib/utils";

export function MobileHomeLaunchpad({
  featured,
  schools,
}: {
  featured: ProfessorCourseSummary[];
  schools: School[];
}) {
  return (
    <div className="space-y-4 md:hidden">
      <div className="rounded-[30px] border border-white/10 bg-white/7 p-4 shadow-[0_20px_40px_rgba(7,17,31,0.12)] backdrop-blur-xl">
        <p className="eyebrow text-white/72">Launchpad</p>
        <h1 className="display-title mt-2 text-[2.3rem] font-semibold leading-[0.94] tracking-[-0.08em] text-white">
          Find the professor who actually gives A&apos;s.
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/72">
          Search fast, reopen recent checks, or jump straight into compare and saved work.
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

      <RecentSearchesPanel
        compact
        title="Pick up where you left off"
        subtitle="Recent schools, courses, and professor checks appear here."
        tone="dark"
      />

      <div className="grid gap-3">
        <div className="rounded-[28px] border border-white/10 bg-white/7 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-white/72">Quick starts</p>
              <p className="mt-1 text-sm text-white/72">Open a school hub and keep moving.</p>
            </div>
            <Sparkles className="h-4 w-4 text-teal" />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {schools.slice(0, 5).map((school) => (
              <Link
                key={school.slug}
                href={`/schools/${school.slug}`}
                className="shrink-0 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white"
              >
                {school.shortName}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/7 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-white/72">Return-worthy picks</p>
              <p className="mt-1 text-sm text-white/72">Fast openings into strong current options.</p>
            </div>
            <Link href="/search" className="inline-flex items-center gap-1 text-sm font-medium text-white/88">
              Open all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {featured.slice(0, 3).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.22 }}
              >
                <Link
                  href={`/schools/${item.schoolSlug}/professors/${item.professorSlug}`}
                  className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/8 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{item.professorName}</p>
                      <CoverageBadge tier={item.coverageTier} variant="onDark" className="text-[0.58rem]" />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-white/66">
                      {item.courseCode} - {item.courseName}
                    </p>
                  </div>
                  <div className="text-right text-xs text-white/76">
                    <p className="font-semibold text-white">{scoreToLabel(item.classifyScore)}</p>
                    <p>{formatGpa(item.expectedGpa)} GPA</p>
                    <p>{formatPercent(item.aRate)}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
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
      className="inline-flex min-h-[3.35rem] flex-col items-center justify-center gap-1 rounded-[20px] border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
