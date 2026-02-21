import { useState } from "react";
import { Badge } from "@/components/base/primitives/badge";
import { Button } from "@/components/base/primitives/button";
import { Input } from "@/components/base/primitives/input";
import { Label } from "@/components/base/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/primitives/select";
import { Switch } from "@/components/base/primitives/switch";
import type { DatabaseConnection, RagParameters } from "@/lib/context-types";
import { Database, Plus, X } from "lucide-react";

interface ContextIntegrationsProps {
  databaseConnections: DatabaseConnection[];
  rag: RagParameters;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
}

const PROVIDER_OPTIONS: DatabaseConnection["provider"][] = [
  "postgres",
  "mysql",
  "sqlite",
  "mongodb",
  "other",
];

export function ContextIntegrations({
  databaseConnections,
  rag,
  onUpdateDatabaseConnections,
  onUpdateRag,
}: ContextIntegrationsProps) {
  const [draft, setDraft] = useState<{
    label: string;
    provider: DatabaseConnection["provider"];
    connectionRef: string;
    database: string;
    schema: string;
    tables: string;
    readOnly: boolean;
  }>({
    label: "",
    provider: "postgres",
    connectionRef: "",
    database: "",
    schema: "",
    tables: "",
    readOnly: true,
  });

  const addDatabase = () => {
    if (!draft.connectionRef.trim() || !draft.database.trim()) return;
    const next: DatabaseConnection = {
      id: `db-${Date.now()}`,
      label: draft.label.trim() || draft.database.trim(),
      provider: draft.provider,
      connectionRef: draft.connectionRef.trim(),
      database: draft.database.trim(),
      schema: draft.schema.trim(),
      tables: draft.tables
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      readOnly: draft.readOnly,
      lastValidatedAt: Date.now(),
    };
    onUpdateDatabaseConnections([...databaseConnections, next]);
    setDraft({
      label: "",
      provider: draft.provider,
      connectionRef: "",
      database: "",
      schema: "",
      tables: "",
      readOnly: true,
    });
  };

  const removeDatabase = (id: string) => {
    onUpdateDatabaseConnections(databaseConnections.filter((db) => db.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground sm:text-base">Database connections</Label>
          <Badge variant="secondary" className="text-xs">
            {databaseConnections.length}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={draft.label}
            onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Label (optional)"
            className="h-11 sm:h-10"
          />
          <Select
            value={draft.provider}
            onValueChange={(provider: DatabaseConnection["provider"]) =>
              setDraft((prev) => ({ ...prev, provider }))
            }
          >
            <SelectTrigger className="h-11 bg-background sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((provider) => (
                <SelectItem key={provider} value={provider} className="capitalize">
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={draft.connectionRef}
            onChange={(e) => setDraft((prev) => ({ ...prev, connectionRef: e.target.value }))}
            placeholder="Connection ID (secret)"
            className="h-11 sm:h-10"
          />
          <Input
            value={draft.database}
            onChange={(e) => setDraft((prev) => ({ ...prev, database: e.target.value }))}
            placeholder="Database name"
            className="h-11 sm:h-10"
          />
          <Input
            value={draft.schema}
            onChange={(e) => setDraft((prev) => ({ ...prev, schema: e.target.value }))}
            placeholder="Schema (optional)"
            className="h-11 sm:h-10"
          />
          <Input
            value={draft.tables}
            onChange={(e) => setDraft((prev) => ({ ...prev, tables: e.target.value }))}
            placeholder="Tables (comma-separated, optional)"
            className="h-11 sm:h-10"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.readOnly}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, readOnly: value }))}
            />
            <Label className="text-sm text-muted-foreground sm:text-base">Read-only</Label>
          </div>
          <Button size="sm" className="h-11 gap-1.5 text-sm sm:h-9 sm:text-base" onClick={addDatabase}>
            <Plus className="w-3 h-3" />
            Add connection
          </Button>
        </div>

        {databaseConnections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {databaseConnections.map((db) => (
              <Badge key={db.id} variant="secondary" className="gap-1.5 text-xs">
                <Database className="w-3 h-3" />
                {db.label}
                <button
                  onClick={() => removeDatabase(db.id)}
                  className="rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                  aria-label={`Remove ${db.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground sm:text-base">Retrieval settings (RAG)</Label>
          <Switch
            checked={rag.enabled}
            onCheckedChange={(enabled) => onUpdateRag({ enabled })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={rag.vectorStoreRef}
            onChange={(e) => onUpdateRag({ vectorStoreRef: e.target.value })}
            placeholder="Vector store ID"
            className="h-11 sm:h-10"
            disabled={!rag.enabled}
          />
          <Input
            value={rag.namespace}
            onChange={(e) => onUpdateRag({ namespace: e.target.value })}
            placeholder="Namespace"
            className="h-11 sm:h-10"
            disabled={!rag.enabled}
          />
          <Select
            value={rag.retrievalStrategy}
            onValueChange={(retrievalStrategy: RagParameters["retrievalStrategy"]) =>
              onUpdateRag({ retrievalStrategy })
            }
            disabled={!rag.enabled}
          >
            <SelectTrigger className="h-11 bg-background sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid">
                Hybrid
              </SelectItem>
              <SelectItem value="semantic">
                Semantic
              </SelectItem>
              <SelectItem value="keyword">
                Keyword
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={String(rag.topK)}
            onChange={(e) => onUpdateRag({ topK: Number(e.target.value) || 0 })}
            placeholder="Top results (topK)"
            className="h-11 sm:h-10"
            disabled={!rag.enabled}
          />
          <Input
            value={String(rag.minScore)}
            onChange={(e) => onUpdateRag({ minScore: Number(e.target.value) || 0 })}
            placeholder="Minimum score (0-1)"
            className="h-11 sm:h-10"
            disabled={!rag.enabled}
          />
          <Input
            value={String(rag.chunkWindow)}
            onChange={(e) => onUpdateRag({ chunkWindow: Number(e.target.value) || 0 })}
            placeholder="Context window (chunks)"
            className="h-11 sm:h-10"
            disabled={!rag.enabled}
          />
        </div>
        <Input
          value={rag.documentRefs.join(", ")}
          onChange={(e) =>
            onUpdateRag({
              documentRefs: e.target.value
                .split(",")
                .map((ref) => ref.trim())
                .filter(Boolean),
            })
          }
          placeholder="Document IDs (comma-separated)"
          className="h-11 sm:h-10"
          disabled={!rag.enabled}
        />
      </div>
    </div>
  );
}
