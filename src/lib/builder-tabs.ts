export function toConstraintInputId(constraint: string): string {
  const slug = constraint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `builder-constraint-${slug || "option"}`;
}
