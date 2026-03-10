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
import {
  getTelemetryLog,
  trackBuilderEvent,
  type BuilderTelemetryEnvelope,
} from "@/lib/telemetry";

type CodexExportModule = typeof import("@/lib/codex-export");

const ENHANCE_DIAGNOSTIC_EVENTS = new Set<string>([
  "builder_enhance_clicked",
  "builder_enhance_metadata_received",
  "builder_enhance_completed",
  "builder_enhance_variant_applied",
  "builder_enhance_accepted",
  "builder_enhance_rerun",
  "builder_enhance_too_much_changed",
] as const);

function buildLatestEnhanceSessionSummary(
  telemetryLog: BuilderTelemetryEnvelope[],
) {
  const relevantEvents = telemetryLog.filter((entry) =>
    ENHANCE_DIAGNOSTIC_EVENTS.has(entry.event),
  );
  if (relevantEvents.length === 0) return null;

  let lastEnhanceStartIndex = -1;
  for (let index = relevantEvents.length - 1; index >= 0; index -= 1) {
    if (relevantEvents[index].event === "builder_enhance_clicked") {
      lastEnhanceStartIndex = index;
      break;
    }
  }

  const sessionEvents =
    lastEnhanceStartIndex >= 0
      ? relevantEvents.slice(lastEnhanceStartIndex)
      : [relevantEvents[relevantEvents.length - 1]];
  const latestByEvent = new Map<
    BuilderTelemetryEnvelope["event"],
    BuilderTelemetryEnvelope
  >();

  for (const entry of sessionEvents) {
    latestByEvent.set(entry.event, entry);
  }

  return {
    startedAt: sessionEvents[0]?.timestamp ?? null,
    latestEventAt: sessionEvents[sessionEvents.length - 1]?.timestamp ?? null,
    eventCount: sessionEvents.length,
    events: sessionEvents.map((entry) => entry.event),
    clicked: latestByEvent.get("builder_enhance_clicked")?.payload ?? null,
    metadata:
      latestByEvent.get("builder_enhance_metadata_received")?.payload ?? null,
    completed:
      latestByEvent.get("builder_enhance_completed")?.payload ?? null,
    variantApplied:
      latestByEvent.get("builder_enhance_variant_applied")?.payload ?? null,
    accepted: latestByEvent.get("builder_enhance_accepted")?.payload ?? null,
    rerun: latestByEvent.get("builder_enhance_rerun")?.payload ?? null,
    tooMuchChanged:
      latestByEvent.get("builder_enhance_too_much_changed")?.payload ?? null,
  };
}

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
  const telemetryLog = getTelemetryLog();
  const latestEnhanceSessionSummary =
    buildLatestEnhanceSessionSummary(telemetryLog);
  const telemetryDisabledReason =
    "No telemetry has been captured yet. Run a builder or enhancement action first.";
  const summaryDisabledReason =
    "No enhancement session telemetry has been captured yet.";

  const downloadTextFile = (
    filename: string,
    content: string,
    mimeType = "text/markdown;charset=utf-8",
  ) => {
    const blob = new Blob([content], { type: mimeType });
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

  const handleCopyTelemetryLog = async () => {
    if (telemetryLog.length === 0) return;

    try {
      await copyTextToClipboard(JSON.stringify(telemetryLog, null, 2));
      toast({
        title: "Telemetry copied",
        description: "Copied the builder telemetry log as JSON.",
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "copy_telemetry_log",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description:
          error instanceof Error
            ? error.message
            : "Telemetry export is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTelemetryLog = () => {
    if (telemetryLog.length === 0) return;

    try {
      downloadTextFile(
        "promptforge-telemetry-log.json",
        JSON.stringify(telemetryLog, null, 2),
        "application/json;charset=utf-8",
      );
      toast({
        title: "Telemetry downloaded",
        description: "Saved the builder telemetry log as JSON.",
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "download_telemetry_log",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description:
          error instanceof Error
            ? error.message
            : "Telemetry export is unavailable.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLatestEnhanceSessionSummary = async () => {
    if (!latestEnhanceSessionSummary) return;

    try {
      await copyTextToClipboard(
        JSON.stringify(latestEnhanceSessionSummary, null, 2),
      );
      toast({
        title: "Summary copied",
        description:
          "Copied the latest enhancement session summary as JSON.",
      });
      trackBuilderEvent("builder_dev_export_used", {
        action: "copy_enhance_summary",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description:
          error instanceof Error
            ? error.message
            : "Enhancement summary export is unavailable.",
        variant: "destructive",
      });
    }
  };

  const items = (
    <>
      <DropdownMenuLabel>Codex exports</DropdownMenuLabel>
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

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Enhancement diagnostics</DropdownMenuLabel>
      <DropdownMenuItem
        disabled={telemetryLog.length === 0}
        title={telemetryLog.length === 0 ? telemetryDisabledReason : undefined}
        onSelect={() => void handleCopyTelemetryLog()}
      >
        Copy telemetry log (JSON)
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={telemetryLog.length === 0}
        title={telemetryLog.length === 0 ? telemetryDisabledReason : undefined}
        onSelect={handleDownloadTelemetryLog}
      >
        Download telemetry log
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!latestEnhanceSessionSummary}
        title={
          latestEnhanceSessionSummary ? undefined : summaryDisabledReason
        }
        onSelect={() => void handleCopyLatestEnhanceSessionSummary()}
      >
        Copy latest enhance session summary
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
