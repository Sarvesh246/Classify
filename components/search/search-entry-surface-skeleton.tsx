export function SearchEntrySurfaceSkeleton() {
  return (
    <>
      <div className="space-y-4 md:hidden">
        <section className="classify-inner rounded-[30px] p-4">
          <p className="eyebrow">Search command</p>
          <h1 className="display-title mt-2 text-[2.15rem] font-semibold leading-[0.96] tracking-[-0.08em] text-ink">
            Search schools, courses, and professors in one place.
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Start with a school, jump into a course, or open a professor directly.
          </p>
          <div className="mt-4 rounded-[26px] border border-border/75 bg-background/70 px-4 py-4">
            <p className="text-sm text-muted">Loading search tools...</p>
          </div>
        </section>
      </div>

      <section className="search-elevated-surface soft-panel hidden rounded-[34px] p-6 sm:p-8 md:block">
        <p className="eyebrow">Universal search</p>
        <h1 className="app-page-title mt-3 font-semibold text-ink">
          Search schools, courses, and professors in one place
        </h1>
        <p className="app-lead mt-4">
          Any searchable school can land in the same Classify workflow. Start
          with a school, course, or professor and then narrow into the school hub,
          planner, course view, or instructor comparison surface.
        </p>
        <div className="mt-8 rounded-[26px] border border-border/75 bg-background/70 px-5 py-5">
          <p className="text-sm text-muted">Loading search tools...</p>
        </div>
      </section>
    </>
  );
}
