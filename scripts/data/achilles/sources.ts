/**
 * Citations behind the recovery program, the training notes and the
 * exercise selection. One entry per citable work in the evidence base
 * and the conditioning notes, plus the clinic handout and the 416
 * Physio article. The quality string is the grade as those notes wrote
 * it; where a work was listed without its own grade, the string says
 * so rather than inventing one.
 *
 * Keys are referenced by program phases (flagSourceKey) and by the
 * program itself (sourceKey). Nothing personal lives here.
 */

import type { SourceSeed } from "./types";

export const SOURCES: SourceSeed[] = [
  // ------------------------------------------------------------
  // The protocol and its source trial
  // ------------------------------------------------------------
  {
    key: "handout",
    citation:
      "Achilles Tendon Rupture, Accelerated Functional Rehabilitation Program. Clinic handout, two pages plus Table E-1 of the Willits appendix. A modified version of the Willits protocol.",
    url: null,
    kind: "handout",
    quality:
      "Primary source for this program. The treating clinician governs over it; it governs over the appendix and the wider literature.",
    notes:
      "Transcribed from photographs of the printed handout. Weeks count from day 0, the injury date, which the appendix footnote establishes for the non-operative group. Phases are stored exactly as printed.",
  },
  {
    key: "willits",
    citation:
      "Willits K, Amendola A, Bryant D, et al. Operative versus nonoperative treatment of acute Achilles tendon ruptures: a multicenter randomized trial using accelerated functional rehabilitation. J Bone Joint Surg Am. 2010;92(17):2767-2775.",
    url: null,
    kind: "trial",
    quality:
      "Multicentre randomised trial; the source protocol the handout modifies. Not graded separately in the evidence base.",
    notes:
      "Table E-1 in its appendix covers both trial arms, so the incision and scar items apply only to the surgical group.",
  },

  // ------------------------------------------------------------
  // Evidence base: operative vs non-operative
  // ------------------------------------------------------------
  {
    key: "ochen2019",
    citation: "Ochen Y, et al. BMJ. 2019",
    url: null,
    kind: "review",
    quality: "strong",
    notes:
      "Systematic review and meta-analysis. With early functional rehabilitation, non-operative re-rupture rates converge to within roughly 1 to 2 percentage points of surgery, while surgery carries higher complication rates.",
  },
  {
    key: "costa2020",
    citation: "Costa ML, et al. (UKSTAR). The Lancet. 2020",
    url: null,
    kind: "trial",
    quality: "strong",
    notes:
      "Randomised trial of plaster cast versus functional brace. No meaningful difference in patient-reported outcomes at nine months; cast versus boot is a compliance and comfort decision, not an outcomes one.",
  },
  {
    key: "barfod2020rct",
    citation:
      "Barfod KW, Hansen MS, Holmich P, Kristensen MT, Troelsen A. Efficacy of early controlled motion of the ankle compared with immobilisation in non-operative treatment of patients with an acute Achilles tendon rupture: an assessor-blinded, randomised controlled trial. Br J Sports Med. 2020;54(12):719-724",
    url: null,
    kind: "trial",
    quality:
      "Assessor-blinded randomised controlled trial. Not graded separately in the evidence base; the early-motion literature as a whole is graded strong with an equivocal finding.",
    notes:
      "The trial exists because the value of early ankle motion was not obvious. Withholding ankle range of motion costs very little.",
  },
  {
    key: "barfod2020cohort",
    citation:
      "Barfod KW, Nielsen EG, Olsen BH, Vinicoff PG, Troelsen A, Holmich P. Orthop J Sports Med. 2020;8(4)",
    url: null,
    kind: "cohort",
    quality: "moderate. Prospective cohort support, not RCT-validated.",
    notes:
      "The Copenhagen Achilles Rupture Treatment Algorithm. Uses dynamic imaging with the ankle plantarflexed to select treatment: tendon ends that appose in equinus favour non-operative care; a substantial persistent gap favours surgery.",
  },

  // ------------------------------------------------------------
  // Evidence base: early motion
  // ------------------------------------------------------------
  {
    key: "ecm2021",
    citation:
      "Systematic review and meta-analysis of early controlled motion and weight-bearing in non-operative ATR, 2021",
    url: null,
    kind: "review",
    quality: "strong (Level 1), but the finding is equivocality, not benefit.",
    notes:
      "Found genuine disagreement over whether early controlled motion and weight-bearing confer benefit. Three included studies reported no significant difference in heel-rise work or height between early-motion and immobilisation groups.",
  },
  {
    key: "fwbm",
    citation:
      "Functional weight-bearing mobilisation RCT (microdialysis / healing response)",
    url: null,
    kind: "trial",
    quality: "moderate-to-strong",
    notes:
      "Single-blinded. Functional weight-bearing mobilisation enhanced the early healing response and improved early ankle range of motion without tendon elongation, but heel-rise tests at 6 and 12 months showed no difference between groups.",
  },

  // ------------------------------------------------------------
  // Evidence base: elongation and diagnosis
  // ------------------------------------------------------------
  {
    key: "kangas",
    citation: "Kangas J, et al. Tendon elongation and functional outcome after Achilles rupture",
    url: null,
    kind: "trial",
    quality: "moderate-to-strong",
    notes:
      "Elongation does not announce itself. It presents months later as weak push-off and an inability to single-leg heel raise, and by then needs reconstructive surgery. Imaging after a loading event matters more than how the leg feels.",
  },
  {
    key: "kannus1991",
    citation: "Kannus P, Jozsa L. J Bone Joint Surg Am. 1991",
    url: null,
    kind: "cohort",
    quality: "strong",
    notes:
      "Degenerative change is present in the large majority of spontaneously ruptured tendons.",
  },

  // ------------------------------------------------------------
  // Evidence base: training during immobilisation
  // ------------------------------------------------------------
  {
    key: "manca",
    citation: "Manca A, et al. Cross-education meta-analysis",
    url: null,
    kind: "review",
    quality:
      "strong. Multiple meta-analyses, consistent direction, replicated in immobilised populations.",
    notes:
      "Unilateral resistance training produces strength gains in the untrained contralateral limb, mediated by neural adaptation. The benefit appears both as strength gain and as prevention of strength loss. Transfer is strongest between homologous muscles, which makes sound-side calf raises the highest-value exercise of the boot phase.",
  },
  {
    key: "hendy",
    citation: "Hendy AM, Spittle M, Kidgell DJ. Cross-education and immobilisation",
    url: null,
    kind: "review",
    quality:
      "strong. Multiple meta-analyses, consistent direction, replicated in immobilised populations.",
    notes:
      "Unilateral training of the free limb maintains strength in the contralateral immobilised limb.",
  },
  {
    key: "carr2025",
    citation: "Carr J, et al. Physiological Reports. 2025",
    url: null,
    kind: "trial",
    quality:
      "strong for the cross-education finding as a whole; this item is a pilot study.",
    notes:
      "Resistance training of the non-immobilised limb attenuates weakness and atrophy in the contralateral immobilised limb and accelerates recovery on retraining.",
  },
  {
    key: "wall",
    citation: "Wall BT, van Loon LJC. Nutrition Reviews",
    url: null,
    kind: "review",
    quality: "moderate. Controlled human studies.",
    notes:
      "Adequate protein intake, roughly 1.6 to 2.0 g/kg/day, attenuates disuse atrophy.",
  },

  // ------------------------------------------------------------
  // Evidence base: lifestyle, guidelines
  // ------------------------------------------------------------
  {
    key: "tonnesen1999",
    citation: "Tonnesen H, et al. BMJ. 1999",
    url: null,
    kind: "trial",
    quality: "moderate-to-strong, but studied in heavy drinkers.",
    notes:
      "Preoperative abstinence reduces complications in heavy drinkers. The dominant alcohol risk during recovery is falls, not biochemistry.",
  },
  {
    key: "aaos",
    citation:
      "AAOS Clinical Practice Guideline: Management of Acute Achilles Tendon Rupture",
    url: null,
    kind: "convention",
    quality:
      "Clinical practice guideline. Not graded separately in the evidence base.",
    notes: null,
  },
  {
    key: "npiap",
    citation:
      "NPIAP/EPUAP International Guideline on Prevention and Treatment of Pressure Ulcers",
    url: null,
    kind: "convention",
    quality: "strong",
    notes:
      "Shear is a primary driver of blister and pressure injury; the heel is among the most common pressure injury sites. Supports heel offloading and a sock as a friction-management interface.",
  },
  {
    key: "kearon",
    citation: "Kearon C, et al. CHEST antithrombotic therapy guidelines",
    url: null,
    kind: "convention",
    quality:
      "Clinical practice guideline. Not graded separately in the evidence base.",
    notes: null,
  },

  // ------------------------------------------------------------
  // Conditioning notes, finding 1: ankle angle dominates tendon load
  // ------------------------------------------------------------
  {
    key: "hullfish2024",
    citation:
      "Hullfish TJ, et al. The Difference in Achilles Tendon Loading within Immobilizing Boots Based on Ankle Angle, Boot Type, and Walking Speed. Orthop J Sports Med. 2024;12(10)",
    url: "https://journals.sagepub.com/doi/10.1177/23259671241283806",
    kind: "cohort",
    quality:
      "moderate. Small samples, healthy subjects rather than patients, single author group, boots supplied at no cost by manufacturers (disclosed).",
    notes:
      "Instrumented three immobilising boots including the AirSelect. Immobilisation angle had the largest effect on tendon load, then boot construction, then walking speed. Thirty degrees of plantarflexion reduced Achilles loading by 60% versus the same boot at neutral. Walking volume inside a wedged boot is cheap; removing a wedge is expensive.",
  },
  {
    key: "baxter2022",
    citation:
      "Baxter JR, et al. Achilles Tendon Loading During Walking Differs Between Commonly Used Immobilizing Boots. Foot Ankle Orthop. 2022",
    url: "https://journals.sagepub.com/doi/abs/10.1177/2473011421S00576",
    kind: "cohort",
    quality:
      "moderate. Conference abstract from the same group as Hullfish 2024, same caveats.",
    notes:
      "Put the average tendon-load reduction across boots at 68% versus unsupported walking in shoes, with 0.5 bodyweight as the surgical-repair reference line.",
  },
  {
    key: "kwon2023",
    citation:
      "Kwon MP, et al. Wearable sensor and machine learning estimate tendon load and walking speed during immobilizing boot ambulation. Sci Rep. 2023",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10593749/",
    kind: "cohort",
    quality: "moderate. Same author group as Hullfish 2024, same caveats.",
    notes: null,
  },

  // ------------------------------------------------------------
  // Conditioning notes, finding 2: assisted walking is expensive
  // ------------------------------------------------------------
  {
    key: "thomas",
    citation:
      "Thomas E, et al. The energy expenditure of non-weight bearing crutch walking on the level and ascending stairs. Gait Posture",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0966636214007504",
    kind: "cohort",
    quality:
      "moderate to strong for the MET values. Weak for any kcal extrapolation, which is arithmetic from published METs and body mass, not a measurement.",
    notes:
      "Indirect calorimetry in healthy adults on elbow crutches, non-weight-bearing: 4.57 METs on level ground, 5.06 METs ascending stairs.",
  },
  {
    key: "waters1974",
    citation:
      "Waters RL, Lunsford BR. Efficiency of Assisted Ambulation Determined by Oxygen Consumption Measurement. J Bone Joint Surg Am. 1974",
    url: "https://www.ovid.com/jnls/jbjsjournal/abstract/00004623-197456050-00011~efficiency-of-assisted-ambulation-determined-by-oxygen",
    kind: "cohort",
    quality: "moderate to strong for the MET values.",
    notes:
      "Cane, two-point and three-point partial-weight-bearing gaits cost about 33% more energy than normal walking; swing-through and three-point non-weight-bearing gaits about 78% more.",
  },
  {
    key: "fisher",
    citation: "Fisher SV, Patterson RP. Energy cost of ambulation with crutches",
    url: "https://experts.umn.edu/en/publications/energy-cost-of-ambulation-with-crutches/",
    kind: "cohort",
    quality: "moderate to strong for the MET values.",
    notes: "Crutch ambulation at roughly twice the oxygen cost of normal walking.",
  },

  // ------------------------------------------------------------
  // Conditioning notes, finding 3: upper-body cardio ceiling
  // ------------------------------------------------------------
  {
    key: "orr2013",
    citation:
      "Orr J, et al. Cardiopulmonary exercise testing: arm crank vs cycle ergometry. Anaesthesia. 2013",
    url: "https://pubmed.ncbi.nlm.nih.gov/23573845/",
    kind: "cohort",
    quality: "moderate to strong",
    notes:
      "Arm crank versus cycle ergometry in the same subjects: peak VO2 25 ml/kg/min arms versus 40 legs, anaerobic threshold 13 versus 20. Peak heart rate during arm work sits below the leg-based maximum, so running heart-rate zones mis-calibrate intensity.",
  },
  {
    key: "bases",
    citation: "BASES Expert Statement on arm crank ergometry training",
    url: "https://www.cases.org.uk/imgs/expert_statemtent_p6_7__pages__arm_crank513.pdf",
    kind: "convention",
    quality: "moderate to strong for the underlying principle; the statement itself is expert consensus.",
    notes:
      "Twelve weeks of arm-crank versus leg-cycle training produced gains in both, with cross-transfer effects around 50% of mode-specific effects.",
  },
  {
    key: "upperbody-sr",
    citation:
      "Effects of Upper Body Exercise Training on Aerobic Fitness and Performance in Healthy People: A Systematic Review",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10045299/",
    kind: "review",
    quality: "moderate to strong",
    notes:
      "Upper-body work preserves roughly half of what leg work would and cannot reach the intensities that produce the largest calorie numbers. Worth doing, not a substitute.",
  },

  // ------------------------------------------------------------
  // Conditioning notes, finding 4: NMES and BFR
  // ------------------------------------------------------------
  {
    key: "hyer2021",
    citation:
      "Hyer CF, et al. Does Functional Neuromuscular Electrical Stimulation (NMES) Influence Calf Atrophy Following Achilles Tendon Surgery? J Foot Ankle Surg. 2021;60:683-8",
    url: "https://www.jfas.org/article/S1067-2516(21)00001-6/abstract",
    kind: "trial",
    quality: "strong evidence of a null result.",
    notes:
      "Prospective double-blind RCT in 40 post-surgical patients, device fitted at surgery, both patient and treating team blinded. Volumetric MRI trended toward less muscle loss at six weeks but did not reach significance; neither muscle mass nor function improved versus sham. Conference abstract with the MRI detail: https://doaj.org/article/42c32c19fbc947fbbd8d179ca82adf00. Review characterising the null: https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2023.1081458/full",
  },
  {
    key: "bentzen2024",
    citation:
      "Bentzen A, et al. Feasibility of Blood Flow Restriction Exercise in Adults with a Non-surgically Treated Achilles Tendon Rupture; a Case Series. Int J Exerc Sci. 2024;17(3):140-53",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11042897/",
    kind: "cohort",
    quality: "weak for efficacy, moderate for safety.",
    notes:
      "Feasibility case series in 18 patients. Both re-ruptures occurred after the 12-week intervention, one in usual-care rehabilitation and one at a work event; the DVT began after cast removal at 40% occlusion pressure. Seated knee extension with the cuff on the proximal thigh, 4 sets of 30/15/15/AMRAP, performed in the boot throughout phases I and II, with two minutes of supine air cycling afterwards. Did not exclude proximal tears. Scoping review on BFR and tendon: https://pmc.ncbi.nlm.nih.gov/articles/PMC12096532/",
  },
  {
    key: "bean",
    citation:
      "BEAN trial protocol: blood flow restriction exercise in non-surgically treated Achilles tendon rupture. Trial registration NCT06434272",
    url: "https://www.sciencedirect.com/science/article/pii/S095825922400066X",
    kind: "trial",
    quality:
      "Not yet reported. The only randomised trial of BFR in non-surgically treated rupture; estimated completion January 2028.",
    notes: "Registration: https://clinicaltrials.gov/study/NCT06434272",
  },

  // ------------------------------------------------------------
  // Conditioning notes, finding 5: in-boot loading
  // ------------------------------------------------------------
  {
    key: "christensen2024",
    citation:
      "Christensen M, et al. Feasibility of an early progressive resistance exercise program for acute Achilles tendon rupture. Pilot Feasibility Stud. 2024;10:66",
    url: "https://pilotfeasibilitystudies.biomedcentral.com/articles/10.1186/s40814-024-01494-4",
    kind: "trial",
    quality:
      "moderate for feasibility; absent for insertional ruptures and high ruptures at the musculotendinous junction, which the trial excluded.",
    notes:
      "Nine-week in-boot progressive resistance programme for non-surgically treated rupture: isometric plantarflexion in a closed boot every waking hour, seated heel-rise five times daily in an open boot with wedges by week, elastic band resistance five times daily. Progression by Borg CR10 at 2 to 5 out of 10, dorsiflexion restricted beyond neutral. Sixteen completers, no re-ruptures, one DVT at 7 to 10 days. Trial registration NCT04121377.",
  },

  // ------------------------------------------------------------
  // Conditioning notes: detraining and single-leg cycling
  // ------------------------------------------------------------
  {
    key: "mujika2000",
    citation:
      "Mujika I, Padilla S. Detraining, Part II: Long term insufficient training stimulus. Sports Med. 2000;30(3):145-54",
    url: "https://pubmed.ncbi.nlm.nih.gov/10999420/",
    kind: "review",
    quality: "strong",
    notes:
      "VO2max in highly trained athletes declines 6 to 20% beyond four weeks of insufficient training but stays above sedentary values. Recently acquired VO2max gains are lost completely.",
  },
  {
    key: "detraining2023",
    citation:
      "Cardiorespiratory and metabolic consequences of detraining in endurance athletes. Front Physiol. 2023",
    url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1334766/full",
    kind: "review",
    quality: "strong",
    notes:
      "Reported point estimates: about 4.7% VO2max loss at 14 days, 10.1% at five weeks, 13% at eight weeks.",
  },
  {
    key: "chen2022",
    citation:
      "Chen et al. Two weeks of detraining reduces cardiopulmonary function and muscular fitness in endurance athletes. Eur J Sport Sci. 2022",
    url: "https://onlinelibrary.wiley.com/doi/10.1080/17461391.2021.1880647",
    kind: "cohort",
    quality: "strong",
    notes:
      "Two weeks of complete cessation in endurance-trained men reduced VO2max, time to exhaustion and maximal stroke volume, while maximal heart rate and knee flexor strength were unchanged. The cardiovascular system moves faster than the muscular one.",
  },
  {
    key: "heidorn2023",
    citation:
      "Heidorn CE, Elmer SJ, et al. Single-leg cycling to maintain and improve function in healthy and clinical populations. Front Physiol. 2023",
    url: "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1105772/full",
    kind: "review",
    quality: "moderate",
    notes:
      "Single-leg cycle training has produced 6 to 13% improvements in trained-leg VO2peak and 8 to 9% in trained-leg work rate. Single-leg VO2peak sits well above half of double-leg values. PubMed: https://pubmed.ncbi.nlm.nih.gov/37187959/",
  },
  {
    key: "counterweight2024",
    citation:
      "Counterweight mass influences single-leg cycling biomechanics. PLOS One. 2024",
    url: "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0304136",
    kind: "cohort",
    quality: "moderate",
    notes:
      "A counterweight of roughly 10 kg on the opposite crank makes single-leg pedalling closer to normal. Without one the rider lifts the leg through flexion and the hip flexors fatigue early.",
  },

  // ------------------------------------------------------------
  // Conditioning notes: pool work (orientation only)
  // ------------------------------------------------------------
  {
    key: "thetis-pool",
    citation: "Thetis Medical. Pool progression after Achilles rupture (blog)",
    url: "https://www.thetismedical.com/blog/pool-progression-after-achilles-rupture/",
    kind: "convention",
    quality:
      "Clinician-authored guidance, not peer-reviewed, included for orientation only.",
    notes:
      "A common pattern is pool walking around weeks 10 to 12 once cleared, gentle swimming around 12 to 14, then longer swims or carefully introduced pool running. The boot comes off in water, so hydrotherapy is a question for the treating clinician.",
  },
  {
    key: "thetis-swim",
    citation: "Thetis Medical. Swimming after Achilles rupture: what to avoid (blog)",
    url: "https://www.thetismedical.com/blog/swimming-after-achilles-rupture-what-to-avoid/",
    kind: "convention",
    quality:
      "Clinician-authored guidance, not peer-reviewed, included for orientation only.",
    notes:
      "Kicking loads the calf, wall push-offs create sudden force, and wet tile is a fall surface.",
  },
  {
    key: "thetis-cardio",
    citation: "Thetis Medical. Cardio after Achilles rupture (blog)",
    url: "https://www.thetismedical.com/blog/cardio-after-achilles-rupture/",
    kind: "convention",
    quality:
      "Clinician-authored guidance, not peer-reviewed, included for orientation only.",
    notes: null,
  },

  // ------------------------------------------------------------
  // Conditioning notes: background sources
  // ------------------------------------------------------------
  {
    key: "hoeffner2022",
    citation:
      "Hoeffner R, et al. Persistent Deficits after an Achilles Tendon Rupture: A Narrative Review. Transl Sports Med. 2022",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11022787/",
    kind: "review",
    quality:
      "Narrative review, background source. The persistent calf-strength deficit it describes is graded strong in the evidence base, replicated across isokinetic testing.",
    notes:
      "Side-to-side triceps surae cross-sectional area differences of 9 to 25% and plantarflexion deficits of 10 to 35% persist beyond 12 months. A 10 to 20% calf strength deficit is common long term regardless of treatment.",
  },
  {
    key: "seow2023",
    citation:
      "Seow D, et al. Lower rerupture rates but higher complication rates following surgical versus conservative treatment. KSSTA. 2023",
    url: "https://pubmed.ncbi.nlm.nih.gov/37115231/",
    kind: "review",
    quality: "Background source, referenced but not central. Not graded separately.",
    notes: null,
  },
  {
    key: "pedersen2019",
    citation:
      "Pedersen MH, et al. Symptomatic Venous Thromboembolism After Achilles Tendon Rupture: A Nationwide Danish Cohort Study of 28,546 Patients. Am J Sports Med. 2019",
    url: "https://pubmed.ncbi.nlm.nih.gov/31574237/",
    kind: "cohort",
    quality: "moderate-to-strong",
    notes:
      "DVT after Achilles rupture runs roughly 35 to 50% regardless of operative or non-operative treatment; Achilles rupture is the sports injury with the highest DVT risk. Patient-reported loading at or under 50% of bodyweight was an independent risk factor (OR 4.3, 95% CI 1.28 to 14.3), so patients should be encouraged to load at least 50%. Early mobilisation alone did not reduce incidence.",
  },
  {
    key: "zellers2019",
    citation:
      "Zellers JA, Carmont MR, Gravare Silbernagel K. Defining Components of Early Functional Rehabilitation for Acute Achilles Tendon Rupture: A Systematic Review. Orthop J Sports Med. 2019;7(11)",
    url: null,
    kind: "review",
    quality:
      "Systematic review. Cited throughout the Danish work; not retrieved directly, so not graded.",
    notes: null,
  },

  // ------------------------------------------------------------
  // The 416 Physio article, source of the demonstration clips
  // ------------------------------------------------------------
  {
    key: "physio416",
    citation:
      "416 Physio (Toronto). What Exercises Can You Do With a Walking Boot? Blog post.",
    url: "https://www.416physio.ca/blog/what-exercises-can-you-do-with-a-walking-boot",
    kind: "convention",
    quality:
      "clinician-authored blog, not peer-reviewed, generic walking-boot audience",
    notes:
      "Not Achilles-specific and not non-operative-specific. Its fourteen exercises anchor the recovery templates and each carries an unlisted Vimeo clip, embedded through Vimeo's player with credit to 416 Physio. Nothing in it overrides the treating clinician or the handout; every item was run through the authoring rules before seeding.",
  },
];
