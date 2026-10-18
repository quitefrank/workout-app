-- Rehab templates: the ankle and tendon work a physiotherapist or a
-- protocol prescribes, filed by phase alongside the strength days that
-- run with them.
--
-- A template category for that work. The recovery program's Push,
-- Pull and Legs keep their own categories.

alter type template_category add value if not exists 'rehab';

-- Where a template's content comes from, and what still needs the
-- physio's sign-off before it is used. needs_signoff is null when the
-- content comes from the treating clinicians or their handout; anything
-- from outside that chain (a public guide, another protocol) says here
-- what to ask. Existing columns on an existing table, so no new grants.

alter table templates
  add column source_id uuid references sources(id) on delete set null,
  add column needs_signoff text;

create index templates_source_id_idx on templates(source_id);

-- The program you are following, so the app can put its next workout
-- in front of you, and the phase you set by hand for a recovery
-- program. A null phase means the app works the phase out: the
-- clearance log while it is current, else the calendar. Existing
-- per-user table, already granted and filtered by auth.uid().

alter table user_settings
  add column active_program_id uuid references programs(id) on delete set null,
  add column program_phase_position integer
    check (program_phase_position is null or program_phase_position >= 1);
