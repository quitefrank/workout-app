-- Exercise families, Frank's calls of 2026-11-05 to 2026-11-07, reviewed in the Exercise Family Map prototype.
-- A family (exercises.movement) is one movement. Each row is one version of it, set apart by three choices:
-- equipment, position (the bench or how the body is set) and variation (option_technique, shown as Variation).
-- Equipment is the parent: it decides the positions, and equipment with position decides the variations.
-- title is the version's display name, built as equipment, position, variation, exercise, with defaults left out
-- ("Smith Machine Incline Bench Press"); a machine with its own name stands in for the exercise ("Pec Deck").
-- name keeps the source spelling for search, and the seeds never touch movement, the options or title.

alter table exercises
  add column option_position text,
  add column option_rank integer,
  add column title text;

comment on column exercises.option_position is 'How the body is set within the family: a bench angle, a support or a stance. Null when the family has no positions.';
comment on column exercises.option_rank is 'Order of this version within its family, for the menus.';
comment on column exercises.title is 'The version''s display name. Null shows name.';
comment on column exercises.option_technique is 'The variation within the family and equipment and position: grip, range, tempo, one side, a named style. Null is the standard way.';


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


-- Set instructions are one exercise with their standard row, as the 21s became: the program row keeps the instruction
-- as its variant, and everything logged moves (none of these was logged).

update template_exercises set variant = coalesce(variant, 'Eccentric-Accentuated') where exercise_id = (select id from exercises where slug = 'eccentric-accentuated-pull-up');
select pg_temp.merge_exercise('pull-ups', 'eccentric-accentuated-pull-up');
update template_exercises set variant = coalesce(variant, 'Cheat') where exercise_id = (select id from exercises where slug = 'hammer-cheat-curl');
select pg_temp.merge_exercise('hammer-curls', 'hammer-cheat-curl');
update template_exercises set variant = coalesce(variant, 'Negative') where exercise_id = (select id from exercises where slug = 'concentration-curl-negative');
select pg_temp.merge_exercise('dumbbell-concentration-curl', 'concentration-curl-negative');
update template_exercises set variant = coalesce(variant, 'Enhanced-Eccentric') where exercise_id = (select id from exercises where slug = 'enhanced-eccentric-lying-leg-curl');
select pg_temp.merge_exercise('lying-leg-curl', 'enhanced-eccentric-lying-leg-curl');
update template_exercises set variant = coalesce(variant, 'Enhanced-Eccentric') where exercise_id = (select id from exercises where slug = 'enhanced-eccentric-leg-extension');
select pg_temp.merge_exercise('leg-extensions', 'enhanced-eccentric-leg-extension');
update template_exercises set variant = coalesce(variant, 'Constant-Tension') where exercise_id = (select id from exercises where slug = 'constant-tension-cable-lateral-raise');
select pg_temp.merge_exercise('cable-lateral-raise', 'constant-tension-cable-lateral-raise');
update template_exercises set variant = coalesce(variant, 'Constant-Tension') where exercise_id = (select id from exercises where slug = 'constant-tension-machine-lateral-raise');
select pg_temp.merge_exercise('machine-lateral-raises', 'constant-tension-machine-lateral-raise');

-- New versions in no program: bench positions on every equipment, and the gaps Frank named. A fresh database has
-- no muscle groups yet, so these insert nothing there.
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'EZ-Bar Preacher Bottom-Half Curl', 'ez-bar-preacher-bottom-half-curl', id, 'other', 'library:ez-bar-preacher-bottom-half-curl' from muscle_groups where name = 'Biceps' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Barbell Low Incline Bench Press', 'barbell-low-incline-bench-press', id, 'barbell', 'library:barbell-low-incline-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Barbell High Incline Bench Press', 'barbell-high-incline-bench-press', id, 'barbell', 'library:barbell-high-incline-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Dumbbell High Incline Bench Press', 'dumbbell-high-incline-bench-press', id, 'dumbbell', 'library:dumbbell-high-incline-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Dumbbell Decline Bench Press', 'dumbbell-decline-bench-press', id, 'dumbbell', 'library:dumbbell-decline-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Low Incline Machine Chest Press', 'low-incline-machine-chest-press', id, 'machine', 'library:low-incline-machine-chest-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'High Incline Machine Chest Press', 'high-incline-machine-chest-press', id, 'machine', 'library:high-incline-machine-chest-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Decline Machine Chest Press', 'decline-machine-chest-press', id, 'machine', 'library:decline-machine-chest-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Smith Machine Bench Press', 'smith-machine-bench-press', id, 'machine', 'library:smith-machine-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Smith Machine Incline Bench Press', 'smith-machine-incline-bench-press', id, 'machine', 'library:smith-machine-incline-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Smith Machine Decline Bench Press', 'smith-machine-decline-bench-press', id, 'machine', 'library:smith-machine-decline-bench-press' from muscle_groups where name = 'Chest' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Machine Seated Single-Leg Leg Curl', 'machine-seated-single-leg-leg-curl', id, 'machine', 'library:machine-seated-single-leg-leg-curl' from muscle_groups where name = 'Hamstrings' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Barbell Seated Shoulder Press', 'barbell-seated-shoulder-press', id, 'barbell', 'library:barbell-seated-shoulder-press' from muscle_groups where name = 'Shoulders' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Dumbbell Standing Shoulder Press', 'dumbbell-standing-shoulder-press', id, 'dumbbell', 'library:dumbbell-standing-shoulder-press' from muscle_groups where name = 'Shoulders' on conflict (slug) do nothing;
insert into exercises (name, slug, muscle_group_id, equipment_type, _notion_id) select 'Close-Grip Dip', 'close-grip-dip', id, 'bodyweight', 'library:close-grip-dip' from muscle_groups where name = 'Triceps' on conflict (slug) do nothing;

-- Triceps Pressdown splits back into the standard pressdown and Nippard's squeeze-only variation. Every logged
-- pressdown was squeeze-only (Frank, 2026-11-07), so the history moves to the new row, with the program rows that
-- carried the squeeze-only instruction.
insert into exercises (name, slug, muscle_group_id, equipment_type, has_floors, video_url, notes, _notion_id)
select 'Squeeze-Only Triceps Pressdown', 'squeeze-only-triceps-pressdown', muscle_group_id, 'cable', has_floors, video_url, notes, 'library:squeeze-only-triceps-pressdown'
from exercises where slug = 'triceps-pressdown'
on conflict (slug) do nothing;
update workout_exercises set exercise_id = (select id from exercises where slug = 'squeeze-only-triceps-pressdown')
where exercise_id = (select id from exercises where slug = 'triceps-pressdown');
update template_exercises set exercise_id = (select id from exercises where slug = 'squeeze-only-triceps-pressdown'), variant = null
where exercise_id = (select id from exercises where slug = 'triceps-pressdown') and variant ilike 'squeeze%';

-- Nippard's stretch-only overhead extension is the cable extension through its stretched half: Frank's row for it
-- takes the program rows, and its equipment is cable (no machine version exists).
update template_exercises set exercise_id = (select id from exercises where slug = 'overhead-extension-stretch-only'), variant = null
where exercise_id = (select id from exercises where slug = 'overhead-cable-triceps-extension') and variant ilike 'stretch%'
  and exists (select 1 from exercises where slug = 'overhead-extension-stretch-only');
update exercises set equipment_type = 'cable' where slug in ('overhead-extension-stretch-only', 'omni-direction-face-pull');

-- Lunges file under Glutes, where the studies put the main work with the quads.
update exercises set muscle_group_id = (select id from muscle_groups where name = 'Glutes')
where slug in ('walking-db-lunge', 'smith-machine-reverse-lunge') and exists (select 1 from muscle_groups where name = 'Glutes');

-- The families. Rows not listed stand alone.
update exercises set movement = null, option_equipment = null, option_position = null, option_technique = null, option_rank = null, title = null;
update exercises e
set movement = v.movement, option_equipment = v.equipment, option_position = v.position, option_technique = v.variation, option_rank = v.rank, title = v.title
from (values
  ('front-plank', 'Plank', 'Bodyweight', null, null, 0, 'Plank'),
  ('llpt-plank', 'Plank', 'Bodyweight', null, 'Long-Lever', 1, 'Long-Lever Plank'),
  ('barbell-row', 'Row', 'Barbell', 'Bent-Over', null, 0, 'Barbell Row'),
  ('pendlay-row', 'Row', 'Barbell', 'Bent-Over', 'Pendlay', 1, 'Barbell Pendlay Row'),
  ('meadows-row', 'Row', 'Barbell', 'Bent-Over', 'Meadows', 2, 'Barbell Meadows Row'),
  ('seal-row', 'Row', 'Barbell', 'Chest-Supported', null, 3, 'Seal Row'),
  ('dumbbell-rows', 'Row', 'Dumbbell', 'Bent-Over', null, 4, 'Dumbbell Row'),
  ('kroc-row', 'Row', 'Dumbbell', 'Bent-Over', 'Kroc', 5, 'Dumbbell Kroc Row'),
  ('incline-chest-supported-db-row', 'Row', 'Dumbbell', 'Chest-Supported', null, 6, 'Dumbbell Chest-Supported Row'),
  ('t-bar-row', 'Row', 'T-Bar', 'Bent-Over', null, 7, 'T-Bar Row'),
  ('wide-grip-t-bar-row', 'Row', 'T-Bar', 'Bent-Over', 'Wide Grip', 8, 'T-Bar Wide Grip Row'),
  ('chest-supported-t-bar-row', 'Row', 'T-Bar', 'Chest-Supported', null, 9, 'T-Bar Chest-Supported Row'),
  ('chest-supported-t-bar-row-w-band', 'Row', 'T-Bar', 'Chest-Supported', 'Band', 10, 'T-Bar Chest-Supported Band Row'),
  ('cable-seated-row', 'Row', 'Cable', 'Seated', null, 11, 'Cable Row'),
  ('cable-seated-elbows-out-row', 'Row', 'Cable', 'Seated', 'Elbows Out', 12, 'Cable Elbows Out Row'),
  ('wide-grip-cable-row', 'Row', 'Cable', 'Seated', 'Wide Grip', 13, 'Cable Wide Grip Row'),
  ('machine-low-row', 'Row', 'Machine', 'Seated', 'Low Grip', 14, 'Machine Low Grip Row'),
  ('machine-high-row', 'Row', 'Machine', 'Seated', 'High Grip', 15, 'Machine High Grip Row'),
  ('wide-grip-machine-row', 'Row', 'Machine', 'Seated', 'Wide Grip', 16, 'Machine Wide Grip Row'),
  ('omni-grip-rows', 'Row', 'Machine', 'Seated', 'Omni-Grip', 17, 'Machine Omni-Grip Row'),
  ('lat-pulldown', 'Lat Pulldown', 'Machine', 'Seated', null, 0, 'Lat Pulldown'),
  ('neutral-grip-lat-pulldown', 'Lat Pulldown', 'Machine', 'Seated', 'Neutral Grip', 1, 'Neutral Grip Lat Pulldown'),
  ('omni-grip-lat-pulldown', 'Lat Pulldown', 'Machine', 'Seated', 'Omni-Grip', 2, 'Omni-Grip Lat Pulldown'),
  ('underhand-lat-pulldown', 'Lat Pulldown', 'Machine', 'Seated', 'Underhand', 3, 'Underhand Lat Pulldown'),
  ('1-arm-cable-pulldown', 'Lat Pulldown', 'Cable', 'Half-Kneeling', '1-Arm', 4, 'Cable 1-Arm Lat Pulldown'),
  ('pull-ups', 'Pull-Up', 'Bodyweight', null, null, 0, 'Pull-Up'),
  ('neutral-grip-pull-up', 'Pull-Up', 'Bodyweight', null, 'Neutral Grip', 1, 'Neutral Grip Pull-Up'),
  ('weighted-pull-up', 'Pull-Up', 'Weighted', null, null, 2, 'Weighted Pull-Up'),
  ('chin-ups', 'Chin-Up', 'Bodyweight', null, null, 0, 'Chin-Up'),
  ('assisted-chin-up', 'Chin-Up', 'Assisted', null, null, 1, 'Assisted Chin-Up'),
  ('cable-pullover', 'Lat Pull-Over', 'Cable', null, null, 0, 'Cable Lat Pull-Over'),
  ('dumbbell-pullovers', 'Lat Pull-Over', 'Dumbbell', null, null, 1, 'Dumbbell Lat Pull-Over'),
  ('bottom-half-db-lat-pullover', 'Lat Pull-Over', 'Dumbbell', null, 'Bottom-Half', 2, 'Dumbbell Bottom-Half Lat Pull-Over'),
  ('shrugs', 'Shrug', 'Barbell', 'Standing', null, 0, 'Barbell Shrug'),
  ('snatch-grip-barbell-shrug', 'Shrug', 'Barbell', 'Standing', 'Snatch Grip', 1, 'Barbell Snatch Grip Shrug'),
  ('db-shrug', 'Shrug', 'Dumbbell', 'Standing', null, 2, 'Dumbbell Shrug'),
  ('cable-shrugs', 'Shrug', 'Cable', 'Standing', null, 3, 'Cable Shrug'),
  ('plate-shrug', 'Shrug', 'Plate', 'Standing', null, 4, 'Plate Shrug'),
  ('incline-shrug', 'Shrug', 'Dumbbell', 'Incline', null, 5, 'Dumbbell Incline Shrug'),
  ('ez-bar-bicep-curls', 'Curl', 'EZ-Bar', 'Standing', null, 0, 'EZ-Bar Bicep Curl'),
  ('db-curls', 'Curl', 'Dumbbell', 'Standing', null, 1, 'Dumbbell Bicep Curl'),
  ('cable-curl', 'Curl', 'Cable', 'Standing', null, 2, 'Cable Bicep Curl'),
  ('single-arm-cable-curl', 'Curl', 'Cable', 'Standing', '1-Arm', 3, 'Cable 1-Arm Curl'),
  ('overhead-cable-bicep-curls', 'Curl', 'Cable', 'Overhead', null, 4, 'Cable Overhead Curl'),
  ('hammer-curls', 'Curl', 'Dumbbell', 'Standing', 'Hammer', 5, 'Dumbbell Hammer Curl'),
  ('reverse-grip-ez-bar-curl', 'Curl', 'EZ-Bar', 'Standing', 'Reverse', 6, 'EZ-Bar Reverse Curl'),
  ('dumbbell-pronated-curl', 'Curl', 'Dumbbell', 'Standing', 'Reverse', 7, 'Dumbbell Reverse Curl'),
  ('inverse-zottman-curl', 'Curl', 'Dumbbell', 'Standing', 'Zottman', 8, 'Dumbbell Zottman Curl'),
  ('bayesian-cable-curl', 'Curl', 'Cable', 'Bayesian', null, 9, 'Cable Bayesian Curl'),
  ('bottom-half-bayesian-curl', 'Curl', 'Cable', 'Bayesian', 'Bottom-Half', 10, 'Cable Bayesian Bottom-Half Curl'),
  ('incline-dumbbell-curl', 'Curl', 'Dumbbell', 'Incline', null, 11, 'Dumbbell Incline Curl'),
  ('lying-incline-death-curls', 'Curl', 'Dumbbell', 'Incline', 'Death', 12, 'Dumbbell Incline Death Curl'),
  ('barbell-preacher-curl', 'Curl', 'Barbell', 'Preacher', null, 13, 'Barbell Preacher Curl'),
  ('ez-bar-preacher-bottom-half-curl', 'Curl', 'EZ-Bar', 'Preacher', 'Bottom-Half', 14, 'EZ-Bar Preacher Bottom-Half Curl'),
  ('dumbbell-preacher-curl', 'Curl', 'Dumbbell', 'Preacher', null, 15, 'Dumbbell Preacher Curl'),
  ('bottom-half-preacher-curls', 'Curl', 'Dumbbell', 'Preacher', 'Bottom-Half', 16, 'Dumbbell Preacher Bottom-Half Curl'),
  ('dumbbell-preacher-hammer-curl', 'Curl', 'Dumbbell', 'Preacher', 'Hammer', 17, 'Dumbbell Preacher Hammer Curl'),
  ('preacher-death-curls', 'Curl', 'Dumbbell', 'Preacher', 'Death', 18, 'Dumbbell Preacher Death Curl'),
  ('machine-preacher-curl', 'Curl', 'Machine', 'Preacher', null, 19, 'Machine Preacher Curl'),
  ('dumbbell-concentration-curl', 'Curl', 'Dumbbell', 'Concentration', null, 20, 'Dumbbell Concentration Curl'),
  ('spider-curl', 'Curl', 'Dumbbell', 'Spider', null, 21, 'Dumbbell Spider Curl'),
  ('bottom-half-spider-curl', 'Curl', 'Dumbbell', 'Spider', 'Bottom-Half', 22, 'Dumbbell Spider Bottom-Half Curl'),
  ('bench-press-flat', 'Bench Press', 'Barbell', 'Flat', null, 0, 'Barbell Bench Press'),
  ('pause-barbell-bench-press', 'Bench Press', 'Barbell', 'Flat', 'Pause', 1, 'Barbell Pause Bench Press'),
  ('flat-back-bench-press', 'Bench Press', 'Barbell', 'Flat', 'Flat-Back', 2, 'Barbell Flat-Back Bench Press'),
  ('larsen-press', 'Bench Press', 'Barbell', 'Flat', 'Larsen', 3, 'Barbell Larsen Press'),
  ('db-bench-press', 'Bench Press', 'Dumbbell', 'Flat', null, 4, 'Dumbbell Bench Press'),
  ('db-larsen-press', 'Bench Press', 'Dumbbell', 'Flat', 'Larsen', 5, 'Dumbbell Larsen Press'),
  ('machine-chest-press', 'Bench Press', 'Machine', 'Flat', null, 6, 'Machine Chest Press'),
  ('bench-press-incline', 'Bench Press', 'Barbell', 'Incline', null, 7, 'Barbell Incline Bench Press'),
  ('close-grip-incline-press', 'Bench Press', 'Barbell', 'Incline', 'Close-Grip', 8, 'Barbell Incline Close-Grip Bench Press'),
  ('db-bench-press-incline', 'Bench Press', 'Dumbbell', 'Incline', null, 9, 'Dumbbell Incline Bench Press'),
  ('close-grip-db-incline-press', 'Bench Press', 'Dumbbell', 'Incline', 'Close-Grip', 10, 'Dumbbell Incline Close-Grip Bench Press'),
  ('incline-machine-press', 'Bench Press', 'Machine', 'Incline', null, 11, 'Incline Machine Chest Press'),
  ('db-bench-press-low-incline', 'Bench Press', 'Dumbbell', 'Low Incline', null, 12, 'Dumbbell Low Incline Bench Press'),
  ('low-incline-smith-machine-press', 'Bench Press', 'Smith Machine', 'Low Incline', null, 13, 'Smith Machine Low Incline Bench Press'),
  ('high-incline-smith-machine-press', 'Bench Press', 'Smith Machine', 'High Incline', null, 14, 'Smith Machine High Incline Bench Press'),
  ('bench-press-decline', 'Bench Press', 'Barbell', 'Decline', null, 15, 'Barbell Decline Bench Press'),
  ('barbell-floor-press', 'Bench Press', 'Barbell', 'Floor', null, 16, 'Barbell Floor Press'),
  ('close-grip-machine-press', 'Bench Press', 'Machine', 'Flat', 'Close-Grip', 17, 'Close-Grip Machine Chest Press'),
  ('close-grip-bench-press', 'Bench Press', 'Barbell', 'Flat', 'Close-Grip', 18, 'Barbell Close-Grip Bench Press'),
  ('close-grip-smith-machine-press', 'Bench Press', 'Smith Machine', 'Flat', 'Close-Grip', 19, 'Smith Machine Close-Grip Bench Press'),
  ('barbell-low-incline-bench-press', 'Bench Press', 'Barbell', 'Low Incline', null, 20, 'Barbell Low Incline Bench Press'),
  ('barbell-high-incline-bench-press', 'Bench Press', 'Barbell', 'High Incline', null, 21, 'Barbell High Incline Bench Press'),
  ('dumbbell-high-incline-bench-press', 'Bench Press', 'Dumbbell', 'High Incline', null, 22, 'Dumbbell High Incline Bench Press'),
  ('dumbbell-decline-bench-press', 'Bench Press', 'Dumbbell', 'Decline', null, 23, 'Dumbbell Decline Bench Press'),
  ('low-incline-machine-chest-press', 'Bench Press', 'Machine', 'Low Incline', null, 24, 'Low Incline Machine Chest Press'),
  ('high-incline-machine-chest-press', 'Bench Press', 'Machine', 'High Incline', null, 25, 'High Incline Machine Chest Press'),
  ('decline-machine-chest-press', 'Bench Press', 'Machine', 'Decline', null, 26, 'Decline Machine Chest Press'),
  ('smith-machine-bench-press', 'Bench Press', 'Smith Machine', 'Flat', null, 27, 'Smith Machine Bench Press'),
  ('smith-machine-incline-bench-press', 'Bench Press', 'Smith Machine', 'Incline', null, 28, 'Smith Machine Incline Bench Press'),
  ('smith-machine-decline-bench-press', 'Bench Press', 'Smith Machine', 'Decline', null, 29, 'Smith Machine Decline Bench Press'),
  ('push-ups', 'Push-Up', 'Bodyweight', 'Standard', null, 0, 'Push-Up'),
  ('diamond-push-ups', 'Push-Up', 'Bodyweight', 'Standard', 'Diamond', 1, 'Diamond Push-Up'),
  ('deficit-push-up', 'Push-Up', 'Bodyweight', 'Standard', 'Deficit', 2, 'Deficit Push-Up'),
  ('kneeling-modified-push-up', 'Push-Up', 'Bodyweight', 'Kneeling', null, 3, 'Kneeling Push-Up'),
  ('med-ball-push-up', 'Push-Up', 'Bodyweight', 'Standard', 'Med-Ball', 4, 'Med-Ball Push-Up'),
  ('dumbbell-flyes', 'Fly', 'Dumbbell', 'Flat', null, 0, 'Dumbbell Fly'),
  ('flat-to-incline-db-flye', 'Fly', 'Dumbbell', 'Flat to Incline', null, 1, 'Dumbbell Flat to Incline Fly'),
  ('cable-crossover', 'Fly', 'Cable', 'Standard', null, 2, 'Cable Fly'),
  ('low-to-high-cable-flye', 'Fly', 'Cable', 'Low to High', null, 3, 'Cable Low to High Fly'),
  ('pec-deck', 'Fly', 'Pec Deck', 'Seated', null, 4, 'Pec Deck'),
  ('standing-calf-raise', 'Calf Raise', 'Machine', 'Standing', null, 0, 'Standing Calf Raise'),
  ('seated-calf-raise', 'Calf Raise', 'Machine', 'Seated', null, 1, 'Seated Calf Raise'),
  ('forearm-wrist-curl', 'Wrist Curl', 'Dumbbell', null, null, 0, 'Wrist Curl'),
  ('reverse-grip-forearm-wrist-curl', 'Wrist Curl', 'Dumbbell', null, 'Reverse', 1, 'Reverse Wrist Curl'),
  ('deadlifts', 'Deadlift', 'Barbell', null, null, 0, 'Barbell Deadlift'),
  ('pause-deadlift', 'Deadlift', 'Barbell', null, 'Pause', 1, 'Barbell Pause Deadlift'),
  ('3-block-pull', 'Deadlift', 'Barbell', null, '3" Block', 2, 'Barbell 3" Block Deadlift'),
  ('5-block-pull', 'Deadlift', 'Barbell', null, '5" Block', 3, 'Barbell 5" Block Deadlift'),
  ('trap-bar-deadlift', 'Deadlift', 'Trap Bar', null, null, 4, 'Trap Bar Deadlift'),
  ('barbell-rdl', 'Deadlift', 'Barbell', null, 'Romanian', 5, 'Barbell Romanian Deadlift'),
  ('snatch-grip-romanian-deadlift', 'Deadlift', 'Barbell', null, 'Snatch-Grip Romanian', 6, 'Barbell Snatch-Grip Romanian Deadlift'),
  ('dumbbell-rdl', 'Deadlift', 'Dumbbell', null, 'Romanian', 7, 'Dumbbell Romanian Deadlift'),
  ('stiff-leg-deadlifts', 'Deadlift', 'Barbell', null, 'Stiff-Leg', 8, 'Barbell Stiff-Leg Deadlift'),
  ('45-hyperextension', 'Hyperextension', 'Bodyweight', null, null, 0, 'Hyperextension'),
  ('round-back-dumbbell-45-hyperextension', 'Hyperextension', 'Dumbbell', null, 'Round-Back', 1, 'Dumbbell Round-Back Hyperextension'),
  ('walking-db-lunge', 'Lunge', 'Dumbbell', null, 'Walking', 0, 'Dumbbell Walking Lunge'),
  ('smith-machine-reverse-lunge', 'Lunge', 'Smith Machine', null, 'Reverse', 1, 'Smith Machine Reverse Lunge'),
  ('hip-thrust', 'Hip Thrust', 'Barbell', null, null, 0, 'Hip Thrust'),
  ('pause-barbell-hip-thrust', 'Hip Thrust', 'Barbell', null, 'Pause', 1, 'Pause Hip Thrust'),
  ('lying-leg-curl', 'Leg Curl', 'Machine', 'Lying', null, 0, 'Machine Lying Leg Curl'),
  ('seated-leg-curl', 'Leg Curl', 'Machine', 'Seated', null, 1, 'Machine Seated Leg Curl'),
  ('swiss-ball-single-leg-leg-curl', 'Leg Curl', 'Swiss Ball', 'Lying', 'Single-Leg', 2, 'Swiss Ball Single-Leg Leg Curl'),
  ('machine-seated-single-leg-leg-curl', 'Leg Curl', 'Machine', 'Seated', 'Single-Leg', 3, 'Machine Seated Single-Leg Leg Curl'),
  ('back-squat', 'Squat', 'Barbell', 'Standard', null, 0, 'Barbell Squat'),
  ('low-bar-back-squat', 'Squat', 'Barbell', 'Standard', 'Low-Bar', 1, 'Barbell Low-Bar Squat'),
  ('pause-squat', 'Squat', 'Barbell', 'Standard', 'Pause', 2, 'Barbell Pause Squat'),
  ('high-bar-box-squat', 'Squat', 'Barbell', 'Standard', 'High-Bar Box', 3, 'Barbell High-Bar Box Squat'),
  ('sumo-box-squat', 'Squat', 'Barbell', 'Standard', 'Sumo Box', 4, 'Barbell Sumo Box Squat'),
  ('smith-squats', 'Squat', 'Smith Machine', 'Standard', null, 5, 'Smith Machine Squat'),
  ('front-squat', 'Squat', 'Barbell', 'Standard', 'Front', 6, 'Barbell Front Squat'),
  ('goblet-squat', 'Squat', 'Dumbbell', 'Standard', 'Goblet', 7, 'Dumbbell Goblet Squat'),
  ('hack-squats', 'Squat', 'Hack Squat', 'Standard', null, 8, 'Hack Squat'),
  ('pause-hack-squat', 'Squat', 'Hack Squat', 'Standard', 'Pause', 9, 'Pause Hack Squat'),
  ('db-bulgarian-split-squats', 'Squat', 'Dumbbell', 'Bulgarian Split', null, 10, 'Dumbbell Bulgarian Split Squat'),
  ('pause-db-bulgarian-split-squat', 'Squat', 'Dumbbell', 'Bulgarian Split', 'Pause', 11, 'Dumbbell Pause Bulgarian Split Squat'),
  ('leg-extensions', 'Leg Extension', 'Machine', null, null, 0, 'Leg Extension'),
  ('single-leg-leg-extension', 'Leg Extension', 'Machine', null, 'Single-Leg', 1, 'Single-Leg Leg Extension'),
  ('leg-press', 'Leg Press', 'Machine', null, null, 0, 'Leg Press'),
  ('single-leg-leg-press', 'Leg Press', 'Machine', null, 'Single-Leg', 1, 'Single-Leg Leg Press'),
  ('db-lateral-raise', 'Lateral Raise', 'Dumbbell', 'Standing', null, 0, 'Dumbbell Lateral Raise'),
  ('lean-in-db-lateral-raise', 'Lateral Raise', 'Dumbbell', 'Lean-In', null, 1, 'Dumbbell Lean-In Lateral Raise'),
  ('cable-lateral-raise', 'Lateral Raise', 'Cable', 'Standing', null, 2, 'Cable Lateral Raise'),
  ('egyptian-cable-lateral-raise', 'Lateral Raise', 'Cable', 'Egyptian', null, 3, 'Cable Egyptian Lateral Raise'),
  ('machine-lateral-raises', 'Lateral Raise', 'Machine', 'Seated', null, 4, 'Machine Lateral Raise'),
  ('bent-over-reverse-db-flies', 'Reverse Fly', 'Dumbbell', 'Bent-Over', null, 0, 'Dumbbell Reverse Fly'),
  ('reverse-cable-flies', 'Reverse Fly', 'Cable', 'Standard', null, 1, 'Cable Reverse Fly'),
  ('low-to-high-reverse-flye', 'Reverse Fly', 'Cable', 'Low to High', null, 2, 'Cable Low to High Reverse Fly'),
  ('reverse-pec-deck', 'Reverse Fly', 'Pec Deck', 'Seated', null, 3, 'Reverse Pec Deck'),
  ('overhead-press', 'Shoulder Press', 'Barbell', 'Standing', null, 0, 'Barbell Shoulder Press'),
  ('overhead-press-push-press', 'Shoulder Press', 'Barbell', 'Standing', 'Push Press', 1, 'Barbell Push Press'),
  ('db-shoulder-press', 'Shoulder Press', 'Dumbbell', 'Seated', null, 2, 'Dumbbell Shoulder Press'),
  ('machine-shoulder-press', 'Shoulder Press', 'Machine', 'Seated', null, 3, 'Machine Shoulder Press'),
  ('seated-arnold-press', 'Shoulder Press', 'Dumbbell', 'Seated', 'Arnold', 4, 'Arnold Press'),
  ('standing-arnold-press', 'Shoulder Press', 'Dumbbell', 'Standing', 'Arnold', 5, 'Standing Arnold Press'),
  ('barbell-seated-shoulder-press', 'Shoulder Press', 'Barbell', 'Seated', null, 6, 'Barbell Seated Shoulder Press'),
  ('dumbbell-standing-shoulder-press', 'Shoulder Press', 'Dumbbell', 'Standing', null, 7, 'Dumbbell Standing Shoulder Press'),
  ('face-pull', 'Face Pull', 'Cable', 'Standing', null, 0, 'Face Pull'),
  ('seated-face-pull', 'Face Pull', 'Cable', 'Seated', null, 1, 'Seated Face Pull'),
  ('omni-direction-face-pull', 'Face Pull', 'Cable', 'Standing', 'Omni-Direction', 2, 'Omni-Direction Face Pull'),
  ('upright-row', 'Upright Row', 'Barbell', null, null, 0, 'Barbell Upright Row'),
  ('rope-upright-row', 'Upright Row', 'Cable', null, null, 1, 'Cable Upright Row'),
  ('triceps-pressdown', 'Triceps Pressdown', 'Cable', null, null, 0, 'Triceps Pressdown'),
  ('squeeze-only-triceps-pressdown', 'Triceps Pressdown', 'Cable', null, 'Squeeze-Only', 1, 'Squeeze-Only Triceps Pressdown'),
  ('triceps-v-bar-pressdown', 'Triceps Pressdown', 'Cable', null, 'V-Bar', 2, 'V-Bar Triceps Pressdown'),
  ('single-arm-tricep-pressdown', 'Triceps Pressdown', 'Cable', null, '1-Arm', 3, '1-Arm Triceps Pressdown'),
  ('overhead-cable-triceps-extension', 'Overhead Triceps Extension', 'Cable', null, null, 0, 'Cable Overhead Triceps Extension'),
  ('1-arm-overhead-cable-extension', 'Overhead Triceps Extension', 'Cable', null, '1-Arm', 1, 'Cable 1-Arm Overhead Triceps Extension'),
  ('overhead-extension-stretch-only', 'Overhead Triceps Extension', 'Cable', null, 'Stretch-Only', 2, 'Cable Stretch-Only Overhead Triceps Extension'),
  ('french-press', 'Overhead Triceps Extension', 'EZ-Bar', null, null, 3, 'EZ-Bar Overhead Triceps Extension'),
  ('skull-crusher', 'Skull Crusher', 'Barbell', 'Bench', null, 0, 'Barbell Skull Crusher'),
  ('floor-skullcrushers', 'Skull Crusher', 'Barbell', 'Floor', null, 1, 'Barbell Floor Skull Crusher'),
  ('db-skull-crushers', 'Skull Crusher', 'Dumbbell', 'Bench', null, 2, 'Dumbbell Skull Crusher'),
  ('cable-tricep-kickback', 'Triceps Kickback', 'Cable', null, null, 0, 'Cable Triceps Kickback'),
  ('db-triceps-kickback', 'Triceps Kickback', 'Dumbbell', null, null, 1, 'Dumbbell Triceps Kickback'),
  ('dip', 'Dip', 'Bodyweight', null, null, 0, 'Dip'),
  ('weighted-dips', 'Dip', 'Weighted', null, null, 1, 'Weighted Dip'),
  ('weighted-dip-close-grip', 'Dip', 'Weighted', null, 'Close-Grip', 2, 'Weighted Close-Grip Dip'),
  ('close-grip-dip', 'Dip', 'Bodyweight', null, 'Close-Grip', 3, 'Close-Grip Dip')
) as v(slug, movement, equipment, position, variation, rank, title)
where e.slug = v.slug;
