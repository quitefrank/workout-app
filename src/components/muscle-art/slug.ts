/** The key a muscle group's art is stored under: its name, lower case, words joined by hyphens. */
export function muscleSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
