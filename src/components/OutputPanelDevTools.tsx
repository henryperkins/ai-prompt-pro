import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/base/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { trackBuilderEvent } from "@/lib/telemetry";

type CodexExportModule = typeof import("@/lib/codex-export");

async function loadCodexExport(): Promise<CodexExportModule> {
  return import("@/lib/codex-export");
}

interface OutputPanelDevToolsProps {
  displayPrompt: string;
  isMobile: boolean;
}

export function OutputPanelDevTools({ displayPrompt, isMobile }: OutputPanelDevToolsProps) {
  const { toast } = useToast();
  const disabled = !displayPrompt;

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyCodex = async (variant: "exec" | "tui" | "appServer") => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const command =
        variant === "exec"
          ? codexExport.generateCodexExecCommandBash(displayPrompt)
          : variant === "tui"
            ? codexExport.generateCodexTuiCommandBash(displayPrompt)
            : codexExport.generateCodexAppServerSendMessageV2CommandBash(displayPrompt);
      await copyTextToClipboard(command);
      toast({
        title: "Copied for Codex",
        description:
          variant === "exec"
            ? "Copied `codex exec` stdin command."
            : variant === "tui"
              ? "Copied `codex` TUI command."
              : "Copied app-server debug command.",
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "copy_codex",
        variant,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Codex command generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAgents = async (variant: "agents" | "override") => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const content =
        variant === "override"
          ? codexExport.generateAgentsOverrideMdFromPrompt(displayPrompt)
          : codexExport.generateAgentsMdFromPrompt(displayPrompt);
      const filename = variant === "override" ? "AGENTS.override.md" : "AGENTS.md";
      downloadTextFile(filename, content);
      toast({
        title: "Downloaded",
        description: `${filename} generated from the current output.`,
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "download_agents",
        variant,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "AGENTS file generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleCopyCodexSkillScaffold = async () => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const command = codexExport.generateCodexSkillScaffoldCommandBash(displayPrompt, {
        skillName: codexExport.CODEX_DEFAULT_SKILL_NAME,
      });
      await copyTextToClipboard(command);
      toast({
        title: "Copied for Codex",
        description: `Copied command to scaffold .agents/skills/${codexExport.CODEX_DEFAULT_SKILL_NAME}/SKILL.md.`,
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "copy_skill_scaffold",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Codex scaffold generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSkill = async () => {
    if (!displayPrompt) return;

    try {
      const codexExport = await loadCodexExport();
      const content = codexExport.generateSkillMdFromPrompt(displayPrompt, {
        skillName: codexExport.CODEX_DEFAULT_SKILL_NAME,
      });
      downloadTextFile("SKILL.md", content);
      toast({
        title: "Downloaded",
        description: `SKILL.md generated for skill name "${codexExport.CODEX_DEFAULT_SKILL_NAME}".`,
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "download_skill",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "SKILL.md generation is unavailable.",
        variant: "destructive",
      });
    }
  };

  const items = (
    <>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleCopyCodex("exec")}>
        Copy Codex exec command
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleCopyCodex("tui")}>
        Copy Codex TUI command
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleCopyCodex("appServer")}>
        Copy app server command
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleCopyCodexSkillScaffold()}>
        Copy skill scaffold
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleDownloadSkill()}>
        Download SKILL.md
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleDownloadAgents("agents")}>
        Download AGENTS.md
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={() => void handleDownloadAgents("override")}>
        Download AGENTS.override.md
      </DropdownMenuItem>
    </>
  );

  if (isMobile) {
    return (
      <>
        <DropdownMenuLabel>Developer tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items}
      </>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Developer tools</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {items}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
