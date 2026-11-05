-- Recovery workouts and the exercises only they used come out of the library: Frank is back
-- to normal training (his call, 2026-11-05). Nothing removed has a logged set. The recovery
-- log itself (recoveries, clearances, events, rules, the program row and its phases) stays.
-- Rows a training program also prescribes stay.
--
-- Two more merges, as in 0009: 1-Arm Half Kneeling Lat Pulldown, and Triceps Pressdown, which
-- takes Tricep Press-down (squeeze only) and Machine Press-down. Everything logged moves to the
-- row kept, the one with the history.

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
      ('lat-pull-downs-1-arm-half-kneeling', '1-arm-half-kneeling-lat-pulldown', '1-Arm Half Kneeling Lat Pulldown', array['1-arm-half-kneeling-lat-pulldown'], 'cable', null),
      ('tricep-press-down-squeeze-only', 'triceps-pressdown', 'Triceps Pressdown', array['triceps-pressdown', 'machine-press-down'], null, 'Squeeze Only')
    ) as v(keep_slug, new_slug, new_name, gone_slugs, new_equipment, variant)
  loop
    select id into keep_id from exercises where slug = g.keep_slug;
    if keep_id is null then
      continue; -- a fresh database has no library rows yet
    end if;
    select coalesce(array_agg(id), '{}') into gone_ids from exercises where slug = any(g.gone_slugs);

    update template_exercises set variant = coalesce(variant, g.variant) where exercise_id = keep_id and g.variant is not null;
    update workout_exercises set exercise_id = keep_id where exercise_id = any(gone_ids);
    update template_exercises set exercise_id = keep_id where exercise_id = any(gone_ids);

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
    delete from exercises where id = any(gone_ids);

    update exercises
    set name = g.new_name, slug = g.new_slug, equipment_type = coalesce(g.new_equipment::equipment_type, equipment_type)
    where id = keep_id;
  end loop;
end $$;

-- Follow nothing until Frank picks a training program
update user_settings
set active_program_id = null, program_phase_position = null
where active_program_id in (select id from programs where kind = 'recovery');

delete from templates where program_id in (select id from programs where kind = 'recovery');

-- Alternates chosen for the boot, on rows that stay
delete from exercise_alternates where _notion_id like 'achilles:%';

-- PPL 1.0 prescribes this one, so it stays under the program's own name
update exercises
set name = 'Seated Face Pull', slug = 'seated-face-pull', _notion_id = 'program:exercise:seated-face-pull'
where slug = 'seated-cable-face-pull';

-- Empty log rows, and any workout left with nothing logged at all. A row with sets stops this
-- migration, because exercises are on delete restrict.
do $$
declare
  recovery_only uuid[];
  emptied uuid[];
begin
  select coalesce(array_agg(id), '{}') into recovery_only from exercises where slug in (
    'side-lying-hip-abductions',
    'seated-russian-twists',
    'supine-marches',
    'modified-push-ups',
    'ball-wall-squats',
    'sit-to-stand-from-a-high-surface',
    'tricep-extensions-supine',
    'shoulder-press-in-a-walking-boot',
    'banded-rows-seated',
    'seated-suitcase-hold',
    'seated-band-hip-abduction',
    'seated-cable-fly',
    'single-leg-calf-raise-sound-leg',
    'leg-extensions-with-band',
    'glute-bridges-in-a-walking-boot',
    'seated-dumbbell-calf-raise-sound-leg',
    'ankle-resistance-band',
    'active-ankle-plantarflexion-and-dorsiflexion-to-neutral',
    'active-ankle-inversion-and-eversion-below-neutral',
    'dorsiflexion-stretching-slowly',
    'single-leg-seated-heel-raise',
    'banded-plantar-flexion',
    'towel-curl',
    'single-leg-balance',
    'retro-walking',
    'seated-double-leg-heel-raise-weighted',
    'standing-heel-raise',
    'staggered-stance-heel-raise',
    'step-down',
    'standing-calf-stretch',
    'double-leg-rebound-heel-raise',
    'hopping-progression',
    'vertical-jump-progression',
    'horizontal-jump-progression',
    'treadmill-walk-jog-progression',
    'plantar-flexion-isometric',
    'short-foot',
    'sprint-cut-and-change-of-direction-drills',
    'straight-leg-raises'
  );
  select coalesce(array_agg(distinct workout_id), '{}') into emptied
  from workout_exercises where exercise_id = any(recovery_only);

  delete from workout_exercises we
  where we.exercise_id = any(recovery_only)
    and not exists (select 1 from sets s where s.workout_exercise_id = we.id);

  delete from workouts w
  where w.id = any(emptied)
    and w.notes is null
    and w.perceived_effort is null
    and not exists (select 1 from workout_exercises we where we.workout_id = w.id);

  delete from exercises where id = any(recovery_only);
end $$;
