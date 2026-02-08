import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { X, Link, FileText, Type, Plus, Upload, Loader2, Globe } from "lucide-react";
import type { ContextSource } from "@/lib/context-types";
import { summarizeSource } from "@/lib/context-types";
import { extractUrl } from "@/lib/ai-client";
import { toast } from "@/hooks/use-toast";

interface ContextSourceChipsProps {
  sources: ContextSource[];
  onAdd: (source: ContextSource) => void;
  onRemove: (id: string) => void;
}

type AddMode = "text" | "url" | null;

const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".log", ".yaml", ".yml"];
const MAX_FILE_SIZE = 500 * 1024; // 500KB

export function ContextSourceChips({ sources, onAdd, onRemove }: ContextSourceChipsProps) {
  const [mode, setMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleAdd = () => {
    if (!content.trim()) return;
    const source: ContextSource = {
      id: Date.now().toString(),
      type: mode === "url" ? "url" : "text",
      title: title.trim() || (mode === "url" ? (() => { try { return new URL(urlInput || content).hostname; } catch { return `Source ${sources.length + 1}`; } })() : `Snippet ${sources.length + 1}`),
      rawContent: content.trim(),
      summary: summarizeSource(content.trim()),
      addedAt: Date.now(),
    };
    onAdd(source);
    setTitle("");
    setContent("");
    setUrlInput("");
    setMode(null);
    setDialogOpen(false);
  };

  // --- Drag & Drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      files.forEach((file) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          toast({
            title: "Unsupported file type",
            description: `"${file.name}" is not supported. Use ${ALLOWED_EXTENSIONS.join(", ")}.`,
            variant: "destructive",
          });
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: `"${file.name}" exceeds the 500 KB limit.`,
            variant: "destructive",
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const source: ContextSource = {
            id: `${Date.now()}-${file.name}`,
            type: "file",
            title: file.name,
            rawContent: text,
            summary: summarizeSource(text),
            addedAt: Date.now(),
          };
          onAdd(source);
          toast({ title: "File added", description: `"${file.name}" added as context source.` });
        };
        reader.onerror = () => {
          toast({
            title: "Read error",
            description: `Could not read "${file.name}".`,
            variant: "destructive",
          });
        };
        reader.readAsText(file);
      });
    },
    [onAdd]
  );

  // --- URL Fetch ---
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetching(true);
    try {
      const result = await extractUrl(urlInput.trim());
      setTitle(result.title);
      setContent(result.content);
      toast({ title: "Content extracted", description: "Key points extracted from the URL." });
    } catch (err) {
      toast({
        title: "Extraction failed",
        description: err instanceof Error ? err.message : "Could not fetch or extract content. You can still paste content manually.",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const chipIcon = (type: ContextSource["type"]) => {
    if (type === "url") return <Link className="w-3 h-3" />;
    if (type === "file") return <FileText className="w-3 h-3" />;
    return <Type className="w-3 h-3" />;
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed transition-colors p-3 text-center ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
      >
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Upload className="w-3.5 h-3.5" />
          <span>Drop files here ({ALLOWED_EXTENSIONS.slice(0, 4).join(", ")}…)</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">Sources</label>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" />
              Add source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add source material</DialogTitle>
            </DialogHeader>

            {!mode ? (
              <div className="grid grid-cols-2 gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setMode("text")}
                >
                  <Type className="w-5 h-5" />
                  <span className="text-xs">Paste text</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setMode("url")}
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-xs">Fetch from URL</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                {mode === "url" && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="bg-background flex-1"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleFetchUrl}
                      disabled={!urlInput.trim() || isFetching}
                      className="shrink-0 gap-1.5"
                    >
                      {isFetching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      {isFetching ? "Fetching…" : "Fetch & Extract"}
                    </Button>
                  </div>
                )}
                <Input
                  placeholder={mode === "url" ? "Page title (auto-filled on fetch)" : "Source title (optional)"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background"
                />
                <Textarea
                  placeholder={
                    mode === "url"
                      ? "Extracted content will appear here, or paste manually…"
                      : "Paste your text, notes, or data here…"
                  }
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[120px] bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Long content will be auto-summarized into compact bullet points.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode(null);
                      setTitle("");
                      setContent("");
                      setUrlInput("");
                    }}
                  >
                    Back
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={!content.trim()}>
                    Add source
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <Badge
              key={source.id}
              variant="secondary"
              className="gap-1.5 pr-1 max-w-[200px] group cursor-default"
              title={`${source.title}\n${source.summary}`}
            >
              {chipIcon(source.type)}
              <span className="truncate text-xs">{source.title}</span>
              <button
                onClick={() => onRemove(source.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                aria-label={`Remove ${source.title}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {sources.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No sources yet. Add text snippets, fetch from URLs, or drop files for richer context.
        </p>
      )}
    </div>
  );
}
