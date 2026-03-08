import { describe, expect, it } from "vitest";
import { defaultConfig, scorePrompt } from "@/lib/prompt-builder";

describe("scorePrompt with fieldOwnership", () => {
  it("shows standard tip when field is empty and no ownership", () => {
    const result = scorePrompt({ ...defaultConfig, originalPrompt: "Test task" });
    expect(result.tips.some((t) => t.includes("Select a role"))).toBe(true);
  });

  it("shows AI review tip when field is ai-owned", () => {
    const config = { ...defaultConfig, originalPrompt: "Test task", role: "Developer" };
    const result = scorePrompt(config, { role: "ai" });
    expect(result.tips.some((t) => t.includes("AI suggested"))).toBe(true);
  });

  it("suppresses tip when field is user-owned", () => {
    const config = {
      ...defaultConfig,
      originalPrompt: "Test task",
      role: "Developer",
      tone: "Technical",
      constraints: ["Avoid jargon", "Think step-by-step"],
      format: ["JSON"],
    };
    const result = scorePrompt(config, { role: "user", tone: "user" });
    expect(result.tips.every((t) => !t.includes("Select a role"))).toBe(true);
  });
});
