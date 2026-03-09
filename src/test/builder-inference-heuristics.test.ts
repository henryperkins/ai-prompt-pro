import { describe, expect, it } from "vitest";
import {
  chooseArtifactType,
  chooseAudience,
  chooseConstraints,
  chooseFormat,
  chooseLengthPreference,
  chooseRole,
  chooseRoleWithConfidence,
  chooseTaskMode,
  chooseTone,
  chooseToneWithConfidence,
  computeConfidence,
  INFERENCE_FIELD_CONFIDENCE,
  INFERENCE_FIELD_LABELS,
} from "../../shared/builder-inference-heuristics";

describe("shared builder inference heuristics", () => {
  /* ---------------------------------------------------------------- */
  /*  Existing tests (preserved)                                       */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  New role detection                                               */
  /* ---------------------------------------------------------------- */

  describe("expanded role detection", () => {
    it("detects Support Specialist", () => {
      expect(chooseRole("Handle this customer support ticket about SLA escalation")).toBe("Support Specialist");
    });

    it("detects Product Strategist", () => {
      expect(chooseRole("Update the product roadmap with new feature prioritization")).toBe("Product Strategist");
    });

    it("detects Research Analyst", () => {
      expect(chooseRole("Perform a systematic review of the literature findings")).toBe("Research Analyst");
    });

    it("detects Executive Communicator", () => {
      expect(chooseRole("Write an executive summary for the board and investors")).toBe("Executive Communicator");
    });

    it("detects Prompt Engineer", () => {
      expect(chooseRole("Evaluate and critique this prompt for quality")).toBe("Prompt Engineer");
    });

    it("returns null for unrecognized prompts", () => {
      expect(chooseRole("hello world")).toBeNull();
    });

    it("picks the role with most keyword matches when ambiguous", () => {
      // "code" + "debug" + "refactor" = 3 matches for Software Developer
      // "api" also matches Software Developer
      const result = chooseRoleWithConfidence("debug and refactor the code for the API endpoint");
      expect(result?.role).toBe("Software Developer");
      expect(result!.matchCount).toBeGreaterThanOrEqual(3);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Artifact-type detection                                          */
  /* ---------------------------------------------------------------- */

  describe("artifact-type detection", () => {
    it("detects email", () => {
      expect(chooseArtifactType("Draft a follow-up email to the client")?.type).toBe("email");
    });

    it("detects report", () => {
      expect(chooseArtifactType("Generate a weekly status report")?.type).toBe("report");
    });

    it("detects PRD", () => {
      expect(chooseArtifactType("Write the product requirements document for the new feature")?.type).toBe("PRD");
    });

    it("detects proposal", () => {
      expect(chooseArtifactType("Create a business case proposal for the RFP")?.type).toBe("proposal");
    });

    it("detects presentation", () => {
      expect(chooseArtifactType("Build a slide deck for the quarterly presentation")?.type).toBe("presentation");
    });

    it("detects code snippet", () => {
      expect(chooseArtifactType("Write a code snippet for the function")?.type).toBe("code snippet");
    });

    it("detects blog post", () => {
      expect(chooseArtifactType("Write a blog post about AI trends")?.type).toBe("blog post");
    });

    it("detects documentation", () => {
      expect(chooseArtifactType("Create documentation and a how-to guide")?.type).toBe("documentation");
    });

    it("returns null for unrecognized prompts", () => {
      expect(chooseArtifactType("Think about the meaning of life")).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Audience detection                                               */
  /* ---------------------------------------------------------------- */

  describe("audience detection", () => {
    it("detects beginner audience", () => {
      expect(chooseAudience("Explain this for a beginner who is non-technical")?.audience).toBe("beginner");
    });

    it("detects expert audience", () => {
      expect(chooseAudience("Write for an advanced expert audience")?.audience).toBe("expert");
    });

    it("detects executive audience", () => {
      expect(chooseAudience("Present to the CEO and leadership team")?.audience).toBe("executive");
    });

    it("detects developer audience", () => {
      expect(chooseAudience("Explain this to the developer team")?.audience).toBe("developer");
    });

    it("detects customer audience", () => {
      expect(chooseAudience("Write a message for the end user and customer")?.audience).toBe("customer");
    });

    it("detects team audience", () => {
      expect(chooseAudience("Share with the cross-functional team")?.audience).toBe("team");
    });

    it("detects public audience", () => {
      expect(chooseAudience("Address a broad audience of consumers")?.audience).toBe("public");
    });

    it("detects internal audience", () => {
      expect(chooseAudience("Write an internal memo for company-wide distribution")?.audience).toBe("internal");
    });

    it("returns null for no audience signal", () => {
      expect(chooseAudience("Do the thing")).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Task-mode detection                                              */
  /* ---------------------------------------------------------------- */

  describe("task-mode detection", () => {
    it("detects transform mode for rewrite prompts", () => {
      expect(chooseTaskMode("Rewrite this email to be more concise")?.mode).toBe("transform");
    });

    it("detects transform mode for edit/revise", () => {
      expect(chooseTaskMode("Edit and revise the proposal")?.mode).toBe("transform");
    });

    it("detects transform mode for improve/fix", () => {
      expect(chooseTaskMode("Improve and fix this paragraph")?.mode).toBe("transform");
    });

    it("detects transform mode for translate/summarize", () => {
      expect(chooseTaskMode("Translate and summarize the document")?.mode).toBe("transform");
    });

    it("detects generate mode for write/create", () => {
      expect(chooseTaskMode("Write a new blog post and create an outline")?.mode).toBe("generate");
    });

    it("detects generate mode for draft/build", () => {
      expect(chooseTaskMode("Draft a proposal and build a plan")?.mode).toBe("generate");
    });

    it("detects generate mode for brainstorm/design", () => {
      expect(chooseTaskMode("Brainstorm ideas and design the layout")?.mode).toBe("generate");
    });

    it("prefers transform when both modes tie", () => {
      // "rewrite" = transform, "create" = generate -> equal, prefers transform
      expect(chooseTaskMode("Rewrite the intro and create a new conclusion")?.mode).toBe("transform");
    });

    it("returns null for no task-mode signal", () => {
      expect(chooseTaskMode("hello world")).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Per-match confidence                                             */
  /* ---------------------------------------------------------------- */

  describe("per-match confidence scoring", () => {
    it("returns base confidence for a single match", () => {
      expect(computeConfidence(0.78, 1)).toBe(0.78);
    });

    it("increases confidence with additional matches", () => {
      expect(computeConfidence(0.78, 2)).toBeCloseTo(0.82, 10);
      expect(computeConfidence(0.78, 3)).toBeCloseTo(0.86, 10);
    });

    it("caps confidence at 0.95", () => {
      expect(computeConfidence(0.78, 10)).toBe(0.95);
    });

    it("returns 0 for zero matches", () => {
      expect(computeConfidence(0.78, 0)).toBe(0);
    });

    it("role confidence increases with multiple keyword hits", () => {
      const single = chooseRoleWithConfidence("debug this code");
      const multi = chooseRoleWithConfidence("debug and refactor the code for the API endpoint using python");
      expect(single).not.toBeNull();
      expect(multi).not.toBeNull();
      expect(multi!.confidence).toBeGreaterThan(single!.confidence);
    });

    it("tone confidence increases with multiple keyword hits", () => {
      const single = chooseToneWithConfidence("Write in a casual tone");
      const multi = chooseToneWithConfidence("Keep it casual, friendly, and conversational");
      expect(single).not.toBeNull();
      expect(multi).not.toBeNull();
      expect(multi!.confidence).toBeGreaterThan(single!.confidence);
    });
  });
});
