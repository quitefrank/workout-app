-- A drop set is a value on a logged set, for any exercise. Frank's call, 2026-11-05.
-- It counts toward volume and never competes for the top set, so PRs and "best set"
-- stay on straight sets.
--
-- The library's Lat Pull-Downs (main) and (dropset), the program seed's Lat Pulldown and
-- Notion's Machine Pulldown become one exercise, Lat Pulldown. The row kept is main,
-- which has the set history, the floors and the demo link. Everything logged against
-- (dropset) is marked a drop set. In a workout that has both on one floor, those sets
-- join the main row after its own sets.
--
-- Arnold Press becomes Seated Arnold Press, apart from Standing Arnold Press.

alter table sets
  add column is_drop_set boolean not null default false;

comment on column sets.is_drop_set is
  'A drop set: counts toward volume, excluded from the top set. Applies to any exercise.';

create or replace view v_workout_exercise_top_set
with (security_invoker = true) as
select distinct on (we.workout_id, we.exercise_id, we.machine_location)
  we.workout_id,
  w.user_id,
  we.id as workout_exercise_id,
  we.exercise_id,
  s.id as set_id,
  s.weight,
  s.reps,
  (s.weight * s.reps) as volume,
  s.completed_at,
  w.completed_at as workout_completed_at,
  we.machine_location
from workout_exercises we
join workouts w on w.id = we.workout_id
join sets s on s.workout_exercise_id = we.id
where not s.is_warm_up
  and not s.is_drop_set
  and s.weight is not null
  and s.reps is not null
order by we.workout_id, we.exercise_id, we.machine_location, (s.weight * s.reps) desc, s.weight desc;

do $$
declare
  keep_id uuid;
  drop_id uuid;
  gone_ids uuid[];
  r record;
  main_we uuid;
  top integer;
  drop_notes text;
  alt record;
  slot integer;
begin
  select id into keep_id from exercises where slug = 'lat-pull-downs-main';
  if keep_id is null then
    return; -- a fresh database has no library rows yet
  end if;
  select id, notes into drop_id, drop_notes from exercises where slug = 'lat-pull-downs-dropset';
  select coalesce(array_agg(id), '{}') into gone_ids
  from exercises where slug in ('lat-pull-downs-dropset', 'lat-pulldown', 'machine-pulldown');

  update sets s set is_drop_set = true
  from workout_exercises we
  where we.id = s.workout_exercise_id and we.exercise_id = drop_id and not s.is_warm_up;

  for r in select id, workout_id, machine_location from workout_exercises where exercise_id = drop_id loop
    select id into main_we from workout_exercises
    where workout_id = r.workout_id and exercise_id = keep_id and machine_location is not distinct from r.machine_location
    order by position limit 1;
    continue when main_we is null;
    select coalesce(max(set_number), 0) into top from sets where workout_exercise_id = main_we;
    update sets set workout_exercise_id = main_we, set_number = set_number + top where workout_exercise_id = r.id;
    delete from workout_exercises where id = r.id;
  end loop;

  update workout_exercises set exercise_id = keep_id where exercise_id = any(gone_ids);

  -- The dropset row of a template stays a row of its own, labelled, with its instructions
  update template_exercises
  set variant = coalesce(variant, 'Dropset'), notes = coalesce(notes, drop_notes)
  where exercise_id = drop_id;
  update template_exercises set exercise_id = keep_id where exercise_id = any(gone_ids);

  -- As in 0009: alternates fill free slots, and any pointing at a merged row point at the kept one
  for alt in
    select a.alternate_exercise_id, a.notes
    from exercise_alternates a
    where a.exercise_id = any(gone_ids)
      and a.alternate_exercise_id <> keep_id
      and a.alternate_exercise_id <> all(gone_ids)
    order by array_position(gone_ids, a.exercise_id), a.position
  loop
    if exists (
      select 1 from exercise_alternates
      where exercise_id = keep_id and alternate_exercise_id = alt.alternate_exercise_id
    ) then
      continue;
    end if;
    select s into slot from unnest(array[1, 2]) s
    where not exists (select 1 from exercise_alternates where exercise_id = keep_id and position = s)
    order by s limit 1;
    exit when slot is null;
    insert into exercise_alternates (exercise_id, alternate_exercise_id, position, notes)
    values (keep_id, alt.alternate_exercise_id, slot, alt.notes);
  end loop;

  delete from exercise_alternates where exercise_id = keep_id and alternate_exercise_id = any(gone_ids);
  delete from exercise_alternates a
  where a.alternate_exercise_id = any(gone_ids)
    and exists (
      select 1 from exercise_alternates b
      where b.exercise_id = a.exercise_id and b.alternate_exercise_id = keep_id
    );
  update exercise_alternates
  set alternate_exercise_id = keep_id
  where id in (
    select distinct on (exercise_id) id from exercise_alternates
    where alternate_exercise_id = any(gone_ids) and exercise_id <> all(gone_ids)
    order by exercise_id, position
  );
  delete from exercises where id = any(gone_ids); -- their remaining alternates cascade

  update exercises set name = 'Lat Pulldown', slug = 'lat-pulldown' where id = keep_id;
end $$;

update exercises
set name = 'Seated Arnold Press', slug = 'seated-arnold-press', _notion_id = 'program:exercise:seated-arnold-press'
where slug = 'arnold-press';
