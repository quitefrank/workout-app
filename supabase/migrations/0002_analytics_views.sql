-- Analytics views for the workout app.
--
-- All five views use security_invoker = true so that querying a view
-- runs each underlying table's RLS policies against auth.uid().
-- A signed-in user sees only their own data; the service role sees all.

-- ============================================================
-- v_workout_exercise_tonnage
-- Sum of weight * reps for non-warm-up sets, per workout exercise.
-- Meaningful within a single exercise's history. Do not sum across
-- exercises with different equipment types.
-- ============================================================

create view v_workout_exercise_tonnage
with (security_invoker = true) as
select
  we.workout_id,
  w.user_id,
  we.id as workout_exercise_id,
  we.exercise_id,
  sum(s.weight * s.reps) as tonnage,
  count(*) as working_set_count
from workout_exercises we
join workouts w on w.id = we.workout_id
join sets s on s.workout_exercise_id = we.id
where not s.is_warm_up
  and s.weight is not null
  and s.reps is not null
group by we.workout_id, w.user_id, we.id, we.exercise_id;

-- ============================================================
-- v_workout_exercise_top_set
-- The single highest-volume working set per workout per exercise.
-- Drives the "last 4-8 sessions" view in the exercise detail screen.
-- ============================================================

create view v_workout_exercise_top_set
with (security_invoker = true) as
select distinct on (we.workout_id, we.exercise_id)
  we.workout_id,
  w.user_id,
  we.id as workout_exercise_id,
  we.exercise_id,
  s.id as set_id,
  s.weight,
  s.reps,
  (s.weight * s.reps) as volume,
  s.completed_at,
  w.completed_at as workout_completed_at
from workout_exercises we
join workouts w on w.id = we.workout_id
join sets s on s.workout_exercise_id = we.id
where not s.is_warm_up
  and s.weight is not null
  and s.reps is not null
order by we.workout_id, we.exercise_id, (s.weight * s.reps) desc, s.weight desc;

-- ============================================================
-- v_workout_exercise_e1rm
-- Epley estimated 1RM from the top working set per workout per exercise.
-- formula: weight * (1 + reps / 30)
-- ============================================================

create view v_workout_exercise_e1rm
with (security_invoker = true) as
select
  t.workout_id,
  t.user_id,
  t.workout_exercise_id,
  t.exercise_id,
  t.weight,
  t.reps,
  t.workout_completed_at,
  round((t.weight * (1 + t.reps::numeric / 30))::numeric, 2) as estimated_1rm
from v_workout_exercise_top_set t;

-- ============================================================
-- v_muscle_group_weekly_sets
-- Count of non-warm-up sets per muscle group, bucketed by ISO week.
-- Cross-exercise but unit-safe (no weight component).
-- ============================================================

create view v_muscle_group_weekly_sets
with (security_invoker = true) as
select
  w.user_id,
  date_trunc('week', w.completed_at)::date as week_start,
  e.muscle_group_id,
  count(*) as set_count
from sets s
join workout_exercises we on we.id = s.workout_exercise_id
join workouts w on w.id = we.workout_id
join exercises e on e.id = we.exercise_id
where not s.is_warm_up
  and w.completed_at is not null
  and e.muscle_group_id is not null
group by w.user_id, date_trunc('week', w.completed_at), e.muscle_group_id;

-- ============================================================
-- v_user_weekly_workouts
-- Count of completed workouts per ISO week.
-- ============================================================

create view v_user_weekly_workouts
with (security_invoker = true) as
select
  w.user_id,
  date_trunc('week', w.completed_at)::date as week_start,
  count(*) as workout_count
from workouts w
where w.completed_at is not null
group by w.user_id, date_trunc('week', w.completed_at);
