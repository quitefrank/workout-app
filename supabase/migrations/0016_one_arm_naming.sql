-- Frank's call, 2026-11-05. Two changes.
--
-- 1. Nippard's single-arm pulldown and the half-kneeling row are one exercise, done on the cable
-- machine, as 1-Arm Cable Pulldown. The half-kneeling row has the history and stays. The other
-- row was never logged, and its floor sit, mat and floor transfer were left over from the boot;
-- they go with it. Its template rows move, and no sets do.
--
-- 2. "1-Arm" is the spelling, never "Single-Arm". Names change and slugs stay, because the
-- program files still spell them that way and the seed matches on the slug.

do $$
declare
  keep_id uuid;
  gone_id uuid;
begin
  select id into keep_id from exercises where slug = '1-arm-half-kneeling-lat-pulldown';
  select id into gone_id from exercises where slug = 'single-arm-cable-pulldown';
  if keep_id is null then
    return; -- a fresh database has no library rows yet; the seeds write the new names
  end if;

  if gone_id is not null then
    update workout_exercises set exercise_id = keep_id where exercise_id = gone_id;
    update template_exercises set exercise_id = keep_id where exercise_id = gone_id;
    delete from exercises where id = gone_id; -- it has no alternates, and any would cascade
  end if;

  -- The new name drops the position, so the note carries it
  update exercises
  set name = '1-Arm Cable Pulldown',
      slug = '1-arm-cable-pulldown',
      notes = 'Half kneeling, 90° legs, stop mid-line.'
  where id = keep_id;
end $$;

update exercises set name = '1-Arm Cable Curl' where slug = 'single-arm-cable-curl';
update exercises set name = '1-Arm Tricep Pressdown' where slug = 'single-arm-tricep-pressdown';
