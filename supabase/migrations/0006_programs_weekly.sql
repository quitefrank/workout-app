-- Additions for demonstration clips, weekly programme phases, template
-- ordering inside a phase, and recorded rule overrides.
--
-- video_credit     who owns a demonstration clip and where it came from,
--                  shown next to the embed
-- block            groups one-week phases of a training programme
--                  ("Base Hypertrophy"); null for the recovery program
-- position         the order of templates inside a phase, so the app can
--                  say which day comes next without the user choosing
-- override_rule    the authoring rule (spec section 6) a template row
--                  knowingly breaks, with the reason; null when none

alter table exercises
  add column video_credit text;

alter table program_phases
  add column block text;

alter table template_phases
  add column position integer;

alter table template_exercises
  add column override_rule integer
    check (override_rule is null or override_rule between 1 and 11),
  add column override_reason text,
  add constraint template_exercises_override_pair
    check ((override_rule is null) = (override_reason is null));
