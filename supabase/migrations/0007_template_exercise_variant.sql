-- A set-type or technique label on a template row, from the programme's
-- own wording: "Top Set", "Back Off AMRAP", "Feeder Sets", "21's",
-- "Ladder", "Slow (3 up, 3 down)". The exercise stays the base movement
-- so history and alternates attach to one library row. Null when the
-- row is a plain prescription.

alter table template_exercises
  add column variant text;
