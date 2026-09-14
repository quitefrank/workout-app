/**
 * The recovery program and its phases, from the clinic handout as
 * printed. Weeks count from day 0, the injury date. Nothing here is
 * shifted to fit any one person's timeline; the live position comes
 * from the clearance log.
 *
 * Guidance uses the handout's wording first, with operational detail
 * from the prototype where it adds something, written side-neutral.
 * Flags carry the generic sentence of each prototype flag with the
 * citation that supports it. Personal reminders live in the personal
 * file, never here.
 */

import type { ProgramSeed } from "./types";

const WEEK_2_TO_6_ITEMS =
  "Continue the week 2 to 6 items: active ankle range of motion to neutral, knee and hip exercises with no ankle involvement, non-weight-bearing cardio with the boot on, hydrotherapy within the motion and weight-bearing limits";

export const RECOVERY_PROGRAM: ProgramSeed = {
  name: "Achilles rupture, accelerated functional rehabilitation (non-operative, modified Willits)",
  kind: "recovery",
  description:
    "The treating clinic's accelerated functional rehabilitation programme for a non-operatively managed Achilles tendon rupture. It is a modified version of the protocol from Willits and colleagues' multicentre randomised trial, issued as a two-page handout with the first page of the trial's Table E-1 appendix. Day 0 is the injury date. Weight-bearing steps up in the boot from week 2, wedges come out from week 6, the boot is weaned from week 8, and the two return-to-sport gates are strength-based rather than calendar-based.",
  citation:
    "Willits K, Amendola A, Bryant D, et al. Operative versus nonoperative treatment of acute Achilles tendon ruptures: a multicenter randomized trial using accelerated functional rehabilitation. J Bone Joint Surg Am. 2010;92(17):2767-2775.",
  authorityNotes:
    "The treating clinician governs over the handout; the handout governs over the appendix; the appendix over the wider literature. No dose is imported from another protocol.",
  sourceKey: "handout",
  phases: [
    {
      position: 1,
      label: "Non-weight-bearing",
      block: null,
      weekFrom: 0,
      weekTo: 2,
      loadPct: 0,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: [
            "Plantarflexion cast, or the walker boot in equinus with heel wedges, worn at all times including sleep",
            "Straps snug enough to hold position, no tighter",
          ],
        },
        {
          heading: "Do",
          items: [
            "Non-weight-bearing with crutches. Nothing through the injured foot",
            "Upper body training: seated, supine, kneeling or hanging",
            "Knee and hip exercises with no ankle involvement",
            "Elevate in blocks, calf supported, leg not rolled outward",
          ],
        },
        {
          heading: "Do not",
          items: [
            "No standing on it, no push-off, no using it for balance",
            "No ankle movement in any direction",
          ],
        },
      ],
      flag: null,
      flagSourceKey: null,
    },
    {
      position: 2,
      label: "25% weight-bearing",
      block: null,
      weekFrom: 2,
      weekTo: 3,
      loadPct: 25,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: [
            "Walker boot with 2 to 4 cm heel lift",
            "Crutches take the remaining 75%",
          ],
        },
        {
          heading: "Do",
          items: [
            "Protected weight-bearing in the boot with heel lifts, with crutches, at 25%",
            "Calibrate 25% on a bathroom scale before walking on it",
            "Active ankle range of motion exercises: plantarflexion and dorsiflexion to neutral, inversion and eversion below neutral",
            "Modalities to control swelling",
            "Knee and hip exercises with no ankle involvement",
            "Non-weight-bearing fitness and cardio work. The walker boot stays on during exercise",
            "Hydrotherapy within the motion and weight-bearing limits",
            "Continue upper body, sound-leg and hip work",
            "Let pain be your guide. If in pain, back off activities and weight-bearing",
          ],
        },
        {
          heading: "Do not",
          items: [
            "Ensure the ankle does not go past neutral during exercises",
            "No barefoot steps, including at night",
          ],
        },
      ],
      flag: "New calf pain, swelling or warmth, or any breathlessness, needs same-day assessment. DVT after Achilles rupture runs 35 to 50%, and loading under 50% of bodyweight is an independent risk factor (OR 4.3, 95% CI 1.28 to 14.3).",
      flagSourceKey: "pedersen2019",
    },
    {
      position: 3,
      label: "50% weight-bearing",
      block: null,
      weekFrom: 3,
      weekTo: 4,
      loadPct: 50,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: ["Boot with wedges, crutches still in use"],
        },
        {
          heading: "Do",
          items: [
            "Protected weight-bearing in the boot at 50%",
            "Recalibrate on the scale at the new percentage",
            WEEK_2_TO_6_ITEMS,
            "Let pain be your guide",
          ],
        },
        {
          heading: "Do not",
          items: [
            "No pool work unsupervised; the boot comes off in water",
            "Ensure the ankle does not go past neutral during exercises",
          ],
        },
      ],
      flag: "Sharp pain at the tendon, or ache that is still there after you stop, means drop back a level and stay there. Do not push through it to keep the schedule.",
      flagSourceKey: "handout",
    },
    {
      position: 4,
      label: "75% weight-bearing",
      block: null,
      weekFrom: 4,
      weekTo: 5,
      loadPct: 75,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: ["Boot with wedges"],
        },
        {
          heading: "Do",
          items: [
            "Protected weight-bearing in the boot at 75%",
            "Recalibrate on the scale at the new percentage",
            "Gait starts feeling more natural in the boot",
            "Keep the sound-leg work going; it protects the injured side",
            WEEK_2_TO_6_ITEMS,
          ],
        },
        {
          heading: "Do not",
          items: [
            "Nothing that loads the tendon suddenly",
            "Ensure the ankle does not go past neutral during exercises",
          ],
        },
      ],
      flag: "Persistent numbness in the foot or toes is a fit problem, not something to tolerate. Report the pattern where it eases when the leg is down and worsens when it is up. Toes that will not move is an emergency.",
      flagSourceKey: null,
    },
    {
      position: 5,
      label: "100% weight-bearing",
      block: null,
      weekFrom: 5,
      weekTo: 6,
      loadPct: 100,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: ["Boot with wedges, full weight as tolerated"],
        },
        {
          heading: "Do",
          items: [
            "100% weight-bearing in the boot with heel lifts",
            "Crutches can be dropped as balance allows",
            WEEK_2_TO_6_ITEMS,
          ],
        },
        {
          heading: "Do not",
          items: [
            "Still no barefoot",
            "Ensure the ankle does not go past neutral during exercises",
          ],
        },
      ],
      flag: "Full weight in the boot is not full weight barefoot. The boot is doing the work. No barefoot steps at any point, including getting up at night.",
      flagSourceKey: "hullfish2024",
    },
    {
      position: 6,
      label: "Wedges out in stages",
      block: null,
      weekFrom: 6,
      weekTo: 8,
      loadPct: 100,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: [
            "Usually 100% weight-bearing as tolerated, still in the walker boot",
            "Remove heel wedges in stages, roughly one per week, depending on Achilles length",
          ],
        },
        {
          heading: "Do",
          items: [
            "Dorsiflexion stretching, slowly",
            "Graduated resistance exercises, open and closed kinetic chain and functional activities, starting with Theraband",
            "Gait retraining",
            "Fitness and cardio work to include weight-bearing: stationary bike, elliptical, treadmill walking as tolerated",
            "Hydrotherapy",
          ],
        },
        {
          heading: "Do not",
          items: [
            "No aggressive stretching. Slowly is the operative word",
            "Never stretch and remove a wedge in the same week",
          ],
        },
      ],
      flag: "The wedge schedule depends on your tendon, not the calendar. Do not run ahead of your physiotherapist.",
      flagSourceKey: "handout",
    },
    {
      position: 7,
      label: "Boot weaning, the vulnerable window",
      block: null,
      weekFrom: 8,
      weekTo: 12,
      loadPct: 100,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: [
            "Wean off the boot, usually over 2 to 5 days",
            "Return to crutches or a cane as needed during the weaning",
          ],
        },
        {
          heading: "Do",
          items: [
            "Shoes at all times, limiting time in bare feet",
            "Continue to progress range of motion, strength and proprioception",
            "Begin weighted resisted exercises, ankle not past neutral",
            "Add stationary bike, elliptical and walking on the treadmill as tolerated",
            "Wobble board: seated, then supported standing, then standing as tolerated",
            "Calf stretches in standing, gently, not past neutral",
            "Double heel raises, progressing to single heel raises when tolerated, not past neutral",
          ],
        },
        {
          heading: "Do not",
          items: [
            "No sudden loading. A trip or a step up stairs can re-rupture it",
            "Do not allow the ankle past the neutral position",
          ],
        },
      ],
      flag: "Re-ruptures cluster here. Pain has gone, function feels near-normal, the tissue is still immature.",
      flagSourceKey: "handout",
    },
    {
      position: 8,
      label: "Strength, power, endurance",
      block: null,
      weekFrom: 12,
      weekTo: 16,
      loadPct: null,
      gate: null,
      guidance: [
        {
          heading: "Boot",
          items: ["Out of the boot"],
        },
        {
          heading: "Do",
          items: [
            "Continue to progress range of motion, strength and proprioception",
            "Retrain strength, power and endurance",
            "The calf will be visibly smaller; that is expected",
          ],
        },
        {
          heading: "Do not",
          items: [
            "Avoid activities that place excessive stretch on the tendon, lunges and squats specifically",
          ],
        },
      ],
      flag: "The calf will be visibly smaller and measurably weaker. A persistent 10 to 20% deficit is common long term. This is where measured strength starts to matter more than how the leg feels.",
      flagSourceKey: "hoeffner2022",
    },
    {
      position: 9,
      label: "Dynamic loading and sport-specific",
      block: null,
      weekFrom: 16,
      weekTo: 26,
      loadPct: null,
      gate: null,
      guidance: [
        {
          heading: "Do",
          items: [
            "Increase dynamic weight-bearing exercises",
            "Sport-specific training begins",
            "Lower body returns to the training rotation",
          ],
        },
        {
          heading: "Do not",
          items: ["No contact, sprinting, cutting or jumping yet"],
        },
      ],
      flag: "Arrange strength testing before the month 6 gate, not at it. The gate is criterion-based, so without a number you will be guessing.",
      flagSourceKey: "handout",
    },
    {
      position: 10,
      label: "Month 6 to 9, non-contact sport",
      block: null,
      weekFrom: 26,
      weekTo: 52,
      loadPct: null,
      gate: "80% strength",
      guidance: [
        {
          heading: "Do",
          items: [
            "At 80% strength: return to normal sporting activities that do not involve contact, sprinting, cutting or jumping",
            "Straight-line running is typically first back",
          ],
        },
        {
          heading: "Do not",
          items: [
            "Nothing with contact, sprinting, cutting or jumping until the 100% gate",
          ],
        },
      ],
      flag: "The gate is strength testing, not the date. Ask to be measured.",
      flagSourceKey: "handout",
    },
    {
      position: 11,
      label: "Month 12, running and jumping",
      block: null,
      weekFrom: 52,
      weekTo: null,
      loadPct: null,
      gate: "100% strength",
      guidance: [
        {
          heading: "Do",
          items: [
            "At 100% strength: return to sports involving running and jumping",
            "Expect a residual calf size difference; normal, not failure",
          ],
        },
        {
          heading: "Do not",
          items: [
            "Contralateral rupture risk stays elevated. Treat stiffness in the other Achilles as a signal",
          ],
        },
      ],
      flag: "Contralateral rupture risk stays raised for life. Treat stiffness in the other Achilles as a signal, not a niggle.",
      flagSourceKey: null,
    },
  ],
};
