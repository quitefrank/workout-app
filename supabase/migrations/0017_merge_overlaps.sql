-- The overlap audit: rows that are one exercise under two names, Frank's call, 2026-11-05.
-- The row kept holds the history where one has it, and everything logged against the other
-- moves to it, so no set changes. A row's floors, note and demo link carry over only where
-- the kept row lacks them.
--
-- Rows that differ by equipment or technique stay rows and are grouped instead:
-- Scott Curl is a barbell preacher curl, and Hammer Cheat Curl is a technique of Hammer Curl.

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

select pg_temp.merge_exercise('cross-body-tricep-extension', 'n1-style-cross-body-triceps-extension');
select pg_temp.merge_exercise('cable-y-raise', 'cross-body-cable-y-raise-side-delt');
select pg_temp.merge_exercise('cable-press-around', 'press-around');
select pg_temp.merge_exercise('cable-shrugs', 'cable-shrug-in');
select pg_temp.merge_exercise('close-grip-incline-press', 'close-grip-barbell-incline-press');
select pg_temp.merge_exercise('db-larsen-press', 'db-bench-press-no-leg-drive');
select pg_temp.merge_exercise('bench-db-lateral-raise', 'lean-in-constant-tension-db-lateral-raise');
select pg_temp.merge_exercise('reverse-cable-flies', 'bent-over-cable-flies');
select pg_temp.merge_exercise('pause-squat', 'pause-high-bar-squat');
select pg_temp.merge_exercise('incline-chest-supported-db-row', 'helms-row');
select pg_temp.merge_exercise('decline-weighted-crunch', 'plate-weighted-crunch');
select pg_temp.merge_exercise('cable-pullover', 'lat-pull-over');

drop function pg_temp.merge_exercise(text, text);

update exercises
set name = 'Lean-In DB Lateral Raise', slug = 'lean-in-db-lateral-raise', option_technique = 'Lean-In'
where slug = 'bench-db-lateral-raise';

update exercises
set name = 'Barbell Preacher Curl', slug = 'barbell-preacher-curl', _notion_id = 'program:exercise:barbell-preacher-curl'
where slug = 'scott-curl';

-- Larsen Press is its own movement: Frank logs it beside Bench Press, in the same workouts
update exercises set movement = 'Larsen Press', option_equipment = 'Barbell', option_technique = null where slug = 'larsen-press';
update exercises set movement = 'Larsen Press', option_equipment = 'Dumbbell', option_technique = null where slug = 'db-larsen-press';
update exercises set movement = 'Larsen Press', option_equipment = 'Machine', option_technique = null where slug = 'machine-chest-press-no-leg-drive';

update exercises set movement = 'Preacher Curl', option_equipment = 'Barbell', option_technique = null where slug = 'barbell-preacher-curl';
update exercises set movement = 'Preacher Curl', option_equipment = 'Dumbbell', option_technique = null where slug = 'dumbbell-preacher-curl';
update exercises set movement = 'Preacher Curl', option_equipment = 'Machine', option_technique = null where slug = 'machine-preacher-curl';
update exercises set movement = 'Preacher Curl', option_equipment = 'Barbell', option_technique = 'Bottom-Half' where slug = 'bottom-half-preacher-curls';

update exercises set movement = 'Hammer Curl', option_equipment = 'Dumbbell', option_technique = null where slug = 'hammer-curls';
update exercises set movement = 'Hammer Curl', option_equipment = 'Dumbbell', option_technique = 'Cheat' where slug = 'hammer-cheat-curl';

-- Notes written for a temporary setup, on rows the programs still use
update exercises set notes = null where slug in ('front-plank', 'seated-face-pull');
