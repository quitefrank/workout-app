-- Bodyweight moves record reps only, so the active workout shows no weight stepper (Frank's call, 2026-11-11).
-- None of these rows has a set with a weight. Weighted, Assisted (the counterweight is the load), Decline Weighted
-- Crunch, Farmers Walks and Plate Front Raises keep their weight.
update exercises set measure = 'reps'
where slug in (
  'staggered-squats', 'behind-the-heel-squats', 'hawaiian-squats', 'shrimp-squats', 'pistol-squats', 'dragon-squats',
  'muscle-up', 'hip-hike-on-wall-with-foam-roller'
);

-- Leg Raise is done on the captain's chair: back on the pad, forearms on the arm rests (Frank, 2026-11-11).
update exercises set option_position = 'Captain''s Chair', title = 'Captain''s Chair Leg Raise'
where slug = 'leg-raise';
