-- Powerbuilding Phase 3.0 (5x) brings three exercises the library did not have. The program seed owns the rows
-- (LIBRARY_ATTRIBUTES); this gives each its place in a family, as 0023 did for Omni-Grip Pull-Up. Run after the
-- program seed has inserted them; on a database without the rows each update touches nothing.
--
-- Anderson Squat: a pin squat that starts and ends on the pins, so its own version of Squat.
-- Barbell Pin Bench Press: a press from pins set just above the chest, its own version of Bench Press.
-- Pin Good Morning: the first Good Morning in the library, a family of its own.
update exercises
set movement = 'Squat', option_equipment = 'Barbell', option_position = 'Standard', option_technique = 'Anderson',
    option_rank = 12, title = 'Barbell Anderson Squat'
where slug = 'anderson-squat';

update exercises
set movement = 'Bench Press', option_equipment = 'Barbell', option_position = 'Flat', option_technique = 'Pin',
    option_rank = 30, title = 'Barbell Pin Bench Press'
where slug = 'barbell-pin-bench-press';

update exercises
set movement = 'Good Morning', option_equipment = 'Barbell', option_position = null, option_technique = 'Pin',
    option_rank = 0, title = 'Barbell Pin Good Morning'
where slug = 'pin-good-morning';
