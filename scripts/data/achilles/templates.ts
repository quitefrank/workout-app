/**
 * The approved recovery templates, transcribed from
 * docs/achilles-exercise-review.md after sign-off: the recovery
 * programme's own Push, Pull and Legs in the boot, separate from any
 * training programme that follows.
 *
 * Order inside each template follows training logic: the biggest
 * compound first while fresh, isolation after, core last (rule 8 checks
 * the core block). Floor transfers and bench transitions do not order a
 * template; the person in the boot takes them when they come. The
 * review's first cut put floor work first to save a transfer and was
 * overruled: the bench on and off is the move with the injury
 * potential, and the order is muscle-dependent.
 *
 * Doses are strings parseDose accepts. Article rows carry the article's
 * dose and cue; prototype rows carry the prototype's. A row that breaks
 * an authoring rule records the override here with the rule number and
 * the reason, so the decision is written down rather than silent. The
 * three overrides are all rule 1: the engine blocks anything through the
 * booted foot while the boot is on, the handout permits protected
 * weight-bearing in the boot at the cleared percentage from week 2.
 *
 * Phases by position in the handout: Push and Pull from phase 1, Legs
 * from phase 2 because its three overrides rely on a cleared percentage
 * above zero. Nothing is valid past phase 7; out of the boot the user
 * moves to a training programme.
 */

import type { TemplateSeed } from "./types";

const RULE_1_HANDOUT =
  "Protected weight-bearing in the boot at the cleared percentage is what the handout permits from week 2";

export const TEMPLATES: TemplateSeed[] = [
  {
    name: "Recovery Legs",
    category: "legs",
    variant: null,
    notes:
      "The recovery programme's leg session in the boot. Squat patterns first (sit to stand, then the wall squat), the bridge, then the sound-leg calf raises, the highest-value items of the week: cross-education against the primary long-term deficit. Isolation after that, the supine marches last. Three rows load the booted foot at the cleared percentage and record a rule 1 override, which is why this template starts at phase 2.",
    spacingNote: null,
    phases: [2, 3, 4, 5, 6, 7],
    exercises: [
      {
        slug: "sit-to-stand-from-a-high-surface",
        dose: "2-3 x 8-10",
        cue: "Weight mostly through the sound side to start, one hand on the rack; even weight only as the cleared percentage allows",
        override: {
          rule: 1,
          reason: `${RULE_1_HANDOUT}; the article's own progression keeps the booted foot under the cleared percentage.`,
        },
      },
      {
        slug: "ball-wall-squats",
        dose: "2-3 x 10-15",
        cue: "Lower into a mini squat keeping weight balanced within available range; push back up slowly. To increase difficulty, add weight in hand",
        override: {
          rule: 1,
          reason: `${RULE_1_HANDOUT}; a mini squat inside the boot's range with the weight split.`,
        },
      },
      {
        slug: "glute-bridges-in-a-walking-boot",
        dose: "2-3 x 10-15",
        cue: "Push through heels to lift hips until shoulders, hips, and knees form a line; hold briefly, then lower",
        override: {
          rule: 1,
          reason: `${RULE_1_HANDOUT}; the bridge loads the heel through the boot with the ankle locked.`,
        },
      },
      {
        slug: "single-leg-calf-raise-sound-leg",
        dose: "4 x 10-15 slow",
        cue: "One hand on the rack upright, dumbbell in the other. Knee straight, so this is gastrocnemius: the homologous muscle to the one you are protecting, and the highest-value item of your week. No step in this gym, so you lose some range at the bottom",
        override: null,
      },
      {
        slug: "seated-dumbbell-calf-raise-sound-leg",
        dose: "3 x 12-15",
        cue: "Sitting on the bench, dumbbell resting on the sound knee. Knee bent, which shifts the work to soleus. No balance demand at all",
        override: null,
      },
      {
        slug: "leg-extensions-with-band",
        dose: "2-3 x 10-15 each side",
        cue: "Avoid locking the knee out fully",
        override: null,
      },
      {
        slug: "side-lying-hip-abductions",
        dose: "2-3 x 10-15 each side",
        cue: "Keep your ankle relaxed in the boot and make sure your leg does not drift forward",
        override: null,
      },
      {
        slug: "straight-leg-raises",
        dose: "2-3 x 8-12 each side",
        cue: "Keep knee locked and movement controlled",
        override: null,
      },
      {
        slug: "supine-marches",
        dose: "2-3 x 10-15 each side",
        cue: "Lift one leg a few inches, alternate like a slow march; keep core engaged and hips steady",
        override: null,
      },
    ],
  },
  {
    name: "Recovery Push",
    category: "push",
    variant: null,
    notes:
      "The recovery programme's push session in the boot. Compounds first: the dumbbell bench, the shoulder press and the modified push-ups, then the fly from the mat at the towers, the lateral raise and the supine triceps extension, and the two core holds last. Nothing loads the booted foot.",
    spacingNote: null,
    phases: [1, 2, 3, 4, 5, 6, 7],
    exercises: [
      {
        slug: "db-bench-press",
        dose: "3 x 10-12",
        cue: "Bench flat, boot resting on the floor, not pushing",
        override: null,
      },
      {
        slug: "shoulder-press-in-a-walking-boot",
        dose: "2-3 x 8-12",
        cue: "Keep your back tall and avoid arching",
        override: null,
      },
      {
        slug: "modified-push-ups",
        dose: "2-3 x 8-12",
        cue: "Hands on the bench, lower chest toward it with elbows angled slightly back; push back up with control. Booted leg crossed over the sound one",
        override: null,
      },
      {
        slug: "seated-cable-fly",
        dose: "3 x 12-15",
        cue: "Sitting on the mat between the towers, sound foot braced against a tower base, pulleys at shoulder height for the floor sit. Both arms together; never one arm from the floor",
        override: null,
      },
      {
        slug: "bench-db-lateral-raise",
        dose: "3 x 12-15",
        cue: "Light, high reps, controlled",
        override: null,
      },
      {
        slug: "tricep-extensions-supine",
        dose: "2-3 x 8-12",
        cue: "Lie on back, boot resting on the bench. Keep movements slow and steady without swinging",
        override: null,
      },
      {
        slug: "front-plank",
        dose: "3 x 10-30 sec",
        cue: "Keep body in a straight line, brace core, avoid sagging hips. Booted leg crossed over the other one",
        override: null,
      },
      {
        slug: "seated-suitcase-hold",
        dose: "3 x 20-30 sec each side",
        cue: "Sit tall on the bench, one heavy dumbbell hanging at your side, nothing in the other hand. Resist the side-bend. Same job as a Pallof press, resisting sideways collapse, but the load pulls straight DOWN instead of sideways, so there is nothing trying to tip you off the bench",
        override: null,
      },
    ],
  },
  {
    name: "Recovery Pull",
    category: "pull",
    variant: null,
    notes:
      "The recovery programme's pull session in the boot. Pull-ups first while fresh, then the row and the face pull from the mat at the towers, curls, and the two core rows last. Pull-ups are capped at two sessions a week, 72 hours apart, and this is the only template that carries them, so it runs at most twice a week with the second run at the light dose: 3 x leave 2-3 in reserve on the pull-ups and lighter curls.",
    spacingNote: null,
    phases: [1, 2, 3, 4, 5, 6, 7],
    exercises: [
      {
        slug: "pull-ups",
        dose: "4 x leave 1-2 in reserve",
        cue: "Step up from the bench already in the rack. Both hands on the bar before you shift weight. Step down onto the sound leg, never drop",
        override: null,
      },
      {
        slug: "cable-seated-row",
        dose: "3 x 10-12",
        cue: "Low pulley, sitting on the mat with the sound foot braced against the tower base, boot resting; there is nothing to sit on at the towers. Seated on the floor is what makes this work: the floor takes the reaction instead of your feet",
        override: null,
      },
      {
        slug: "seated-cable-face-pull",
        dose: "3 x 15",
        cue: "Rope at head height for the floor sit, sound foot braced against the tower base. Standing, this pulls you off balance on one leg. Seated, it cannot. Counters the crutch hunch",
        override: null,
      },
      {
        slug: "db-curls",
        dose: "3 x 12-15",
        cue: "Bench upright, back supported",
        override: null,
      },
      {
        slug: "hanging-leg-raise",
        dose: "3 x 10-15",
        cue: "Knees bent. Zero foot contact, controlled, no swing. Ab straps if grip is gone from the pull-ups",
        override: null,
      },
      {
        slug: "seated-russian-twists",
        dose: "2-3 x 10-15",
        cue: "Sit tall on the mat, feet flat, light weight or ball. Rotate torso side to side keeping spine tall",
        override: null,
      },
    ],
  },
];
