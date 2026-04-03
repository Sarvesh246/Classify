create table schools (
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
  refreshed_at timestamptz not null default now()
);

create table professors (
  id text primary key,
  school_id text not null references schools(id),
  slug text not null,
  name text not null,
  department text,
  title text,
  unique (school_id, slug)
);

create table courses (
  id text primary key,
  school_id text not null references schools(id),
  slug text not null,
  code text not null,
  name text not null,
  department text,
  unique (school_id, slug)
);

create table sections (
  id text primary key,
  school_id text not null references schools(id),
  course_id text not null references courses(id),
  professor_id text references professors(id),
  term text not null,
  source_key text not null,
  source_url text,
  instructor_name_raw text,
  match_status text not null default 'unmatched',
  sample_size integer not null default 0
);

create table grade_distributions (
  section_id text primary key references sections(id),
  avg_gpa numeric(4,2),
  a_count integer not null default 0,
  b_count integer not null default 0,
  c_count integer not null default 0,
  d_count integer not null default 0,
  f_count integer not null default 0,
  withdrawn_count integer not null default 0
);

create table rmp_ratings (
  professor_id text primary key references professors(id),
  school_id text not null references schools(id),
  rmp_id text,
  rating numeric(3,2),
  difficulty numeric(3,2),
  review_count integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  matched_confidence numeric(5,2),
  refreshed_at timestamptz not null default now()
);

create table raw_source_snapshots (
  id text primary key,
  school_id text references schools(id),
  source_key text not null,
  source_type text not null,
  fetched_at timestamptz not null default now(),
  payload jsonb not null
);

create table published_professor_course_summaries (
  id text primary key,
  school_id text not null references schools(id),
  course_id text not null references courses(id),
  professor_id text not null references professors(id),
  coverage_tier text not null,
  classify_score numeric(5,2),
  expected_gpa numeric(4,2),
  a_rate numeric(5,2),
  trend_delta numeric(5,2),
  confidence numeric(5,2),
  match_confidence numeric(5,2),
  freshness_label text,
  source_labels jsonb not null default '[]'::jsonb,
  data_completeness text,
  latest_term text,
  published_at timestamptz not null default now()
);

create index idx_sections_school_course on sections (school_id, course_id);
create index idx_sections_professor on sections (professor_id, term);
create index idx_published_summaries_school_course on published_professor_course_summaries (school_id, course_id);
create index idx_published_summaries_professor on published_professor_course_summaries (school_id, professor_id);

create table department_aggregates (
  id text primary key,
  school_id text not null references schools(id),
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

create table published_grade_distribution_series (
  id text primary key,
  school_id text not null references schools(id),
  course_id text not null references courses(id),
  professor_id text references professors(id),
  summary_id text references published_professor_course_summaries(id),
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

create index idx_grade_series_lookup on published_grade_distribution_series (school_id, course_id, professor_id, term);

create table section_meetings (
  id text primary key,
  section_id text not null references sections(id) on delete cascade,
  school_id text not null references schools(id),
  meeting_days text[] not null default '{}'::text[],
  start_time time,
  end_time time,
  location text,
  source_key text not null,
  published_at timestamptz not null default now()
);

create table syllabi (
  id text primary key,
  school_id text not null references schools(id),
  course_id text references courses(id),
  professor_id text references professors(id),
  term text,
  storage_url text not null,
  preview_url text,
  ocr_text text,
  uploader_id text,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table crowd_grade_submissions (
  id text primary key,
  school_id text not null references schools(id),
  course_id text references courses(id),
  professor_id text references professors(id),
  expected_grade text not null,
  major text,
  class_year text,
  submission_source text not null default 'community',
  moderation_status text not null default 'pending',
  created_by_user_id text,
  created_at timestamptz not null default now()
);

create table verified_reviews (
  id text primary key,
  school_id text not null references schools(id),
  course_id text references courses(id),
  professor_id text not null references professors(id),
  rating integer not null check (rating between 1 and 5),
  body text,
  structured_tags jsonb not null default '[]'::jsonb,
  provenance text not null default 'verified_school_email',
  moderation_status text not null default 'pending',
  created_by_user_id text not null,
  created_at timestamptz not null default now()
);

create table review_votes (
  id text primary key,
  review_id text not null references verified_reviews(id) on delete cascade,
  user_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create table correction_reports (
  id text primary key,
  school_id text references schools(id),
  professor_id text references professors(id),
  course_id text references courses(id),
  report_type text not null,
  details text not null,
  status text not null default 'open',
  submitted_by_user_id text,
  resolved_by_user_id text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table watchlists (
  id text primary key,
  user_id text not null unique,
  created_at timestamptz not null default now()
);

create table watchlist_entries (
  id text primary key,
  watchlist_id text not null references watchlists(id) on delete cascade,
  school_id text references schools(id),
  course_id text references courses(id),
  professor_id text references professors(id),
  created_at timestamptz not null default now()
);

create table major_requirement_presets (
  id text primary key,
  school_id text not null references schools(id),
  major_slug text not null,
  catalog_year text not null,
  label text not null,
  required_course_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, major_slug, catalog_year)
);

create table professor_match_reviews (
  id text primary key,
  school_id text not null references schools(id),
  source_key text not null,
  professor_name_raw text not null,
  proposed_professor_id text references professors(id),
  confidence numeric(5,2) not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create table etl_job_runs (
  id text primary key,
  source_key text not null,
  school_id text references schools(id),
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);
