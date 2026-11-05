-- Exercises filed under the wrong muscle group, or none. Frank's call, 2026-11-05.
update exercises e
set muscle_group_id = mg.id
from (values
  ('bent-over-cable-flies', 'Shoulders'),
  ('cable-y-raise', 'Shoulders'),
  ('cable-external-rotations', 'Shoulders'),
  ('dead-bug-kicks', 'Abs'),
  ('french-press', 'Triceps'),
  ('neutral-grip-pull-up', 'Back'),
  ('shrugs', 'Back')
) as fix(slug, muscle_group)
join muscle_groups mg on mg.name = fix.muscle_group
where e.slug = fix.slug;
