-- Program names drop the author and anything in brackets (Frank's call, 2026-11-10).
-- The name is the program seed's identity: templates, template_exercises and
-- exercise_alternates are keyed "program:<name>:..." in _notion_id, and an
-- alternate's notes read "Substitution from <name>". Renaming the rows in
-- place keeps every template, logged workout and alternate attached; the
-- converters write the same new names, so a reseed matches these rows.

update public.programs p
set name = r.new_name
from (values
  ('Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)', 'Ultimate Push Pull Legs System'),
  ('Jeff Nippard, Legs/Push/Pull Hypertrophy Program (PPL 1.0)', 'Legs/Push/Pull Hypertrophy Program'),
  ('Jeff Nippard, Powerbuilding System (4x per week)', 'Powerbuilding System'),
  ('Jeff Nippard, Arm Hypertrophy Program', 'Arm Hypertrophy Program')
) as r(old_name, new_name)
where p.name = r.old_name;

update public.templates t
set _notion_id = 'program:' || r.new_name || substr(t._notion_id, length('program:' || r.old_name) + 1)
from (values
  ('Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)', 'Ultimate Push Pull Legs System'),
  ('Jeff Nippard, Legs/Push/Pull Hypertrophy Program (PPL 1.0)', 'Legs/Push/Pull Hypertrophy Program'),
  ('Jeff Nippard, Powerbuilding System (4x per week)', 'Powerbuilding System'),
  ('Jeff Nippard, Arm Hypertrophy Program', 'Arm Hypertrophy Program')
) as r(old_name, new_name)
where starts_with(t._notion_id, 'program:' || r.old_name || ':');

update public.template_exercises te
set _notion_id = 'program:' || r.new_name || substr(te._notion_id, length('program:' || r.old_name) + 1)
from (values
  ('Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)', 'Ultimate Push Pull Legs System'),
  ('Jeff Nippard, Legs/Push/Pull Hypertrophy Program (PPL 1.0)', 'Legs/Push/Pull Hypertrophy Program'),
  ('Jeff Nippard, Powerbuilding System (4x per week)', 'Powerbuilding System'),
  ('Jeff Nippard, Arm Hypertrophy Program', 'Arm Hypertrophy Program')
) as r(old_name, new_name)
where starts_with(te._notion_id, 'program:' || r.old_name || ':');

update public.exercise_alternates a
set _notion_id = 'program:' || r.new_name || substr(a._notion_id, length('program:' || r.old_name) + 1)
from (values
  ('Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)', 'Ultimate Push Pull Legs System'),
  ('Jeff Nippard, Legs/Push/Pull Hypertrophy Program (PPL 1.0)', 'Legs/Push/Pull Hypertrophy Program'),
  ('Jeff Nippard, Powerbuilding System (4x per week)', 'Powerbuilding System'),
  ('Jeff Nippard, Arm Hypertrophy Program', 'Arm Hypertrophy Program')
) as r(old_name, new_name)
where starts_with(a._notion_id, 'program:' || r.old_name || ':');

update public.exercise_alternates a
set notes = replace(a.notes, r.old_name, r.new_name)
from (values
  ('Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)', 'Ultimate Push Pull Legs System'),
  ('Jeff Nippard, Legs/Push/Pull Hypertrophy Program (PPL 1.0)', 'Legs/Push/Pull Hypertrophy Program'),
  ('Jeff Nippard, Powerbuilding System (4x per week)', 'Powerbuilding System'),
  ('Jeff Nippard, Arm Hypertrophy Program', 'Arm Hypertrophy Program')
) as r(old_name, new_name)
where strpos(a.notes, r.old_name) > 0;
