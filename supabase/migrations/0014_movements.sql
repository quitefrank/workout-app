-- One movement on screen, every row kept. Frank's call, 2026-11-05: the library rows stay, each with its
-- own image and history, and rows that are one movement are grouped by these three values. Picking other
-- equipment or another technique switches to that row. Rows with no movement are their own thing.

alter table exercises
  add column movement text,
  add column option_equipment text,
  add column option_technique text;

comment on column exercises.movement is 'The movement this row is one way of doing, shown as one entry. Null when it stands alone.';
comment on column exercises.option_equipment is 'What sets this row apart within its movement: the equipment.';
comment on column exercises.option_technique is 'What sets this row apart within its movement and equipment: the technique. Null is the standard way.';

create index exercises_movement_idx on exercises(movement);

update exercises e
set movement = v.movement, option_equipment = v.equipment, option_technique = v.technique
from (values
  ('bench-press-flat', 'Bench Press', 'Barbell', null),
  ('db-bench-press', 'Bench Press', 'Dumbbell', null),
  ('machine-chest-press', 'Bench Press', 'Machine', null),
  ('pause-barbell-bench-press', 'Bench Press', 'Barbell', 'Pause'),
  ('flat-back-bench-press', 'Bench Press', 'Barbell', 'Flat-Back'),
  ('db-bench-press-no-leg-drive', 'Bench Press', 'Dumbbell', 'No Leg Drive'),
  ('machine-chest-press-no-leg-drive', 'Bench Press', 'Machine', 'No Leg Drive'),
  ('bench-press-incline', 'Incline Bench Press', 'Barbell', null),
  ('db-bench-press-incline', 'Incline Bench Press', 'Dumbbell', null),
  ('incline-machine-press', 'Incline Bench Press', 'Machine', null),
  ('cable-pullover', 'Pullover', 'Cable', null),
  ('lat-pull-over', 'Pullover', 'Cable', 'Lat Pull-Over'),
  ('dumbbell-pullovers', 'Pullover', 'Dumbbell', null),
  ('bottom-half-db-lat-pullover', 'Pullover', 'Dumbbell', 'Bottom-Half'),
  ('db-lateral-raise', 'Lateral Raise', 'Dumbbell', null),
  ('cable-lateral-raise', 'Lateral Raise', 'Cable', null),
  ('machine-lateral-raises', 'Lateral Raise', 'Machine', null),
  ('bench-db-lateral-raise', 'Lateral Raise', 'Dumbbell', 'Seated'),
  ('egyptian-cable-lateral-raise', 'Lateral Raise', 'Cable', 'Egyptian'),
  ('lean-in-constant-tension-db-lateral-raise', 'Lateral Raise', 'Dumbbell', 'Constant Tension'),
  ('constant-tension-cable-lateral-raise', 'Lateral Raise', 'Cable', 'Constant Tension'),
  ('constant-tension-machine-lateral-raise', 'Lateral Raise', 'Machine', 'Constant Tension'),
  ('ez-bar-bicep-curls', 'Bicep Curl', 'EZ-Bar', null),
  ('db-curls', 'Bicep Curl', 'Dumbbell', null),
  ('cable-curl', 'Bicep Curl', 'Cable', null),
  ('ez-bar-curls-21s', 'Bicep Curl', 'EZ-Bar', '21s'),
  ('overhead-press', 'Shoulder Press', 'Barbell', null),
  ('db-shoulder-press', 'Shoulder Press', 'Dumbbell', null),
  ('machine-shoulder-press', 'Shoulder Press', 'Machine', null),
  ('shrugs', 'Shrug', 'Barbell', null),
  ('db-shrug', 'Shrug', 'Dumbbell', null),
  ('cable-shrugs', 'Shrug', 'Cable', null),
  ('plate-shrug', 'Shrug', 'Plate', null),
  ('snatch-grip-barbell-shrug', 'Shrug', 'Barbell', 'Snatch Grip'),
  ('bent-over-reverse-db-flies', 'Reverse Fly', 'Dumbbell', null),
  ('reverse-cable-flies', 'Reverse Fly', 'Cable', null),
  ('reverse-pec-deck', 'Reverse Fly', 'Machine', null),
  ('barbell-rdl', 'Romanian Deadlift', 'Barbell', null),
  ('dumbbell-rdl', 'Romanian Deadlift', 'Dumbbell', null),
  ('skull-crusher', 'Skull Crusher', 'Barbell', null),
  ('db-skull-crushers', 'Skull Crusher', 'Dumbbell', null),
  ('floor-skullcrushers', 'Skull Crusher', 'Barbell', 'Floor'),
  ('cable-tricep-kickback', 'Triceps Kickback', 'Cable', null),
  ('db-triceps-kickback', 'Triceps Kickback', 'Dumbbell', null),
  ('triceps-pressdown', 'Triceps Pressdown', 'Cable', null),
  ('triceps-v-bar-pressdown', 'Triceps Pressdown', 'Cable', 'V-Bar')
) as v(slug, movement, equipment, technique)
where e.slug = v.slug;
