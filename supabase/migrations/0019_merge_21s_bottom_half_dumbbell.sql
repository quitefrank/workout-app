-- 21s are a rep scheme, not an exercise, Frank's call, 2026-11-05. Their sets already say 21 reps, so they move to
-- EZ-Bar Bicep Curls unchanged, and the program's row keeps the scheme as its variant and the how-to as its note.
--
-- Bottom-Half Preacher Curls were done with dumbbells, so the row is tagged Dumbbell, not the barbell first inferred.

create function pg_temp.merge_exercise(keep_slug text, gone_slug text) returns void
language plpgsql as $$
declare
  keep_id uuid;
  gone record;
  alt record;
  slot integer;
begin
  select id into keep_id from exercises where slug = keep_slug;
  select * into gone from exercises where slug = gone_slug;
  if keep_id is null or gone.id is null then
    return; -- a fresh database has no library rows yet, and the seeds keep them merged
  end if;

  update exercises
  set has_floors = has_floors or gone.has_floors,
      notes = coalesce(notes, gone.notes),
      video_url = coalesce(video_url, gone.video_url)
  where id = keep_id;

  update workout_exercises set exercise_id = keep_id where exercise_id = gone.id;
  update template_exercises set exercise_id = keep_id where exercise_id = gone.id;

  -- Its alternates fill free slots on the kept row
  for alt in
    select alternate_exercise_id, notes
    from exercise_alternates
    where exercise_id = gone.id and alternate_exercise_id <> keep_id
    order by position
  loop
    continue when exists (
      select 1 from exercise_alternates
      where exercise_id = keep_id and alternate_exercise_id = alt.alternate_exercise_id
    );
    select s into slot from unnest(array[1, 2]) s
    where not exists (select 1 from exercise_alternates where exercise_id = keep_id and position = s)
    order by s limit 1;
    exit when slot is null;
    insert into exercise_alternates (exercise_id, alternate_exercise_id, position, notes)
    values (keep_id, alt.alternate_exercise_id, slot, alt.notes);
  end loop;

  -- Alternates pointing at it point at the kept row, unless that row is already there or is the exercise itself
  delete from exercise_alternates where exercise_id = keep_id and alternate_exercise_id = gone.id;
  delete from exercise_alternates a
  where a.alternate_exercise_id = gone.id
    and exists (
      select 1 from exercise_alternates b
      where b.exercise_id = a.exercise_id and b.alternate_exercise_id = keep_id
    );
  update exercise_alternates set alternate_exercise_id = keep_id where alternate_exercise_id = gone.id;

  delete from exercises where id = gone.id; -- its remaining alternates cascade
end $$;

update template_exercises
set variant = '21''s',
    notes = coalesce(notes, '7 reps seated, 7 reps standing full ROM, 7 reps bottom-half')
where exercise_id = (select id from exercises where slug = 'ez-bar-curls-21s');

select pg_temp.merge_exercise('ez-bar-bicep-curls', 'ez-bar-curls-21s');

update exercises
set option_equipment = 'Dumbbell', equipment_type = 'dumbbell'
where slug = 'bottom-half-preacher-curls';
