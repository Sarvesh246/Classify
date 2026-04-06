-- Targeted repair for the currently detected Supabase schema drift on 2026-04-05.
-- Safe to run multiple times in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.schools
  add column if not exists aliases jsonb not null default '[]'::jsonb,
  add column if not exists catalog_completeness_pct integer not null default 0,
  add column if not exists section_completeness_pct integer not null default 0,
  add column if not exists meeting_time_completeness_pct integer not null default 0,
  add column if not exists evidence_completeness_pct integer not null default 0,
  add column if not exists readiness_reason text;

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

create table if not exists public.user_course_shortlists (
  user_id uuid not null references auth.users (id) on delete cascade,
  school_slug text not null,
  course_slugs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, school_slug)
);

create table if not exists public.user_compare_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  offering_ids text[] not null default '{}',
  school_slug text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.user_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('professor', 'course')),
  school_slug text not null,
  professor_slug text,
  course_slug text,
  created_at timestamptz not null default now(),
  constraint user_saved_items_slug_kind check (
    (item_type = 'professor' and professor_slug is not null and course_slug is null)
    or (item_type = 'course' and course_slug is not null and professor_slug is null)
  )
);

create table if not exists public.user_planner_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  school_slug text not null,
  name text not null,
  term_label text,
  course_slugs text[] not null default '{}',
  ranking_mode text not null default 'planner_fit' check (
    ranking_mode in ('expected_gpa', 'ease_score', 'planner_fit')
  ),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists user_saved_items_professor_uniq
  on public.user_saved_items (user_id, school_slug, professor_slug)
  where item_type = 'professor';

create unique index if not exists user_saved_items_course_uniq
  on public.user_saved_items (user_id, school_slug, course_slug)
  where item_type = 'course';

alter table public.published_catalog_control enable row level security;
alter table public.user_course_shortlists enable row level security;
alter table public.user_compare_sets enable row level security;
alter table public.user_saved_items enable row level security;
alter table public.user_planner_drafts enable row level security;

drop policy if exists "published_catalog_read_control" on public.published_catalog_control;
create policy "published_catalog_read_control"
  on public.published_catalog_control for select
  using (true);

drop policy if exists "user_course_shortlists_select_own" on public.user_course_shortlists;
create policy "user_course_shortlists_select_own"
  on public.user_course_shortlists for select
  using (auth.uid() = user_id);

drop policy if exists "user_course_shortlists_insert_own" on public.user_course_shortlists;
create policy "user_course_shortlists_insert_own"
  on public.user_course_shortlists for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_course_shortlists_update_own" on public.user_course_shortlists;
create policy "user_course_shortlists_update_own"
  on public.user_course_shortlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_course_shortlists_delete_own" on public.user_course_shortlists;
create policy "user_course_shortlists_delete_own"
  on public.user_course_shortlists for delete
  using (auth.uid() = user_id);

drop policy if exists "user_compare_sets_select_own" on public.user_compare_sets;
create policy "user_compare_sets_select_own"
  on public.user_compare_sets for select
  using (auth.uid() = user_id);

drop policy if exists "user_compare_sets_insert_own" on public.user_compare_sets;
create policy "user_compare_sets_insert_own"
  on public.user_compare_sets for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_compare_sets_update_own" on public.user_compare_sets;
create policy "user_compare_sets_update_own"
  on public.user_compare_sets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_compare_sets_delete_own" on public.user_compare_sets;
create policy "user_compare_sets_delete_own"
  on public.user_compare_sets for delete
  using (auth.uid() = user_id);

drop policy if exists "user_saved_items_select_own" on public.user_saved_items;
create policy "user_saved_items_select_own"
  on public.user_saved_items for select
  using (auth.uid() = user_id);

drop policy if exists "user_saved_items_insert_own" on public.user_saved_items;
create policy "user_saved_items_insert_own"
  on public.user_saved_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_saved_items_delete_own" on public.user_saved_items;
create policy "user_saved_items_delete_own"
  on public.user_saved_items for delete
  using (auth.uid() = user_id);

drop policy if exists "user_planner_drafts_select_own" on public.user_planner_drafts;
create policy "user_planner_drafts_select_own"
  on public.user_planner_drafts for select
  using (auth.uid() = user_id);

drop policy if exists "user_planner_drafts_insert_own" on public.user_planner_drafts;
create policy "user_planner_drafts_insert_own"
  on public.user_planner_drafts for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_planner_drafts_update_own" on public.user_planner_drafts;
create policy "user_planner_drafts_update_own"
  on public.user_planner_drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_planner_drafts_delete_own" on public.user_planner_drafts;
create policy "user_planner_drafts_delete_own"
  on public.user_planner_drafts for delete
  using (auth.uid() = user_id);
