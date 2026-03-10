export type EnhancePhase = "idle" | "starting" | "streaming" | "settling" | "done";

export type OutputPreviewSource =
  | "empty"
  | "prompt_text"
  | "builder_fields"
  | "enhanced";

export type EnhancementVariant = "original" | "shorter" | "more_detailed";
