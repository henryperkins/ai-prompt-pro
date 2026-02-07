import { useState } from "react";
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
import { X, Link, FileText, Type, Plus } from "lucide-react";
import type { ContextSource } from "@/lib/context-types";
import { summarizeSource } from "@/lib/context-types";

interface ContextSourceChipsProps {
  sources: ContextSource[];
  onAdd: (source: ContextSource) => void;
  onRemove: (id: string) => void;
}

type AddMode = "text" | "url" | null;

export function ContextSourceChips({ sources, onAdd, onRemove }: ContextSourceChipsProps) {
  const [mode, setMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAdd = () => {
    if (!content.trim()) return;
    const source: ContextSource = {
      id: Date.now().toString(),
      type: mode === "url" ? "url" : "text",
      title: title.trim() || (mode === "url" ? new URL(content).hostname : `Snippet ${sources.length + 1}`),
      rawContent: content.trim(),
      summary: summarizeSource(content.trim()),
      addedAt: Date.now(),
    };
    onAdd(source);
    setTitle("");
    setContent("");
    setMode(null);
    setDialogOpen(false);
  };

  const chipIcon = (type: ContextSource["type"]) => {
    if (type === "url") return <Link className="w-3 h-3" />;
    if (type === "file") return <FileText className="w-3 h-3" />;
    return <Type className="w-3 h-3" />;
  };

  return (
    <div className="space-y-3">
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
                  <Link className="w-5 h-5" />
                  <span className="text-xs">Paste URL / content</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <Input
                  placeholder={mode === "url" ? "https://example.com" : "Source title (optional)"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background"
                />
                <Textarea
                  placeholder={
                    mode === "url"
                      ? "Paste the key content from this URL..."
                      : "Paste your text, notes, or data here..."
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
          No sources yet. Add text snippets, URLs, or documents for richer context.
        </p>
      )}
    </div>
  );
}
