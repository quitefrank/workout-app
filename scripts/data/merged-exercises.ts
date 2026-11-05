/**
 * Notion keeps the upstairs and downstairs machines as separate pages; the library has one exercise per movement since
 * migration 0009, with the floor on each logged row. The Notion seed writes each `keep` page with the plain slug and
 * has_floors, and sends the `merged` pages to it, so re-running the seed cannot bring the duplicates back.
 */
export const MERGED_EXERCISES: { slug: string; name?: string; oneFloor?: boolean; keep: string; merged: string[] }[] = [
  { slug: "cable-crossover", keep: "b4326536-ab14-431d-8e91-e1aaf20d61ff", merged: ["fc0e7381-308c-4b2f-bf61-f623e1ce00de"] },
  { slug: "cable-crunch", keep: "c30217f0-e47f-470c-a10e-5351a8a272ea", merged: ["101e764c-5d48-495c-b43c-cc99fc0dd5ca"] },
  { slug: "cable-press-around", keep: "2d706fca-e4f3-423c-a716-d5e395b187b3", merged: ["997403ee-bca6-4333-ba21-7f0a0924e7cb", "6d9e7624-ee78-4194-a733-735afd386cbc"] },
  { slug: "cable-y-raise", keep: "ec0f19fc-ac75-4db9-a3f1-c5bba1f39693", merged: ["a8648e09-45a4-434f-bc69-70e898e48626"] },
  { slug: "cross-body-tricep-extension", keep: "a8130643-3384-4cce-b2b9-4882ff643e8b", merged: ["d02b9c76-8299-4539-a7e6-ea65ae90f506"] },
  { slug: "lat-pulldown", name: "Lat Pulldown", keep: "48a93644-912f-47e6-b301-33ad3adf57d0", merged: ["4ba54c4d-d386-473d-9b47-0e9b328e70f3", "aab74eaa-5c6a-49c4-ba48-99dd306f227c", "bb52566d-ccbe-4908-aa04-6b25d6b5dab3", "bb6a5ea0-812c-40e3-b3cd-db6171640e66"] },
  { slug: "omni-direction-face-pull", keep: "278ec28a-60d2-4fe8-a82e-8dc5d4401ab8", merged: ["2b8e2c1f-5594-4595-a410-fc1943064df0"] },
  { slug: "omni-grip-rows", keep: "0822e419-6bd0-45a7-a1c8-1a731b680235", merged: ["fffcb27b-d058-4d3f-b987-3a71af97f4ce"] },
  { slug: "overhead-extension-stretch-only", keep: "e22be59a-b5dd-4641-a701-98843baef197", merged: ["555a00c8-672e-4ef3-b138-6851914a22fd"] },
  { slug: "triceps-pressdown", name: "Triceps Pressdown", keep: "04439159-838d-4399-a07e-4cb6a42302f5", merged: ["7113a297-3cad-4ae3-b13c-58aa2c36ce11", "72b4194b-41a4-42a9-ba73-a635e8cf40c1"] },
  { slug: "1-arm-half-kneeling-lat-pulldown", name: "1-Arm Half Kneeling Lat Pulldown", oneFloor: true, keep: "918ef66c-d8bd-445d-bd66-4d5469ca441f", merged: [] },
];

/** Notion pages removed from the library, so re-running the seed cannot bring them back: Omni, an empty stub. */
export const REMOVED_PAGES = new Set(["217c4b6c-bd1f-8017-9aa6-ea9f14b208ee"]);

/** Notion pages whose logged sets are drop sets (migration 0010): the two floors of Lat Pull-Downs (dropset). */
export const DROP_SET_PAGES = new Set(["aab74eaa-5c6a-49c4-ba48-99dd306f227c", "bb52566d-ccbe-4908-aa04-6b25d6b5dab3"]);

/** Muscle groups that differ from the Notion page (migration 0013), by exercise slug, so re-running the seed keeps them. */
export const MUSCLE_GROUP_OVERRIDES: Record<string, string> = {
  "bent-over-cable-flies": "Shoulders",
  "cable-y-raise": "Shoulders",
  "cable-external-rotations": "Shoulders",
  "dead-bug-kicks": "Abs",
  "french-press": "Triceps",
  "neutral-grip-pull-up": "Back",
  shrugs: "Back",
};
