# Training evidence baseline

The reference ranges the app measures training against: weekly volume, frequency, reps and load, effort, per muscle
group. Saved 2026-11-11 for the Home "Last 7 days" heat map and anything later that scores training. Cross-reference
this file before encoding a target in code.

## Sources and how to use them

1. **The paper (primary source of truth).** Currier BS, D'Souza AC, Fiatarone Singh MA, Lowisz CV, Rawson ES,
   Schoenfeld BJ, Smith-Ryan AE, Steen JP, Thomas GA, Triplett NT, Washington TA, Werner TJ, Phillips SM. *American
   College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and
   Physical Performance in Healthy Adults: An Overview of Reviews.* Med Sci Sports Exerc. 2026;58(4):851-872.
   DOI 10.1249/MSS.0000000000003897. An overview of 137 systematic reviews (more than 30,000 participants), searched
   to October 2024; it replaces ACSM's 2009 position stand. Open access under CC BY-NC-ND 4.0, so the unchanged PDF is
   kept here: [acsm-2026-resistance-training-position-stand.pdf](acsm-2026-resistance-training-position-stand.pdf)
   (also in the vault at `Personal/raw/training/`).
2. **The video (secondary).** Renaissance Periodization (Dr. Mike Israetel), *30,000 People Studied. This Is How You
   Should Train.*, a breakdown of the paper. The transcript and a highlights summary are kept verbatim outside this
   public repo, in the vault at `Personal/raw/training/rp-umbrella-review-*` and locally in `docs/research/sources/`
   (gitignored).

**Rule (Frank's call, 2026-11-11):** the paper decides. Where the paper is silent or leaves room for interpretation,
the video can fill the gap, with its reasoning written down. Where the two disagree, the paper wins.

Reading the paper's verdicts: ✔ the variable changes the outcome, ✖ it does not, ? not enough evidence. QoE is the
paper's quality-of-evidence score (0 to 100%) for the reviews behind that verdict (Tables 3, 4 and 6).

## Hypertrophy (muscle growth)

| Variable | Paper | QoE | Video | For the app |
|---|---|---|---|---|
| Weekly sets per muscle group | ✔ **≥10 sets/muscle group/week**, dose-response. A meta-regression the paper cites (Pelland 2025, ref 187) shows diminishing returns past **~18 to 20 weekly sets** | 50% (5 reviews, n = 2,267) | ≥10, still rising to 30+ if recovery allows | **10 to 20 is the range.** Past 20 still counts, with diminishing returns. "30+" is the video's view; the paper says returns diminish past ~18 to 20 |
| Frequency | ✖ No effect when weekly volume is equal (1 vs more than 5 days a week) | 63% (4 reviews, n = 3,177) | Agrees: frequency is a way to spread volume | Score growth by weekly sets, not sessions |
| Load / reps per set | ✖ No effect from 30% to 100% 1RM, given enough effort | 66% (8 reviews, n = 5,340) | 5 to 30 reps, equal growth when effort is equal | Agrees. **Reps and load do not change the growth score**; any working set counts |
| Effort / failure | ✖ Training to failure adds nothing. Sufficient effort is "near-failure" or **2 to 3 reps in reserve**; there is not enough evidence to set an exact RIR target | 69% (4 reviews, n = 800) | 1 to 2 RIR equals failure; 5 to 7 RIR grows less | Paper wins: **2 to 3 RIR**. The video's "far from failure grows less" agrees with the paper's minimum-effort point but the paper does not quantify it. The app logs no RIR |
| Contraction type | ✔ Eccentric overload / eccentric-only beats concentric-only | 75% (1 review, n = 868) | Not covered | Note only |
| Periodization | ✖ Linear, undulating and none give the same growth | 63% (4 reviews, n = 1,414) | Periodize hypertrophy, then strength, then power | Paper wins (see Periodization) |
| Exercise order | ✖ | 81% (4 reviews) | Not covered for growth | No rule |
| Time under tension, tempo | ✖ Fast (0.5 s) vs slow (8 s) reps the same | 58% | Not covered | No rule |
| Rest between sets, range of motion, set structure (drop sets), machine vs free weight | ? Not enough evidence | | Not covered | No rule |

## Strength

| Variable | Paper | QoE | Video | For the app |
|---|---|---|---|---|
| Frequency | ✔ **≥2 sessions a week**; no dose-response found, and the effect shrinks when volume is equal | 69% (4 reviews, n = 3,531) | 2 to 4 times a week per lift | ≥2 sessions a week per lift |
| Load | ✔ **≥80% 1RM**, dose-response (heavier is better) | 79% (6 reviews, n = 6,574) | 80 to 90%+, 2 to 6 reps | ≥80% 1RM. The rep range is the video's translation |
| Sets | ✔ **2 to 3 sets per exercise per session**; returns diminish past ~2 to 3 (ref 187). At least two sets advised | 71% (7 reviews, n = 5,633) | 2 to 5 heavy sets | Paper wins: 2 to 3 |
| Order | ✔ Heavy lifts at the **start** of the session | 88% (4 reviews) | Agrees | Agrees with Frank's muscle-logic ordering rule |
| Range of motion | ✔ Full range | 50% (2 reviews) | Not covered | Note only |
| Failure, rest length, tempo, machine vs free weight, time of day | ✖ No effect | 63 to 83% | Not covered | No rule |
| Periodization | ? Not enough evidence; one review slightly favoured periodized programs | | Periodize | Paper wins |
| Main lifts per session | Not in the paper | | 1 to 2 key compound lifts | The video's opinion only |

## Power

| Variable | Paper | Video | For the app |
|---|---|---|---|
| Load | ✔ **30 to 70% 1RM** (75% QoE, 2 reviews) | 30 to 70% | Agrees |
| Volume | ✔ **Reps × sets ≤ 24** | 2 to 5 sets of 2 to 5 reps | Paper wins where they differ (5 × 5 = 25 is over) |
| Intent | ✔ Power training (fast concentric), Olympic-style lifts and eccentric flywheel beat standard training | Maximal intent; stop the set when speed drops | Stopping on speed loss is the video's rule; the paper doesn't test it |
| Rest | Not studied for power | 3 to 5 minutes | The video's opinion only |

## Periodization

The paper: with progressive overload, periodization is not significantly better than a non-periodized program, so it
matters less than the 2009 stand assumed. It notes that definitions vary, that the order of goals across a program is
understudied, and that "periodization and programming are often conflated". The video's hypertrophy, then strength,
then power sequence is therefore an option, not a requirement. For the app: following a periodized program (the
Nippard programs are) is fine, and the app scores training the same way in any block.

## General recommendations from the paper

- Train with **high effort at least twice a week, with all major muscle groups engaged** (its primary recommendation).
- Progression is not needed for benefits, but some increase in stimulus is likely needed for long-term progress.
- The evidence did not compare muscle groups. The authors suggest applying the recommendations to four body regions
  (upper and lower, push and pull) or six (adding horizontal and vertical for the upper body), per session or per
  week. A possible coarser grouping for the heat map.
- Weekly volume load (load × reps × sets × exercises × sessions) was rarely studied.
- Limits: group-level evidence, mostly from untrained people, many low-quality trials. Individualize.

## What the app can measure today

| Variable | From | Status |
|---|---|---|
| Working sets per muscle group per week | `sets` joined to `exercises.muscle_group_id`; `v_muscle_group_weekly_sets` | Ready, with two limits: the view buckets by calendar week (a rolling 7 days needs its own query), and each set counts only for the exercise's one main group, so bench press credits chest and never triceps. Secondary muscles would need a new column or table |
| Sessions per muscle group per week (frequency) | distinct workouts per group | Ready |
| Sets per exercise per session (strength) | `sets` per `workout_exercises` row | Ready |
| Load as % of 1RM (strength, power) | set weight over the exercise's best estimated 1RM (`v_workout_exercise_e1rm`), per floor | Ready, approximate |
| Days since a muscle group was last trained | latest working set per group | Ready |
| Effort (reps in reserve) | nothing logged | Not captured. Nippard prescribes RPE in program notes; the app logs no RPE or RIR per set |

## Intended use: Home's Last 7 days

Frank's direction (2026-11-11): one full-body muscle drawing on Home, front and back, with heat zones on the muscles
trained in the last seven days, scored against this baseline.

What the paper implies for it, to settle when it is designed:

- **Weekly working sets are the growth signal.** Candidate bands per muscle group: none; 1 to 9 (below the minimum);
  10 to 20 (in range); over 20 (diminishing returns).
- **Reps and load should not change the growth heat.** Within 30 to 100% 1RM they do not affect growth. They matter
  for strength (≥80% 1RM), which could be a separate view.
- **Frequency does not affect growth once sets are equal,** so recency (days since trained) is context, not score.
  The paper's general advice of at least twice a week still makes "trained once this week" worth showing.
- **Effort** cannot be scored until the app logs RIR.
