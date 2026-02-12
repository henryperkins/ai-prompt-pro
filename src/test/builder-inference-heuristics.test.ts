import { describe, expect, it } from "vitest";
import {
  chooseConstraints,
  chooseFormat,
  chooseLengthPreference,
  chooseRole,
  chooseTone,
  INFERENCE_FIELD_CONFIDENCE,
  INFERENCE_FIELD_LABELS,
} from "../../shared/builder-inference-heuristics";

describe("shared builder inference heuristics", () => {
  it("infers role and tone from mixed-case prompts", () => {
    expect(chooseRole("Please DEBUG this API integration.")).toBe("Software Developer");
    expect(chooseTone("Need an ACADEMIC explanation with citations")).toBe("Academic");
  });

  it("infers length, format, and constraints", () => {
    expect(chooseLengthPreference("Give me a concise summary")).toBe("brief");
    expect(chooseLengthPreference("Need a comprehensive deep dive")).toBe("detailed");
    expect(chooseFormat("Return the answer as JSON")).toEqual(["JSON"]);
    expect(chooseConstraints("include source citation, no jargon")).toEqual([
      "Include citations",
      "Avoid jargon",
    ]);
  });

  it("exports stable field labels and confidence defaults", () => {
    expect(INFERENCE_FIELD_LABELS.role).toBe("Set AI persona");
    expect(INFERENCE_FIELD_LABELS.format).toBe("Choose output format");
    expect(INFERENCE_FIELD_CONFIDENCE.tone).toBe(0.72);
    expect(INFERENCE_FIELD_CONFIDENCE.constraints).toBe(0.64);
  });
});
