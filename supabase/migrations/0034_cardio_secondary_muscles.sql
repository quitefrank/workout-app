-- Cardio's secondary muscles (Frank's calls, 2026-11-13): the Library has no Cardio card, so each cardio exercise shows
-- under Secondary on the muscles it works. Home's Last 7 Days lists a cardio exercise under these muscles with its
-- minutes but counts no sets for it (heat.ts): the ACSM 2026 baseline counts resistance sets, and the paper gives no
-- rate for aerobic work. Keyed by slug, as cardio has no families. No seed writes this column.
with m(slug, secondaries) as (
  values
    ('running', array['Quadriceps', 'Hamstrings', 'Glutes', 'Calves']),
    ('warm-up-run', array['Quadriceps', 'Hamstrings', 'Glutes', 'Calves']),
    ('treadmill-run', array['Quadriceps', 'Hamstrings', 'Glutes', 'Calves']),
    ('warm-up-walk', array['Quadriceps', 'Hamstrings', 'Glutes', 'Calves']),
    ('max-incline-walk', array['Quadriceps', 'Hamstrings', 'Glutes', 'Calves']),
    ('indoor-bike', array['Quadriceps', 'Glutes', 'Hamstrings']),
    ('elliptical-machine', array['Quadriceps', 'Glutes', 'Hamstrings']),
    ('rowing-machine', array['Quadriceps', 'Glutes', 'Hamstrings', 'Back'])
)
update exercises e
set secondary_muscle_group_ids = array(
  select g.id from unnest(m.secondaries) with ordinality s(name, n) join muscle_groups g on g.name = s.name order by s.n
)
from m
where e.slug = m.slug;
