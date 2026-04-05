-- Published catalog tables for DB-first reads (readPublishedCatalogSnapshotFromDb).
-- Run in Supabase SQL Editor after auth/user tables if needed.
-- Safe to re-run: uses IF NOT EXISTS.

create table if not exists public.schools (
  id text primary key,
  slug text not null unique,
  name text not null,
  short_name text not null,
  city text not null,
  state text not null,
  kind text not null,
  coverage_tier text not null,
  source_primary text not null,
  source_fallback text not null,
  source_note text not null,
  planner_readiness text not null default 'directory_ready',
  has_catalog boolean not null default false,
  has_sections boolean not null default false,
  has_instructor_directory boolean not null default false,
  has_planner boolean not null default true,
  has_official_grades boolean not null default false,
  has_rmp boolean not null default false,
  has_community_evidence boolean not null default false,
  evidence_freshness text,
  source_availability jsonb not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now()
);

alter table public.schools add column if not exists catalog_completeness_pct integer not null default 0;
alter table public.schools add column if not exists section_completeness_pct integer not null default 0;
alter table public.schools add column if not exists meeting_time_completeness_pct integer not null default 0;
alter table public.schools add column if not exists evidence_completeness_pct integer not null default 0;
alter table public.schools add column if not exists readiness_reason text;

create table if not exists public.professors (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  slug text not null,
  name text not null,
  department text,
  title text,
  unique (school_id, slug)
);

create table if not exists public.courses (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  slug text not null,
  code text not null,
  name text not null,
  department text,
  unique (school_id, slug)
);

create table if not exists public.sections (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  professor_id text references public.professors(id) on delete set null,
  term text not null,
  source_key text not null,
  source_url text,
  instructor_name_raw text,
  match_status text not null default 'unmatched',
  sample_size integer not null default 0
);

create table if not exists public.rmp_ratings (
  professor_id text primary key references public.professors(id) on delete cascade,
  school_id text not null references public.schools(id) on delete cascade,
  rmp_id text,
  rating numeric(3,2),
  difficulty numeric(3,2),
  review_count integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  matched_confidence numeric(5,2),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.published_professor_course_summaries (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  professor_id text not null references public.professors(id) on delete cascade,
  coverage_tier text not null,
  classify_score numeric(5,2),
  expected_gpa numeric(4,2),
  a_rate numeric(5,2),
  trend_delta numeric(5,2),
  confidence numeric(5,2),
  match_confidence numeric(5,2),
  freshness_label text,
  source_labels jsonb not null default '[]'::jsonb,
  ranking_mode text,
  available_evidence_sources jsonb not null default '[]'::jsonb,
  has_section_planning boolean not null default false,
  data_completeness text,
  latest_term text,
  published_at timestamptz not null default now()
);

create index if not exists idx_published_summaries_school_course
  on public.published_professor_course_summaries (school_id, course_id);
create index if not exists idx_published_summaries_professor
  on public.published_professor_course_summaries (school_id, professor_id);

create table if not exists public.department_aggregates (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  department_slug text not null,
  department_name text not null,
  metric_window text not null default 'last_3_academic_years',
  coverage_tier text not null,
  avg_classify_score numeric(5,2),
  avg_expected_gpa numeric(4,2),
  avg_a_rate numeric(5,2),
  professor_count integer not null default 0,
  course_count integer not null default 0,
  sample_size integer not null default 0,
  latest_freshness text,
  published_at timestamptz not null default now(),
  unique (school_id, department_slug, metric_window)
);

create table if not exists public.published_grade_distribution_series (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  professor_id text references public.professors(id) on delete set null,
  summary_id text references public.published_professor_course_summaries(id) on delete set null,
  term text not null,
  sample_size integer not null default 0,
  avg_gpa numeric(4,2),
  source_label text,
  estimated boolean not null default false,
  a_count integer not null default 0,
  b_count integer not null default 0,
  c_count integer not null default 0,
  d_count integer not null default 0,
  f_count integer not null default 0,
  published_at timestamptz not null default now()
);

create index if not exists idx_grade_series_lookup
  on public.published_grade_distribution_series (school_id, course_id, professor_id, term);

create table if not exists public.section_meetings (
  id text primary key,
  section_id text not null references public.sections(id) on delete cascade,
  school_id text not null references public.schools(id) on delete cascade,
  instructor_name text,
  meeting_days text[] not null default '{}'::text[],
  start_time time,
  end_time time,
  location text,
  source_key text not null,
  published_at timestamptz not null default now()
);

create index if not exists idx_sections_school_course on public.sections (school_id, course_id);
create index if not exists idx_sections_professor on public.sections (professor_id, term);

create table if not exists public.raw_source_snapshots (
  id text primary key,
  school_id text references public.schools(id) on delete set null,
  source_key text not null,
  source_type text not null,
  fetched_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.published_catalog_control (
  slot text primary key,
  active_snapshot_id text not null references public.raw_source_snapshots(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.etl_job_runs (
  id text primary key,
  source_key text not null,
  school_id text references public.schools(id) on delete set null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);

-- Anonymous read for app catalog (publishable snapshot). Service role bypasses RLS.
alter table public.schools enable row level security;
alter table public.professors enable row level security;
alter table public.courses enable row level security;
alter table public.sections enable row level security;
alter table public.rmp_ratings enable row level security;
alter table public.published_professor_course_summaries enable row level security;
alter table public.department_aggregates enable row level security;
alter table public.published_grade_distribution_series enable row level security;
alter table public.section_meetings enable row level security;
alter table public.published_catalog_control enable row level security;

drop policy if exists "published_catalog_read_schools" on public.schools;
create policy "published_catalog_read_schools" on public.schools for select using (true);

drop policy if exists "published_catalog_read_professors" on public.professors;
create policy "published_catalog_read_professors" on public.professors for select using (true);

drop policy if exists "published_catalog_read_courses" on public.courses;
create policy "published_catalog_read_courses" on public.courses for select using (true);

drop policy if exists "published_catalog_read_sections" on public.sections;
create policy "published_catalog_read_sections" on public.sections for select using (true);

drop policy if exists "published_catalog_read_rmp" on public.rmp_ratings;
create policy "published_catalog_read_rmp" on public.rmp_ratings for select using (true);

drop policy if exists "published_catalog_read_summaries" on public.published_professor_course_summaries;
create policy "published_catalog_read_summaries" on public.published_professor_course_summaries for select using (true);

drop policy if exists "published_catalog_read_departments" on public.department_aggregates;
create policy "published_catalog_read_departments" on public.department_aggregates for select using (true);

drop policy if exists "published_catalog_read_grade_series" on public.published_grade_distribution_series;
create policy "published_catalog_read_grade_series" on public.published_grade_distribution_series for select using (true);

drop policy if exists "published_catalog_read_meetings" on public.section_meetings;
create policy "published_catalog_read_meetings" on public.section_meetings for select using (true);

drop policy if exists "published_catalog_read_control" on public.published_catalog_control;
create policy "published_catalog_read_control" on public.published_catalog_control for select using (true);
