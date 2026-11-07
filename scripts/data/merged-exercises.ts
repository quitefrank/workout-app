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
  { slug: "1-arm-cable-pulldown", name: "1-Arm Cable Pulldown", oneFloor: true, keep: "918ef66c-d8bd-445d-bd66-4d5469ca441f", merged: [] },
  { slug: "single-arm-tricep-pressdown", name: "1-Arm Tricep Pressdown", oneFloor: true, keep: "4adab133-6ca9-4ea4-a4c4-61b66197b77b", merged: [] },
  { slug: "ez-bar-bicep-curls", oneFloor: true, keep: "fa3e2fa7-b393-4ddd-9fac-4ce344ee32a4", merged: ["04b0971b-e463-4ec8-89bb-352d85db5597"] },
  { slug: "db-larsen-press", oneFloor: true, keep: "716960fd-202a-48e1-8ff6-2a4ff7bc61f4", merged: ["ef882f5c-98bc-426d-a5cd-6dad25aded29"] },
  { slug: "incline-chest-supported-db-row", oneFloor: true, keep: "0aa00b00-d124-429a-99e3-20193a24b8e7", merged: ["73098aa4-316a-4702-9fec-24d1a7406f4a"] },
  { slug: "lean-in-db-lateral-raise", name: "Lean-In DB Lateral Raise", oneFloor: true, keep: "bd870ac9-f76b-4fbb-8287-09e19eeaa528", merged: [] },
  { slug: "machine-chest-press", oneFloor: true, keep: "5d7710b2-0e75-40a6-bf61-136c53eb6de4", merged: ["5571f444-7696-4a78-a4aa-237bffbab5a3"] },
  { slug: "reverse-cable-flies", oneFloor: true, keep: "399a6537-d53d-45e0-bdd1-6a0601e0849f", merged: ["95895f09-9df5-4139-bd9e-aa0ed7fbbcc6"] },
];

/** Notion pages removed from the library, so re-running the seed cannot bring them back: Omni, an empty stub. */
export const REMOVED_PAGES = new Set(["217c4b6c-bd1f-8017-9aa6-ea9f14b208ee", "55325a22-8949-4616-9cf6-5e49ed682b23"]);

/** Notion pages whose logged sets are drop sets (migration 0010): the two floors of Lat Pull-Downs (dropset). */
export const DROP_SET_PAGES = new Set(["aab74eaa-5c6a-49c4-ba48-99dd306f227c", "bb52566d-ccbe-4908-aa04-6b25d6b5dab3"]);

/** Muscle groups that differ from the Notion page (migration 0013), by exercise slug, so re-running the seed keeps them. */
export const MUSCLE_GROUP_OVERRIDES: Record<string, string> = {
  "cable-y-raise": "Shoulders",
  "cable-external-rotations": "Shoulders",
  "dead-bug-kicks": "Abs",
  "french-press": "Triceps",
  "neutral-grip-pull-up": "Back",
  shrugs: "Back",
};
