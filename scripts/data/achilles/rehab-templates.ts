/**
 * The rehab templates, one set per phase of the recovery programme, the
 * way the training programmes have one set of days per week. Category
 * "rehab", so the programme screen lists them apart from the strength
 * rotation and never schedules them: no source gives a frequency for the
 * clinic's exercises.
 *
 * Phases are the handout's, by position in program.ts:
 *   2-5 weeks 2 to 6, 6 weeks 6 to 8, 7 weeks 8 to 12, 8 weeks 12 to 16,
 *   9 week 16+, 10 month 6 to 9, 11 month 12.
 *
 * The clinic's templates come first and are the default. "Achilles
 * Rehab, Weeks 8-12" is the physio's sheet exactly: seven exercises in
 * the sheet's order, its doses as written, blank where it gives none,
 * nothing added. It carries into weeks 12 to 16 because the handout
 * names no new exercises there and the physio has not changed it.
 *
 * The E3 Rehab templates follow E3's five phases, placed on the
 * handout's weeks by E3's own time markers (exercises from about week
 * 2, boot off around weeks 6 to 8, highest risk to about month 3,
 * plyometrics from at least week 12). E3 is outside the authority
 * chain, so each carries needsSignoff, and each row where E3 disagrees
 * with the handout says how in its cue. The handout governs.
 *
 * Overrides are all rule 1: the engine blocks body weight through the
 * foot until the boot is off, and the boot is weaned during weeks 8 to
 * 12, in shoes.
 */

import type { TemplateSeed } from "./types";

const WEAN =
  "The handout weans the boot over weeks 8 to 12 and keeps you in shoes; this is done standing in shoes with something to hold";

const NEUTRAL_LIMIT =
  "Not past neutral in weeks 8 to 12: the handout puts the limit on weighted resisted exercise, standing calf stretches and heel raises, and does not say whether it carries on after week 12. Ask the physio";

export const REHAB_TEMPLATES: TemplateSeed[] = [
  // ------------------------------------------------------------------
  // The clinic: handout and physio sheet
  // ------------------------------------------------------------------
  {
    name: "Achilles Rehab, Weeks 2-6",
    sourceKey: "handout",
    needsSignoff: null,
    category: "rehab",
    variant: "2-6",
    notes:
      'The handout\'s active range of motion for weeks 2 to 6, in the boot with heel lifts: "PLEASE ENSURE ANKLE DOES NOT GO PAST NEUTRAL WHILE DURING EXERCISES". It gives no doses and no frequency. Knee and hip work with no ankle involvement is in Recovery Legs. "LET PAIN BE YOUR GUIDE. If in pain, back off activities and weight bearing."',
    spacingNote: null,
    phases: [2, 3, 4, 5],
    exercises: [
      { slug: "active-ankle-plantarflexion-and-dorsiflexion-to-neutral", dose: null, cue: "To neutral, never past it", override: null },
      { slug: "active-ankle-inversion-and-eversion-below-neutral", dose: null, cue: "Below neutral", override: null },
    ],
  },
  {
    name: "Achilles Rehab, Weeks 6-8",
    sourceKey: "handout",
    needsSignoff: null,
    category: "rehab",
    variant: "6-8",
    notes:
      "The handout's weeks 6 to 8, usually at full weight in the boot as tolerated, with the heel wedges coming out in stages depending on Achilles length. It names dorsiflexion stretching slowly and graduated resistance starting with Theraband, and gives no doses or frequency. It also lists gait retraining, which is not an exercise here, and weight-bearing cardio; the bike was dropped from the boot templates because neither building's bike has a boot rest.",
    spacingNote: null,
    phases: [6],
    exercises: [
      { slug: "dorsiflexion-stretching-slowly", dose: null, cue: "Slowly. No method or dose given", override: null },
      {
        slug: "ankle-resistance-band",
        dose: null,
        variant: "Lighter band",
        cue: "Graduated: a lighter band, then a heavier one. Movements, sets and reps are the physio's call",
        override: null,
      },
    ],
  },
  {
    name: "Achilles Rehab, Weeks 8-12",
    sourceKey: "physio-sheet",
    needsSignoff: null,
    category: "rehab",
    variant: "8-12",
    notes: [
      "Your physio's sheet, items 1 to 6, plus the handout's resistance band. Doses are exactly as written; where the sheet gives none, the dose is blank. Runs until the physio changes it, which is why it carries into weeks 12 to 16.",
      'Frequency: neither the sheet nor the handout says how often. The handout\'s only progression language is "as tolerated", and its only test is "LET PAIN BE YOUR GUIDE".',
      'The handout for this window, in bold: "Ensure patient understands that tendon is still very vulnerable ... Any sudden loading of the Achilles (e.g. Trip, Step up stairs, etc.) may result in a re-rupture." Shoes on for the standing work.',
      "Questions for the physio: 1. How often should each exercise be done, and how many sets for items 2 to 6? 2. Towel scrunch: dose? 3. Item 6: is the calf raise on one leg or both? 4. Item 2: when should weight on the knee be added, and how much? 5. Resistance band: which movements, and what sets and reps? 6. Heel slide: confirm end of range is intended.",
      "Stop and get seen urgently after a pop or snap at the back of the ankle, sudden weakness, or being unable to rise onto the toes. New calf pain, swelling, warmth or redness needs same-day assessment; sudden breathlessness or chest pain is an emergency.",
    ].join("\n\n"),
    spacingNote: null,
    phases: [7, 8],
    exercises: [
      { slug: "seated-passive-heel-slide", dose: "3 x 10 sec", cue: "Holds at end of range (the sheet: \"3x10s holds end of range\")", override: null },
      {
        slug: "seated-calf-raise-hold",
        dose: "45-60 sec",
        cue: 'The sheet: "45s-1min, possible weight on knee". Bodyweight first; weight on the knee is optional and has no trigger on the sheet, so ask the physio',
        override: null,
      },
      { slug: "toe-spread-and-hold", dose: "10-15 sec", cue: null, override: null },
      { slug: "towel-scrunch", dose: null, cue: "No dose on the sheet", override: null },
      {
        slug: "standing-weight-shift-to-single-leg-stand",
        dose: "5 sec",
        cue: "Single-leg stand for 5 s, with arm support. Shoes on",
        override: { rule: 1, reason: `${WEAN}; it is item 5 on the physio's sheet.` },
      },
      {
        slug: "weight-shift-with-calf-raise",
        dose: null,
        cue: "Item 5 with a calf raise. One leg or both is a question for the physio. Flat floor, never off a step edge",
        override: { rule: 1, reason: `${WEAN}; it is item 6 on the physio's sheet.` },
      },
      {
        slug: "ankle-resistance-band",
        dose: null,
        variant: "Lighter band",
        cue: "The handout's Theraband: lighter band, then heavier. Movements, sets and reps are questions for the physio",
        override: null,
      },
    ],
  },

  // ------------------------------------------------------------------
  // E3 Rehab, outside the clinic's protocol
  // ------------------------------------------------------------------
  {
    name: "E3 Rehab 1, Controlled Mobilization",
    sourceKey: "e3rehab",
    needsSignoff:
      "E3 Rehab, not your clinic. It starts seated heel raises and band work from about week 2; the handout keeps weeks 2 to 6 to active movement to neutral and starts Theraband in weeks 6 to 8. The handout governs.",
    category: "rehab",
    variant: "1",
    notes:
      'E3\'s phase 1, in the boot from about week 2: plantar flexion strength, other foot and ankle work, and lower body strength. "Depending on your tolerance, you may perform these 1-3 times per day." E3 also lists a squat to a box once cleared for full weight-bearing, which is the sit to stand in Recovery Legs.',
    spacingNote: null,
    phases: [2, 3, 4, 5, 6],
    exercises: [
      { slug: "single-leg-seated-heel-raise", dose: "2-3 x 10-25", variant: "Bodyweight", cue: "Heel on a wedge early on", override: null },
      { slug: "banded-plantar-flexion", dose: "2-3 x 10-25", variant: "Reps", cue: "Light band. Limit how far you come back into dorsiflexion", override: null },
      { slug: "banded-plantar-flexion", dose: "2-3 x 15-45 sec", variant: "Isometric", cue: "Held against the band", override: null },
      { slug: "plantar-flexion-isometric", dose: "2-3 x 15-45 sec", cue: "Holds. Can be done in the boot", override: null },
      { slug: "towel-scrunch", dose: null, cue: "E3's towel curl. No dose given", override: null },
      { slug: "short-foot", dose: null, cue: "No dose given", override: null },
      { slug: "leg-extensions", dose: null, cue: "Lower body work in the boot. No dose given", override: null },
      { slug: "seated-leg-curl", dose: null, cue: "No dose given", override: null },
    ],
  },
  {
    name: "E3 Rehab 2, Normalize Walking",
    sourceKey: "e3rehab",
    needsSignoff:
      "E3 Rehab, not your clinic. Your physio's sheet already covers balance in weeks 8 to 12 with the weight shift to a 5 s single-leg stand; this adds E3's longer holds and backward walking.",
    category: "rehab",
    variant: "2",
    notes:
      'E3\'s phase 2, as you come out of the boot. The goal is "to be able to walk unassisted without a limp". E3 says to do these "while wearing shoes and a heel lift unless instructed otherwise". No frequency given.',
    spacingNote: null,
    phases: [7, 8],
    exercises: [
      {
        slug: "single-leg-balance",
        dose: "3 x 60 sec",
        cue: "Work up to it. Hands on a chair if needed",
        override: { rule: 1, reason: `${WEAN}. E3 starts it as the boot comes off.` },
      },
      { slug: "retro-walking", dose: null, cue: "No dose given", override: { rule: 1, reason: `${WEAN}. E3 starts it as the boot comes off.` } },
      {
        slug: "retro-walking",
        dose: null,
        variant: "Easier: hold on, step back",
        cue: "Hold something steady, step back, slowly lower the heel, return. Keep the heel inside what your physio allows",
        override: { rule: 1, reason: `${WEAN}. E3's easier version of retro walking.` },
      },
    ],
  },
  {
    name: "E3 Rehab 3, Seated Heel Raise Day",
    sourceKey: "e3rehab",
    needsSignoff: `E3 Rehab, not your clinic. ${NEUTRAL_LIMIT} before any deficit work.`,
    category: "rehab",
    variant: "3A",
    notes:
      'E3\'s phase 3: "The most important exercise in your recovery will be a heel raise." A minimum of 1 to 2 heel raise exercises, 2 to 3 days a week; E3\'s example is seated on Monday and Friday, standing on Wednesday. Single leg first, slow and controlled, heel as high as it goes. E3\'s month 3 milestone: a single-leg seated heel raise with 50% of your bodyweight for more than 20 reps.',
    spacingNote: null,
    phases: [8, 9],
    exercises: [
      { slug: "single-leg-seated-heel-raise", dose: "3 x 25", variant: "Bodyweight", cue: "Slow and controlled. The goal before adding load: 3 sets of 25 on one leg, flat floor", override: null },
      {
        slug: "single-leg-seated-heel-raise",
        dose: "3-4 x 6-15",
        variant: "Loaded",
        cue: "Once 3 x 25 is done. Dumbbell or kettlebell on the knee, Smith machine or seated calf machine",
        override: null,
      },
      { slug: "seated-double-leg-heel-raise-weighted", dose: null, cue: "Optional; E3 prefers single leg. Floor, not a deficit, until the physio clears it", override: null },
      { slug: "leg-extensions", dose: null, cue: "Continue and progress. No dose given", override: null },
      { slug: "seated-leg-curl", dose: null, cue: "Continue and progress. No dose given", override: null },
      { slug: "indoor-bike", dose: null, cue: "Aerobic work. No dose given", override: null },
    ],
  },
  {
    name: "E3 Rehab 3, Standing Heel Raise Day",
    sourceKey: "e3rehab",
    needsSignoff: `E3 Rehab, not your clinic. ${NEUTRAL_LIMIT} before the step edge. E3 also lists squats, which the handout's weeks 12 to 16 say to avoid.`,
    category: "rehab",
    variant: "3B",
    notes:
      "E3's phase 3 standing day, once you can walk without an assistive device. The heel raise rows are a ladder: work at the first level you cannot yet finish, and move up once you reach its target. The other rows are E3's progression by Achilles load: bodyweight squat, low step-up, high step-up, low step-down, high step-down.",
    spacingNote: null,
    phases: [8, 9],
    exercises: [
      { slug: "standing-heel-raise", dose: "3 x 25", variant: "Double leg, floor", cue: null, override: null },
      { slug: "standing-heel-raise", dose: "3 x 15", variant: "Single leg, floor", cue: "Full range", override: null },
      { slug: "standing-heel-raise", dose: "3 x 15", variant: "Single leg, step edge", cue: "Past neutral. Not before the physio clears it", override: null },
      { slug: "standing-heel-raise", dose: "3-4 x 6-15", variant: "Single leg, step edge, weighted", cue: "Past neutral. Not before the physio clears it", override: null },
      { slug: "staggered-stance-heel-raise", dose: null, cue: "If one leg is too big a step from two. No dose given", override: null },
      {
        slug: "goblet-squat",
        dose: null,
        cue: 'E3\'s squat variation. The handout\'s weeks 12 to 16: "AVOID ACTIVITIES THAT PLACE EXCESSIVE STRETCH ON TENDON (e.g. lunges, squats)". The handout governs',
        override: null,
      },
      { slug: "dumbbell-rdl", dose: null, variant: "Single leg", cue: "E3's deadlift variation. No dose given", override: null },
      { slug: "db-step-up", dose: null, variant: "Low step, then high", cue: "No dose given", override: null },
      { slug: "step-down", dose: null, variant: "Low step, then high", cue: "Goes past neutral. No dose given", override: null },
      { slug: "standing-calf-stretch", dose: null, cue: "Gently. Flat floor, not past neutral, until the physio says otherwise", override: null },
    ],
  },
  {
    name: "E3 Rehab 4, Starting Plyometrics",
    sourceKey: "e3rehab",
    needsSignoff:
      "E3 Rehab, not your clinic. E3's entry gate is at least 12 weeks after the injury and 5 single-leg heel raises at 90% of your available height. The handout puts dynamic loading at week 16 and keeps jumping out of sport until the 100% strength gate; Table E-1 adds plyometric training after 12 weeks.",
    category: "rehab",
    variant: "4A",
    notes: 'E3\'s phase 4, energy storage and release, at the start: "lower-intensity double leg hops in place for 10-15 seconds and or double leg sub max vertical jumps for 3-5 repetitions, 1-2 days a week."',
    spacingNote: null,
    phases: [9, 10],
    exercises: [
      { slug: "double-leg-rebound-heel-raise", dose: null, cue: "No dose given", override: null },
      { slug: "hopping-progression", dose: "10-15 sec", variant: "Level 1, in place", cue: null, override: null },
      { slug: "vertical-jump-progression", dose: null, variant: "Level 1, double-leg submaximal", cue: "3 to 5 repetitions; E3 gives no set count", override: null },
    ],
  },
  {
    name: "E3 Rehab 4, Building Plyometrics",
    sourceKey: "e3rehab",
    needsSignoff:
      "E3 Rehab, not your clinic. The handout keeps jumping out of sport until the 100% strength gate at month 12; ask the physio how far to take this before then.",
    category: "rehab",
    variant: "4B",
    notes: 'E3\'s phase 4 built up: "2-4 sets of 30-60 seconds for the hopping exercises, and 2-4 sets of 4-10 repetitions for the jumping progressions, 2-3 days per week." Move up a level as each one gets easy; the levels are in each exercise\'s notes.',
    spacingNote: null,
    phases: [9, 10],
    exercises: [
      { slug: "hopping-progression", dose: "2-4 x 30-60 sec", cue: null, override: null },
      { slug: "vertical-jump-progression", dose: "2-4 x 4-10", cue: null, override: null },
      { slug: "horizontal-jump-progression", dose: "2-4 x 4-10", cue: "Stick the landing", override: null },
    ],
  },
  {
    name: "E3 Rehab 4, Running Progression",
    sourceKey: "e3rehab",
    needsSignoff:
      "E3 Rehab, not your clinic. The handout's month 6 to 9 gate is 80% strength, for sport without contact, sprinting, cutting or jumping. Ask the physio before starting to run.",
    category: "rehab",
    variant: "Run",
    notes:
      "The University of Delaware treadmill progression E3 shows, eight levels from walk-jog intervals to jog-run. Rest at least 1 to 2 days between sessions. Progress only with no soreness during or after: soreness during means drop a level, soreness after means repeat the level.",
    spacingNote: null,
    phases: [10, 11],
    exercises: [{ slug: "treadmill-walk-jog-progression", dose: null, variant: "Level 1", cue: "Walk 0.1 mile, jog 0.1 mile, ten times", override: null }],
  },
  {
    name: "E3 Rehab 5, Return to Sport",
    sourceKey: "e3rehab",
    needsSignoff:
      "E3 Rehab, not your clinic. The handout's month 12 gate is 100% strength for sport involving running and jumping; E3's bar is at least 85% of the other leg for strength, hopping and jumping. The handout governs.",
    category: "rehab",
    variant: "5",
    notes: "E3's phase 5: build intensity, volume and complexity, from treadmill running to sprinting, cutting and change of direction, then modified practice, then full participation. No doses given.",
    spacingNote: null,
    phases: [11],
    exercises: [{ slug: "sprint-cut-and-change-of-direction-drills", dose: null, cue: "No dose given", override: null }],
  },
  {
    name: "Strength Tests",
    sourceKey: "e3rehab",
    needsSignoff:
      "Tests to failure on the injured side; ask the physio when. The handout's own gates are 80% strength at month 6 to 9 and 100% at month 12, and it does not say how to measure; these are E3's tests.",
    category: "rehab",
    variant: "Test",
    notes:
      "Log each test as a set so the numbers build a history. Both of the handout's return-to-sport gates are strength-based, not calendar-based, so a measured number is what moves you through them.",
    spacingNote: null,
    phases: [8, 9, 10, 11],
    exercises: [
      {
        slug: "single-leg-seated-heel-raise",
        dose: "1 x AMRAP",
        variant: "Test: 50% bodyweight",
        cue: "E3's month 3 milestone: more than 20 reps with 50% of your bodyweight on the knee",
        override: null,
      },
      {
        slug: "standing-heel-raise",
        dose: "1 x 5",
        variant: "Test: 90% height",
        cue: "E3's phase 4 entry: 5 single-leg raises at 90% of your available height, measured with a tape against the other side",
        override: null,
      },
      {
        slug: "standing-heel-raise",
        dose: "1 x AMRAP",
        variant: "Test: single leg, each side",
        cue: "Each side. Compare them. E3: at least 85% of the other leg; 20 with 20 lb on one side means at least 17 on the injured side",
        override: null,
      },
    ],
  },
];
