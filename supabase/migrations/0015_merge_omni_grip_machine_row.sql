-- Nippard's Omni-Grip Machine Chest-Supported Row is the library's Omni-grip Rows under a
-- longer name: the same machine row with the same three grips. Frank's call, 2026-11-05.
-- Omni-grip Rows has the history, the floors and the demo link, and it stays. The long
-- row was never logged, so this moves template rows and one alternate, and no sets.

do $$
declare
  keep_id uuid;
  gone_id uuid;
  alt record;
begin
  select id into keep_id from exercises where slug = 'omni-grip-rows';
  select id into gone_id from exercises where slug = 'omni-grip-machine-chest-supported-row';
  if keep_id is null or gone_id is null then
    return; -- a fresh database has no library rows yet, and the seed's alias keeps it that way
  end if;

  update workout_exercises set exercise_id = keep_id where exercise_id = gone_id;
  update template_exercises set exercise_id = keep_id where exercise_id = gone_id;

  -- Its substitutions fill free slots on the kept row, under the key the program seed uses
  for alt in
    select alternate_exercise_id, position, notes, _notion_id
    from exercise_alternates
    where exercise_id = gone_id and alternate_exercise_id <> keep_id
    order by position
  loop
    continue when exists (
      select 1 from exercise_alternates
      where exercise_id = keep_id
        and (position = alt.position or alternate_exercise_id = alt.alternate_exercise_id)
    );
    insert into exercise_alternates (exercise_id, alternate_exercise_id, position, notes, _notion_id)
    values (
      keep_id,
      alt.alternate_exercise_id,
      alt.position,
      alt.notes,
      replace(alt._notion_id, ':omni-grip-machine-chest-supported-row:', ':omni-grip-rows:')
    );
  end loop;

  delete from exercises where id = gone_id; -- its remaining alternates cascade
end $$;
