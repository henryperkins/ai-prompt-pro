import { describe, expect, it } from "vitest";
import {
  CODEX_DEFAULT_SKILL_NAME,
  buildBashHereDocSubstitution,
  chooseHereDocDelimiter,
  generateAgentsMdFromPrompt,
  generateCodexAppServerSendMessageV2CommandBash,
  generateCodexExecCommandBash,
  generateCodexSkillScaffoldCommandBash,
  generateCodexTuiCommandBash,
  generateSkillMdFromPrompt,
  sanitizeSkillName,
  truncateToUtf8Bytes,
  utf8ByteLength,
} from "@/lib/codex-export";

describe("codex-export", () => {
  it("measures UTF-8 byte length correctly", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
  });

  it("truncates without breaking UTF-8 sequences", () => {
    const value = "ab😀cd";
    expect(truncateToUtf8Bytes(value, 5, "")).toBe("ab");
    expect(truncateToUtf8Bytes(value, 6, "")).toBe("ab😀");
  });

  it("chooses a safe heredoc delimiter when prompt already contains the base delimiter", () => {
    const prompt = "line one\nPROMPTFORGE_PROMPT\nline two";
    const delimiter = chooseHereDocDelimiter(prompt, "PROMPTFORGE_PROMPT");
    expect(delimiter).toBe("PROMPTFORGE_PROMPT_1");
  });

  it("builds a heredoc command substitution payload", () => {
    const prompt = "first line\nsecond line";
    const payload = buildBashHereDocSubstitution(prompt);
    expect(payload).toContain("$(cat <<'PROMPTFORGE_PROMPT'");
    expect(payload).toContain("\nfirst line\nsecond line\n");
    expect(payload).toContain("\nPROMPTFORGE_PROMPT\n)");
  });

  it("builds codex commands for TUI, exec stdin, and app-server debug", () => {
    const prompt = "Write tests\nand docs";

    const tui = generateCodexTuiCommandBash(prompt, { flags: ["--model", "gpt-5"] });
    expect(tui).toContain("codex --model gpt-5 ");
    expect(tui).toContain("$(cat <<'PROMPTFORGE_PROMPT'");

    const execCommand = generateCodexExecCommandBash(prompt, { flags: "--model gpt-5" });
    expect(execCommand).toContain(" | codex exec --model gpt-5 -");
    expect(execCommand).toContain("Write tests\nand docs");

    const appServer = generateCodexAppServerSendMessageV2CommandBash(prompt);
    expect(appServer).toContain("codex debug app-server send-message-v2 ");
    expect(appServer).toContain("$(cat <<'PROMPTFORGE_PROMPT'");
  });

  it("caps AGENTS markdown output to the provided max bytes", () => {
    const content = generateAgentsMdFromPrompt("1234567890abcdef", { maxBytes: 12 });
    expect(utf8ByteLength(content)).toBeLessThanOrEqual(12);
    expect(content.endsWith("\n")).toBe(true);
  });

  it("sanitizes skill names to spec-safe slugs", () => {
    expect(sanitizeSkillName("My Skill v1")).toBe("my-skill-v1");
    expect(sanitizeSkillName("--")).toBe(CODEX_DEFAULT_SKILL_NAME);
    expect(sanitizeSkillName("UPPER__AND  symbols!!")).toBe("upper-and-symbols");
  });

  it("generates SKILL.md frontmatter and prompt body", () => {
    const prompt = "Follow these steps\n1. Inspect\n2. Implement";
    const skillMd = generateSkillMdFromPrompt(prompt, { skillName: "Demo Skill" });
    expect(skillMd).toContain("---\nname: demo-skill\n");
    expect(skillMd).toContain("\ndescription: ");
    expect(skillMd).toContain("\n\nFollow these steps\n1. Inspect\n2. Implement\n");
  });

  it("generates a shell scaffold command for .agents/skills", () => {
    const prompt = "Do the work";
    const command = generateCodexSkillScaffoldCommandBash(prompt, { skillName: "Demo Skill" });
    expect(command).toContain("mkdir -p '.agents/skills/demo-skill'");
    expect(command).toContain("> '.agents/skills/demo-skill/SKILL.md'");
    expect(command).toContain("name: demo-skill");
    expect(command).toContain("\nDo the work\n");
  });
});
