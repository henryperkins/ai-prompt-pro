import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { cn } from "@/lib/utils";

export interface CodeSnippetProps {
  code: string;
  language: string;
  fileName?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export interface CodeSnippetTab {
  id: string;
  label: string;
  code: string;
  language: string;
  fileName?: string;
}

interface CodeSnippetTabsProps {
  tabs: CodeSnippetTab[];
  defaultTabId?: string;
}

export const CodeSnippet = ({
  code,
  language,
  fileName,
  showLineNumbers = true,
  className,
}: CodeSnippetProps) => {
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <BadgeWithDot tone="info" size="sm">
            {language.toUpperCase()}
          </BadgeWithDot>
          {fileName ? (
            <Badge tone="default" size="sm" className="truncate">
              {fileName}
            </Badge>
          ) : null}
        </div>
        <ButtonUtility
          icon={copied ? Check : Copy}
          tooltip={copied ? "Copied" : "Copy code"}
          onClick={handleCopy}
          color="tertiary"
          size="xs"
          aria-label={copied ? "Copied code" : "Copy code"}
        />
      </div>

      <pre className="overflow-x-auto p-3 sm:p-4">
        <code className="block font-mono text-xs text-foreground sm:text-sm">
          {lines.map((line, index) => (
            <span key={`${index}-${line}`} className={cn("grid min-h-[1.5rem]", showLineNumbers ? "grid-cols-[2rem_1fr]" : "grid-cols-1")}>
              {showLineNumbers ? (
                <span className="select-none pr-2 text-right text-muted-foreground tabular-nums">{index + 1}</span>
              ) : null}
              <span className="whitespace-pre break-normal">{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
};

export const CodeSnippetTabs = ({ tabs, defaultTabId }: CodeSnippetTabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultTabId ?? tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ButtonGroup value={active.id} onValueChange={(value) => value && setActiveTab(value)} aria-label="Snippet selection">
          {tabs.map((tab) => (
            <ButtonGroupItem key={tab.id} value={tab.id}>
              {tab.label}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>

        <ButtonGroup
          value={showLineNumbers ? "on" : "off"}
          onValueChange={(value) => setShowLineNumbers(value !== "off")}
          aria-label="Line number mode"
        >
          <ButtonGroupItem value="on">Line Numbers</ButtonGroupItem>
          <ButtonGroupItem value="off">Plain</ButtonGroupItem>
        </ButtonGroup>
      </div>

      <CodeSnippet
        code={active.code}
        language={active.language}
        fileName={active.fileName}
        showLineNumbers={showLineNumbers}
      />
    </div>
  );
};
