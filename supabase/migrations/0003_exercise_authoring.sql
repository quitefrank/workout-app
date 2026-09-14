-- Exercise authoring attributes.
--
-- Stored so the template-building rules in src/lib/recovery/authoring.ts
-- can run against them: in seed tests now, in a template builder later.
-- Only support_required is ever shown in the UI. The rest are inputs to
-- how a template gets built, not facts a screen displays.
--
-- Nullable because the Notion library arrives unrated. Every exercise
-- seeded from the Achilles material must have all of them set; the seed
-- tests enforce that.

create type support_type as enum (
  'hanging',
  'lying',
  'seated_supported',
  'standing_supported',
  'standing_free'
);

-- "horizontal" is split into sagittal and lateral. A seated cable row
-- (sagittal, one foot braces it) passes; a seated Pallof press (lateral)
-- tipped the user off the bench.
create type load_direction as enum (
  'vertical',
  'sagittal',
  'lateral',
  'none'
);

-- The building gym plus home equipment, and the machines the gym does
-- not have, so a Notion exercise that needs one can be flagged.
create type equipment_item as enum (
  'cable_tower',
  'dumbbells',
  'adjustable_bench',
  'half_rack',
  'pull_up_bar',
  'plate_tree',
  'mat',
  'medicine_ball',
  'stability_ball',
  'treadmill',
  'elliptical',
  'stepper',
  'spin_bike',
  'upright_bike',
  'resistance_band',
  'hanging_ab_straps',
  'barbell',
  'rower',
  'leg_press',
  'calf_machine',
  'assisted_pull_up',
  'captains_chair',
  'chest_press_machine',
  'shoulder_press_machine',
  'step_platform',
  'bathroom_scale'
);

alter table exercises
  add column slug text,
  add column support_required support_type,
  add column load_direction load_direction,
  add column loads_booted_foot boolean,
  add column ankle_involvement boolean,
  add column floor_transfer_required boolean,
  add column equipment_needed equipment_item[],
  add column min_hours_between_sessions integer
    check (min_hours_between_sessions is null or min_hours_between_sessions > 0),
  add column max_sessions_per_week integer
    check (max_sessions_per_week is null or max_sessions_per_week > 0),
  add column video_verified_at timestamptz;

-- Unique on non-null slugs. Rows without a slug (hand-entered before the
-- seed sets one) do not collide with each other.
create unique index exercises_slug_idx on exercises(slug);

alter table user_settings
  add column equipment_available equipment_item[];
