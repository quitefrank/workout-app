-- One exercise per movement, with the floor as a value on each logged row. The
-- upstairs and downstairs library rows, and the program seed's third copy of three
-- of them, become one exercise marked has_floors. Frank's call, 2026-11-04. Weights
-- differ by floor, so everything logged keeps the floor it was done on, and PRs,
-- charts and "last time" are worked out per floor.
--
-- The row kept is the one with the most history, and it takes the plain slug.
-- History and templates move to it. Its alternates are kept, free slots fill from
-- the merged rows, and any alternate pointing at a merged row now points at it.

alter table exercises
  add column has_floors boolean not null default false;

comment on column exercises.has_floors is
  'Can be done on either floor. The floor itself is on each logged row, workout_exercises.machine_location.';

alter table workout_exercises
  add column machine_location machine_location;

comment on column workout_exercises.machine_location is
  'The floor this was done on, for an exercise with has_floors. Null otherwise.';

-- One top set per floor: a workout can do the same exercise on both
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
  and s.weight is not null
  and s.reps is not null
order by we.workout_id, we.exercise_id, we.machine_location, (s.weight * s.reps) desc, s.weight desc;

-- FLOOR AND MERGE
update workout_exercises we
set machine_location = e.machine_location
from exercises e
where e.id = we.exercise_id and e.machine_location is not null;

do $$
declare
  g record;
  keep_id uuid;
  gone_ids uuid[];
  alt record;
  slot integer;
begin
  for g in
    select * from (values
      ('cable-crossover', 'cable-crossover-upstairs', array['cable-crossover-downstairs', 'cable-crossover']),
      ('cable-crunch', 'cable-crunch-downstairs', array['cable-crunch-upstairs', 'cable-crunch']),
      ('cable-press-around', 'cable-press-around-upstairs-2', array['cable-press-around-upstairs', 'cable-press-around-downstairs']),
      ('cable-y-raise', 'cable-y-raise-upstairs', array['cable-y-raise-downstairs']),
      ('cross-body-tricep-extension', 'cross-body-tricep-extension-downstairs', array['cross-body-tricep-extension-upstairs']),
      ('lat-pull-downs-dropset', 'lat-pull-downs-dropset-upstairs', array['lat-pull-downs-dropset-downstairs']),
      ('lat-pull-downs-main', 'lat-pull-downs-main-upstairs', array['lat-pull-downs-main-downstairs']),
      ('omni-direction-face-pull', 'omni-direction-face-pull-upstairs', array['omni-direction-face-pull-downstairs', 'omni-direction-face-pull']),
      ('omni-grip-rows', 'omni-grip-rows-upstairs', array['omni-grip-rows-downstairs']),
      ('overhead-extension-stretch-only', 'overhead-extension-stretch-only-upstairs', array['overhead-extension-stretch-only-downstairs']),
      ('tricep-press-down-squeeze-only', 'tricep-press-down-squeeze-only-downstairs', array['tricep-press-down-squeeze-only-upstairs'])
    ) as v(base, keep_slug, gone_slugs)
  loop
    select id into keep_id from exercises where slug = g.keep_slug;
    if keep_id is null then
      continue; -- a fresh database has no library rows yet
    end if;
    select coalesce(array_agg(id), '{}') into gone_ids from exercises where slug = any(g.gone_slugs);

    update workout_exercises set exercise_id = keep_id where exercise_id = any(gone_ids);
    update template_exercises set exercise_id = keep_id where exercise_id = any(gone_ids);

    -- A merged row's alternates fill the kept row's free slots, in order
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

    -- Alternates pointing at a merged row now point at the kept one
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

    update exercises set slug = g.base, has_floors = true where id = keep_id;
  end loop;
end $$;

-- A floor is no longer a property of an exercise
alter table exercises drop column machine_location;
