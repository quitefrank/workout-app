# Training evidence baseline

The reference ranges the app measures training against: weekly volume, frequency, reps per set, load and
effort, per muscle group. Saved 2026-11-11 for the Home "Last 7 days" heat map and anything later that scores
training. Cross-reference this file before encoding a target in code.

## Sources

1. **The paper.** Currier BS, D'Souza AC, Fiatarone Singh MA, et al. *ACSM Position Stand: Resistance Training
   Prescription for Muscle Strength and Hypertrophy in Healthy Adults* (umbrella review of 137 systematic reviews,
   more than 30,000 participants). Medicine & Science in Sports & Exercise, 58(4):851-872, 2026. Replaces ACSM's
   2009 position stand. Full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823 (not yet read in full; the
   page served a bot check on 2026-11-11, so only the abstract via search results has been checked).
2. **The video.** Renaissance Periodization (Dr. Mike Israetel), *30,000 People Studied. This Is How You Should
   Train.*, a breakdown of the paper. Its transcript and a highlights summary are kept verbatim outside this
   public repo: in the vault at `Personal/raw/training/rp-umbrella-review-transcript.txt` and
   `rp-umbrella-review-highlights.md`, and locally in `docs/research/sources/` (gitignored, like the
   Nippard sources).

## Baseline ranges

"Paper" means the abstract states it. "Video" means only the RP breakdown states it, and it is the
presenter's reading until checked against the full text.

### Hypertrophy

| Variable | Range | Says who |
|---|---|---|
| Weekly working sets per muscle group | 10 or more | Paper (≥10 sets/wk) and video |
| Dose-response above 10 | More sets, more growth, diminishing returns, up to 30+ when recovery allows | Video only |
| Reps per set | 5 to 30, equal growth when effort is equal | Video only |
| Effort | 1 to 2 reps in reserve matches failure; 5 to 7 in reserve grows less | Video only. The paper found training to momentary failure had no consistent effect |
| Frequency per muscle | 2 to 4 sessions a week, as a way to spread volume | Video only |
| Eccentric overload | Helps growth | Paper |

### Strength

| Variable | Range | Says who |
|---|---|---|
| Load | Heavier loads; video puts it at 80 to 90%+ of 1RM, 2 to 6 reps | Paper (heavier loads); numbers from video |
| Sets | 2 to 3 per exercise per session (video: 2 to 5) | Paper (2-3 sets) |
| Frequency | 2 or more sessions a week per lift | Paper (≥2 sessions/wk) and video |
| Order | Heavy lifts first in the session | Paper and video |
| Range of motion | Full | Paper |

### Power

| Variable | Range | Says who |
|---|---|---|
| Load | Moderate; video says 30 to 70% of 1RM | Paper (moderate loads) |
| Volume | Low to moderate; video says 2 to 5 sets of 2 to 5 reps, 3 to 5 min rest | Paper (low-to-moderate volume) |
| Intent | Fast concentric, stop when speed drops | Paper (fast concentric) and video |

## Where the video and the paper disagree

- **Failure.** The video treats proximity to failure as a driver (1 to 2 RIR). The paper's abstract lists training
  to momentary muscle fatigue among variables that "did not consistently impact training outcomes".
- **Periodization.** The video says to periodize hypertrophy, then strength, then power. The paper's abstract lists
  periodization among the same no-consistent-effect variables.
- **Upper volume.** "30+ sets" is not in the abstract. Treat it as the video's claim.

Settle these against the full text before any of them becomes a target in code.

## What the app can measure today

| Variable | From | Status |
|---|---|---|
| Working sets per muscle group per week | `sets` joined to `exercises.muscle_group_id`; `v_muscle_group_weekly_sets` | Ready, with two limits: the view buckets by calendar week (a rolling 7 days needs its own query), and each set counts only for the exercise's one main group, so bench press credits chest and never triceps. Secondary muscles would need a new column or table |
| Sessions per muscle group per week (frequency) | distinct workouts per group | Ready |
| Reps per set | `sets.reps` | Ready |
| Load as % of 1RM | set weight over the exercise's best estimated 1RM (`v_workout_exercise_e1rm`), per floor | Ready, approximate |
| Days since a muscle group was last trained | latest working set per group | Ready |
| Effort (reps in reserve) | nothing logged | Not captured. Nippard prescribes RPE in program notes, but the app logs no RPE or RIR per set |

## Intended use: Home's Last 7 days

Frank's direction (2026-11-11): one full-body muscle drawing on Home, front and back, with heat zones on the
muscles trained in the last seven days. The heat reflects how recently each group was trained, together with its
sets and reps, scored against the ranges above (for example, under 10 weekly sets reads as under target for growth).
Exact bands and the scoring rule are not decided.
