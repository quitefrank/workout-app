-- Omni-Grip Pull-Up comes back as a version of Pull-Up: Nippard names it as the first substitute for Omni-Grip Lat
-- Pulldown in the Ultimate PPL (weeks 11 to 13), and Frank keeps what Nippard's programs use (2026-11-07). The program
-- seed owns the row (LIBRARY_ATTRIBUTES); this gives it its place in the family.
update exercises set option_rank = 3 where slug = 'weighted-pull-up';
update exercises
set movement = 'Pull-Up', option_equipment = 'Bodyweight', option_position = null, option_technique = 'Omni-Grip', option_rank = 2,
    title = 'Omni-Grip Pull-Up'
where slug = 'omni-grip-pull-up';
