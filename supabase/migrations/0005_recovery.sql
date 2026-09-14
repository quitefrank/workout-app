-- Per-user recovery tables.
--
-- recoveries   an enrolment in a recovery program: day 0 lives here
-- clearances   the dated, sourced log of what is permitted. Insert-only;
--              a wrong row is voided and re-entered, never edited
-- events       appointments, milestones, reminders, with questions to raise
-- rules        the standing rules and any prohibition
-- daily_checks one row per day of checks
--
-- All scoped to auth.uid() through recoveries.user_id.

create type clearance_kind as enum (
  'weight_bearing',
  'ankle_rom',
  'wedge_removal',
  'boot_weaning',
  'out_of_boot',
  'strength_gate'
);

create type clearance_source as enum ('clinic', 'self', 'planned');

create type event_kind as enum ('appointment', 'milestone', 'reminder');

create type rule_kind as enum ('rule', 'prohibition');

-- ============================================================
-- recoveries
-- ============================================================

create table recoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references programs(id) on delete restrict,
  label text not null,
  side text not null check (side in ('left', 'right')),
  injury_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recoveries_user_id_idx on recoveries(user_id);

create trigger recoveries_set_updated_at
  before update on recoveries
  for each row execute function set_updated_at();

-- ============================================================
-- clearances
-- ============================================================

create table clearances (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  effective_from date not null,
  kind clearance_kind not null,
  value_pct integer check (value_pct is null or value_pct between 0 and 100),
  value_text text,
  phase_id uuid references program_phases(id) on delete restrict,
  source clearance_source not null,
  note text,
  voided_at timestamptz,
  created_at timestamptz not null default now()
  ,
  constraint clearances_weight_bearing_needs_pct
    check (kind <> 'weight_bearing' or value_pct is not null)
);

create index clearances_recovery_id_effective_from_idx
  on clearances(recovery_id, effective_from);

create index clearances_phase_id_idx on clearances(phase_id);

-- ============================================================
-- events
-- ============================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  date date not null,
  kind event_kind not null,
  label text not null,
  note text,
  questions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_recovery_id_date_idx on events(recovery_id, date);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ============================================================
-- rules
-- ============================================================

create table rules (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  position integer not null,
  kind rule_kind not null,
  title text not null,
  detail text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recovery_id, position)
);

create trigger rules_set_updated_at
  before update on rules
  for each row execute function set_updated_at();

-- ============================================================
-- daily_checks
-- ============================================================

create table daily_checks (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  date date not null,
  upright_minutes integer check (upright_minutes is null or upright_minutes >= 0),
  skin_check boolean,
  scale_recalibrated boolean,
  pain_0_10 integer check (pain_0_10 is null or pain_0_10 between 0 and 10),
  numbness boolean,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recovery_id, date)
);

create trigger daily_checks_set_updated_at
  before update on daily_checks
  for each row execute function set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table recoveries enable row level security;
alter table clearances enable row level security;
alter table events enable row level security;
alter table rules enable row level security;
alter table daily_checks enable row level security;

create policy "recoveries_owner_all" on recoveries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "events_owner_all" on events
  for all to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = events.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = events.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "rules_owner_all" on rules
  for all to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = rules.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = rules.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "daily_checks_owner_all" on daily_checks
  for all to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = daily_checks.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = daily_checks.recovery_id and r.user_id = auth.uid()
    )
  );

-- Clearances are insert-only. Select and insert for the owner; update
-- for the owner but, through a column-level grant below, only on
-- voided_at; no delete policy, so deletes are refused.

create policy "clearances_owner_select" on clearances
  for select to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "clearances_owner_insert" on clearances
  for insert to authenticated
  with check (
    exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "clearances_owner_void" on clearances
  for update to authenticated
  using (
    voided_at is null
    and exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    voided_at is not null
    and exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  );

-- Supabase grants all privileges to authenticated by default. Narrow
-- update on clearances to the one column that may change.
revoke update on clearances from authenticated;
grant update (voided_at) on clearances to authenticated;
revoke delete on clearances from authenticated;
