-- More families, Frank's calls of 2026-11-11, from the audit of rows with no family. Grouping only:
-- every row keeps its history, PRs and name. Leg Raise and Hanging Leg Raise are different exercises
-- in one family. Alternating Leg-ups, Scissor Kicks and Glute Bridge stay alone for now.
update exercises e
set movement = v.movement, option_equipment = v.equipment, option_position = v.position, option_technique = v.variation, option_rank = v.rank, title = v.title
from (values
  ('leg-press-toe-press', 'Calf Raise', 'Leg Press', 'Seated', null, 2, 'Leg Press Toe Press'),
  ('leg-raise', 'Leg Raise', 'Bodyweight', 'Lying', null, 0, 'Leg Raise'),
  ('hanging-leg-raise', 'Leg Raise', 'Bodyweight', 'Hanging', null, 1, 'Hanging Leg Raise'),
  ('cable-crunch', 'Crunch', 'Cable', null, null, 0, 'Cable Crunch'),
  ('machine-crunch', 'Crunch', 'Machine', null, null, 1, 'Machine Crunch'),
  ('decline-weighted-crunch', 'Crunch', 'Weighted', null, null, 2, 'Decline Weighted Crunch'),
  ('sit-ups', 'Crunch', 'Bodyweight', null, 'Sit-Up', 3, 'Sit-Up'),
  ('v-sit-up', 'Crunch', 'Bodyweight', null, 'V Sit-Up', 4, 'V Sit-Up'),
  ('bicycle-crunches', 'Crunch', 'Bodyweight', null, 'Bicycle', 5, 'Bicycle Crunch'),
  ('staggered-squats', 'Squat', 'Bodyweight', 'Standard', 'Staggered', 12, 'Staggered Squat'),
  ('behind-the-heel-squats', 'Squat', 'Bodyweight', 'Standard', 'Behind the Heel', 13, 'Behind the Heel Squat'),
  ('hawaiian-squats', 'Squat', 'Bodyweight', 'Standard', 'Hawaiian', 14, 'Hawaiian Squat'),
  ('shrimp-squats', 'Squat', 'Bodyweight', 'Standard', 'Shrimp', 15, 'Shrimp Squat'),
  ('pistol-squats', 'Squat', 'Bodyweight', 'Standard', 'Pistol', 16, 'Pistol Squat'),
  ('dragon-squats', 'Squat', 'Bodyweight', 'Standard', 'Dragon', 17, 'Dragon Squat'),
  ('nordic-ham-curl', 'Leg Curl', 'Bodyweight', 'Kneeling', null, 4, 'Nordic Ham Curl'),
  ('glute-ham-raise', 'Leg Curl', 'GHD', 'Kneeling', null, 5, 'Glute Ham Raise'),
  ('front-back-leg-swings', 'Leg Swing', 'Bodyweight', null, 'Front/Back', 0, 'Front/Back Leg Swing'),
  ('side-side-leg-swings', 'Leg Swing', 'Bodyweight', null, 'Side/Side', 1, 'Side/Side Leg Swing'),
  ('cross-leg-forward-fold', 'Forward Fold', 'Bodyweight', null, 'Cross Leg', 0, 'Cross Leg Forward Fold'),
  ('wide-leg-forward-fold', 'Forward Fold', 'Bodyweight', null, 'Wide Leg', 1, 'Wide Leg Forward Fold')
) as v(slug, movement, equipment, position, variation, rank, title)
where e.slug = v.slug;
