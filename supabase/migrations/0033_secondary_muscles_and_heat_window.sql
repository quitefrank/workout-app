-- Secondary muscles: the groups a lift also trains, counted at half a set each in Home's Last 7 Days (Frank's call,
-- 2026-11-11; Pelland 2025, ref 187 of the ACSM 2026 position stand: fractional counting, an indirect set as 0.5,
-- predicted growth best). The main group stays exercises.muscle_group_id. Keyed by family and main group, so every
-- version of a lift shares its helpers; a family that spans groups (Deadlift) gets one row per main group.
-- No seed writes this column.
alter table exercises add column secondary_muscle_group_ids uuid[] not null default '{}';

with m(movement, main, secondaries) as (
  values
    ('Bench Press', 'Chest', array['Triceps', 'Shoulders']),
    ('Push-Up', 'Chest', array['Triceps', 'Shoulders']),
    ('Fly', 'Chest', array['Shoulders']),
    ('Dip', 'Triceps', array['Chest', 'Shoulders']),
    ('Lat Pulldown', 'Back', array['Biceps']),
    ('Pull-Up', 'Back', array['Biceps']),
    ('Chin-Up', 'Back', array['Biceps']),
    ('Row', 'Back', array['Biceps', 'Shoulders']),
    ('Lat Pull-Over', 'Back', array['Chest', 'Triceps']),
    ('Curl', 'Biceps', array['Forearms']),
    ('Shoulder Press', 'Shoulders', array['Triceps']),
    ('Face Pull', 'Shoulders', array['Back']),
    ('Reverse Fly', 'Shoulders', array['Back']),
    ('Squat', 'Quadriceps', array['Glutes']),
    ('Leg Press', 'Quadriceps', array['Glutes']),
    ('Lunge', 'Glutes', array['Quadriceps']),
    ('Hip Thrust', 'Glutes', array['Hamstrings']),
    ('Deadlift', 'Glutes', array['Hamstrings', 'Back', 'Quadriceps']),
    ('Deadlift', 'Hamstrings', array['Glutes', 'Back'])
)
update exercises e
set secondary_muscle_group_ids = array(
  select g.id from unnest(m.secondaries) with ordinality s(name, n) join muscle_groups g on g.name = s.name order by s.n
)
from m join muscle_groups main on main.name = m.main
where e.movement = m.movement and e.muscle_group_id = main.id;

-- In no family yet
update exercises
set secondary_muscle_group_ids = array(select id from muscle_groups where name = 'Shoulders')
where slug = 'cable-press-around';

-- Home's Last 7 Days counts a rolling seven days or Monday to Sunday (Frank's call, 2026-11-11). A setting, not a
-- device cookie, because it is a training preference.
alter table user_settings add column heat_window text not null default 'rolling'
  check (heat_window in ('rolling', 'week'));
