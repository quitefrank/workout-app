-- Cable Elbows Out Row is Cable Wide Grip Row under Nippard's name (Frank's call, 2026-11-11):
-- the same seated cable pull with the elbows flared. The Notion row is kept, since it holds the
-- history, and PPL 1.0's eight template rows move to it. Their notes keep Nippard's cue.
-- LIBRARY_ALIASES stops the program seed inserting the row again.

create or replace function pg_temp.merge_exercise(keep_slug text, gone_slug text) returns void
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
  update workout_exercises set swapped_from_exercise_id = keep_id where swapped_from_exercise_id = gone.id;
  update template_exercises set exercise_id = keep_id where exercise_id = gone.id;

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

  delete from exercise_alternates where exercise_id = keep_id and alternate_exercise_id = gone.id;
  delete from exercise_alternates a
  where a.alternate_exercise_id = gone.id
    and exists (
      select 1 from exercise_alternates b
      where b.exercise_id = a.exercise_id and b.alternate_exercise_id = keep_id
    );
  update exercise_alternates set alternate_exercise_id = keep_id where alternate_exercise_id = gone.id;

  delete from exercises where id = gone.id;
end $$;

select pg_temp.merge_exercise('wide-grip-cable-row', 'cable-seated-elbows-out-row');

drop function pg_temp.merge_exercise(text, text);
