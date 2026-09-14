-- Workout app initial schema.
-- Source of truth lives in this file. Edit, then push with `supabase db push`.

create extension if not exists pgcrypto;

-- ============================================================
-- Enums
-- ============================================================

create type equipment_type as enum (
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'cardio_machine',
  'other'
);

create type machine_location as enum (
  'upstairs',
  'downstairs'
);

create type template_category as enum (
  'push',
  'pull',
  'legs',
  'arms',
  'full_body',
  'cardio',
  'abs'
);

create type weight_unit as enum (
  'lbs',
  'kg'
);

-- ============================================================
-- updated_at trigger helper
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- muscle_groups
-- ============================================================

create table muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order integer,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger muscle_groups_set_updated_at
  before update on muscle_groups
  for each row execute function set_updated_at();

-- ============================================================
-- exercises
-- ============================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group_id uuid references muscle_groups(id) on delete set null,
  equipment_type equipment_type not null default 'other',
  machine_location machine_location,
  notes text,
  video_url text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_muscle_group_id_idx on exercises(muscle_group_id);
create index exercises_name_idx on exercises(name);

create trigger exercises_set_updated_at
  before update on exercises
  for each row execute function set_updated_at();

-- ============================================================
-- exercise_alternates
-- ============================================================

create table exercise_alternates (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  alternate_exercise_id uuid not null references exercises(id) on delete cascade,
  position integer not null check (position in (1, 2)),
  notes text,
  _notion_id text,
  created_at timestamptz not null default now(),
  unique (exercise_id, position),
  check (exercise_id <> alternate_exercise_id)
);

create index exercise_alternates_exercise_id_idx on exercise_alternates(exercise_id);

-- ============================================================
-- templates (one day's prescription; the 18 Notion day templates
-- and any recovery templates added later)
-- ============================================================

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category template_category,
  variant text,
  tutorial_url text,
  estimated_minutes integer,
  notes text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger templates_set_updated_at
  before update on templates
  for each row execute function set_updated_at();

-- ============================================================
-- template_exercises (prescription rows for a template)
-- A prescription is one of reps, RIR, or seconds.
-- ============================================================

create table template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  prescribed_sets_min integer,
  prescribed_sets_max integer,
  prescribed_reps_min integer,
  prescribed_reps_max integer,
  prescribed_rir_min integer,
  prescribed_rir_max integer,
  prescribed_seconds_min integer,
  prescribed_seconds_max integer,
  prescribed_rest_seconds integer,
  prescribed_rpe text,
  warm_up_sets_min integer,
  warm_up_sets_max integer,
  notes text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index template_exercises_template_id_idx on template_exercises(template_id);
create index template_exercises_exercise_id_idx on template_exercises(exercise_id);

create trigger template_exercises_set_updated_at
  before update on template_exercises
  for each row execute function set_updated_at();

-- ============================================================
-- workouts (session instances)
-- ============================================================

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references templates(id) on delete set null,
  machine_location machine_location,
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  perceived_effort integer check (perceived_effort between 1 and 10),
  notes text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_user_id_idx on workouts(user_id);
create index workouts_scheduled_for_idx on workouts(scheduled_for);
create index workouts_completed_at_idx on workouts(completed_at);

create trigger workouts_set_updated_at
  before update on workouts
  for each row execute function set_updated_at();

-- ============================================================
-- workout_exercises
-- ============================================================

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  prescribed_sets_min integer,
  prescribed_sets_max integer,
  prescribed_reps_min integer,
  prescribed_reps_max integer,
  prescribed_rir_min integer,
  prescribed_rir_max integer,
  prescribed_seconds_min integer,
  prescribed_seconds_max integer,
  prescribed_rest_seconds integer,
  prescribed_rpe text,
  warm_up_sets_min integer,
  warm_up_sets_max integer,
  notes text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_exercises_workout_id_idx on workout_exercises(workout_id);
create index workout_exercises_exercise_id_idx on workout_exercises(exercise_id);

create trigger workout_exercises_set_updated_at
  before update on workout_exercises
  for each row execute function set_updated_at();

-- ============================================================
-- sets (one row per logged set)
-- ============================================================

create table sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number integer not null,
  is_warm_up boolean not null default false,
  weight numeric(8, 2),
  reps integer,
  seconds integer,
  rpe numeric(3, 1),
  notes text,
  completed_at timestamptz,
  _notion_id text,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number)
);

create index sets_workout_exercise_id_idx on sets(workout_exercise_id);

-- ============================================================
-- user_settings
-- ============================================================

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight_unit weight_unit not null default 'lbs',
  default_rest_seconds integer not null default 180,
  default_machine_location machine_location,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

-- ============================================================
-- Row-Level Security
--
-- Library tables (muscle_groups, exercises, exercise_alternates,
-- templates, template_exercises) are global reference data shared
-- across users. Any authenticated user can read them. Writes are
-- restricted to the service role, which bypasses RLS during the
-- Notion seed and any future admin tasks.
--
-- Per-user tables (workouts, workout_exercises, sets,
-- user_settings) are scoped to auth.uid().
-- ============================================================

alter table muscle_groups enable row level security;
alter table exercises enable row level security;
alter table exercise_alternates enable row level security;
alter table templates enable row level security;
alter table template_exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;
alter table user_settings enable row level security;

-- Library tables: authenticated reads only.
create policy "library_read_muscle_groups" on muscle_groups
  for select to authenticated using (true);

create policy "library_read_exercises" on exercises
  for select to authenticated using (true);

create policy "library_read_exercise_alternates" on exercise_alternates
  for select to authenticated using (true);

create policy "library_read_templates" on templates
  for select to authenticated using (true);

create policy "library_read_template_exercises" on template_exercises
  for select to authenticated using (true);

-- Per-user tables.

create policy "workouts_owner_all" on workouts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "workout_exercises_owner_all" on workout_exercises
  for all to authenticated
  using (
    exists (
      select 1 from workouts w
      where w.id = workout_exercises.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts w
      where w.id = workout_exercises.workout_id
        and w.user_id = auth.uid()
    )
  );

create policy "sets_owner_all" on sets
  for all to authenticated
  using (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id
        and w.user_id = auth.uid()
    )
  );

create policy "user_settings_owner_all" on user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
