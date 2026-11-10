-- What each exercise measures, so the active workout shows only the controls that fit it (Frank's calls, 2026-11-09).
-- The focus screen's controls zone follows exercises.measure: two steppers side by side, one spanning the width,
-- three across for a treadmill, or none. Before this every exercise showed weight and reps.
--
--   weight_reps   weight × reps, the default for every loaded lift
--   reps          reps alone: bodyweight moves and active stretches (a loaded version is its own Weighted row)
--   weight_steps  weight × steps, stored in reps (Farmers Walks)
--   weight_time   weight × time (Squat Walk-Out, a held 1RM)
--   time          time alone (planks, cardio machines not yet given their own controls)
--   hold          no stepper: a static stretch held for its prescribed seconds, 30 when none is written
--   treadmill     incline × speed × time (Warm up Walk, Treadmill Run, Max-Incline Walk)
--   outdoor       distance, with time kept by the app (Outdoor Run, Warm up Run)
--
-- Steps per tap: weight 5 lb or 2.5 kg, reps 1, time 30 s, incline 0.5 %, speed 0.5 km/h, distance 0.5 km.
-- The seeds never touch measure, so a change is a migration.

create type exercise_measure as enum (
  'weight_reps',
  'reps',
  'weight_steps',
  'weight_time',
  'time',
  'hold',
  'treadmill',
  'outdoor'
);

alter table exercises add column measure exercise_measure not null default 'weight_reps';
comment on column exercises.measure is 'What a set of this exercise records, and so which controls the active workout shows.';

-- A column on an existing table keeps that table's grants, so none are needed here.
alter table sets
  add column incline numeric(4, 1),
  add column speed numeric(4, 1),
  add column distance numeric(6, 2);

comment on column sets.incline is 'Treadmill incline in percent.';
comment on column sets.speed is 'Treadmill speed in km/h.';
comment on column sets.distance is 'Distance in km.';

alter table sets
  add constraint sets_incline_range check (incline is null or (incline >= 0 and incline <= 40)),
  add constraint sets_speed_range check (speed is null or (speed >= 0 and speed <= 40)),
  add constraint sets_distance_range check (distance is null or distance >= 0);

update exercises set measure = 'reps' where slug in (
  -- abs
  'ab-wheel-rollout', 'alternating-leg-ups', 'alternating-toe-touches', 'arms-legs-raise-with-ball', 'bicycle-crunches',
  'dead-bug-kicks', 'hanging-leg-raise', 'leg-raise', 'running-plank', 'scissor-kicks', 'sit-ups',
  'torso-twist-with-medicine-ball', 'v-sit-up',
  -- bodyweight pulls, pushes and dips (the Weighted rows keep weight × reps)
  'chin-ups', 'pull-ups', 'neutral-grip-pull-up', 'omni-grip-pull-up', 'push-ups', 'kneeling-modified-push-up',
  'diamond-push-ups', 'deficit-push-up', 'med-ball-push-up', 'dip', 'close-grip-dip',
  -- legs, glutes and the band work
  'nordic-ham-curl', 'swiss-ball-single-leg-leg-curl', 'glute-ham-raise', '45-hyperextension', 'glute-bridge',
  'banded-lateral-walk', 'standing-banded-glute-clocks', 'band-pull-apart', 'neck-flexion-extension',
  -- active stretches and mobility, done for reps
  'arm-circles', 'ankle-roll', 'ankle-rocking', 'dynamic-toe-touch', 'front-back-leg-swings', 'side-side-leg-swings',
  'hip-flexion', 'hip-rotation', 'touch-your-toes', 'roll-ups', 'side-lying-twists', 'step-throughs',
  'supine-lifting-pointing-toes', 'foam-roller-partial-hinge', 'kegel'
);

-- Clamshell's slug carries its curly quotes from Notion
update exercises set measure = 'reps' where name ilike '%clamshell%';

update exercises set measure = 'hold' where slug in (
  'pec-stretch', 'delt-stretch', 'static-lat-stretch', 'bicep-static-stretch', 'quad-stretches',
  'standing-glute-stretch', 'cross-leg-forward-fold', 'wide-leg-forward-fold', 'ankle-stretch',
  'calf-flexor-with-ball', 'gluteal-release-with-ball', 'hamstring-foam-rolling'
);

update exercises set measure = 'time' where slug in (
  'front-plank', 'llpt-plank', 'elliptical-machine', 'indoor-bike', 'rowing-machine'
);

update exercises set measure = 'weight_steps' where slug = 'farmers-walks';
update exercises set measure = 'weight_time' where slug = 'squat-walk-out-do-not-squat';
update exercises set measure = 'treadmill' where slug in ('warm-up-walk', 'max-incline-walk');
update exercises set measure = 'outdoor' where slug = 'warm-up-run';

-- Running splits into two versions of one family: the Notion row becomes the outdoor run, and the indoor run gets its
-- own treadmill row, so each template shows its own controls.
do $$
declare
  outdoor_id uuid;
  treadmill_id uuid;
  cardio_id uuid;
begin
  select id, muscle_group_id into outdoor_id, cardio_id from exercises where slug = 'running';
  if outdoor_id is null then
    return; -- a fresh database has no library rows yet
  end if;

  update exercises
  set movement = 'Running', option_equipment = 'Outdoor', option_rank = 1, title = 'Outdoor Run', measure = 'outdoor'
  where id = outdoor_id;

  insert into exercises (name, slug, title, muscle_group_id, equipment_type, movement, option_equipment, option_rank, measure, _notion_id)
  values ('Treadmill Run', 'treadmill-run', 'Treadmill Run', cardio_id, 'cardio_machine', 'Running', 'Treadmill', 0, 'treadmill', 'library:treadmill-run')
  on conflict (_notion_id) do update set measure = excluded.measure
  returning id into treadmill_id;

  update template_exercises te
  set exercise_id = treadmill_id
  from templates t
  where t.id = te.template_id and t.name = 'Run (indoor)' and te.exercise_id = outdoor_id;

  update workout_exercises we
  set exercise_id = treadmill_id
  from workouts w join templates t on t.id = w.template_id
  where w.id = we.workout_id and t.name = 'Run (indoor)' and we.exercise_id = outdoor_id;
end $$;

-- Notion history logged bodyweight reps in the weight column ("Leg Raise 15 lb" with no reps). Frank confirmed these
-- were reps (2026-11-09). Move them where reps is empty; a set with both filled is left as it is.
update sets s
set reps = round(s.weight)::integer, weight = null
from workout_exercises we join exercises e on e.id = we.exercise_id
where we.id = s.workout_exercise_id
  and e.measure = 'reps'
  and s.reps is null
  and s.weight is not null;
