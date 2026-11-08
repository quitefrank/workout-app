-- What a row in a workout replaced when it was swapped during the workout (Frank's active workout redesign,
-- 2026-11-08). The swap sheet and a version switch set it to the exercise the row started as, and clear it when
-- the row is switched back. Finishing with "Keep swaps in template" writes the new exercise onto the template row
-- that held the old one. Null means the row is what the template prescribed.
--
-- A column on an existing table keeps that table's grants, so none are needed here.

alter table workout_exercises
  add column swapped_from_exercise_id uuid references exercises(id) on delete set null;

comment on column workout_exercises.swapped_from_exercise_id is
  'The exercise this row replaced during the workout; null when it is what the template prescribed.';
