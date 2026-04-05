-- Run in Supabase SQL editor (Dashboard -> SQL). Requires Auth enabled.
-- Cloud sync for signed-in users: course shortlists, compare sets, saved professors/courses.

create extension if not exists pgcrypto;

-- Shortlist per user per school (course slugs from catalog)
create table if not exists public.user_course_shortlists (
  user_id uuid not null references auth.users (id) on delete cascade,
  school_slug text not null,
  course_slugs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, school_slug)
);

-- Saved compare sets (offering ids as published in catalog)
create table if not exists public.user_compare_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  offering_ids text[] not null default '{}',
  school_slug text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Bookmark professors or courses
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

-- Saved planner drafts per user/school
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

alter table public.user_course_shortlists enable row level security;
alter table public.user_compare_sets enable row level security;
alter table public.user_saved_items enable row level security;
alter table public.user_planner_drafts enable row level security;

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
