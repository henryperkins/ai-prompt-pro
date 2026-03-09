export const AMBIGUITY_MODES = ["ask_me", "placeholders", "infer_conservatively"] as const;
export type AmbiguityMode = (typeof AMBIGUITY_MODES)[number];

export const AMBIGUITY_MODE_LABELS: Record<AmbiguityMode, string> = {
  ask_me: "Ask me",
  placeholders: "Use placeholders",
  infer_conservatively: "Infer conservatively",
};
