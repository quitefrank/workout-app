-- 0025's foreign key gave workout_exercises a second relationship to exercises, so every embed of
-- exercises(...) from workout_exercises became ambiguous and PostgREST refused it ("more than one relationship
-- was found"). The column stays as a plain id; the app only reads it to write the swap onto the template, and
-- an exercise that is deleted later simply matches no template row.

alter table workout_exercises
  drop constraint if exists workout_exercises_swapped_from_exercise_id_fkey;
