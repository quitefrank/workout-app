-- Machine Chest Press (No Leg Drive) is Machine Chest Press with a cue, Frank's call, 2026-11-07: a seated machine's
-- back pad already takes away most leg drive, so the two are one exercise. Nippard offers it as the Larsen Press's
-- substitute, and the Larsen Press row's own note already says "Zero leg drive", so the cue is not lost.
-- Neither row has anything logged; the merge moves the alternates that point at it.

drop function if exists pg_temp.merge_exercise(text, text); -- 0019 left its copy in the session

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

select pg_temp.merge_exercise('machine-chest-press', 'machine-chest-press-no-leg-drive');
drop function pg_temp.merge_exercise(text, text);
