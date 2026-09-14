-- Programs: a multi-week programme with phases and sources.
--
-- The recovery protocol is one program. A normal training programme
-- with phases is another. Templates optionally belong to a program and
-- are valid in some of its phases.
--
-- Weeks count from day 0 of the enrolment (recoveries.injury_date for
-- a recovery program). Phases are stored as the source document prints
-- them. Nothing is shifted and no offset column exists anywhere; the
-- live position comes only from the clearance log.

create type program_kind as enum ('recovery', 'training');

create type source_kind as enum (
  'trial',
  'review',
  'cohort',
  'handout',
  'convention',
  'anecdote'
);

-- ============================================================
-- sources
-- ============================================================

create table sources (
  id uuid primary key default gen_random_uuid(),
  citation text not null unique,
  url text,
  kind source_kind not null,
  quality text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sources_set_updated_at
  before update on sources
  for each row execute function set_updated_at();

-- ============================================================
-- programs
-- ============================================================

create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind program_kind not null,
  description text,
  citation text,
  authority_notes text,
  source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programs_set_updated_at
  before update on programs
  for each row execute function set_updated_at();

create index programs_source_id_idx on programs(source_id);

-- ============================================================
-- program_phases
-- guidance is an ordered array of { "heading": text, "items": text[] }.
-- Display content, not queried data.
-- ============================================================

create table program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  position integer not null,
  label text not null,
  week_from integer not null check (week_from >= 0),
  week_to integer,
  load_pct integer check (load_pct is null or load_pct between 0 and 100),
  gate text,
  guidance jsonb not null default '[]'::jsonb
    check (jsonb_typeof(guidance) = 'array'),
  flag text,
  flag_source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, position),
  constraint program_phases_week_range_check
    check (week_to is null or week_to > week_from)
);

create trigger program_phases_set_updated_at
  before update on program_phases
  for each row execute function set_updated_at();

create index program_phases_flag_source_id_idx on program_phases(flag_source_id);

-- ============================================================
-- templates.program_id and template_phases
-- ============================================================

alter table templates
  add column program_id uuid references programs(id) on delete set null;

create index templates_program_id_idx on templates(program_id);

create table template_phases (
  template_id uuid not null references templates(id) on delete cascade,
  phase_id uuid not null references program_phases(id) on delete cascade,
  primary key (template_id, phase_id)
);

create index template_phases_phase_id_idx on template_phases(phase_id);

-- ============================================================
-- Row-Level Security: library tables, authenticated reads only.
-- ============================================================

alter table sources enable row level security;
alter table programs enable row level security;
alter table program_phases enable row level security;
alter table template_phases enable row level security;

create policy "library_read_sources" on sources
  for select to authenticated using (true);

create policy "library_read_programs" on programs
  for select to authenticated using (true);

create policy "library_read_program_phases" on program_phases
  for select to authenticated using (true);

create policy "library_read_template_phases" on template_phases
  for select to authenticated using (true);
